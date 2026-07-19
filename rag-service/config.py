"""Central config for the Shakti RAG service.

Mirrors the BOT project's rag/ pipeline values (chunk 500/overlap 50, k=4,
nomic-embed-text + llama3.1:8b via Ollama) but scoped to Shakti with its own
Chroma store, so support answers are never grounded in unrelated corpora.
"""
import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).parent
# Load rag-service/.env so AI_PROVIDER / GEMINI_* are available when the service
# is started with a plain `uvicorn` (which doesn't read .env on its own).
load_dotenv(BASE_DIR / ".env")
DATA_DIR = BASE_DIR / "data"
DOCS_DIR = DATA_DIR / "documents"       # uploaded source files land here
CHROMA_DIR = DATA_DIR / "chroma"        # persistent vector store
DOCS_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

# Ollama (same local server BOT + VIntuna use). No API key needed.
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
EMBED_MODEL = os.environ.get("RAG_EMBED_MODEL", "nomic-embed-text")
LLM_MODEL = os.environ.get("RAG_CHAT_MODEL", "llama3.1:8b")

# Embeddings run on the local Ollama nomic-embed-text (768-dim) — free, private,
# and fast (~20ms/query, no network hop). The Google API embedder
# (gemini-embedding-001, 3072-dim, higher quality/multilingual) is kept as a
# commented alternative in ingest.py (see embeddings.py). Switching embedders
# changes the vector dimension, so the Chroma store must be wiped + re-ingested.
GEMINI_EMBED_MODEL = os.environ.get("GEMINI_EMBED_MODEL", "gemini-embedding-001")
# Name surfaced to the admin UI (/health, /sources) as the active embedder.
ACTIVE_EMBED_MODEL = EMBED_MODEL

# Chat-generation provider: 'gemini' (Google, fast) or 'ollama' (local). Only the
# chat model switches — embeddings + retrieval always stay on local Ollama so the
# Chroma vector store never needs re-ingesting.
AI_PROVIDER = os.environ.get("AI_PROVIDER", "ollama").lower()
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
# One or more keys: GEMINI_API_KEY is primary, GEMINI_API_KEYS holds extras
# (comma-separated). When a key's whole model chain is exhausted, roll to the next.
_GEMINI_EXTRA_KEYS = os.environ.get("GEMINI_API_KEYS", "")
GEMINI_KEYS = list(dict.fromkeys(
    [k.strip() for k in ([GEMINI_API_KEY] + _GEMINI_EXTRA_KEYS.split(",")) if k.strip()]
))
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-flash-lite-latest")
# Free-tier quota is per-model-per-day, so on a 429 we fail over to the next
# model (each has its own bucket). Primary first, then this chain.
_GEMINI_FALLBACKS = os.environ.get(
    "GEMINI_FALLBACK_MODELS",
    "gemini-flash-lite-latest,gemini-3-flash-preview,gemini-flash-latest,gemini-2.0-flash,gemini-2.0-flash-lite",
)
GEMINI_MODELS = list(dict.fromkeys(
    [GEMINI_MODEL] + [m.strip() for m in _GEMINI_FALLBACKS.split(",") if m.strip()]
))

# Generation params (mirror BOT/config.py).
LLM_TEMPERATURE = float(os.environ.get("RAG_TEMPERATURE", "0.3"))
LLM_NUM_CTX = int(os.environ.get("RAG_NUM_CTX", "8192"))
LLM_NUM_PREDICT = int(os.environ.get("RAG_NUM_PREDICT", "1800"))

# Retrieval / chunking (mirror BOT/config.py).
CHUNK_SIZE = int(os.environ.get("RAG_CHUNK_SIZE", "500"))
CHUNK_OVERLAP = int(os.environ.get("RAG_CHUNK_OVERLAP", "50"))
RETRIEVE_K = int(os.environ.get("RAG_RETRIEVE_K", "5"))

# Relevance floor for grounding: a chunk is only used as context / cited as a
# source when its cosine relevance clears this. nomic-embed gives loosely-related
# text a ~0.4 baseline, so 0.5 keeps genuine matches while dropping noise (e.g. a
# greeting no longer "matches" a random document). Tune via RAG_MIN_SCORE if the
# assistant answers too eagerly (raise it) or too rarely (lower it).
MIN_SCORE = float(os.environ.get("RAG_MIN_SCORE", "0.5"))

COLLECTION = os.environ.get("RAG_COLLECTION", "shakti")
