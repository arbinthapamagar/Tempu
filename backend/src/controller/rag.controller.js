import fs from 'fs/promises';
import { asyncHandler } from '../utils/asyncHandler.js';
import { apiError } from '../utils/apiError.js';
import { apiResponse } from '../utils/apiResponse.js';
import {
    extractText,
    ingestText,
    search,
    ask,
    chat,
    listSources,
    deleteSource,
    EMBED_MODEL,
} from '../utils/rag.js';

// Knowledge Base (RAG) admin endpoints. Ported from the BOT project's rag/.
// All routes are mounted under /api/v1/admin/knowledge and gated by
// verifyAdminJwt + the manageKnowledge permission (see admin.route.js).

// POST /knowledge/ingest  (multipart: files[])
// Parse each uploaded file, chunk + embed it, persist under its filename.
const ingestDocuments = asyncHandler(async (req, res) => {
    const files = req.files || [];
    if (!files.length) throw new apiError(400, 'No files uploaded');

    const results = [];
    try {
        for (const file of files) {
            const text = await extractText(file.path, file.originalname);
            if (!text.trim()) {
                results.push({ source: file.originalname, chunks: 0, skipped: 'no readable text' });
                continue;
            }
            const chunks = await ingestText(text, file.originalname, req.admin?._id);
            results.push({ source: file.originalname, chunks });
        }
    } finally {
        // Always clean up the temp uploads, success or failure.
        await Promise.all(files.map((f) => fs.unlink(f.path).catch(() => {})));
    }

    const total = results.reduce((n, r) => n + (r.chunks || 0), 0);
    return res
        .status(201)
        .json(new apiResponse(201, { results, totalChunks: total }, `Ingested ${total} chunk(s)`));
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

// POST /knowledge/ask  { question, k }  → LLM answer grounded in retrieval
const askKnowledge = asyncHandler(async (req, res) => {
    const { question, k } = req.body;
    if (!question || !question.trim()) throw new apiError(400, 'Question is required');
    const result = await ask(question.trim(), Number(k) || undefined);
    return res.status(200).json(new apiResponse(200, result, 'Answer'));
});

// POST /knowledge/chat  { message, history }  → multi-turn assistant reply
const chatKnowledge = asyncHandler(async (req, res) => {
    const { message, history = [] } = req.body;
    if (!message || !message.trim()) throw new apiError(400, 'Message is required');
    const result = await chat(message.trim(), Array.isArray(history) ? history : []);
    return res.status(200).json(new apiResponse(200, result, 'Chat reply'));
});

export {
    ingestDocuments,
    ingestRawText,
    getSources,
    removeSource,
    searchKnowledge,
    askKnowledge,
    chatKnowledge,
};
