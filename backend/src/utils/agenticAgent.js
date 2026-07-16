// Agentic AI orchestration — a tool-calling loop restricted to the whitelisted
// read-only data tools in agenticTools.js. The model can only ever call those
// named functions; it never sees or writes raw database queries. The underlying
// model is provider-agnostic (Gemini or local Ollama) via ./llm.js — set with
// the AI_PROVIDER env var.
import { TOOLS, HANDLERS } from './agenticTools.js';
import { chatWithTools, chatPlain, friendlyAiError } from './llm.js';

// Enough round-trips for real multi-step questions (e.g. list tickets → open the
// detail of each → summarise) without letting a confused model loop forever.
const MAX_STEPS = 8;

const SYSTEM_PROMPT =
    'You are **Tempu Ai**, the data assistant inside the Tempu admin panel (Tempu is a ' +
    'women-first ride-sharing platform in Nepal). You answer questions about live app data ' +
    '— riders, drivers, trips, payments, withdrawals, subscriptions, suppliers, support ' +
    'tickets, emergencies, and platform stats.\n\n' +

    `Today is ${new Date().toISOString().slice(0, 10)}.\n\n` +

    '## Tone — professional & brief\n' +
    '- Always address the user as **"boss"** (e.g. "0 unanswered tickets, boss.").\n' +
    '- Be professional, crisp, and to the point. Answer ONLY what was asked — no preamble, ' +
    'no filler, no unsolicited menus or lists of what you can do. Do not waste words.\n' +
    '- Prefer one or two tight sentences. Use a Markdown table or bullets ONLY when listing ' +
    'multiple records; otherwise plain short prose. Bold the key number or name.\n\n' +

    '## Getting the data right\n' +
    '- For any data question, ALWAYS use the tools. Never guess or invent names, phone ' +
    'numbers, ratings, counts, or amounts — every fact must come from a tool result. If a ' +
    'tool returns nothing / found:false, say so plainly.\n' +
    '- Chain tools when needed (e.g. list tickets, then open the ones that matter), but stop ' +
    'as soon as you can answer. Use a tool’s exact `count` for "how many".\n' +
    '- Do NOT add filters the boss did not ask for — omit optional args (e.g. status) unless ' +
    'they named one.\n' +
    '- Be direct; don’t hedge or refuse something you have a tool for. Ask a short clarifying ' +
    'question only if genuinely ambiguous.\n\n' +

    '## Greetings & identity\n' +
    '- For "hi"/"who are you"/"what can you do"/"who built you", reply in ONE short ' +
    'professional line as Tempu Ai, the Tempu admin data assistant — then ask what the boss ' +
    'needs. Do NOT dump a capabilities menu or call any tool.\n\n' +

    '## Absolute rule\n' +
    'Your reply is shown to the boss exactly as written. NEVER output JSON, curly braces, or ' +
    'anything resembling a function/tool call — the tool mechanism is separate and automatic. ' +
    'Write only natural, human-readable Markdown prose.';

async function runTool(name, args = {}) {
    const handler = HANDLERS[name];
    if (!handler) return { error: `Unknown tool: ${name}` };
    try {
        return await handler(args);
    } catch (e) {
        return { error: e.message };
    }
}

// Scan text for top-level {...} blocks using brace-depth counting, so a JSON
// object embedded mid-sentence (with nested objects inside it) is still
// extracted correctly — a plain regex can't handle the nested braces in e.g.
// {"name":"x","parameters":{}}.
function extractJsonObjects(text) {
    const blocks = [];
    let depth = 0;
    let start = -1;
    for (let i = 0; i < text.length; i++) {
        if (text[i] === '{') {
            if (depth === 0) start = i;
            depth++;
        } else if (text[i] === '}') {
            depth = Math.max(0, depth - 1);
            if (depth === 0 && start !== -1) {
                blocks.push(text.slice(start, i + 1));
                start = -1;
            }
        }
    }
    return blocks;
}

// The 8B model occasionally "leaks" a tool call as plain text JSON (e.g.
// {"name":"platform_stats","parameters":{}}) instead of using the proper
// tool_calls mechanism — sometimes standalone, sometimes wrapped inside an
// explanatory sentence ("...I'll provide a generic response: {...}"). Scan the
// WHOLE reply for any embedded JSON object naming a real tool, and either
// actually run it (self-heal) or drop it — raw JSON must never reach the
// admin as if it were a real answer.
function parseLeakedToolCall(content) {
    if (!content) return null;
    for (const block of extractJsonObjects(content)) {
        if (!/"name"\s*:\s*"/.test(block)) continue;
        try {
            const parsed = JSON.parse(block);
            if (parsed?.name && HANDLERS[parsed.name]) {
                return { name: parsed.name, args: parsed.parameters || parsed.arguments || {} };
            }
        } catch {
            // Not valid JSON - try the next candidate block.
        }
    }
    return null;
}

// history: [{ role: 'user'|'model', text }] — same shape the RAG chat uses.
// Returns { reply, toolCalls: [{name, args}] }.
export async function runAgenticChat(message, history = []) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(history || []).slice(-8).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text,
        })),
        { role: 'user', content: message },
    ];

    const toolCalls = [];
    try {
        for (let step = 0; step < MAX_STEPS; step++) {
            const reply = await chatWithTools(messages, TOOLS);

            if (reply.toolCalls?.length) {
                messages.push({ role: 'assistant', content: reply.content || '', toolCalls: reply.toolCalls });
                for (const call of reply.toolCalls) {
                    const result = await runTool(call.name, call.args);
                    toolCalls.push({ name: call.name, args: call.args });
                    messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify(result) });
                }
                continue;
            }

            // Some models "leak" a tool call as plain-text JSON instead of using the
            // tool mechanism. Detect it and self-heal by actually running the tool.
            const leaked = parseLeakedToolCall(reply.content);
            if (leaked) {
                const result = await runTool(leaked.name, leaked.args);
                const id = `leak_${toolCalls.length}`;
                toolCalls.push({ name: leaked.name, args: leaked.args });
                messages.push({ role: 'assistant', content: '', toolCalls: [{ id, name: leaked.name, args: leaked.args }] });
                messages.push({ role: 'tool', toolCallId: id, name: leaked.name, content: JSON.stringify(result) });
                continue;
            }

            // Content has a JSON "tool call" shape but names a tool that doesn't
            // exist (hallucinated). Never show that raw text — but if we already have
            // real tool data, summarise it instead of bailing.
            const hasUnresolvedToolAttempt = extractJsonObjects(reply.content || '').some((b) => /"name"\s*:\s*"/.test(b));
            if (hasUnresolvedToolAttempt) {
                if (toolCalls.length) return { reply: await finalizeAnswer(messages), toolCalls };
                return {
                    reply: "I don't have a way to look that up yet — could you rephrase your question?",
                    toolCalls,
                };
            }

            return { reply: reply.content || 'Sorry, I could not generate a response.', toolCalls };
        }
        // Hit the step cap. We almost certainly have tool data by now — force one
        // final tool-free pass so the admin gets an answer built from it, not a
        // "couldn't finish" apology.
        return { reply: await finalizeAnswer(messages), toolCalls };
    } catch (err) {
        // The AI provider failed (Gemini quota used up, key rejected, Ollama not
        // running, …). Return a clear, human-readable reply as a normal response
        // — the admin sees exactly what went wrong, and the API logger records it
        // like any other reply instead of it vanishing into a 500.
        return { reply: friendlyAiError(err), toolCalls, error: true };
    }
}

// One last generation with NO tools available, so the model is forced to write
// a natural-language answer from the tool results already in the conversation.
async function finalizeAnswer(messages) {
    let content = '';
    try {
        ({ content } = await chatPlain([
            ...messages,
            {
                role: 'system',
                content:
                    'Now write the final answer for the admin using ONLY the data already ' +
                    'gathered above. Do not call tools. Reply in warm, skimmable Markdown ' +
                    'prose — no JSON or curly braces.',
            },
        ]));
    } catch (err) {
        // Surface the real provider problem (quota, unreachable) so the admin
        // isn't left with a vague apology after we already fetched the data.
        return friendlyAiError(err);
    }
    // Strip any stray leaked JSON so raw tool-call text never reaches the admin.
    if (extractJsonObjects(content || '').some((b) => /"name"\s*:\s*"/.test(b))) {
        return 'I gathered the data but had trouble writing it up — could you ask that again?';
    }
    return content || 'Sorry, I could not generate a response.';
}
