"""Shakti RAG microservice — FastAPI over the BOT-style LangChain + Chroma pipeline.

Consumed server-to-server by the Shakti Node backend (see backend/src/utils/rag.js).
Run:  uvicorn main:app --host 0.0.0.0 --port 8100
"""
import shutil
from typing import Optional

import requests
from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from config import DOCS_DIR, ACTIVE_EMBED_MODEL, LLM_MODEL, RETRIEVE_K, OLLAMA_BASE_URL
import ingest
import retriever
import answer as answer_mod
from images import IMAGES_DIR

app = FastAPI(title="Shakti RAG Service", version="1.0.0")
# Called server-to-server by the Node backend; open CORS is harmless for a
# localhost-internal service.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# Images extracted from ingested documents. Served here for the Node backend to
# proxy (the admin UI never talks to :8100 directly) — see images.py.
app.mount("/images", StaticFiles(directory=str(IMAGES_DIR)), name="images")


@app.get("/health")
def health():
    # Reports whether Ollama is actually reachable, not just which model is
    # configured. Embeddings and retrieval both depend on it, so when it is down
    # nothing can be ingested or searched — previously this endpoint still said
    # "ok" and named the model, so a stopped Ollama looked like a healthy service.
    # Short timeout and never raises: /health must stay fast and always answer.
    ollama = {"reachable": False, "error": None}
    try:
        res = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=2)
        ollama["reachable"] = res.ok
        if res.ok:
            names = [m.get("name", "") for m in res.json().get("models", [])]
            ollama["embedModelPresent"] = any(n.split(":")[0] == ACTIVE_EMBED_MODEL.split(":")[0] for n in names)
        else:
            ollama["error"] = f"HTTP {res.status_code}"
    except Exception as e:  # noqa: BLE001 - unreachable is a reportable state, not a crash
        ollama["error"] = f"{type(e).__name__}: {e}"
    return {
        "ok": True,
        "embedModel": ACTIVE_EMBED_MODEL,
        "chatModel": LLM_MODEL,
        "ollama": ollama,
    }


# Deliberately sync (`def`, not `async def`) like every other endpoint here:
# ingestion is entirely blocking work (PDF parsing, image extraction, embedding
# round-trips) and FastAPI runs sync endpoints in a threadpool. As `async def` it
# ran that blocking work directly on the event loop, so one slow or stuck ingest
# froze the whole service — /health included, which made an ingest problem look
# like a dead service.
@app.post("/ingest")
def ingest_endpoint(files: list[UploadFile] = File(...)):
    saved = []
    for f in files:
        dest = DOCS_DIR / f.filename
        with open(dest, "wb") as out:
            shutil.copyfileobj(f.file, out)
        saved.append((str(dest), f.filename))
    total, results = ingest.ingest_files(saved)
    return {"chunks": total, "results": results}


class TextIn(BaseModel):
    text: str
    source: str = "pasted"


@app.post("/text")
def text_endpoint(body: TextIn):
    return {"chunks": ingest.ingest_text(body.text, body.source), "source": body.source}


@app.get("/sources")
def sources_endpoint():
    return {"sources": ingest.list_sources(), "embedModel": ACTIVE_EMBED_MODEL}


@app.get("/source/content")
def source_content_endpoint(name: str):
    return {"source": name, "text": ingest.get_source_text(name)}


@app.delete("/source")
def delete_source_endpoint(name: str):
    return {"ok": True, "deleted": ingest.delete_source(name), "source": name}


@app.delete("/sources")
def reset_endpoint():
    ingest.reset()
    return {"ok": True}


class SearchIn(BaseModel):
    query: str
    k: Optional[int] = None


@app.post("/search")
def search_endpoint(body: SearchIn):
    return {"results": retriever.search(body.query, body.k or RETRIEVE_K)}


class AskIn(BaseModel):
    question: str
    k: Optional[int] = None


@app.post("/ask")
def ask_endpoint(body: AskIn):
    r = answer_mod.answer(body.question, [], body.k or RETRIEVE_K)
    return {"answer": r["reply"], "sources": r["sources"], "images": r.get("images", [])}


class ChatIn(BaseModel):
    message: str = ""
    history: Optional[list] = None
    k: Optional[int] = None
    # Optional base64 data URL ("data:image/png;base64,…") for image understanding.
    image: Optional[str] = None


@app.post("/chat")
def chat_endpoint(body: ChatIn):
    r = answer_mod.answer(body.message, body.history or [], body.k or RETRIEVE_K, image=body.image)
    return {"reply": r["reply"], "sources": r["sources"], "images": r.get("images", [])}
