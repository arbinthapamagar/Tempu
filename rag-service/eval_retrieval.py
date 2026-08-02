"""Measure retrieval quality and calibrate RAG_MIN_SCORE for the active embedder.

Run after any embedder change:  python eval_retrieval.py

Two things this answers, neither of which a benchmark score can:

1. **Recall per language.** The gold set below asks the SAME dozen questions in
   English and in Hebrew, each pointing at the parallel article
   (`shopify-en-01-installation` / `shopify-he-01-installation`). Identical
   topics in both languages means any recall gap is the embedder's multilingual
   ability rather than the questions being harder. This is the test
   nomic-embed-text failed: Hebrew recall@1 0/8 while *scoring higher* than
   English, because it collapses Hebrew into a narrow band where wrong articles
   score 0.75-0.81 — high scores over wrong hits, which no threshold can fix.

2. **Where RAG_MIN_SCORE belongs.** The floor is embedder-specific: it is only
   meaningful as the gap between what on-topic and off-topic queries score on
   *this* model. The on-topic set therefore includes real admin phrasing with
   typos and shorthand, which embeds far lower than polished test queries — a
   floor calibrated on clean phrasing (0.63 was, once) silently refuses genuine
   questions. The off-topic set is mostly greetings, since those are what
   actually arrive and get wrongly grounded.

Prints a suggested floor, but read the overlap report before taking it: if the
two distributions overlap there is no clean floor, and the right call is to err
toward answering (answer.py's prompt handles a greeting that drags in a weak
chunk; a refused real question just looks broken).
"""
import argparse
import statistics
import sys

from config import EMBED_MODEL, MIN_SCORE

# (query, [acceptable sources]) — a query is a hit if any listed source is
# retrieved. Topics are paired EN/HE against the same underlying article.
PAIRED = [
    ("how do I install ShipOS on Shopify",
     "איך מתקינים את שיפוס בשופיפיי", "shopify-{}-01-installation"),
    ("how to create a shipment in Shopify",
     "איך יוצרים משלוח בשופיפיי", "shopify-{}-02-creating-shipments"),
    ("returns in Shopify",
     "החזרות בשופיפיי", "shopify-{}-06-returns"),
    ("install the ShipOS app on Wix",
     "התקנת האפליקציה של שיפוס בוויקס", "wix-{}-01-installation"),
    ("pickup points in Wix",
     "נקודות איסוף בוויקס", "wix-{}-03-pickup-points"),
    ("printing shipping labels in WooCommerce",
     "הדפסת מדבקות משלוח בווקומרס", "woocommerce-{}-04-labels"),
    ("track a shipment in WooCommerce",
     "מעקב אחרי משלוח בווקומרס", "woocommerce-{}-08-tracking"),
    ("cash on delivery",
     "תשלום במזומן בעת המסירה", "woocommerce-{}-14-cash-on-delivery"),
    ("free shipping rules",
     "כללים למשלוח חינם", "woocommerce-{}-18-free-shipping"),
    ("SMS notifications to customers",
     "הודעות SMS ללקוחות", "woocommerce-{}-11-sms-notifications"),
    ("what is ShipOS",
     "מה זה שיפוס", "general-{}-01-about-shipos"),
    ("account settings",
     "הגדרות חשבון", "general-{}-09-account-settings"),
]

# Real admin phrasing, typos and all — the reason the 0.63 floor was wrong.
MESSY = [
    ("clinet wana add collection point how can he",
     ["woocommerce-en-05-pickup-points", "shopify-en-03-pickup-points",
      "wix-en-03-pickup-points", "shopify-en-08-independent-pickup-points",
      "woocommerce-en-10-self-pickup", "company-en-self-pickup"]),
    ("client cant see app", ["general-en-04-troubleshooting",
                             "shopify-en-01-installation", "wix-en-01-installation",
                             "woocommerce-en-01-installation"]),
    ("how to instal in wordpres", ["woocommerce-en-01-installation",
                                   "woocommerce-en-02-setup-wizard"]),
    ("label not printing", ["woocommerce-en-04-labels", "wix-en-05-labels",
                            "general-en-04-troubleshooting"]),
]

# What must NOT clear the floor. Mostly greetings: these are what actually
# arrive alongside real questions, and grounding one cites a random document.
OFF_TOPIC = [
    "hello", "hi", "hey there", "thanks!", "ok", "good morning",
    "שלום", "תודה",
    "what's the weather in Kathmandu",
    "who is the prime minister of Nepal",
    "write me a poem about the sea",
]

TOP_N = 8


def rank_of(hits, acceptable):
    """1-based rank of the first hit from an acceptable source, else None."""
    for i, h in enumerate(hits, 1):
        if h["source"] in acceptable:
            return i
    return None


def run(query, k):
    from ingest import get_vectorstore
    # Deliberately the raw vector search, not retriever.search(): that layer adds
    # query expansion and reserves slots for illustrated chunks, which is right
    # in production but would credit/blame the embedder for someone else's work.
    pairs = get_vectorstore().similarity_search_with_relevance_scores(query, k=k)
    return [{"source": (d.metadata or {}).get("source", "?"), "score": float(s)}
            for d, s in pairs]


def report_recall(label, rows):
    """rows: list of (query, rank_or_None, top_score)."""
    n = len(rows)
    at = lambda k: sum(1 for _, r, _ in rows if r is not None and r <= k)
    print(f"\n{label}  (n={n})")
    print(f"  recall@1 {at(1)}/{n}   recall@3 {at(3)}/{n}   recall@{TOP_N} {at(TOP_N)}/{n}")
    tops = [s for _, _, s in rows]
    if tops:
        print(f"  top-1 score: mean {statistics.mean(tops):.3f}  "
              f"min {min(tops):.3f}  max {max(tops):.3f}")
    for q, r, s in rows:
        mark = "ok " if r == 1 else (f"@{r} " if r else "MISS")
        print(f"    {mark} {s:.3f}  {q}")
    return rows


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("-k", type=int, default=TOP_N, help="chunks retrieved per query")
    args = ap.parse_args()

    print(f"embedder: {EMBED_MODEL}   current RAG_MIN_SCORE={MIN_SCORE}")

    per_lang = {}
    for en, he, tmpl in PAIRED:
        for lang, q in (("en", en), ("he", he)):
            hits = run(q, args.k)
            per_lang.setdefault(lang, []).append(
                (q, rank_of(hits, {tmpl.format(lang)}), hits[0]["score"] if hits else 0.0))

    for lang in ("en", "he"):
        report_recall(f"ON-TOPIC / {lang.upper()}", per_lang[lang])

    messy = []
    for q, acceptable in MESSY:
        hits = run(q, args.k)
        messy.append((q, rank_of(hits, set(acceptable)), hits[0]["score"] if hits else 0.0))
    report_recall("ON-TOPIC / messy real phrasing", messy)

    off = []
    for q in OFF_TOPIC:
        hits = run(q, args.k)
        off.append((q, None, hits[0]["score"] if hits else 0.0))
    print(f"\nOFF-TOPIC  (n={len(off)}) — these must NOT clear the floor")
    for q, _, s in sorted(off, key=lambda r: -r[2]):
        print(f"    {s:.3f}  {q}")

    on_scores = [s for rows in list(per_lang.values()) + [messy] for _, _, s in rows]
    off_scores = [s for _, _, s in off]
    lo, hi = min(on_scores), max(off_scores)
    print("\n--- calibration ---")
    print(f"  lowest on-topic top-1 : {lo:.3f}")
    print(f"  highest off-topic     : {hi:.3f}")
    if lo > hi:
        floor = round((lo + hi) / 2, 2)
        print(f"  clean gap -> RAG_MIN_SCORE={floor:.2f} separates them")
    else:
        # Overlap is the normal case, not a failure of the measurement.
        stuck = sum(1 for s in on_scores if s <= hi)
        print(f"  OVERLAP: {stuck}/{len(on_scores)} on-topic queries score at or "
              f"below the best off-topic one ({hi:.3f}).")
        print("  No floor separates them. Err toward answering: pick a value that "
              "keeps the real questions, and let answer.py's GREETINGS prompt "
              "handle a greeting that drags in a weak chunk.")
        print(f"  Keeping every on-topic query would need RAG_MIN_SCORE<={lo:.2f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
