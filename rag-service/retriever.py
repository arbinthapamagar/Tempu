"""Similarity search over the Chroma store (same idea as BOT/rag/retriever.py),
returning per-hit relevance scores so the caller can gate on MIN_SCORE.
"""
import re

from config import RETRIEVE_K
from ingest import get_vectorstore

# Vocabulary bridge for platform names. Users say "WordPress"/"WP"; the docs are
# filed under "WooCommerce", and nomic-embed-text has no idea the two are
# related — so "how to install shipos in wordpress" used to rank the WooCommerce
# install article 7th, behind Wix and Shopify, and the model would answer that it
# has no WordPress instructions at all.
#
# Expanding the QUERY is the right place for this. Putting the aliases in the
# documents instead was tried and made things worse: every WooCommerce article
# then contained "WordPress", so the install article no longer stood out.
PLATFORM_HINTS = (
    (r"\b(wordpress|wp|woo)\b", "WooCommerce plugin"),
    (r"\bshopify\b", "Shopify App Store"),
    (r"\bwix\b", "Wix App Market"),
)


def expand_query(query: str) -> str:
    """Add canonical platform vocabulary when the user used a colloquial name."""
    q = query or ""
    extra = [
        hint for pat, hint in PLATFORM_HINTS
        if re.search(pat, q, re.I) and hint.split()[0].lower() not in q.lower()
    ]
    return f"{q} ({' '.join(extra)})" if extra else q


def search(query: str, k: int = RETRIEVE_K):
    vs = get_vectorstore()
    pairs = vs.similarity_search_with_relevance_scores(expand_query(query), k=k)
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
