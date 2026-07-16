"""Grounded answer generation via ChatOllama (llama3.1:8b), retrieving context
from Chroma first. Returns the reply, the cited sources, and the raw hits (with
scores) so callers can apply their own relevance gate.
"""
import requests
from langchain_ollama import ChatOllama

from config import (
    LLM_MODEL,
    OLLAMA_BASE_URL,
    LLM_TEMPERATURE,
    LLM_NUM_CTX,
    LLM_NUM_PREDICT,
    RETRIEVE_K,
    MIN_SCORE,
    AI_PROVIDER,
    GEMINI_API_KEY,
    GEMINI_MODEL,
)
from retriever import search

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"

SYSTEM = (
    "You are **Tempu Rag**, the knowledge assistant for Tempu — a women-first "
    "ride-sharing platform in Nepal. You answer questions from the Tempu "
    "knowledge base (policies, fares, help articles, uploaded documents).\n\n"
    "RULES:\n"
    "- Answer using ONLY the KNOWLEDGE provided below. Never invent facts, "
    "numbers, prices, or policies. If the knowledge does not cover the question, "
    "say so plainly ('I don't have that in the knowledge base yet') and suggest "
    "contacting support — do NOT guess.\n"
    "- If the user just greets you or makes small talk ('hi', 'hello', 'thanks', "
    "'who are you'), reply warmly in one or two lines, say you're Tempu Rag and "
    "can answer questions from the Tempu knowledge base, and invite their "
    "question. Do NOT force knowledge into a greeting.\n"
    "- Be warm, clear, and concise. Format your reply as Markdown: a direct "
    "opening line, then bullet points or short paragraphs for detail. Bold the "
    "key facts.\n"
    "- Cite sources as [1], [2] inline when you draw on a specific passage."
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


def _generate(msgs):
    """Run one chat generation on the configured provider. `msgs` is a list of
    (role, text) tuples. Returns the reply text. Embeddings/retrieval are
    unaffected — only text generation switches provider."""
    if AI_PROVIDER == "gemini" and GEMINI_API_KEY:
        payload = {
            "model": GEMINI_MODEL,
            "messages": [{"role": r, "content": t} for r, t in msgs],
            "temperature": LLM_TEMPERATURE,
        }
        res = requests.post(
            GEMINI_URL,
            headers={"Authorization": f"Bearer {GEMINI_API_KEY}", "Content-Type": "application/json"},
            json=payload,
            timeout=60,
        )
        res.raise_for_status()
        return res.json()["choices"][0]["message"]["content"] or ""
    resp = llm().invoke(msgs)
    return getattr(resp, "content", None) or str(resp)


def _context(hits) -> str:
    if not hits:
        return ""
    return "\n\n".join(
        f"[{i + 1}] ({h['source']})\n{h['content'].strip()}" for i, h in enumerate(hits)
    )


def answer(message: str, history=None, k: int = RETRIEVE_K):
    raw_hits = search(message, k=k)
    # Only ground on genuinely relevant chunks. Below the relevance floor the
    # match is noise (e.g. a greeting nearest-neighbours some random doc), so we
    # drop it — that keeps answers from hallucinating off weak matches and stops
    # unrelated documents being cited as sources on small talk.
    hits = [h for h in raw_hits if h.get("score", 0) >= MIN_SCORE]
    ctx = _context(hits)
    sys = SYSTEM + (
        f"\n\nKNOWLEDGE:\n{ctx}" if ctx else "\n\n(No knowledge base entries matched this question.)"
    )
    msgs = [("system", sys)]
    for m in (history or [])[-8:]:
        role = "user" if (m.get("role") == "user") else "assistant"
        msgs.append((role, m.get("text", "")))
    msgs.append(("user", message))

    reply = _generate(msgs)
    sources = list(dict.fromkeys(h["source"] for h in hits))
    return {"reply": reply, "sources": sources, "hits": hits}
