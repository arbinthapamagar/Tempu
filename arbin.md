# How I built a private, self-hosted RAG knowledge assistant from scratch 🚀

> A build journal — from the first "hi, does this even work?" to a working, grounded AI that answers from real documents with citations. Written while building **Tempu**, a women-first EV ride-sharing platform in Nepal.

---

## 📸 How to use this doc

I've embedded **real, live output from my own running service** as proof it works (the code blocks below are actual responses, not mock-ups). Wherever you see a
`![...](./screenshots/...)` line, drop in a screenshot of the admin UI — I've marked exactly what to capture.

> 👉 Screenshots to add live in the `./screenshots/` folder (already created). The knowledge-base UI is at `web/frontend/src/pages/knowledge/KnowledgeBase.jsx`.

---

## Chapter 1 — "hi, can I even talk to an AI?"

It started small. My first goal wasn't RAG at all — it was just: *can I get a local model to reply to "hi" on my own machine, with no API bill and no data leaving my laptop?*

So I installed **Ollama**, pulled a model, and sent it a hello. It replied. That tiny moment — a language model running fully offline on my own hardware — is what convinced me the whole thing was possible.

![Screenshot: the very first "hi" reply in the chat UI](./screenshots/01-first-hello.png)
*↑ Add a screenshot of the first chat reply here.*

## Chapter 2 — the real problem

A model that chats is nice. A model that chats **about your actual documents, without making things up**, is useful. That's **RAG** (Retrieval-Augmented Generation): instead of trusting what the model "knows," you retrieve the relevant pieces of *your* documents first and make it answer only from those.

The goal became clear:

> Let an admin ask a question about company docs — policies, fares, help articles, uploaded PDFs — and get a **grounded answer with citations**, privately and cheaply.

## Chapter 3 — the architecture I landed on

I built the AI as a **separate Python FastAPI microservice**, and my main **Node.js backend proxies to it**. Clean separation: the AI service can crash, restart, or be swapped without touching the main app.

```
Upload doc ─► chunk ─► embed ─► store in vector DB (Chroma)
                                        │
User question ─► embed ─► similarity search ─► relevance gate ─► LLM ─► grounded answer + citations
```

**The stack:**

| Layer | Tool | Why |
|---|---|---|
| API service | **FastAPI** | fast, tiny, async |
| Doc loading + splitting | **LangChain** | PDF/DOCX/MD/TXT loaders out of the box |
| Vector store | **ChromaDB** | persistent, local, cosine similarity |
| Embeddings | **Ollama + `nomic-embed-text`** | 100% local, free, ~20ms/query |
| Answer generation | **Google Gemini** (or local Ollama) | switchable with one env var |
| Glue | **Node.js proxy** | rest of the app keeps one clean API |

![Screenshot: the Knowledge Base admin page with documents listed](./screenshots/02-knowledge-page.png)
*↑ Add a screenshot of the `/knowledge` admin page here.*

## Chapter 4 — the decisions I actually had to make

**1. Local embeddings vs cloud embeddings.**
I tested Google's `gemini-embedding-001` (3072-dim) against local `nomic-embed-text` (768-dim). Gemini scored higher on relevance and was better at Nepali — but nomic was **~10x faster, free, and fully private**. For an internal tool, speed + privacy won. I kept the Gemini embedder in the code as a documented alternative.

**2. Provider-switchable chat, locked-local embeddings.**
The *chat* model switches between Gemini (fast) and local Ollama (private) with one env var — but *embeddings always stay local*. This means I can swap the "brain" **without ever re-processing my documents.** Decoupling those two was the best call I made.

**3. Don't let it hallucinate — the relevance gate.**
Every retrieved chunk gets a **relevance score**, and anything below a tuned floor is dropped *before* it reaches the model. So a "hi 👋" doesn't accidentally cite a random document. The system prompt is strict: *answer ONLY from the knowledge base; if it's not there, say so — never guess.*

**4. Engineer for the day the API fails — because it will.**
Free-tier quotas run out, keys get rejected, services go down. So I built **automatic failover that rotates across multiple API keys AND multiple models**: a `429` (quota) tries the next model, a rejected key rolls to the next key, and it remembers the last working combo so it doesn't waste calls. Every failure returns a **clear human message** ("the local model isn't running — start it and try again") instead of a cryptic 500.

## Chapter 5 — proof it works (real output)

**Health check** — the service reports its active models:

```json
{ "ok": true, "embedModel": "nomic-embed-text", "chatModel": "llama3.1:8b" }
```

**Ingested sources** — documents chunked and stored in the vector DB:

```json
{
  "sources": [
    { "source": "Arbin CV.pdf", "chunks": 17 },
    { "source": "ShipOS Rest API 2026.pdf", "chunks": 42 }
  ],
  "embedModel": "nomic-embed-text"
}
```

**Retrieval with real relevance scores** — the gate keeps the genuine matches, drops the noise:

```json
{
  "results": [
    {
      "source": "Arbin CV.pdf",
      "content": "...currently growing into AI-powered systems, RAG pipelines, and Shopify app development...",
      "score": 0.592
    },
    {
      "source": "Arbin CV.pdf",
      "content": "...Built responsive React frontends with reusable components, React Router, hooks, and Tailwind CSS...",
      "score": 0.576
    }
  ]
}
```

**A grounded answer with citations** — it only speaks from the retrieved docs:

```json
{
  "answer": "Arbin is currently working on Shopify app development and CRUD operations, which you can find on his GitHub [1].",
  "sources": ["Arbin CV.pdf", "ShipOS Rest API 2026.pdf"]
}
```

![Screenshot: asking a question in the UI and getting an answer with [1] citations](./screenshots/03-answer-with-citations.png)
*↑ Add a screenshot of a real question + answer with citations here.*

## Chapter 6 — the project structure

```
rag-service/
├── main.py         # FastAPI routes: /ingest /search /ask /chat /sources /health
├── config.py       # all tunables: chunk size, k, MIN_SCORE, provider, keys
├── ingest.py       # load → chunk → embed → store in Chroma
├── retriever.py    # similarity search with relevance scores
├── answer.py       # grounding + prompt + Gemini/Ollama failover
├── embeddings.py   # optional Google embedder (documented alternative)
└── vision.py       # optional image understanding
```

## Chapter 7 — what else I'm learning (and building next)

RAG is one half of the AI I'm building into Tempu. The other half is an **agentic AI assistant** — instead of retrieving documents, it uses **tool-calling** to query live data (safe, read-only) and reason over it. Two very different AI patterns:

- **RAG** → "answer from my documents"
- **Agentic / tool-calling** → "go fetch live data and reason about it"

I'm also actively learning **rerankers and hybrid search** (to sharpen retrieval as the corpus grows), **prompt engineering**, **local-vs-cloud model trade-offs**, and **vector databases** at scale. Every feature teaches me something the last one didn't.

## What I learned building this

- **RAG is 20% "retrieve + generate" and 80% the boring, critical stuff** — relevance gating, error handling, failover, privacy.
- **Decouple your embedding model from your chat model.** It saves enormous pain later.
- **Local models are shockingly capable** for internal tools — you don't always need a frontier model or a per-query bill.
- **Grounding discipline beats model size.** A strict prompt + a relevance floor beats a bigger model that's allowed to guess.

---

If you're building RAG, my advice: **start with "hi," stay grounded, and engineer for the day the API fails.** 😄

Happy to go deeper on any part — drop a comment. 👇

#RAG #AI #MachineLearning #Python #FastAPI #LangChain #Ollama #LLM #VectorDatabase #SoftwareEngineering #BuildInPublic #Nepal
