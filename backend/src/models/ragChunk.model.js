import mongoose from 'mongoose';

// One embedded chunk of an ingested knowledge-base document. A "source" is the
// original file/text label; a source is split into many chunks, each stored
// with its own embedding vector. Similarity search loads the candidate chunks
// and ranks them by cosine similarity in Node (the corpus is admin-curated and
// small, so a dedicated vector DB isn't warranted).
const ragChunkSchema = new mongoose.Schema(
    {
        // Original document label (filename or a user-given label for pasted text).
        source: {
            type: String,
            required: true,
            trim: true,
            index: true,
        },
        // 0-based position of this chunk within its source, for stable ordering.
        chunkIndex: {
            type: Number,
            required: true,
        },
        // The chunk text that gets injected into the LLM context.
        content: {
            type: String,
            required: true,
        },
        // The embedding vector for `content`. Length depends on the embed model.
        embedding: {
            type: [Number],
            required: true,
        },
        // Embedding vector length + model, so we can detect a model change and
        // skip incompatible vectors instead of comparing across dimensions.
        dims: {
            type: Number,
            required: true,
        },
        embedModel: {
            type: String,
            required: true,
        },
        // Which admin ingested this chunk (audit trail).
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Admin',
            default: null,
        },
    },
    { timestamps: true },
);

export const RagChunk = mongoose.model('RagChunk', ragChunkSchema);
