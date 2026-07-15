import { search, answerFromHits, MIN_SCORE } from './rag.js';
import { getSupportSettings } from '../models/supportSettings.model.js';

// Bridges the Knowledge Base assistant into the real support-ticket flow.
//
// When a customer (user/driver/guest) posts to a ticket, we ask the RAG
// assistant for an answer grounded in the knowledge base. If — and only if —
// the KB actually had relevant content (sources matched), we append the reply
// as an AI-flagged support message. Anything the KB can't answer is left for a
// human agent, so the bot never guesses at customers.
//
// This is best-effort and fully guarded: any failure (Ollama down, timeout,
// empty KB) is swallowed so the customer's message is never lost or delayed
// into an error. Returns true if an AI reply was appended.

const AI_TIMEOUT_MS = Number(process.env.RAG_SUPPORT_TIMEOUT_MS) || 25000;

// Map a ticket's stored messages to the {role, text} history the assistant
// expects. Customer turns are 'user'; admin/AI turns are 'assistant'.
function toHistory(messages = []) {
    return messages
        .filter((m) => (m.message || '').trim())
        .map((m) => ({
            role: ['user', 'driver', 'guest'].includes(m.senderType) ? 'user' : 'model',
            text: m.message,
        }));
}

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((resolve) => setTimeout(() => resolve(null), ms)),
    ]);
}

// True once a HUMAN support agent has replied on the ticket (an 'admin' message
// that isn't AI-flagged). From that point the AI hands the conversation over and
// stays silent — the customer is now talking to a real person.
export function humanHasReplied(ticket) {
    return (ticket.messages || []).some((m) => m.senderType === 'admin' && !m.isAI);
}

// Retrieve from the KB and append a grounded answer to `ticket` if — and only if
// — something cleared the relevance bar. Returns true if a reply was appended.
async function appendKbAnswer(ticket, customerMessage, priorHistory) {
    // Gate on retrieval FIRST: cosine search always returns the top-k chunks, so
    // filter by a relevance threshold. If nothing clears the bar, don't spend an
    // LLM call and don't reply — leave it for a human agent.
    const hits = await withTimeout(search(customerMessage), AI_TIMEOUT_MS);
    const relevant = (hits || []).filter((h) => h.score >= MIN_SCORE);
    if (!relevant.length) return false;

    const result = await withTimeout(
        answerFromHits(customerMessage, priorHistory, relevant),
        AI_TIMEOUT_MS,
    );
    if (!result || !result.reply) return false;

    ticket.messages.push({
        senderId: null,
        senderType: 'admin',
        isAI: true,
        message: result.reply,
    });
    await ticket.save();
    return true;
}

// Follow-up customer messages: reply from the KB, UNLESS a human agent has
// already stepped in (then the AI is out of the loop). History is taken from
// messages BEFORE the latest customer turn so the question isn't duplicated.
export async function maybeAppendAiReply(ticket, customerMessage) {
    try {
        if (humanHasReplied(ticket)) return false;
        const priorHistory = toHistory(ticket.messages.slice(0, -1));
        return await appendKbAnswer(ticket, customerMessage, priorHistory);
    } catch (err) {
        console.error('[supportAi] auto-reply skipped:', err.message);
        return false;
    }
}

// Brand-new ticket: the AI speaks FIRST with a welcome + the configured working
// hours, then attempts a KB answer to the opening question. Best-effort; never
// throws. The greeting always posts even when the KB has nothing to add.
export async function greetAndMaybeAnswer(ticket, customerMessage) {
    try {
        const settings = await getSupportSettings();
        const hours = (settings.workingHours || '').trim();
        const greeting =
            "Hi! Thanks for reaching out to Tempu support. I'm the AI assistant and I'll help right away while a support agent joins the chat." +
            (hours ? `\n\n${hours}` : '');
        ticket.messages.push({ senderId: null, senderType: 'admin', isAI: true, message: greeting });
        await ticket.save();

        // Opening question → no prior conversation history to carry.
        await appendKbAnswer(ticket, customerMessage, []);
        return true;
    } catch (err) {
        console.error('[supportAi] greeting skipped:', err.message);
        return false;
    }
}
