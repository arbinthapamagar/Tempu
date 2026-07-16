// Agentic AI orchestration — a tool-calling loop over Ollama (llama3.1:8b),
// restricted to the whitelisted read-only data tools in agenticTools.js. The
// model can only ever call those named functions; it never sees or writes raw
// database queries.
import { TOOLS, HANDLERS } from './agenticTools.js';

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');
const MODEL = process.env.AGENTIC_CHAT_MODEL || process.env.RAG_CHAT_MODEL || 'llama3.1:8b';
// Enough round-trips for real multi-step questions (e.g. list tickets → open the
// detail of each → summarise) without letting a confused model loop forever.
const MAX_STEPS = 8;

// What Tempu Ai can actually do, in plain admin language — surfaced in greetings
// / "what can you do" answers and to keep the model grounded in its real tools.
const CAPABILITIES = [
    '**People** — look up any rider or driver by name/phone/email/plate (profile, rating, wallet, rides, earnings, account status), and rank best/worst-rated users or drivers.',
    '**Trips** — recent trips across the platform or for one person, plus the bids and in-app call logs on a specific trip.',
    '**Money** — a user’s payment transactions, a driver’s withdrawal (cashout) requests, and the live fare/pricing config (commission, VAT, base fares, time-slot multipliers).',
    '**Support** — list open / in-progress / unanswered tickets platform-wide with exact counts, and open the full conversation thread of any ticket (who said what, the assigned agent, the rating).',
    '**Growth** — subscriptions per user and the vehicle suppliers (verified status, city, contact).',
    '**Safety** — active SOS / emergency alerts.',
    '**Operations** — overall platform stats, admin/staff accounts, driver verification documents, and a user’s notifications.',
];

const SYSTEM_PROMPT =
    'You are **Tempu Ai**, the data assistant inside the Tempu admin panel. Tempu is a ' +
    'women-first ride-sharing platform in Nepal. You help admins get real answers about ' +
    'live app data — riders, drivers, trips, payments, withdrawals, subscriptions, ' +
    'suppliers, support tickets, emergencies, and platform stats.\n\n' +

    `Today is ${new Date().toISOString().slice(0, 10)}.\n\n` +

    '## How to answer\n' +
    '- For a real data question, ALWAYS use the tools to fetch live data. Never guess or ' +
    'invent names, phone numbers, ratings, counts, or amounts — every fact you state must ' +
    'come from a tool result. If a tool returns nothing / found:false, say so plainly.\n' +
    '- Be thorough. Call as many tools as the question needs, and CHAIN them: if the admin ' +
    'asks what tickets are about, first list them, then open the details that matter. Don’t ' +
    'stop with half an answer when one more tool call would complete it.\n' +
    '- When a tool returns a `count`, use that exact number for "how many" questions.\n' +
    '- Do NOT add optional filters the admin did not ask for. If they say "our support ' +
    'tickets" with no status, omit the status argument so you get ALL of them; only filter ' +
    'by status/category when they explicitly name one.\n' +
    '- Be confident and direct — do not hedge or refuse a question you have a tool for. ' +
    'Only ask a short clarifying question if the request is genuinely ambiguous (e.g. a name ' +
    'that could match many people); otherwise just look it up.\n\n' +

    '## Formatting (your reply is rendered as Markdown)\n' +
    '- Open with a one-line direct answer, then the supporting detail.\n' +
    '- Use short **bold labels**, bullet lists, and Markdown tables when showing multiple ' +
    'records (e.g. a table of tickets with customer, status, assigned agent, last message).\n' +
    '- Keep it skimmable and warm. Bold the key number or name so it stands out.\n\n' +

    '## Greetings & small talk\n' +
    '- If the admin greets you ("hi", "hello", "hey") or asks who/what you are or what you ' +
    'can do, do NOT call any tool. Reply warmly, introduce yourself as Tempu Ai in one line, ' +
    'and list what you can help with as a short bulleted menu drawn from these capabilities:\n' +
    CAPABILITIES.map((c) => `  - ${c}`).join('\n') + '\n' +
    '  End with a friendly nudge like "What would you like to look into?" Keep the whole ' +
    'greeting tight — a warm line, the menu, and the nudge.\n\n' +

    '## Absolute rule\n' +
    'Your reply is shown to the admin exactly as written. NEVER output JSON, curly braces, ' +
    'or anything resembling a function/tool call in your reply — the tool mechanism is ' +
    'separate and automatic. Write only natural, human-readable Markdown prose.';

// Low temperature + a warm model keep answers deterministic, grounded, and fast.
const OLLAMA_OPTIONS = {
    temperature: Number(process.env.AGENTIC_TEMPERATURE) || 0.15,
    top_p: 0.9,
    num_ctx: Number(process.env.AGENTIC_NUM_CTX) || 8192,
};
// Ollama's keep_alive accepts a duration string ("30m") OR a number of seconds
// (-1 = keep loaded forever). A bare numeric string like "-1" is rejected as a
// duration ("missing unit"), so coerce numerics to an actual number.
const rawKeepAlive = process.env.OLLAMA_KEEP_ALIVE || '30m';
const KEEP_ALIVE = /^-?\d+$/.test(rawKeepAlive.trim()) ? Number(rawKeepAlive) : rawKeepAlive;

async function ollamaChat(messages) {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            messages,
            tools: TOOLS,
            stream: false,
            options: OLLAMA_OPTIONS,
            keep_alive: KEEP_ALIVE,
        }),
    });
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('[agenticAgent] Ollama error', res.status, body.slice(0, 500));
        throw new Error(`Ollama responded ${res.status}`);
    }
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
}

// One last generation with NO tools available, so the model is forced to write
// a natural-language answer from the tool results already in the conversation.
async function finalizeAnswer(messages) {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: MODEL,
            messages: [
                ...messages,
                {
                    role: 'system',
                    content:
                        'Now write the final answer for the admin using ONLY the data already ' +
                        'gathered above. Do not call tools. Reply in warm, skimmable Markdown ' +
                        'prose — no JSON or curly braces.',
                },
            ],
            stream: false,
            options: OLLAMA_OPTIONS,
            keep_alive: KEEP_ALIVE,
        }),
    });
    if (!res.ok) return 'Sorry, I could not generate a response.';
    const data = await res.json();
    const content = data.message?.content || '';
    // Strip any stray leaked JSON so raw tool-call text never reaches the admin.
    if (extractJsonObjects(content).some((b) => /"name"\s*:\s*"/.test(b))) {
        return 'I gathered the data but had trouble writing it up — could you ask that again?';
    }
    return content || 'Sorry, I could not generate a response.';
}
