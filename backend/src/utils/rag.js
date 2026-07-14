// RAG core — a Node port of the BOT project's Python `rag/` package.
//
// Pipeline mirrors the original: load -> chunk -> embed -> persist, then
// similarity-search over the stored vectors and format the top hits for
// LLM-context injection. Differences from the Python version:
//   * Embeddings come from Ollama's HTTP API (same `nomic-embed-text` model),
//     called directly instead of via langchain_ollama.
//   * Vectors live in MongoDB (RagChunk) instead of Chroma; cosine similarity
//     is computed in Node. The admin corpus is small, so this is plenty fast
//     and adds no new infrastructure.
import fs from 'fs/promises';
import path from 'path';
import mammoth from 'mammoth';
// Import the library entry directly: pdf-parse's index.js runs a debug harness
// that reads a bundled test PDF when required as the main module, which throws
// under ESM. The lib entry is the pure parser.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { RagChunk } from '../models/ragChunk.model.js';

const OLLAMA_URL = (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');
export const EMBED_MODEL = process.env.RAG_EMBED_MODEL || 'nomic-embed-text';
export const CHAT_MODEL = process.env.RAG_CHAT_MODEL || 'llama3.1:8b';
const CHUNK_SIZE = Number(process.env.RAG_CHUNK_SIZE) || 1000;
const CHUNK_OVERLAP = Number(process.env.RAG_CHUNK_OVERLAP) || 150;
export const RETRIEVE_K = Number(process.env.RAG_RETRIEVE_K) || 4;
// Minimum cosine similarity for a chunk to count as "relevant". Cosine search
// always returns the top-k chunks regardless of quality, so callers that must
// avoid answering off-topic questions (e.g. support auto-reply) gate on this.
// Tuned for nomic-embed-text: on-topic ≳0.65, off-topic ≲0.45.
export const MIN_SCORE = Number(process.env.RAG_MIN_SCORE) || 0.6;

// ── Embeddings ─────────────────────────────────────────────────────────────
// Ask Ollama for the embedding vector of a single string.
export async function embed(text) {
    const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
    });
    if (!res.ok) {
        throw new Error(`Ollama embeddings returned ${res.status}. Is Ollama running (ollama serve) and is "${EMBED_MODEL}" pulled?`);
    }
    const data = await res.json();
    const vec = data.embedding;
    if (!Array.isArray(vec) || !vec.length) throw new Error('Ollama returned an empty embedding');
    return vec;
}

// ── Text extraction ──────────────────────────────────────────────────────────
// Extract plain text from a file on disk. Supports PDF and DOCX via parsers;
// anything else is read as UTF-8 text (md, txt, csv, json, code, logs, ...).
export async function extractText(filePath, originalName) {
    const ext = path.extname(originalName || filePath).toLowerCase();
    try {
        if (ext === '.pdf') {
            const buf = await fs.readFile(filePath);
            const parsed = await pdfParse(buf);
            return parsed.text || '';
        }
        if (ext === '.docx') {
            const { value } = await mammoth.extractRawText({ path: filePath });
            return value || '';
        }
    } catch (e) {
        // Fall through to a raw text read so a flaky parser never loses content.
        console.error(`[rag] parse failed for ${originalName} (${e.message}); falling back to text`);
    }
    try {
        return await fs.readFile(filePath, 'utf-8');
    } catch {
        return '';
    }
}

// ── Chunking ─────────────────────────────────────────────────────────────────
// Recursive character splitter mirroring LangChain's RecursiveCharacterTextSplitter:
// try to split on the coarsest separator that keeps pieces under CHUNK_SIZE,
// recursing to finer separators, then stitch pieces back up to the size limit
// with CHUNK_OVERLAP carried between adjacent chunks.
const SEPARATORS = ['\n\n', '\n', '. ', ' ', ''];

function splitRecursive(text, separators) {
    if (text.length <= CHUNK_SIZE) return [text];
    const [sep, ...rest] = separators;
    if (sep === undefined) return [text]; // can't split further
    const parts = sep === '' ? text.split('') : text.split(sep);
    const pieces = [];
    for (let part of parts) {
        const withSep = sep === '' ? part : part + sep;
        if (withSep.length > CHUNK_SIZE) {
            pieces.push(...splitRecursive(withSep, rest));
        } else {
            pieces.push(withSep);
        }
    }
    return pieces;
}

function mergePieces(pieces) {
    const chunks = [];
    let current = '';
    for (const piece of pieces) {
        if ((current + piece).length > CHUNK_SIZE && current) {
            chunks.push(current.trim());
            // Carry the tail of the previous chunk forward as overlap.
            const overlap = current.slice(-CHUNK_OVERLAP);
            current = overlap + piece;
        } else {
            current += piece;
        }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks.filter(Boolean);
}

export function chunkText(text) {
    const clean = (text || '').replace(/\r\n/g, '\n').trim();
    if (!clean) return [];
    return mergePieces(splitRecursive(clean, SEPARATORS));
}

// ── Ingestion ─────────────────────────────────────────────────────────────────
// Chunk + embed a piece of text under `source` and persist. Re-ingesting the
// same source label replaces its existing chunks (idempotent updates).
export async function ingestText(text, source, adminId = null) {
    const chunks = chunkText(text);
    if (!chunks.length) return 0;

    // Replace any prior version of this source.
    await RagChunk.deleteMany({ source });

    const docs = [];
    for (let i = 0; i < chunks.length; i++) {
        const embedding = await embed(chunks[i]);
        docs.push({
            source,
            chunkIndex: i,
            content: chunks[i],
            embedding,
            dims: embedding.length,
            embedModel: EMBED_MODEL,
            createdBy: adminId,
        });
    }
    await RagChunk.insertMany(docs);
    return docs.length;
}

// ── Retrieval ─────────────────────────────────────────────────────────────────
function cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    if (!na || !nb) return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// Retrieve the top-k most similar chunks to `query`. Returns
// [{ source, chunkIndex, content, score }] sorted by descending score.
export async function search(query, k = RETRIEVE_K) {
    const qVec = await embed(query);
    // Only compare against vectors from the current embed model / dimensionality.
    const all = await RagChunk.find({ embedModel: EMBED_MODEL, dims: qVec.length })
        .select('source chunkIndex content embedding')
        .lean();
    if (!all.length) return [];

    return all
        .map((c) => ({
            source: c.source,
            chunkIndex: c.chunkIndex,
            content: c.content,
            score: cosine(qVec, c.embedding),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, k);
}

// Format retrieved chunks for system-prompt injection. Returns "" when nothing
// relevant matched, so it can be concatenated unconditionally (mirrors the
// Python rag_context()).
export async function ragContext(query, k = RETRIEVE_K, maxChars = 1800) {
    const hits = await search(query, k);
    if (!hits.length) return '';
    const block = hits
        .map((h, i) => `[${i + 1}] (${h.source})\n${h.content.trim()}`)
        .join('\n\n')
        .slice(0, maxChars);
    return `\n\nRELEVANT KNOWLEDGE (cite as [1], [2], …):\n${block}\n`;
}

// ── Corpus management ────────────────────────────────────────────────────────
// Distinct sources with their chunk counts + last-updated time.
export async function listSources() {
    return RagChunk.aggregate([
        {
            $group: {
                _id: '$source',
                chunks: { $sum: 1 },
                updatedAt: { $max: '$updatedAt' },
                embedModel: { $first: '$embedModel' },
            },
        },
        { $project: { _id: 0, source: '$_id', chunks: 1, updatedAt: 1, embedModel: 1 } },
        { $sort: { updatedAt: -1 } },
    ]);
}

export async function deleteSource(source) {
    const { deletedCount } = await RagChunk.deleteMany({ source });
    return deletedCount || 0;
}

// ── LLM chat ──────────────────────────────────────────────────────────────
// Low-level Ollama /api/chat call. `messages` is the full role/content array.
async function ollamaChat(messages) {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: CHAT_MODEL,
            messages,
            stream: false,
            keep_alive: '10m',
            options: { temperature: 0.2, top_p: 0.9, num_ctx: 4096, num_predict: 400 },
        }),
    });
    if (!res.ok) throw new Error(`Ollama chat returned ${res.status}. Is Ollama running and is "${CHAT_MODEL}" pulled?`);
    const data = await res.json();
    return (data.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

// Multi-turn assistant grounded in the knowledge base. Retrieves context for
// the latest user message, injects it into the system prompt, and replays the
// recent conversation so the bot keeps context across turns.
// `history` is [{ role: 'user'|'model'|'assistant', text }]. Returns { reply, sources }.
export async function chat(message, history = [], k = RETRIEVE_K) {
    const hits = await search(message, k);
    return answerFromHits(message, history, hits);
}

// Generate a grounded reply from already-retrieved hits (lets callers gate on
// retrieval before spending an LLM call). Returns { reply, sources }.
export async function answerFromHits(message, history = [], hits = []) {
    const context = hits.length
        ? hits.map((h, i) => `[${i + 1}] (${h.source})\n${h.content.trim()}`).join('\n\n')
        : '';

    const systemPrompt =
        'You are the Tempu Assistant, a helpful support assistant for the Tempu ride-hailing platform. ' +
        'Answer the user using ONLY the KNOWLEDGE below. If the knowledge does not cover the question, ' +
        'say you don\'t have that information yet and suggest contacting support — do NOT make things up. ' +
        'Be warm, concise, and clear. Cite sources as [1], [2] when relevant.' +
        (context ? `\n\nKNOWLEDGE:\n${context}` : '\n\n(No knowledge base entries matched this question.)');

    const recent = (history || []).slice(-8).map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.text,
    }));
    const messages = [
        { role: 'system', content: systemPrompt },
        ...recent,
        { role: 'user', content: message },
    ];

    const reply = await ollamaChat(messages);
    const sources = [...new Set(hits.map((h) => h.source))];
    return { reply: reply || 'Sorry, I could not generate a response. Please try again.', sources };
}

// ── LLM answer over retrieved context ────────────────────────────────────────
// Optional "ask" helper: retrieve, then have Ollama answer grounded strictly in
// the retrieved chunks. Returns { answer, sources }.
export async function ask(question, k = RETRIEVE_K) {
    const hits = await search(question, k);
    if (!hits.length) {
        return { answer: "I don't have anything in the knowledge base about that yet.", sources: [] };
    }
    const context = hits.map((h, i) => `[${i + 1}] (${h.source})\n${h.content.trim()}`).join('\n\n');
    const messages = [
        {
            role: 'system',
            content:
                'You are a knowledge-base assistant. Answer the question using ONLY the CONTEXT below. ' +
                'If the context does not contain the answer, say you do not have that information. ' +
                'Cite sources as [1], [2] where relevant. Be concise.\n\nCONTEXT:\n' + context,
        },
        { role: 'user', content: question },
    ];
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: CHAT_MODEL,
            messages,
            stream: false,
            options: { temperature: 0.2, num_ctx: 4096, num_predict: 400 },
        }),
    });
    if (!res.ok) throw new Error(`Ollama chat returned ${res.status}`);
    const data = await res.json();
    const answer = (data.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
    const sources = [...new Set(hits.map((h) => h.source))];
    return { answer: answer || 'No answer generated.', sources };
}
