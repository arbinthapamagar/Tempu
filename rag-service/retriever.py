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


# "some images?", "any screenshots", "show me a picture" — the user is asking to
# SEE something, not to read about it.
IMAGE_INTENT = re.compile(
    r"\b(image|images|screenshot|screenshots|picture|pictures|photo|photos|"
    r"diagram|diagrams|visual|visuals|show me|see it)\b", re.I,
)


def wants_images(query: str) -> bool:
    return bool(IMAGE_INTENT.search(query or ""))


# Which platform's docs the user is asking about. The illustrated PDFs are filed
# per platform ("Shipos Documentation (Shopify)-…"), and so are the help-center
# articles ("shopify-en-02-…"), so matching the source name is enough.
PLATFORM_OF_QUERY = (
    ("shopify", r"\bshopify\b"),
    ("wix", r"\bwix\b"),
    ("woocommerce", r"\b(woocommerce|wordpress|wp|woo)\b"),
)

# How many of the k slots may be given to illustrated chunks that text ranking
# alone would have left out. Two is enough to carry a procedure's key screens
# without crowding out the prose that explains them.
IMAGE_RESERVE = 2

# A screenshot only earns a reserved slot if it is properly on topic. MIN_SCORE
# (0.55) is the floor for "worth grounding on at all", which is too low here: at
# that level "hello" reaches an illustrated chunk, and answering a greeting with a
# screenshot of the shipment form is worse than answering it with nothing. Real
# procedural matches sit at 0.66+, so this only drops the incidental ones.
ILLUSTRATION_FLOOR = 0.60


def _platform(query: str):
    for name, pat in PLATFORM_OF_QUERY:
        if re.search(pat, query or "", re.I):
            return name
    return None


def _has_images(pair) -> bool:
    return bool((pair[0].metadata or {}).get("images"))


def _source_platform(pair):
    src = str((pair[0].metadata or {}).get("source", "")).lower()
    return next((name for name, _ in PLATFORM_OF_QUERY if name in src), None)


def search(query: str, k: int = RETRIEVE_K):
    vs = get_vectorstore()

    # Over-retrieve, then choose. Only two of the ~152 sources are illustrated
    # PDFs; the ~144 text-only help-center articles reliably out-rank them on
    # how-to phrasing, so plain top-k retrieval fills every slot with prose and
    # the answer arrives with no screenshots — while the screenshots sit right
    # there in the corpus, scoring 0.66+, just below the cutoff.
    pool = vs.similarity_search_with_relevance_scores(
        expand_query(query), k=min(max(k * 4, 24), 40)
    )

    illustrated = [p for p in pool if _has_images(p)]
    plain = [p for p in pool if not _has_images(p)]

    # Respect the platform the user named. Two ways this went wrong: "how to
    # create a shipment in shopify" answered with Wix screenshots because the Wix
    # chunk scored a hair higher (the right screens existed, in the Shopify doc),
    # and a WordPress question pulled in Shopify screenshots because no
    # WooCommerce PDF exists at all. Showing another platform's UI is worse than
    # showing none, so mismatches are dropped rather than reordered.
    # Platform-neutral sources (the REST API PDF, standalone uploads) still count.
    plat = _platform(query)
    if plat:
        illustrated = [p for p in illustrated if (_source_platform(p) or plat) == plat]

    if wants_images(query):
        # Asked to SEE something: illustrated chunks take the slots, with some
        # prose kept behind them because the screenshots still need explaining.
        pairs = (illustrated + plain)[:k]
    else:
        # Otherwise keep text ranking in the lead but always reserve a couple of
        # slots for illustrations, so a "how do I…" answer can show the screens
        # without the user having to ask for them in a second message.
        reserve = [p for p in illustrated if p[1] >= ILLUSTRATION_FLOOR][:IMAGE_RESERVE]
        keep = max(k - len(reserve), 1)
        chosen = plain[:keep] + reserve
        # Back to score order so the cited [1], [2] numbering reads naturally.
        pairs = sorted(chosen, key=lambda p: -p[1])[:k]

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
