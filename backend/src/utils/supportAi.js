import { search, answerFromHits, MIN_SCORE } from './rag.js';

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

// Generate + append an AI reply to `ticket` for `customerMessage`, then save.
// `ticket` is a mongoose document. History is taken from messages BEFORE the
// latest customer turn so the current question isn't duplicated in context.
export async function maybeAppendAiReply(ticket, customerMessage) {
    try {
        // Gate on retrieval FIRST: cosine search always returns the top-k chunks,
        // so filter by a relevance threshold. If nothing clears the bar, don't
        // spend an LLM call and don't reply — leave it for a human agent.
        const hits = await withTimeout(search(customerMessage), AI_TIMEOUT_MS);
        const relevant = (hits || []).filter((h) => h.score >= MIN_SCORE);
        if (!relevant.length) return false;

        // History excluding the just-added customer message (it's the last one).
        const priorHistory = toHistory(ticket.messages.slice(0, -1));
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
    } catch (err) {
        console.error('[supportAi] auto-reply skipped:', err.message);
        return false;
    }
}
