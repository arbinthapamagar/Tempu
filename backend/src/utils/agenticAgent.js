// Agentic AI orchestration — a tool-calling loop restricted to two whitelists:
// the read-only data tools in agenticTools.js, and the write actions in
// agenticActions.js. The model can only ever call those named functions; it
// never sees or writes raw database queries. The underlying model is
// provider-agnostic (Gemini or local Ollama) via ./llm.js — set with AI_PROVIDER.
//
// Reads run immediately. Writes never do: calling an action tool only PREPARES a
// signed proposal, which the admin panel renders as a confirm card. Nothing is
// written until the boss clicks Send and the panel calls
// POST /admin/agentic/action. See agenticActions.js for that contract.
import { TOOLS, HANDLERS } from './agenticTools.js';
import { actionToolsFor, isActionTool, proposeAction } from './agenticActions.js';
import { chatWithTools, chatPlain, friendlyAiError, AI_PROVIDER } from './llm.js';

// Enough round-trips for real multi-step questions (e.g. list tickets → open the
// detail of each → summarise) without letting a confused model loop forever.
const MAX_STEPS = 8;

const SYSTEM_PROMPT =
    'You are **Tempu Ai**, the assistant inside the Tempu admin panel (Tempu is a ' +
    'women-first ride-sharing platform in Nepal). You answer questions about live app data ' +
    '— riders, drivers, trips, payments, withdrawals, subscriptions, suppliers, support ' +
    'tickets, emergencies, documents, notifications, pricing, map settings, API traffic and ' +
    'platform analytics — and you can also PREPARE changes across those same areas. ' +
    'The boss can also attach an image with the ' +
    'paperclip button and you can see and describe it (e.g. a screenshot, a document photo, a ' +
    'driver ID). If asked whether you can read documents, be accurate: you can view an ' +
    'attached IMAGE directly in this chat, but reading whole document FILES (PDF/DOCX) happens ' +
    'through the separate Tempu Rag knowledge base upload, not here.\n\n' +

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
    'question only if genuinely ambiguous.\n' +
    '- When the boss asks for "all" of something (all tickets, all pending documents), pass ' +
    'limit: 50 so they get the whole list, and quote the tool’s exact `count`.\n\n' +

    '## Making changes — you PREPARE, the boss CONFIRMS\n' +
    'Some of your tools change data: sending notifications, replying to and assigning support ' +
    'tickets, acknowledging SOS alerts, verifying documents, changing rider/driver statuses, ' +
    'processing withdrawals, granting driver money, editing pricing, and more.\n' +
    '- Calling one of those tools does NOT perform the change. It only prepares it. The boss ' +
    'then sees a confirmation card with Send and Cancel buttons, and nothing happens until ' +
    'they click Send.\n' +
    '- So NEVER say a change is done. Do not write "sent", "notified", "approved", "resolved", ' +
    '"I have updated". Report it as ready: e.g. "Ready to send, boss — confirm below." ' +
    'ONE short line.\n' +
    '- Do NOT restate the recipient, title or message in prose — the card already shows every ' +
    'detail. Repeating it is noise.\n' +
    '- Prepare each action ONCE per turn. Never call the same action tool twice.\n' +
    '- If the boss gave you only the message text, write a short sensible title yourself.\n' +
    '- Look the target up by the name the boss used; the tool resolves it. If the tool comes ' +
    'back with an error (no such user, already approved, needs a reason), say exactly that in ' +
    'one line and, if something is missing, ask for it.\n' +
    '- If the boss asks for a change you have no tool for, or one your permissions do not ' +
    'cover, say so plainly and point them to the relevant admin screen.\n\n' +

    '## Greetings & identity\n' +
    '- For "hi"/"who are you"/"what can you do"/"who built you", reply in ONE short ' +
    'professional line as Tempu Ai, the Tempu admin assistant — then ask what the boss ' +
    'needs. Do NOT dump a capabilities menu or call any tool.\n\n' +

    '## Absolute rule\n' +
    'Your reply is shown to the boss exactly as written. NEVER output JSON, curly braces, or ' +
    'anything resembling a function/tool call — the tool mechanism is separate and automatic. ' +
    'Write only natural, human-readable Markdown prose.';

const isKnownTool = (name) => Object.prototype.hasOwnProperty.call(HANDLERS, name) || isActionTool(name);

// Dispatch one tool call. A read tool runs for real; an action tool is only
// resolved into a signed proposal (collected into `pending`) and the model is
// told explicitly that nothing has happened yet, so it can't report success.
async function runTool(name, args = {}, admin, pending) {
    if (isActionTool(name)) {
        // The same action proposed twice in one turn would show the boss two
        // identical cards and risk a double-send. Keep the first.
        if (pending.some((p) => p.action === name)) {
            return { proposed: true, note: 'Already prepared and shown to the boss — do not prepare it again.' };
        }
        const result = await proposeAction(name, args, admin);
        if (!result.ok) return { error: result.error };
        pending.push(result.proposal);
        return {
            proposed: true,
            awaitingConfirmation: true,
            summary: result.proposal.summary,
            note: 'NOT done yet. A confirmation card is now shown to the boss with Send/Cancel; '
                + 'it only happens if they click Send. Tell them it is ready to confirm — never that it is done.',
        };
    }

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
            if (parsed?.name && isKnownTool(parsed.name)) {
                return { name: parsed.name, args: parsed.parameters || parsed.arguments || {} };
            }
        } catch {
            // Not valid JSON - try the next candidate block.
        }
    }
    return null;
}

// history: [{ role: 'user'|'model', text }] — same shape the RAG chat uses.
// `image` (optional) is a base64 data URL ("data:image/png;base64,…") — only
// understood on the Gemini provider (its OpenAI-compatible endpoint accepts
// multimodal content alongside tool calling); on Ollama the image is ignored
// with a note, since the configured local model isn't vision-capable.
// `admin` is the authenticated Admin doc: it decides which write actions are
// offered to the model at all, and signs any proposal to that admin.
// Returns { reply, toolCalls: [{name, args}], pendingActions: [proposal] }.
export async function runAgenticChat(message, history = [], image = null, admin = null) {
    let systemPrompt = SYSTEM_PROMPT;
    let userContent = message;
    if (image) {
        if (AI_PROVIDER === 'gemini') {
            systemPrompt +=
                '\n\n## Attached image\nThe boss attached an image. Describe/analyse it and answer their ' +
                'question about it. Combine what you see with tool data when relevant, but never invent ' +
                'facts that aren’t in the image or a tool result.';
            const parts = [];
            if (message) parts.push({ type: 'text', text: message });
            parts.push({ type: 'image_url', image_url: { url: image } });
            userContent = parts;
        } else {
            systemPrompt +=
                '\n\n## Attached image\nThe boss attached an image, but the local model can’t view images ' +
                '— tell them to switch `AI_PROVIDER=gemini` for image understanding, then answer the text ' +
                'part of their message if there is one.';
        }
    }

    const messages = [
        { role: 'system', content: systemPrompt },
        ...(history || []).slice(-8).map((m) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.text,
        })),
        { role: 'user', content: userContent },
    ];

    // Only the actions this admin's permissions allow are offered, so the model
    // can never propose something that would be refused at the confirm step.
    const tools = [...TOOLS, ...actionToolsFor(admin)];

    const toolCalls = [];
    const pendingActions = [];
    try {
        for (let step = 0; step < MAX_STEPS; step++) {
            const reply = await chatWithTools(messages, tools);

            if (reply.toolCalls?.length) {
                messages.push({ role: 'assistant', content: reply.content || '', toolCalls: reply.toolCalls });
                for (const call of reply.toolCalls) {
                    const result = await runTool(call.name, call.args, admin, pendingActions);
                    toolCalls.push({ name: call.name, args: call.args });
                    messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify(result) });
                }
                continue;
            }

            // Some models "leak" a tool call as plain-text JSON instead of using the
            // tool mechanism. Detect it and self-heal by actually running the tool.
            const leaked = parseLeakedToolCall(reply.content);
            if (leaked) {
                const result = await runTool(leaked.name, leaked.args, admin, pendingActions);
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
                if (toolCalls.length) return { reply: await finalizeAnswer(messages, pendingActions), toolCalls, pendingActions };
                return {
                    reply: "I don't have a way to look that up yet — could you rephrase your question?",
                    toolCalls,
                    pendingActions,
                };
            }

            return { reply: reply.content || 'Sorry, I could not generate a response.', toolCalls, pendingActions };
        }
        // Hit the step cap. We almost certainly have tool data by now — force one
        // final tool-free pass so the admin gets an answer built from it, not a
        // "couldn't finish" apology.
        return { reply: await finalizeAnswer(messages, pendingActions), toolCalls, pendingActions };
    } catch (err) {
        // The AI provider failed (Gemini quota used up, key rejected, Ollama not
        // running, …). Return a clear, human-readable reply as a normal response
        // — the admin sees exactly what went wrong, and the API logger records it
        // like any other reply instead of it vanishing into a 500.
        //
        // Any prepared action is dropped: the boss never saw a card for it, so
        // offering one now against a failed turn would be confusing.
        return { reply: friendlyAiError(err), toolCalls, pendingActions: [], error: true };
    }
}

// One last generation with NO tools available, so the model is forced to write
// a natural-language answer from the tool results already in the conversation.
async function finalizeAnswer(messages, pendingActions = []) {
    let content = '';
    try {
        ({ content } = await chatPlain([
            ...messages,
            {
                role: 'system',
                content:
                    'Now write the final answer for the admin using ONLY the data already ' +
                    'gathered above. Do not call tools. Reply in warm, skimmable Markdown ' +
                    'prose — no JSON or curly braces.' +
                    (pendingActions.length
                        ? ' An action is prepared and awaiting the boss’s confirmation — say it is ' +
                          'ready to confirm below, in one short line. NEVER say it is done, sent, or applied.'
                        : ''),
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
