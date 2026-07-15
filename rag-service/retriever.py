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
        out.append(
            {
                "source": (doc.metadata or {}).get("source", "unknown"),
                "content": doc.page_content,
                "score": float(score),
            }
        )
    return out
