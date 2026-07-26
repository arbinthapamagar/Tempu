"""Similarity search over the Chroma store (same idea as BOT/rag/retriever.py),
returning per-hit relevance scores so the caller can gate on MIN_SCORE.
"""
from config import RETRIEVE_K
from ingest import get_vectorstore


def search(query: str, k: int = RETRIEVE_K):
    vs = get_vectorstore()
    pairs = vs.similarity_search_with_relevance_scores(query, k=k)
    out = []
    for doc, score in pairs:
        meta = doc.metadata or {}
        # Screenshots ride in metadata, not page_content — they must not pollute
        # the embedded text (a URL string never matches a natural-language query,
        # and image-only chunks would be dead weight). answer.py re-attaches them
        # to the context it shows the model.
        imgs = [u for u in (meta.get("images") or "").split(",") if u]
        out.append(
            {
                "source": meta.get("source", "unknown"),
                "content": doc.page_content,
                "images": imgs,
                "score": float(score),
            }
        )
    return out
