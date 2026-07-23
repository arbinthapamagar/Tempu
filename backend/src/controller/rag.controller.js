import fs from 'fs/promises';
import { asyncHandler } from '../utils/asyncHandler.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import {
    ingestFiles,
    ingestText,
    search,
    ask,
    chat,
    listSources,
    deleteSource,
    getSourceContent,
    EMBED_MODEL,
} from '../utils/rag.js';
import { runAgenticChat } from '../utils/agenticAgent.js';

// Knowledge Base (RAG) admin endpoints. Ported from the BOT project's rag/.
// All routes are mounted under /api/v1/admin/knowledge and gated by
// verifyAdminJwt + the manageKnowledge permission (see admin.route.js).

// POST /knowledge/ingest  (multipart: files[])
// Parse each uploaded file, chunk + embed it, persist under its filename.
const ingestDocuments = asyncHandler(async (req, res) => {
    const files = req.files || [];
    if (!files.length) throw new apiError(400, 'No files uploaded');

    try {
        // The Python RAG service extracts (LangChain loaders), chunks and embeds.
        const { chunks = 0, results = [] } = await ingestFiles(files);
        return res
            .status(201)
            .json(new apiResponse(201, { results, totalChunks: chunks }, `Ingested ${chunks} chunk(s)`));
    } finally {
        // Always clean up the temp uploads, success or failure.
        await Promise.all(files.map((f) => fs.unlink(f.path).catch(() => {})));
    }
});

// POST /knowledge/text  { text, label }
const ingestRawText = asyncHandler(async (req, res) => {
    const { text, label } = req.body;
    if (!text || !text.trim()) throw new apiError(400, 'Text is required');
    const source = (label || '').trim() || `pasted-${new Date().toISOString().slice(0, 10)}`;
    const chunks = await ingestText(text, source, req.admin?._id);
    if (!chunks) throw new apiError(400, 'Nothing to ingest from the provided text');
    return res.status(201).json(new apiResponse(201, { source, chunks }, `Ingested ${chunks} chunk(s)`));
});

// GET /knowledge/sources
const getSources = asyncHandler(async (req, res) => {
    const sources = await listSources();
    return res
        .status(200)
        .json(new apiResponse(200, { sources, embedModel: EMBED_MODEL }, 'Knowledge sources'));
});

// GET /knowledge/sources/:source/content  → original text of a pasted source
// (used to load it back into the editor).
const getSourceText = asyncHandler(async (req, res) => {
    const source = decodeURIComponent(req.params.source || '');
    if (!source) throw new apiError(400, 'Source is required');
    const text = await getSourceContent(source);
    return res.status(200).json(new apiResponse(200, { source, text }, 'Source content'));
});

// PUT /knowledge/sources/:source  { text }  → edit a pasted source in place.
// ingestText deletes the source's existing chunks and re-embeds the new text
// under the same name, so this is an atomic replace. The label (source name) is
// kept as the identity and not renamed here, to avoid clobbering another source.
const updateSource = asyncHandler(async (req, res) => {
    const source = decodeURIComponent(req.params.source || '');
    const { text } = req.body;
    if (!source) throw new apiError(400, 'Source is required');
    if (!text || !text.trim()) throw new apiError(400, 'Text is required');
    const chunks = await ingestText(text, source);
    if (!chunks) throw new apiError(400, 'Nothing to ingest from the provided text');
    return res.status(200).json(new apiResponse(200, { source, chunks }, `Updated ${chunks} chunk(s)`));
});

// DELETE /knowledge/sources/:source
const removeSource = asyncHandler(async (req, res) => {
    const source = decodeURIComponent(req.params.source || '');
    if (!source) throw new apiError(400, 'Source is required');
    const deleted = await deleteSource(source);
    if (!deleted) throw new apiError(404, 'Source not found');
    return res.status(200).json(new apiResponse(200, { source, deleted }, `Deleted ${deleted} chunk(s)`));
});

// POST /knowledge/search  { query, k }  → raw retrieval (for testing relevance)
const searchKnowledge = asyncHandler(async (req, res) => {
    const { query, k } = req.body;
    if (!query || !query.trim()) throw new apiError(400, 'Query is required');
    const results = await search(query.trim(), Number(k) || undefined);
    return res.status(200).json(new apiResponse(200, { results }, 'Search results'));
});

// When the RAG microservice can't even be reached (not started / crashed), turn
// it into a clear reply the admin sees — returned as a normal 200 so it also
// lands in the API log, instead of a bare 500 that looks like the feature broke.
const RAG_DOWN_MSG =
    "⚠️ The knowledge service (Tempu Rag) isn't reachable. Make sure it's running on port 8100 " +
    '(`cd rag-service && uvicorn main:app --host 0.0.0.0 --port 8100`).';

// POST /knowledge/ask  { question, k }  → LLM answer grounded in retrieval
const askKnowledge = asyncHandler(async (req, res) => {
    const { question, k } = req.body;
    if (!question || !question.trim()) throw new apiError(400, 'Question is required');
    try {
        const result = await ask(question.trim(), Number(k) || undefined);
        return res.status(200).json(new apiResponse(200, result, 'Answer'));
    } catch {
        return res.status(200).json(new apiResponse(200, { answer: RAG_DOWN_MSG, sources: [], error: true }, 'Answer'));
    }
});

// POST /knowledge/chat  { message, history, image? }  → multi-turn assistant reply.
// `image` is an optional base64 data URL for image understanding (Tempu Rag).
const chatKnowledge = asyncHandler(async (req, res) => {
    const { message = '', history = [], image = null } = req.body;
    if ((!message || !message.trim()) && !image) throw new apiError(400, 'Message or image is required');
    try {
        const result = await chat((message || '').trim(), Array.isArray(history) ? history : [], image);
        return res.status(200).json(new apiResponse(200, result, 'Chat reply'));
    } catch {
        return res.status(200).json(new apiResponse(200, { reply: RAG_DOWN_MSG, sources: [], error: true }, 'Chat reply'));
    }
});

// POST /agentic/chat  { message, history, image? }  → tool-calling agent over live app data
// Gated by requireAgenticAI (see admin.route.js) - separate from the RAG knowledge
// permission, since this reaches live user/driver/trip/payment data.
// `image` is an optional base64 data URL, understood on the Gemini provider only.
const agenticChat = asyncHandler(async (req, res) => {
    const { message = '', history = [], image = null } = req.body;
    if ((!message || !message.trim()) && !image) throw new apiError(400, 'Message or image is required');
    const result = await runAgenticChat((message || '').trim(), Array.isArray(history) ? history : [], image);
    return res.status(200).json(new apiResponse(200, result, 'Agentic reply'));
});

export {
    ingestDocuments,
    ingestRawText,
    getSources,
    getSourceText,
    updateSource,
    removeSource,
    searchKnowledge,
    askKnowledge,
    chatKnowledge,
    agenticChat,
};
