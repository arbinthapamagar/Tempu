// Provider-agnostic chat layer for the agentic assistant. Switch between a
// local Ollama model and Google's Gemini API with the AI_PROVIDER env var
// ('gemini' | 'ollama'). Both providers accept the SAME neutral message list
// and return the SAME normalized shape, so the orchestration loop in
// agenticAgent.js never has to know which one is running.
//
// Neutral message shapes the caller builds:
//   { role: 'system'|'user', content }
//   { role: 'assistant', content, toolCalls?: [{ id, name, args }] }
//   { role: 'tool', toolCallId, name, content }
//
// Tools are OpenAI/Ollama-style function definitions ({ type, function: {...} }),
// which both Ollama and Gemini's OpenAI-compatible endpoint accept as-is.

export const AI_PROVIDER = (process.env.AI_PROVIDER || 'ollama').toLowerCase();

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');
const OLLAMA_MODEL = process.env.AGENTIC_CHAT_MODEL || process.env.RAG_CHAT_MODEL || 'llama3.1:8b';

// One or more Gemini API keys. GEMINI_API_KEY is the main one; add extras in
// GEMINI_API_KEYS (comma-separated). Each key has its own per-model daily quota,
// so when every model on the current key is exhausted we roll to the next key.
const GEMINI_KEYS = [...new Set(
    [process.env.GEMINI_API_KEY, ...(process.env.GEMINI_API_KEYS || '').split(',')]
        .map((s) => (s || '').trim())
        .filter(Boolean)
)];
let activeKeyIdx = 0; // remember the last key that worked
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

// Gemini free-tier quota is counted PER MODEL PER DAY, so when the active model
// returns 429 (or 404 = unavailable) we transparently fail over to the next
// model — each has its own daily bucket. Order: the configured primary first,
// then a sane default chain. Override with GEMINI_FALLBACK_MODELS (comma-sep).
const GEMINI_FALLBACKS = (
    process.env.GEMINI_FALLBACK_MODELS ||
    'gemini-flash-lite-latest,gemini-3-flash-preview,gemini-flash-latest,gemini-2.0-flash,gemini-2.0-flash-lite'
).split(',').map((s) => s.trim()).filter(Boolean);
const GEMINI_MODELS = [...new Set([GEMINI_MODEL, ...GEMINI_FALLBACKS])];
// Remember the last model that worked so we start there next time instead of
// re-hitting an already-exhausted model on every request.
let activeGeminiIdx = 0;

const TEMPERATURE = Number(process.env.AGENTIC_TEMPERATURE) || 0.15;

// Ollama keep_alive accepts a duration string ("30m") OR a number of seconds
// (-1 = forever); a bare numeric string is rejected, so coerce numerics.
const rawKeepAlive = process.env.OLLAMA_KEEP_ALIVE || '30m';
const KEEP_ALIVE = /^-?\d+$/.test(rawKeepAlive.trim()) ? Number(rawKeepAlive) : rawKeepAlive;

const safeParse = (s) => {
    if (s == null) return {};
    if (typeof s === 'object') return s;
    try { return JSON.parse(s); } catch { return {}; }
};

// Build an Error carrying the provider + HTTP status so callers can turn it into
// a clear, user-facing message (e.g. "Gemini quota used up") instead of a
// generic 500.
function providerError(provider, status, body) {
    const err = new Error(`${provider} responded ${status}`);
    err.provider = provider;
    err.status = status;
    err.body = (body || '').slice(0, 300);
    return err;
}

// A human-readable explanation for an AI provider failure, shown to the admin
// AND stored in the API log. Covers the common cases explicitly.
export function friendlyAiError(err) {
    const provider = err?.provider || AI_PROVIDER;
    // Network-level failure (server not running / unreachable).
    if (err?.connection) {
        return provider === 'gemini'
            ? '⚠️ Could not reach the Gemini API — check the network connection.'
            : "⚠️ The local AI (Ollama) isn't running. Start it with `ollama serve`, or switch `AI_PROVIDER=gemini` in the backend `.env`.";
    }
    if (provider === 'gemini') {
        if (err?.status === 429) {
            return '⚠️ The Gemini AI quota has been used up for now. Enable billing on the Gemini API key (free-tier limits reset daily), or switch `AI_PROVIDER=ollama` to use the local model. I can’t answer until then.';
        }
        if (err?.status === 401 || err?.status === 403) {
            return '⚠️ The Gemini API key was rejected (invalid or unauthorized). Check `GEMINI_API_KEY` in the backend `.env`.';
        }
        return `⚠️ The Gemini AI request failed (status ${err?.status || '?'}). Try again shortly, or switch \`AI_PROVIDER=ollama\`.`;
    }
    return `⚠️ The local AI (Ollama) request failed (status ${err?.status || '?'}). Make sure the model is pulled and Ollama has enough memory.`;
}

// ── Ollama ──────────────────────────────────────────────────────────────────
function toOllamaMessages(messages) {
    return messages.map((m) => {
        if (m.role === 'assistant') {
            const out = { role: 'assistant', content: m.content || '' };
            if (m.toolCalls?.length) {
                out.tool_calls = m.toolCalls.map((tc) => ({ function: { name: tc.name, arguments: tc.args || {} } }));
            }
            return out;
        }
        if (m.role === 'tool') return { role: 'tool', content: m.content };
        return { role: m.role, content: m.content };
    });
}

async function ollamaChat(messages, tools) {
    let res;
    try {
        res = await fetch(`${OLLAMA_URL}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: OLLAMA_MODEL,
                messages: toOllamaMessages(messages),
                ...(tools ? { tools } : {}),
                stream: false,
                options: { temperature: TEMPERATURE, top_p: 0.9, num_ctx: Number(process.env.AGENTIC_NUM_CTX) || 8192 },
                keep_alive: KEEP_ALIVE,
            }),
        });
    } catch (e) {
        const err = providerError('ollama', 0, e.message);
        err.connection = true;
        console.error('[llm] Ollama unreachable', e.message);
        throw err;
    }
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('[llm] Ollama error', res.status, body.slice(0, 300));
        throw providerError('ollama', res.status, body);
    }
    const msg = (await res.json()).message || {};
    return {
        content: msg.content || '',
        toolCalls: (msg.tool_calls || []).map((tc, i) => ({
            id: tc.id || `call_${i}`,
            name: tc.function?.name,
            args: tc.function?.arguments || {},
        })),
    };
}

// ── Gemini (OpenAI-compatible endpoint) ──────────────────────────────────────
function toOpenAiMessages(messages) {
    return messages.map((m) => {
        if (m.role === 'assistant') {
            const out = { role: 'assistant', content: m.content || null };
            if (m.toolCalls?.length) {
                out.tool_calls = m.toolCalls.map((tc) => ({
                    id: tc.id,
                    type: 'function',
                    function: { name: tc.name, arguments: JSON.stringify(tc.args || {}) },
                    // Gemini 3.x requires the thought_signature it returned with a
                    // function call to be echoed back on the follow-up turn.
                    ...(tc.extra ? { extra_content: tc.extra } : {}),
                }));
            }
            return out;
        }
        if (m.role === 'tool') return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
        return { role: m.role, content: m.content };
    });
}

// One raw call to a specific Gemini key + model.
async function geminiCall(key, model, openAiMessages, tools) {
    let res;
    try {
        res = await fetch(GEMINI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
            body: JSON.stringify({
                model,
                messages: openAiMessages,
                ...(tools ? { tools } : {}),
                temperature: TEMPERATURE,
            }),
        });
    } catch (e) {
        const err = providerError('gemini', 0, e.message);
        err.connection = true;
        throw err;
    }
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw providerError('gemini', res.status, body);
    }
    const msg = (await res.json()).choices?.[0]?.message || {};
    return {
        content: msg.content || '',
        toolCalls: (msg.tool_calls || []).map((tc, i) => ({
            id: tc.id || `call_${i}`,
            name: tc.function?.name,
            args: safeParse(tc.function?.arguments),
            extra: tc.extra_content, // thought_signature etc., replayed on next turn
        })),
    };
}

async function geminiChat(messages, tools) {
    if (!GEMINI_KEYS.length) throw providerError('gemini', 401, 'GEMINI_API_KEY is not set');
    const openAiMessages = toOpenAiMessages(messages);
    let lastErr;
    // Two-level rotation, starting from the last known-good key + model:
    //   for each KEY → try each MODEL. A 429/404 rolls to the next model; once a
    //   key's whole model chain is exhausted (or the key is rejected) roll to the
    //   next key (fresh per-model daily quota). Only network/malformed errors abort.
    for (let k = 0; k < GEMINI_KEYS.length; k++) {
        const keyIdx = (activeKeyIdx + k) % GEMINI_KEYS.length;
        const key = GEMINI_KEYS[keyIdx];
        let keyRejected = false;
        for (let m = 0; m < GEMINI_MODELS.length; m++) {
            const modelIdx = (activeGeminiIdx + m) % GEMINI_MODELS.length;
            const model = GEMINI_MODELS[modelIdx];
            try {
                const result = await geminiCall(key, model, openAiMessages, tools);
                if (keyIdx !== activeKeyIdx || modelIdx !== activeGeminiIdx) {
                    console.warn(`[llm] Gemini now using key #${keyIdx + 1} / "${model}"`);
                    activeKeyIdx = keyIdx;
                    activeGeminiIdx = modelIdx;
                }
                return result;
            } catch (err) {
                if (err.connection) throw err; // network down — rotating won't help
                if (err.status === 401 || err.status === 403) {
                    // Key invalid/expired — no point trying more models on it; next key.
                    console.warn(`[llm] Gemini key #${keyIdx + 1} rejected (${err.status}), trying next key`);
                    lastErr = err;
                    keyRejected = true;
                    break;
                }
                if (err.status === 429 || err.status === 404) {
                    console.warn(`[llm] Gemini key #${keyIdx + 1} "${model}" → ${err.status}, failing over`);
                    lastErr = err;
                    continue; // next model on this key
                }
                console.error('[llm] Gemini error', err.status, err.body);
                throw err; // 400 etc. — a request bug, not a quota/key issue
            }
        }
        if (keyRejected) continue; // move to next key
    }
    // Every key × model combination is exhausted / rejected.
    console.error('[llm] all Gemini keys + models exhausted');
    throw lastErr || providerError('gemini', 429, 'all Gemini keys/models exhausted');
}

// ── Public API ────────────────────────────────────────────────────────────────
// One chat turn with tools available. Returns { content, toolCalls: [{id,name,args}] }.
export async function chatWithTools(messages, tools) {
    return AI_PROVIDER === 'gemini' ? geminiChat(messages, tools) : ollamaChat(messages, tools);
}

// One chat turn with NO tools (forces a natural-language answer). Returns { content }.
export async function chatPlain(messages) {
    const { content } = AI_PROVIDER === 'gemini' ? await geminiChat(messages, null) : await ollamaChat(messages, null);
    return { content };
}
