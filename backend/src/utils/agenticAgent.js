// Agentic AI orchestration — a tool-calling loop over Ollama (llama3.1:8b),
// restricted to the whitelisted read-only data tools in agenticTools.js. The
// model can only ever call those named functions; it never sees or writes raw
// database queries.
import { TOOLS, HANDLERS } from './agenticTools.js';

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');
const MODEL = process.env.AGENTIC_CHAT_MODEL || process.env.RAG_CHAT_MODEL || 'llama3.1:8b';
const MAX_STEPS = 4; // hard cap on tool-call round-trips per question

const SYSTEM_PROMPT =
    'You are Ultron, the Tempu admin data assistant. Admins ask you questions about ' +
    'live app data (users, drivers, trips, payments, withdrawals, subscriptions, ' +
    'support tickets, platform stats). Use the provided tools to look up real data ' +
    '— never guess or invent names, numbers, phone numbers, or ratings. If a tool ' +
    'finds nothing, say so plainly. Keep answers concise and factual, and include ' +
    'the specific details the admin asked for (name, phone, rating, etc.) when the ' +
    'tools return them.\n\n' +
    'For greetings, small talk, thanks, or anything that is NOT a specific data ' +
    'question (e.g. "hi", "thanks", "who are you", "what can you do") — respond ' +
    'warmly and briefly in plain conversation. Do NOT call a tool just because one ' +
    'is available; only call a tool when the admin is actually asking about real ' +
    'data. If you are unsure what to look up, ask a short clarifying question in ' +
    'plain English — never guess by calling a tool anyway.\n\n' +
    'Your reply is shown to the admin AS-IS. NEVER write JSON, curly braces, or ' +
    'anything that looks like a function/tool call in your reply — the tool ' +
    'mechanism is separate and automatic. If there is nothing to look up, just say ' +
    'so in one plain sentence.';

async function ollamaChat(messages) {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, messages, tools: TOOLS, stream: false }),
    });
    if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
    const data = await res.json();
    return data.message || {};
}

async function runTool(call) {
    const name = call.function?.name;
    const args = call.function?.arguments || {};
    const handler = HANDLERS[name];
    if (!handler) return { name, args, result: { error: `Unknown tool: ${name}` } };
    try {
        return { name, args, result: await handler(args) };
    } catch (e) {
        return { name, args, result: { error: e.message } };
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
    for (let step = 0; step < MAX_STEPS; step++) {
        const reply = await ollamaChat(messages);

        if (reply.tool_calls?.length) {
            messages.push({ role: 'assistant', content: reply.content || '', tool_calls: reply.tool_calls });
            for (const call of reply.tool_calls) {
                const { name, args, result } = await runTool(call);
                toolCalls.push({ name, args });
                messages.push({ role: 'tool', content: JSON.stringify(result) });
            }
            continue;
        }

        const leaked = parseLeakedToolCall(reply.content);
        if (leaked) {
            const { result } = await runTool({ function: { name: leaked.name, arguments: leaked.args } });
            toolCalls.push({ name: leaked.name, args: leaked.args });
            messages.push({ role: 'assistant', content: '' });
            messages.push({ role: 'tool', content: JSON.stringify(result) });
            continue;
        }

        // Content has a JSON "tool call" shape but names a tool that doesn't
        // exist (hallucinated) — still never show that raw text as an answer.
        const hasUnresolvedToolAttempt = extractJsonObjects(reply.content || '').some((b) => /"name"\s*:\s*"/.test(b));
        if (hasUnresolvedToolAttempt) {
            return {
                reply: "I don't have a way to look that up yet — could you rephrase your question?",
                toolCalls,
            };
        }

        return { reply: reply.content || 'Sorry, I could not generate a response.', toolCalls };
    }
    return {
        reply: "I looked into a few things but couldn't finish — could you rephrase or narrow the question?",
        toolCalls,
    };
}
