"""
Smart OCR extraction engine — eliminates hard Tesseract dependency.
Routes: PyMuPDF (PDF text) → Groq Vision (images/scanned PDFs) → Tesseract (fallback)
"""
import os
import io
import base64
import logging

logger = logging.getLogger(__name__)


def extract_text_from_file(file_path: str, file_bytes: bytes, content_type: str) -> dict:
    """
    Smart routing OCR engine. Detects file type and routes to best extraction method.
    Always returns {"method": str, "text": str}. Never raises to caller.
    """
    try:
        ext = (file_path or "").lower().rsplit(".", 1)[-1] if file_path else ""
        ct = (content_type or "").lower()

        # ROUTE 1 — PDF files
        if ext == "pdf" or "pdf" in ct:
            return _extract_pdf(file_bytes)

        # ROUTE 2 — Image files
        if ext in ("jpg", "jpeg", "png", "webp", "bmp", "tiff", "tif") or "image" in ct:
            media = ct if ct and ct.startswith("image/") else f"image/{ext if ext != 'jpg' else 'jpeg'}"
            return _extract_image_vision(file_bytes, media)

        # Unknown type — try PDF first, then image
        result = _extract_pdf(file_bytes)
        if result["method"] != "failed" and len(result["text"].strip()) > 20:
            return result
        return _extract_image_vision(file_bytes, "image/jpeg")

    except Exception as e:
        logger.error(f"OCR engine top-level error: {e}")
        return {"method": "failed", "text": ""}


def _extract_pdf(file_bytes: bytes) -> dict:
    """Extract text from PDF using PyMuPDF. Falls back to vision for scanned PDFs."""
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()

        if len(text.strip()) > 100:
            return {"method": "pymupdf", "text": text.strip()}

        # Scanned PDF — no text layer. Extract first page as image and use vision.
        logger.info("PDF has no text layer (scanned). Routing to Groq Vision.")
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        page = doc[0]
        pix = page.get_pixmap(dpi=200)
        img_bytes = pix.tobytes("png")
        doc.close()
        return _extract_image_vision(img_bytes, "image/png")

    except ImportError:
        logger.warning("PyMuPDF not installed. Trying Tesseract fallback for PDF.")
        return _extract_pdf_tesseract(file_bytes)
    except Exception as e:
        logger.error(f"PyMuPDF extraction failed: {e}")
        return _extract_pdf_tesseract(file_bytes)


def _extract_pdf_tesseract(file_bytes: bytes) -> dict:
    """Legacy PDF extraction via pdf2image + Tesseract."""
    try:
        from pdf2image import convert_from_bytes
        import pytesseract

        pytesseract.pytesseract.tesseract_cmd = os.getenv(
            "TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        )
        images = convert_from_bytes(file_bytes, dpi=200)
        text = ""
        for img in images:
            text += pytesseract.image_to_string(img, config="--psm 6") + "\n"
        if text.strip():
            return {"method": "tesseract", "text": text.strip()}
    except Exception as e:
        logger.warning(f"Tesseract PDF fallback failed: {e}")
    return {"method": "failed", "text": ""}


def _extract_image_vision(file_bytes: bytes, media_type: str) -> dict:
    """Send image to Groq Vision API for OCR."""
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        logger.warning("No GROQ_API_KEY — falling back to Tesseract for image OCR")
        return _extract_image_tesseract(file_bytes)

    try:
        from groq import Groq

        image_b64 = base64.b64encode(file_bytes).decode("utf-8")
        client = Groq(api_key=api_key)

        response = client.chat.completions.create(
            model="llama-3.2-11b-vision-preview",
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a precise medical document OCR system. "
                        "Output ONLY the raw text content from the document. "
                        "No commentary, no headers like 'Here is the text:', no explanation."
                    ),
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{media_type};base64,{image_b64}"
                            },
                        },
                        {
                            "type": "text",
                            "text": (
                                "Extract ALL text from this medical document exactly "
                                "as it appears. Preserve all numbers, units, "
                                "reference ranges, dates, and formatting. "
                                "Return ONLY the extracted text — no preamble, no commentary."
                            ),
                        },
                    ],
                }
            ],
            max_tokens=4096,
            temperature=0.1,
        )
        text = response.choices[0].message.content or ""
        # Strip common LLM preamble patterns
        text = text.strip()
        for prefix in [
            "Here is the extracted text:",
            "Here is the text from the document:",
            "Here is the text:",
            "The text in the image reads:",
            "The document reads:",
            "Extracted text:",
        ]:
            if text.lower().startswith(prefix.lower()):
                text = text[len(prefix):].strip()
                break
        if text:
            return {"method": "groq_vision", "text": text}
        logger.warning("Groq Vision returned empty text, falling back to Tesseract")
        return _extract_image_tesseract(file_bytes)

    except Exception as e:
        logger.error(f"Groq Vision OCR failed: {e}")
        return _extract_image_tesseract(file_bytes)


def _extract_image_tesseract(file_bytes: bytes) -> dict:
    """Fallback image OCR via Tesseract. Never crashes."""
    try:
        import pytesseract
        from PIL import Image

        pytesseract.pytesseract.tesseract_cmd = os.getenv(
            "TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        )
        img = Image.open(io.BytesIO(file_bytes))
        text = pytesseract.image_to_string(img, config="--psm 6")
        if text.strip():
            return {"method": "tesseract", "text": text.strip()}
    except Exception as e:
        logger.warning(f"Tesseract image fallback failed: {e}")
    return {"method": "failed", "text": ""}
