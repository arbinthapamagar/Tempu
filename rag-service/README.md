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
| `RAG_MIN_SCORE` | `0.63` | Relevance floor — chunks below this are dropped before grounding, so off-topic queries don't cite random docs. Tuned to nomic's score distribution **and to the store's size** — a bigger store needs a higher floor, since more chunks means more chances an off-topic query finds something. Re-calibrated to 0.63 for the ~600-chunk store (was 0.5 at 64 chunks). |
| `RAG_COLLECTION` | `shakti` | Chroma collection name. |

## Run

**Option A (easiest) — `npm run rag`:**
```bash
cd rag-service
npm run rag        # add :dev for --reload while editing the Python
```
There is no Node code here — `package.json` exists purely so this Python service starts
the same way as the Node ones, instead of you having to remember the interpreter path.
It wraps Option B below. Override with `RAG_PYTHON=` (interpreter) or `RAG_PORT=` (default 8100).

Option B — reuse the BOT project's virtualenv (already has every dependency):
```bash
cd rag-service
/home/arbin/Arbeen/Development/BOT/BOT/.venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port 8100
```
The absolute path matters: there is no venv in this directory, so a bare `uvicorn` or
`python` uses the system interpreter and dies on the missing imports.

Option C — fresh virtualenv:
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

### Screenshots in answers
Embedded images are **extracted, kept and shown in answers** — the text loaders drop
them otherwise, which silently loses every screenshot in an uploaded guide (see
`images.py`):

- **PDF** — images are pulled per page (`pypdf`) and attached to that page's text, so
  a screenshot stays with the step it illustrates.
- **DOCX** — images come from `word/media/`; zip order doesn't preserve position, so
  they attach to the end of the document.
- **A directly uploaded image** — the file is kept alongside its vision/OCR description,
  so an answer can show the screenshot instead of only describing it.

Logos, icons and dividers are filtered out (`MIN_BYTES` / `MIN_DIMENSION` in
`images.py`). Each kept image is woven into the chunk text as
`![Screenshot](/admin/knowledge/images/<source>/<file>)`, and `answer.py` instructs the
model to reproduce that markdown verbatim next to the relevant step. `/chat` and `/ask`
also return an `images` array of everything available in the grounded context, as a
fallback when the model doesn't inline them.

Files live in `data/images/<source>/` and are served by this service at `/images/...`.
The admin UI never reaches :8100 directly, so the Node backend proxies them at
`GET /api/v1/admin/knowledge/images/:dir/:file` behind admin auth (the KB can hold
private uploads). The frontend can't use a plain `<img src>` there — it authenticates
with a Bearer token — so `web/frontend/src/components/ai/Markdown.jsx` fetches the bytes
through the authed client and renders an object URL. Deleting or re-ingesting a source
removes its images too.

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
images.py       extract/persist/serve images embedded in ingested documents
```

Data (Chroma + uploaded files) persists under `rag-service/data/` — gitignored.

## Troubleshooting

**Nothing ingests, and requests hang forever with no error.**

Check Ollama first — embeddings and retrieval both need it, and it has no systemd
unit on this machine, so it does not come back after a reboot:

```bash
curl localhost:8100/health      # "ollama": {"reachable": true, ...}
ollama serve &                  # if unreachable
```

If Ollama is up but calls still hang, suspect the persisted Chroma HNSW index.
When the service is killed mid-write, the vector segment under
`data/chroma/<segment-uuid>/` can be left corrupt, and Chroma's Rust core then
**hangs indefinitely on any collection operation** — `count()` included. There is
no error and no timeout, so it looks like a dead service rather than a broken
index. Confirm with:

```bash
# hangs => corrupt index;  prints a number => index is fine
python -c "import chromadb; c=chromadb.PersistentClient(path='data/chroma'); print(c.get_collection('shakti').count())"
```

To recover, stop the service, back up `data/chroma`, and move the vector segment
directory aside — Chroma reloads the collection from SQLite:

```bash
sqlite3 data/chroma/chroma.sqlite3 "select id from segments where scope='VECTOR';"
mv data/chroma/<that-uuid> /tmp/
```

That unblocks the service, but **it does not restore the vectors**: only records
still in `embeddings_queue` get replayed into the new index, so most chunks end up
in SQLite yet absent from the vector index — retrieval then silently searches a
fraction of the knowledge base. Verify and, if needed, re-embed every chunk from
the text SQLite still holds (no PDF re-parsing or vision calls required):

```bash
python -c "
import chromadb; c=chromadb.PersistentClient(path='data/chroma'); col=c.get_collection('shakti')
n=len(col.query(query_embeddings=[[0.01]*768], n_results=10000, include=[])['ids'][0])
print('in vector index:', n, 'of', col.count())"
```
