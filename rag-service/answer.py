"""Grounded answer generation via ChatOllama (llama3.1:8b), retrieving context
from Chroma first. Returns the reply, the cited sources, and the raw hits (with
scores) so callers can apply their own relevance gate.
"""
from langchain_ollama import ChatOllama

from config import (
    LLM_MODEL,
    OLLAMA_BASE_URL,
    LLM_TEMPERATURE,
    LLM_NUM_CTX,
    LLM_NUM_PREDICT,
    RETRIEVE_K,
)
from retriever import search

SYSTEM = (
    "You are the Tempu Assistant, a helpful support assistant for the Tempu "
    "ride-hailing platform. Answer the user using ONLY the KNOWLEDGE below. If "
    "the knowledge does not cover the question, say you don't have that "
    "information yet and suggest contacting support — do NOT make things up. Be "
    "warm, concise, and clear. Cite sources as [1], [2] when relevant."
)

_llm = None


def llm():
    global _llm
    if _llm is None:
        _llm = ChatOllama(
            model=LLM_MODEL,
            base_url=OLLAMA_BASE_URL,
            temperature=LLM_TEMPERATURE,
            num_ctx=LLM_NUM_CTX,
            num_predict=LLM_NUM_PREDICT,
        )
    return _llm


def _context(hits) -> str:
    if not hits:
        return ""
    return "\n\n".join(
        f"[{i + 1}] ({h['source']})\n{h['content'].strip()}" for i, h in enumerate(hits)
    )


def answer(message: str, history=None, k: int = RETRIEVE_K):
    hits = search(message, k=k)
    ctx = _context(hits)
    sys = SYSTEM + (
        f"\n\nKNOWLEDGE:\n{ctx}" if ctx else "\n\n(No knowledge base entries matched this question.)"
    )
    msgs = [("system", sys)]
    for m in (history or [])[-8:]:
        role = "user" if (m.get("role") == "user") else "assistant"
        msgs.append((role, m.get("text", "")))
    msgs.append(("user", message))

    resp = llm().invoke(msgs)
    reply = getattr(resp, "content", None) or str(resp)
    sources = list(dict.fromkeys(h["source"] for h in hits))
    return {"reply": reply, "sources": sources, "hits": hits}
