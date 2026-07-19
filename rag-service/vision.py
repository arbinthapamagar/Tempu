"""Image understanding for ingestion — OCR (pytesseract) plus, when the Gemini
provider is configured, a richer vision description via the same OpenAI-compatible
endpoint answer.py uses for chat-time image understanding. Combining both means an
image with printed text (a scanned form, a screenshot) AND visual content (a
photo, a chart) becomes meaningfully searchable, not just literally-OCR'd.

Never raises — ingestion must not fail because OCR or Gemini vision is
unavailable; this degrades to whichever half succeeds.
"""
import base64
import mimetypes
from pathlib import Path

import requests

from config import AI_PROVIDER, GEMINI_KEYS, GEMINI_MODELS

# OCR is optional. If Pillow/pytesseract (or the tesseract binary) aren't
# installed, image ingestion must still work via Gemini vision — so a missing
# dependency degrades to "no OCR", it never crashes the whole service on import.
try:
    from PIL import Image
    import pytesseract
except Exception:  # noqa: BLE001 - any import failure means OCR is simply unavailable
    Image = None
    pytesseract = None

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
# Last key/model that worked, so we don't re-hit an exhausted combo every call.
_active_key_idx = 0
_active_gemini_idx = 0

DESCRIBE_PROMPT = (
    "Describe this image in detail for a searchable knowledge base: what it shows, "
    "any objects/people/diagrams/charts, and transcribe any visible text verbatim. "
    "Be factual and thorough; do not speculate beyond what's visible."
)


def _ocr_text(path: Path) -> str:
    """Extract any literal text in the image. Requires the tesseract-ocr system
    binary (`apt install tesseract-ocr` / `brew install tesseract`) — if it isn't
    installed, or the image can't be read, this quietly returns ''."""
    if pytesseract is None or Image is None:
        return ""
    try:
        return pytesseract.image_to_string(Image.open(path)).strip()
    except Exception:
        return ""


def _gemini_describe(path: Path) -> str:
    """One-shot Gemini vision call, rotating KEY x MODEL like answer.py's
    _generate — a 429/404 tries the next model, a rejected key tries the next key."""
    global _active_key_idx, _active_gemini_idx
    if not GEMINI_KEYS:
        return ""
    mime = mimetypes.guess_type(str(path))[0] or "image/png"
    data_url = f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('ascii')}"
    messages = [{
        "role": "user",
        "content": [
            {"type": "text", "text": DESCRIBE_PROMPT},
            {"type": "image_url", "image_url": {"url": data_url}},
        ],
    }]
    for ka in range(len(GEMINI_KEYS)):
        key_idx = (_active_key_idx + ka) % len(GEMINI_KEYS)
        key = GEMINI_KEYS[key_idx]
        key_rejected = False
        for ma in range(len(GEMINI_MODELS)):
            m_idx = (_active_gemini_idx + ma) % len(GEMINI_MODELS)
            model = GEMINI_MODELS[m_idx]
            try:
                res = requests.post(
                    GEMINI_URL,
                    headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                    json={"model": model, "messages": messages, "temperature": 0.2},
                    timeout=60,
                )
            except Exception:
                return ""  # network down — fall back to OCR-only
            if res.status_code in (401, 403):
                key_rejected = True
                break  # bad key — next key
            if res.status_code in (429, 404):
                continue  # next model on this key
            if not res.ok:
                return ""
            _active_key_idx, _active_gemini_idx = key_idx, m_idx
            return (res.json()["choices"][0]["message"]["content"] or "").strip()
        if key_rejected:
            continue
    return ""


def describe_image(path: Path) -> str:
    """Best-effort text representation of an image for embedding: a Gemini vision
    description (when AI_PROVIDER=gemini) plus any OCR'd text, so the image is
    findable both by what it shows and by literal text it contains."""
    ocr = _ocr_text(path)
    description = _gemini_describe(path) if AI_PROVIDER == "gemini" else ""
    parts = []
    if description:
        parts.append(description)
    if ocr:
        parts.append(f"Text found in image:\n{ocr}")
    return "\n\n".join(parts) or f"[Image: {path.name} — no readable text or description available]"
