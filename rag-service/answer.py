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
    GEMINI_MODELS,
)
from retriever import search

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
# Index of the last Gemini model that worked, so we don't re-hit an exhausted
# model on every request (mirrors the Node side).
_active_gemini_idx = 0

SYSTEM = (
    "You are **Tempu Rag**, the knowledge assistant for Tempu — a women-first "
    "ride-sharing platform in Nepal. You answer questions from the Tempu "
    "knowledge base (policies, fares, help articles, uploaded documents).\n\n"

    "GROUNDING:\n"
    "- Answer using ONLY the KNOWLEDGE provided below. Never invent facts, "
    "numbers, prices, or policies. If it isn't covered, say so plainly ('I don't "
    "have that in the knowledge base yet') and suggest contacting support — never guess.\n\n"

    "HOW TO ANSWER (be genuinely helpful, not robotic):\n"
    "- LEAD with a direct, confident answer to exactly what was asked in the first "
    "sentence — e.g. 'Yes — Arbin works with Node.js.' Then add the supporting "
    "detail.\n"
    "- Write like a knowledgeable colleague: natural, warm, flowing prose. Do NOT "
    "repeat the same point in different words, and don't pad with filler like 'here "
    "are a few key details'. Every line should add something new.\n"
    "- Use structure only when it truly helps: a short paragraph for a simple answer; "
    "tight bullets **only** when listing 3+ distinct items. Bold the key fact or "
    "figure so it stands out. Keep it concise.\n"
    "- Anticipate the obvious follow-up and fold it in when the knowledge supports it, "
    "but don't speculate beyond the sources.\n"
    "- Cite sources naturally as [1], [2] right after the fact they back — don't stack "
    "citations on every clause.\n\n"

    "GREETINGS & SMALL TALK:\n"
    "- For 'hi', 'hello', 'thanks', 'who are you', reply warmly in a line or two, say "
    "you're Tempu Rag and answer from the Tempu knowledge base, and invite a question. "
    "Never force knowledge into a greeting."
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
    unaffected — only text generation switches provider. On Gemini, a per-model
    daily 429 (or 404) fails over to the next model in the chain."""
    global _active_gemini_idx
    if AI_PROVIDER == "gemini" and GEMINI_API_KEY:
        oai = [{"role": r, "content": t} for r, t in msgs]
        last_exc = None
        for attempt in range(len(GEMINI_MODELS)):
            idx = (_active_gemini_idx + attempt) % len(GEMINI_MODELS)
            model = GEMINI_MODELS[idx]
            res = requests.post(
                GEMINI_URL,
                headers={"Authorization": f"Bearer {GEMINI_API_KEY}", "Content-Type": "application/json"},
                json={"model": model, "messages": oai, "temperature": LLM_TEMPERATURE},
                timeout=60,
            )
            if res.status_code in (429, 404):
                last_exc = requests.HTTPError(f"{model} -> {res.status_code}", response=res)
                continue
            res.raise_for_status()
            _active_gemini_idx = idx  # stick with the model that worked
            return res.json()["choices"][0]["message"]["content"] or ""
        # Every model exhausted — re-raise the last 429 so the caller shows the
        # quota message.
        raise last_exc if last_exc else RuntimeError("Gemini: no models available")
    resp = llm().invoke(msgs)
    return getattr(resp, "content", None) or str(resp)


def _context(hits) -> str:
    if not hits:
        return ""
    return "\n\n".join(
        f"[{i + 1}] ({h['source']})\n{h['content'].strip()}" for i, h in enumerate(hits)
    )


def _friendly_error(exc, stage: str) -> str:
    """Turn a provider/dependency failure into a clear message the admin sees
    (and that gets logged), instead of a bare 500."""
    msg = str(exc)
    # Gemini HTTP error (raise_for_status) carries the status on the response.
    status = getattr(getattr(exc, "response", None), "status_code", None)
    if status == 429:
        return ("⚠️ The Gemini AI quota has been used up for now. Enable billing on the "
                "Gemini API key (free-tier limits reset daily), or set AI_PROVIDER=ollama "
                "to use the local model.")
    if status in (401, 403):
        return "⚠️ The Gemini API key was rejected. Check GEMINI_API_KEY in rag-service/.env."
    if "connect to ollama" in msg.lower() or "connection" in msg.lower():
        if stage == "embed":
            return ("⚠️ The knowledge base search is unavailable — the local embedding model "
                    "(Ollama) can't be reached. Start it with `ollama serve` and try again.")
        return ("⚠️ The local AI (Ollama) isn't reachable. Start it with `ollama serve`, or set "
                "AI_PROVIDER=gemini in rag-service/.env.")
    return f"⚠️ The AI service hit an error while trying to answer ({stage}). Please try again shortly."


def answer(message: str, history=None, k: int = RETRIEVE_K):
    # Retrieval (uses local Ollama embeddings). If Ollama is down this is where
    # it fails — return a clear message rather than a 500 so the admin knows why.
    try:
        raw_hits = search(message, k=k)
    except Exception as exc:  # noqa: BLE001 - surface any dependency failure cleanly
        return {"reply": _friendly_error(exc, "embed"), "sources": [], "hits": [], "error": True}

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

    # Generation (Gemini or Ollama). Gemini quota / key / connection problems land
    # here — again, return a clear message instead of a 500.
    try:
        reply = _generate(msgs)
    except Exception as exc:  # noqa: BLE001
        return {"reply": _friendly_error(exc, "generate"), "sources": [], "hits": hits, "error": True}

    sources = list(dict.fromkeys(h["source"] for h in hits))
    return {"reply": reply, "sources": sources, "hits": hits}
