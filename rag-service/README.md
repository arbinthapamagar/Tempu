# Shakti RAG service

A small **Python / FastAPI** service that runs the retrieval-augmented generation
for Shakti support (the **Tempu Rag** knowledge base), based on the BOT project's
pipeline:

- **LangChain** loaders + `RecursiveCharacterTextSplitter` (chunk 500 / overlap 50)
- **Embeddings:** local **Ollama** `nomic-embed-text` (768-dim) — free, private, ~20 ms/query
- **Chat:** provider-switchable — **Google Gemini** *or* local **Ollama** (`AI_PROVIDER`)
- **Chroma** persistent vector store (its own Shakti-only collection, cosine space)
- top-k = 5 retrieval, gated by a relevance floor (`RAG_MIN_SCORE`) so weak matches
  are never cited

The Shakti Node backend calls this over HTTP (`backend/src/utils/rag.js`); the web
admin and mobile app never call it directly.

> **Key design choice:** embeddings **always** run on local Ollama, even when chat
> uses Gemini. Switching the chat provider therefore never requires re-ingesting
> the Chroma store. (Only changing the *embedder* would — see "Swapping the
> embedder" below.)

## Prerequisites
- **Ollama** running with the embedding model pulled (and the chat model too, if
  you run chat locally):
  ```bash
  ollama serve
  ollama pull nomic-embed-text      # required — embeddings
  ollama pull llama3.1:8b           # only needed when AI_PROVIDER=ollama
  ```

## Configuration
Copy `.env.sample` to `.env` and adjust. Key variables:

| Variable | Default | Purpose |
|---|---|---|
| `AI_PROVIDER` | `ollama` | Chat provider: `gemini` (fast) or `ollama` (local). Embeddings always stay local. |
| `GEMINI_API_KEY` | – | Primary Gemini key (needed when `AI_PROVIDER=gemini`). |
| `GEMINI_API_KEYS` | – | Optional comma-separated extra keys — rotated when one is exhausted/rejected. |
| `GEMINI_MODEL` | `gemini-flash-lite-latest` | Primary Gemini chat model. |
| `GEMINI_FALLBACK_MODELS` | (chain) | Models tried on a per-model 429/404, each key has its own quota. |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Local Ollama server. |
| `RAG_EMBED_MODEL` | `nomic-embed-text` | Embedding model (local Ollama). |
| `RAG_CHAT_MODEL` | `llama3.1:8b` | Local chat model (used when `AI_PROVIDER=ollama`). |
| `RAG_CHUNK_SIZE` / `RAG_CHUNK_OVERLAP` | `500` / `50` | Text splitting. |
| `RAG_RETRIEVE_K` | `5` | How many chunks to retrieve per query. |
| `RAG_MIN_SCORE` | `0.5` | Relevance floor — chunks below this are dropped before grounding, so off-topic queries don't cite random docs. Tuned to nomic's score distribution. |
| `RAG_COLLECTION` | `shakti` | Chroma collection name. |

## Run

Option A — reuse the BOT project's virtualenv (already has every dependency):
```bash
cd rag-service
/home/arbin/Arbeen/Development/BOT/BOT/.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8100
```

Option B — fresh virtualenv:
```bash
cd rag-service
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8100
```

Point the Node backend at it with `RAG_SERVICE_URL` (defaults to `http://localhost:8100`).

> The service must be started **separately** — it is not part of `npm start`. If the
> Node backend logs **"fetch failed"** on a knowledge query, this service (or Ollama)
> isn't reachable — check `ss -ltnp | grep -E '8100|11434'` and `tail` the uvicorn log.

## Endpoints (all JSON except `/ingest`)
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | – | `{ ok, embedModel, chatModel }` |
| POST | `/ingest` | multipart `files` | `{ chunks, results }` |
| POST | `/text` | `{ text, source }` | `{ chunks, source }` |
| GET | `/sources` | – | `{ sources:[{source,chunks}], embedModel }` |
| DELETE | `/source?name=` | – | `{ ok, deleted }` |
| DELETE | `/sources` | – | `{ ok }` (wipe) |
| POST | `/search` | `{ query, k? }` | `{ results:[{source,content,score}] }` |
| POST | `/ask` | `{ question, k? }` | `{ answer, sources }` |
| POST | `/chat` | `{ message, history?, k?, image? }` | `{ reply, sources }` |

`image` on `/chat` is an optional base64 data URL (`data:image/png;base64,…`); it's
understood only when `AI_PROVIDER=gemini` (Gemini vision). Retrieval still runs so KB
context is available alongside the image.

## Ingestion
Supported file types: **PDF, DOCX, MD, TXT**, and images (PNG/JPG/… — described via
Gemini vision when `AI_PROVIDER=gemini`, or OCR if `pytesseract` + the `tesseract-ocr`
binary are installed). Re-ingesting the same `source` name is idempotent (the old
chunks are deleted first).

## Swapping the embedder (optional)
A higher-quality Google embedder (`gemini-embedding-001`, 3072-dim, better
multilingual/Nepali) is included as a **commented alternative** in `ingest.py`
(`get_vectorstore()`) — see `embeddings.py`. To switch: uncomment the
`GeminiEmbeddings()` line + its import, set `ACTIVE_EMBED_MODEL` in `config.py`, then
**wipe `data/chroma` and re-ingest** — the vector dimensions differ (768 vs 3072), so
the stores are not compatible.

## Files
```
main.py         FastAPI routes (/ingest /search /ask /chat /sources /health)
config.py       env-driven config: provider, keys, chunk size, k, MIN_SCORE
ingest.py       load → chunk → embed → store in Chroma
retriever.py    similarity search with cosine relevance scores
answer.py       grounding + system prompt + Gemini/Ollama generation & failover
embeddings.py   optional Google embedder (documented alternative)
vision.py       optional image description (Gemini vision / OCR)
```

Data (Chroma + uploaded files) persists under `rag-service/data/` — gitignored.
