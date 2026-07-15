# Shakti RAG service

A small **Python / FastAPI** service that runs the retrieval-augmented generation
for Shakti support, using the **same stack and pipeline as the BOT project**:

- **LangChain** loaders + `RecursiveCharacterTextSplitter` (chunk 500 / overlap 50)
- **Ollama** embeddings (`nomic-embed-text`) and chat (`llama3.1:8b`)
- **Chroma** persistent vector store (its own Shakti-only collection)
- top-k = 4 retrieval, cosine relevance

The Shakti Node backend calls this over HTTP (`backend/src/utils/rag.js`); the web
admin and mobile app never call it directly.

## Prerequisites
- **Ollama** running with both models pulled:
  ```bash
  ollama serve
  ollama pull llama3.1:8b
  ollama pull nomic-embed-text
  ```

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
| POST | `/chat` | `{ message, history?, k? }` | `{ reply, sources }` |

Data (Chroma + uploaded files) persists under `rag-service/data/` — gitignored.
