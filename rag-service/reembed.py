"""Re-embed the Chroma store with the currently configured embedder.

Run after changing RAG_EMBED_MODEL:  python reembed.py

Why this exists instead of "wipe + re-upload everything": a Chroma collection
stores fixed-width vectors, so a new embedder (bge-m3 1024-dim vs the old
nomic-embed-text 768-dim) cannot be dropped into the existing one — but the
chunk TEXT and metadata already in the store are exactly what re-ingesting would
reproduce, only more faithfully. Re-ingesting instead would:
  * re-run Gemini vision/OCR over the illustrated PDFs, producing different
    image descriptions than the ones the answer prompt was tuned against (and
    burning quota),
  * lose the per-source chunk sizes — the help-center articles were ingested at
    1500/150, not the global 500/50, so re-running them through ingest.py would
    silently re-chunk them,
  * and depend on every original upload still sitting in data/documents/.

So we read the chunks out, swap the collection, and put the same chunks back
through the new embedder. Text and metadata are carried over verbatim; only the
vectors are recomputed.

The old store is copied to data/chroma.reembed-backup-<stamp> first. If the run
fails partway, restore that directory over data/chroma.
"""
import argparse
import logging
import shutil
import sys
import time
from datetime import datetime

import chromadb
from langchain_core.documents import Document

from config import CHROMA_DIR, COLLECTION, EMBED_MODEL, DATA_DIR

logging.basicConfig(level=logging.INFO, format="%(message)s")
log = logging.getLogger("rag.reembed")

# Ollama embeds one batch per HTTP round-trip. 32 keeps each request short enough
# that a stall is obvious in the progress log rather than looking like a hang.
BATCH = 32


def read_existing():
    """Pull every chunk out of the current collection.

    Uses the raw chromadb client, not ingest.get_vectorstore(): that one is
    already wired to the NEW embedder, and while reading wouldn't embed
    anything, pointing the new-dimension store at the old collection is exactly
    the mismatch we're here to avoid.
    """
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    names = [c if isinstance(c, str) else c.name for c in client.list_collections()]
    if COLLECTION not in names:
        log.error("collection %r not found in %s (have: %s)", COLLECTION, CHROMA_DIR, names)
        return None
    col = client.get_collection(COLLECTION)
    got = col.get(include=["documents", "metadatas"])
    ids = got.get("ids", []) or []
    docs = got.get("documents", []) or []
    metas = got.get("metadatas", []) or []
    # Keep the original ids: delete_source() and the images on disk are keyed by
    # the `source` metadata, but stable ids mean a re-run is idempotent.
    return [
        (i, Document(page_content=d or "", metadata=m or {}))
        for i, d, m in zip(ids, docs, metas)
    ]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true",
                    help="report what would be re-embedded and exit")
    ap.add_argument("--yes", action="store_true",
                    help="skip the confirmation prompt")
    args = ap.parse_args()

    rows = read_existing()
    if rows is None:
        return 1
    if not rows:
        log.info("collection %r is empty — nothing to re-embed.", COLLECTION)
        return 0

    sources = {}
    for _, doc in rows:
        sources[doc.metadata.get("source", "unknown")] = \
            sources.get(doc.metadata.get("source", "unknown"), 0) + 1
    log.info("%d chunks across %d sources -> re-embedding with %r",
             len(rows), len(sources), EMBED_MODEL)
    if args.dry_run:
        for s, n in sorted(sources.items()):
            log.info("  %5d  %s", n, s)
        return 0

    if not args.yes:
        # The old vectors are unrecoverable without this run finishing, so make
        # the operator say so out loud.
        reply = input(f"Replace the {COLLECTION!r} vectors with {EMBED_MODEL!r}? [y/N] ")
        if reply.strip().lower() not in ("y", "yes"):
            log.info("aborted.")
            return 1

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = DATA_DIR / f"chroma.reembed-backup-{stamp}"
    log.info("backing up %s -> %s", CHROMA_DIR, backup)
    shutil.copytree(CHROMA_DIR, backup)

    # Import only now: this constructs the new-embedder vectorstore, and it must
    # happen after the backup exists.
    import ingest

    log.info("dropping the old collection")
    ingest.reset()
    vs = ingest.get_vectorstore()

    t0 = time.time()
    done = 0
    for start in range(0, len(rows), BATCH):
        batch = rows[start:start + BATCH]
        vs.add_documents([d for _, d in batch], ids=[i for i, _ in batch])
        done += len(batch)
        rate = done / max(time.time() - t0, 1e-6)
        log.info("  %d/%d chunks (%.1f/s, ~%ds left)",
                 done, len(rows), rate, int((len(rows) - done) / max(rate, 1e-6)))

    # Confirm the store actually holds what we put in it, at the new width.
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    col = client.get_collection(COLLECTION)
    probe = col.get(limit=1, include=["embeddings"])
    dim = len(probe["embeddings"][0]) if len(probe.get("embeddings", [])) else 0
    log.info("done in %.0fs — %d chunks, %d-dim vectors (%s)",
             time.time() - t0, col.count(), dim, EMBED_MODEL)
    if col.count() != len(rows):
        log.error("COUNT MISMATCH: expected %d, got %d — restore %s", len(rows), col.count(), backup)
        return 1
    log.info("backup kept at %s — delete it once retrieval looks right.", backup)
    log.info("NOTE: RAG_MIN_SCORE is calibrated per-embedder. Re-measure it "
             "against real queries before trusting the relevance gate.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
