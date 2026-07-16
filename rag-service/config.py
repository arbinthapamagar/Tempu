"""Central config for the Shakti RAG service.

Mirrors the BOT project's rag/ pipeline values (chunk 500/overlap 50, k=4,
nomic-embed-text + llama3.1:8b via Ollama) but scoped to Shakti with its own
Chroma store, so support answers are never grounded in unrelated corpora.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
DOCS_DIR = DATA_DIR / "documents"       # uploaded source files land here
CHROMA_DIR = DATA_DIR / "chroma"        # persistent vector store
DOCS_DIR.mkdir(parents=True, exist_ok=True)
CHROMA_DIR.mkdir(parents=True, exist_ok=True)

# Ollama (same local server BOT + VIntuna use). No API key needed.
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
EMBED_MODEL = os.environ.get("RAG_EMBED_MODEL", "nomic-embed-text")
LLM_MODEL = os.environ.get("RAG_CHAT_MODEL", "llama3.1:8b")

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
