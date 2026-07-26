"""Extract and persist images embedded in uploaded documents.

The text pipeline (PyPDFLoader / Docx2txtLoader) drops embedded images silently,
so a screenshot-heavy install guide used to ingest as prose with the pictures
lost. This module pulls those images out, stores them on disk next to the docs,
and hands back markdown references that get woven into the chunk text — so a
retrieved chunk carries its screenshots and the model can reproduce them in the
answer.

Images are served by main.py (StaticFiles at /images) and proxied to the admin
UI through the Node backend, which is why REF_PREFIX is the Node route.
"""
import io
import re
import zipfile
from pathlib import Path

from config import DATA_DIR

IMAGES_DIR = DATA_DIR / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

# Path the admin UI fetches through (backend/src/routes/admin.route.js), relative
# to the frontend's axios baseURL (.../api/v1). Stored verbatim in chunk text.
REF_PREFIX = "/admin/knowledge/images"

# Below this, an "image" is almost always a logo, bullet, divider or icon rather
# than a screenshot worth citing.
MIN_BYTES = 6000
MIN_DIMENSION = 120

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp", ".tiff", ".tif", ".gif"}


def slug(name: str) -> str:
    """Filesystem- and URL-safe directory name for a source."""
    return re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip("-.") or "source"


def _big_enough(data: bytes) -> bool:
    if len(data) < MIN_BYTES:
        return False
    try:
        from PIL import Image  # optional; see vision.py
        with Image.open(io.BytesIO(data)) as im:
            w, h = im.size
        return w >= MIN_DIMENSION and h >= MIN_DIMENSION
    except Exception:
        # No Pillow (or an unreadable image) — fall back to the byte-size filter.
        return True


def _write(source: str, filename: str, data: bytes) -> str:
    """Persist one image and return its markdown-referencable URL path."""
    d = IMAGES_DIR / slug(source)
    d.mkdir(parents=True, exist_ok=True)
    safe = slug(filename)
    (d / safe).write_bytes(data)
    return f"{REF_PREFIX}/{slug(source)}/{safe}"


def _ext_of(name: str, default: str = ".png") -> str:
    e = Path(name).suffix.lower()
    return e if e in IMAGE_EXTS else default


def from_pdf(path: Path, source: str) -> dict[int, list[str]]:
    """page index (0-based) -> list of image URL paths on that page."""
    out: dict[int, list[str]] = {}
    try:
        import pypdf
        reader = pypdf.PdfReader(str(path))
    except Exception:
        return out
    for pno, page in enumerate(reader.pages):
        try:
            imgs = list(page.images)
        except Exception:
            continue
        for i, im in enumerate(imgs):
            try:
                data = im.data
                if not _big_enough(data):
                    continue
                url = _write(source, f"p{pno + 1}-{i + 1}{_ext_of(im.name)}", data)
                out.setdefault(pno, []).append(url)
            except Exception:
                continue
    return out


def from_docx(path: Path, source: str) -> list[str]:
    """DOCX is a zip; embedded media lives under word/media/. Document order is
    not recoverable from the zip alone, so these attach to the whole document."""
    urls: list[str] = []
    try:
        with zipfile.ZipFile(path) as z:
            names = sorted(n for n in z.namelist() if n.startswith("word/media/"))
            for i, n in enumerate(names):
                if Path(n).suffix.lower() not in IMAGE_EXTS:
                    continue
                data = z.read(n)
                if not _big_enough(data):
                    continue
                urls.append(_write(source, f"media-{i + 1}{_ext_of(n)}", data))
    except Exception:
        pass
    return urls


def from_image_file(path: Path, source: str) -> list[str]:
    """A directly uploaded screenshot — keep the file itself so the answer can
    show it, not just the Gemini/OCR text description of it."""
    try:
        return [_write(source, f"image{_ext_of(path.name)}", path.read_bytes())]
    except Exception:
        return []


def markdown_refs(urls, alt: str = "Screenshot") -> str:
    """Markdown block appended to the text the images belong with."""
    if not urls:
        return ""
    return "\n\n" + "\n\n".join(f"![{alt}]({u})" for u in urls)


def delete_for_source(source: str) -> int:
    """Remove a source's stored images (called on re-ingest / delete)."""
    d = IMAGES_DIR / slug(source)
    if not d.is_dir():
        return 0
    n = 0
    for f in d.iterdir():
        try:
            f.unlink()
            n += 1
        except Exception:
            pass
    try:
        d.rmdir()
    except Exception:
        pass
    return n
