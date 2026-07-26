// RAG client — proxies to the Python RAG microservice (FastAPI + LangChain +
// Chroma + Ollama), which lives in /rag-service. All embedding, chunking, vector
// storage, retrieval and generation happen there (BOT's stack); this module is
// just a thin HTTP client so the rest of the Node backend keeps the same API.
import fs from 'fs/promises';

const RAG_URL = (process.env.RAG_SERVICE_URL || 'http://localhost:8100').replace(/\/+$/, '');
const TIMEOUT_MS = Number(process.env.RAG_SERVICE_TIMEOUT_MS) || 60000;

// Kept for the admin UI (displayed next to ingested sources) and for the
// support relevance gate in supportAi.js.
export const EMBED_MODEL = process.env.RAG_EMBED_MODEL || 'nomic-embed-text';
export const MIN_SCORE = Number(process.env.RAG_MIN_SCORE) || 0.35;

async function call(path, { method = 'POST', json, form } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const opts = { method, signal: controller.signal };
        if (form) {
            opts.body = form; // multipart; fetch sets the boundary header
        } else if (json !== undefined) {
            opts.headers = { 'Content-Type': 'application/json' };
            opts.body = JSON.stringify(json);
        }
        const res = await fetch(`${RAG_URL}${path}`, opts);
        if (!res.ok) throw new Error(`RAG service responded ${res.status}`);
        return await res.json();
    } finally {
        clearTimeout(timer);
    }
}

// Raw retrieval with per-hit relevance scores (used by supportAi's gate).
export async function search(query, k) {
    const data = await call('/search', { json: { query, k } });
    return (data.results || []).map((r, i) => ({ chunkIndex: i, ...r }));
}

// Grounded multi-turn reply. `hits` is ignored — the service re-retrieves — but
// the signature is kept so callers (supportAi.answerFromHits) don't change.
export async function answerFromHits(message, history = [], _hits) {
    const data = await call('/chat', { json: { message, history } });
    return { reply: data.reply, sources: data.sources || [] };
}

// `images` are screenshots extracted from ingested documents that were in the
// grounded context. The reply usually inlines them as markdown already; this
// list is the fallback for a model that ignored them.
export async function chat(message, history = [], image = null) {
    const data = await call('/chat', { json: { message, history, ...(image ? { image } : {}) } });
    return { reply: data.reply, sources: data.sources || [], images: data.images || [] };
}

export async function ask(question, k) {
    const data = await call('/ask', { json: { question, k } });
    return { answer: data.answer, sources: data.sources || [], images: data.images || [] };
}

export async function ingestText(text, source) {
    const data = await call('/text', { json: { text, source } });
    return data.chunks || 0;
}

// Forward uploaded files (multer file objects) to the service for extraction,
// chunking and embedding — so PDF/DOCX/MD parsing uses LangChain loaders.
export async function ingestFiles(files) {
    const form = new FormData();
    for (const f of files) {
        const buf = await fs.readFile(f.path);
        form.append('files', new Blob([buf], { type: f.mimetype || 'application/octet-stream' }), f.originalname || 'file');
    }
    return call('/ingest', { form });
}

export async function listSources() {
    const data = await call('/sources', { method: 'GET' });
    return (data.sources || []).map((s) => ({ updatedAt: null, kind: 'file', ...s }));
}

// Original text of a source (used to edit a pasted source). Returns '' if the
// service has no stored text for it.
export async function getSourceContent(source) {
    const data = await call(`/source/content?name=${encodeURIComponent(source)}`, { method: 'GET' });
    return data.text || '';
}

// Fetch an image extracted from an ingested document. Unlike every other call
// here this returns bytes, not JSON — the admin UI can't reach :8100 directly,
// so the Node backend proxies the file (and gates it behind admin auth).
export async function fetchImage(sourceDir, filename) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const url = `${RAG_URL}/images/${encodeURIComponent(sourceDir)}/${encodeURIComponent(filename)}`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        return {
            buffer: Buffer.from(await res.arrayBuffer()),
            contentType: res.headers.get('content-type') || 'application/octet-stream',
        };
    } finally {
        clearTimeout(timer);
    }
}

export async function deleteSource(source) {
    const data = await call(`/source?name=${encodeURIComponent(source)}`, { method: 'DELETE' });
    return data.deleted || 0;
}
