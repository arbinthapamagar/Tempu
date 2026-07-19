"""Shakti RAG microservice — FastAPI over the BOT-style LangChain + Chroma pipeline.

Consumed server-to-server by the Shakti Node backend (see backend/src/utils/rag.js).
Run:  uvicorn main:app --host 0.0.0.0 --port 8100
"""
import shutil
from typing import Optional

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from config import DOCS_DIR, ACTIVE_EMBED_MODEL, LLM_MODEL, RETRIEVE_K
import ingest
import retriever
import answer as answer_mod

app = FastAPI(title="Shakti RAG Service", version="1.0.0")
# Called server-to-server by the Node backend; open CORS is harmless for a
# localhost-internal service.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True, "embedModel": ACTIVE_EMBED_MODEL, "chatModel": LLM_MODEL}


@app.post("/ingest")
async def ingest_endpoint(files: list[UploadFile] = File(...)):
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
    return {"answer": r["reply"], "sources": r["sources"]}


class ChatIn(BaseModel):
    message: str = ""
    history: Optional[list] = None
    k: Optional[int] = None
    # Optional base64 data URL ("data:image/png;base64,…") for image understanding.
    image: Optional[str] = None


@app.post("/chat")
def chat_endpoint(body: ChatIn):
    r = answer_mod.answer(body.message, body.history or [], body.k or RETRIEVE_K, image=body.image)
    return {"reply": r["reply"], "sources": r["sources"]}
