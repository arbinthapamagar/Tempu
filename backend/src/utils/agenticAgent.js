// Agentic AI orchestration — a tool-calling loop over Ollama (llama3.1:8b),
// restricted to the whitelisted read-only data tools in agenticTools.js. The
// model can only ever call those named functions; it never sees or writes raw
// database queries.
import { TOOLS, HANDLERS } from './agenticTools.js';

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');
const MODEL = process.env.AGENTIC_CHAT_MODEL || process.env.RAG_CHAT_MODEL || 'llama3.1:8b';
const MAX_STEPS = 4; // hard cap on tool-call round-trips per question

const SYSTEM_PROMPT =
    'You are the Tempu admin data assistant. Admins ask you questions about live ' +
    'app data (users, drivers, trips, payments, withdrawals, subscriptions, support ' +
    'tickets, platform stats). Use the provided tools to look up real data — never ' +
    'guess or invent names, numbers, phone numbers, or ratings. If a tool finds ' +
    'nothing, say so plainly. Keep answers concise and factual, and include the ' +
    'specific details the admin asked for (name, phone, rating, etc.) when the ' +
    'tools return them.';

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
        if (!reply.tool_calls?.length) {
            return { reply: reply.content || 'Sorry, I could not generate a response.', toolCalls };
        }
        messages.push({ role: 'assistant', content: reply.content || '', tool_calls: reply.tool_calls });
        for (const call of reply.tool_calls) {
            const { name, args, result } = await runTool(call);
            toolCalls.push({ name, args });
            messages.push({ role: 'tool', content: JSON.stringify(result) });
        }
    }
    return {
        reply: "I looked into a few things but couldn't finish — could you rephrase or narrow the question?",
        toolCalls,
    };
}
