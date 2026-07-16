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

const GEMINI_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

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
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
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
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('[llm] Ollama error', res.status, body.slice(0, 300));
        throw new Error(`Ollama responded ${res.status}`);
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

async function geminiChat(messages, tools) {
    if (!GEMINI_KEY) throw new Error('GEMINI_API_KEY is not set');
    const res = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GEMINI_KEY}` },
        body: JSON.stringify({
            model: GEMINI_MODEL,
            messages: toOpenAiMessages(messages),
            ...(tools ? { tools } : {}),
            temperature: TEMPERATURE,
        }),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('[llm] Gemini error', res.status, body.slice(0, 300));
        throw new Error(`Gemini responded ${res.status}`);
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
