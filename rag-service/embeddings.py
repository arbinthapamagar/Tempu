"""Embeddings via Google's OpenAI-compatible endpoint (gemini-embedding-001).

Reuses the same GEMINI_KEYS + `Authorization: Bearer` auth as answer.py's chat
path — so the same key that works for chat works here, with no extra SDK
dependency — and rotates across keys on rejection/quota just like the chat and
vision paths.

Swapped in for the local Ollama nomic-embed-text embedder (kept commented in
ingest.py as a free, fully-private fallback) to get Google's higher-quality,
multilingual embeddings. NOTE: the vector dimension differs (nomic 768 vs
gemini-embedding-001 3072), so switching embedders requires wiping +
re-ingesting the Chroma store — the two are not interchangeable in place.
"""
import requests
from langchain_core.embeddings import Embeddings

from config import GEMINI_EMBED_MODEL, GEMINI_KEYS

EMBED_URL = "https://generativelanguage.googleapis.com/v1beta/openai/embeddings"


class GeminiEmbeddings(Embeddings):
    """LangChain-compatible embedder backed by the Gemini embeddings API."""

    def __init__(self, model: str = GEMINI_EMBED_MODEL, keys=None):
        self.model = model
        self.keys = keys or GEMINI_KEYS
        # Remember the last key that worked so we don't re-hit an exhausted one.
        self._active = 0

    def _embed_one(self, text: str):
        if not self.keys:
            raise RuntimeError("No GEMINI_API_KEY configured for embeddings")
        # Gemini rejects empty input; a single space is a safe stand-in.
        payload_text = text if (text and text.strip()) else " "
        last_exc = None
        for ka in range(len(self.keys)):
            idx = (self._active + ka) % len(self.keys)
            key = self.keys[idx]
            try:
                res = requests.post(
                    EMBED_URL,
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json={"model": self.model, "input": payload_text},
                    timeout=60,
                )
            except Exception as exc:  # noqa: BLE001 - network down; try the next key
                last_exc = exc
                continue
            if res.status_code in (401, 403, 429):
                # Bad or quota-exhausted key — roll to the next one.
                last_exc = requests.HTTPError(f"key#{idx + 1} -> {res.status_code}", response=res)
                continue
            res.raise_for_status()
            self._active = idx
            return res.json()["data"][0]["embedding"]
        raise last_exc if last_exc else RuntimeError("Gemini embeddings: no keys available")

    def embed_documents(self, texts):
        # One call per chunk keeps error handling simple and robust; the KB is
        # small enough that batching isn't worth the added failure surface.
        return [self._embed_one(t) for t in texts]

    def embed_query(self, text: str):
        return self._embed_one(text)
