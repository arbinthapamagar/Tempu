"""Ingest pipeline — load -> chunk -> embed -> persist to Chroma.

Same pipeline as BOT/rag/ingest.py: LangChain loaders + RecursiveCharacterTextSplitter
+ OllamaEmbeddings + Chroma.
"""
from pathlib import Path

from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import (
    PyPDFLoader,
    TextLoader,
    UnstructuredMarkdownLoader,
    Docx2txtLoader,
)
from langchain_core.documents import Document
from langchain_ollama import OllamaEmbeddings
from langchain_chroma import Chroma

from config import (
    CHROMA_DIR,
    EMBED_MODEL,
    OLLAMA_BASE_URL,
    CHUNK_SIZE,
    CHUNK_OVERLAP,
    COLLECTION,
)
# from embeddings import GeminiEmbeddings  # Google API embedder (see get_vectorstore)
from vision import describe_image

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif", ".gif"}

_vs = None


def get_vectorstore() -> Chroma:
    global _vs
    if _vs is None:
        # Local Ollama nomic-embed-text — free, private, and fast (~20ms/query, no
        # network round-trip), which is why it's the active embedder.
        embeddings = OllamaEmbeddings(model=EMBED_MODEL, base_url=OLLAMA_BASE_URL)
        # Google API embeddings (gemini-embedding-001) — higher quality, multilingual.
        # To switch: uncomment the next line (and its import above), set
        # ACTIVE_EMBED_MODEL=GEMINI_EMBED_MODEL in config, then wipe + re-ingest
        # Chroma (nomic 768-dim vs gemini 3072-dim — the stores aren't compatible).
        # embeddings = GeminiEmbeddings()
        _vs = Chroma(
            persist_directory=str(CHROMA_DIR),
            embedding_function=embeddings,
            collection_name=COLLECTION,
            # cosine so relevance scores are meaningful for the MIN_SCORE gate.
            collection_metadata={"hnsw:space": "cosine"},
        )
    return _vs


def _load_file(path: Path):
    ext = path.suffix.lower()
    if ext in IMAGE_EXTS:
        return [Document(page_content=describe_image(path), metadata={"source": path.name})]
    try:
        if ext == ".pdf":
            return PyPDFLoader(str(path)).load()
        if ext == ".docx":
            return Docx2txtLoader(str(path)).load()
        if ext == ".md":
            return UnstructuredMarkdownLoader(str(path)).load()
        if ext == ".txt":
            return TextLoader(str(path), encoding="utf-8").load()
    except Exception:
        pass  # fall through to a plain text read
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        text = path.read_text(encoding="latin-1", errors="ignore")
    return [Document(page_content=text, metadata={"source": path.name})]


_splitter = RecursiveCharacterTextSplitter(
    chunk_size=CHUNK_SIZE,
    chunk_overlap=CHUNK_OVERLAP,
    separators=["\n\n", "\n", ". ", " ", ""],
)


def _add(docs, source: str) -> int:
    for d in docs:
        d.metadata = d.metadata or {}
        d.metadata["source"] = source
    chunks = _splitter.split_documents(docs)
    if not chunks:
        return 0
    get_vectorstore().add_documents(chunks)
    return len(chunks)


def ingest_files(paths_and_names):
    """paths_and_names: iterable of (filepath, display_source_name)."""
    total, results = 0, []
    for path, name in paths_and_names:
        delete_source(name)  # re-ingest is idempotent per source
        n = _add(_load_file(Path(path)), name)
        results.append({"source": name, "chunks": n})
        total += n
    return total, results


def ingest_text(text: str, source: str = "pasted") -> int:
    if not text or not text.strip():
        return 0
    delete_source(source)
    return _add([Document(page_content=text, metadata={"source": source})], source)


def list_sources():
    got = get_vectorstore().get(include=["metadatas"])
    counts = {}
    for m in got.get("metadatas", []) or []:
        s = (m or {}).get("source", "unknown")
        counts[s] = counts.get(s, 0) + 1
    return [{"source": s, "chunks": c} for s, c in sorted(counts.items())]


def delete_source(name: str) -> int:
    vs = get_vectorstore()
    try:
        existing = vs.get(where={"source": name}).get("ids", []) or []
        if existing:
            vs.delete(ids=existing)
        return len(existing)
    except Exception:
        return 0


def reset() -> None:
    global _vs
    try:
        get_vectorstore().delete_collection()
    except Exception:
        pass
    _vs = None
