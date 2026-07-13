"""
Smart OCR extraction engine — eliminates hard Tesseract dependency.
Routes: PyMuPDF (PDF text) → Groq Vision (images/scanned PDFs) → Tesseract (optional fallback)

Vision model fallback chain ensures extraction works even when one model is down.
"""
import os
import io
import base64
import time
import logging

logger = logging.getLogger(__name__)

# Vision models to try in order — best first, smallest last
VISION_MODELS = [
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.2-90b-vision-preview",
    "llama-3.2-11b-vision-preview",
]


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
    """Send image to Groq Vision API for OCR. Tries multiple models."""
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        logger.warning("No GROQ_API_KEY — falling back to Tesseract for image OCR")
        return _extract_image_tesseract(file_bytes)

    try:
        from groq import Groq
        client = Groq(api_key=api_key)
    except Exception as e:
        logger.error(f"Failed to initialize Groq client: {e}")
        return _extract_image_tesseract(file_bytes)

    image_b64 = base64.b64encode(file_bytes).decode("utf-8")

    messages = [
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
                        "You are a precise medical document OCR system. "
                        "Extract ALL text from this medical document exactly "
                        "as it appears. Preserve all numbers, units, "
                        "reference ranges, dates, formatting, headers, and table structures. "
                        "If this is a lab report, preserve the parameter names, values, units, and reference ranges in a clear format. "
                        "If this is a prescription or letter, preserve the full text. "
                        "Return ONLY the extracted text — no preamble, no commentary, no 'Here is the text:' prefix."
                    ),
                },
            ],
        }
    ]

    last_error = None
    for model in VISION_MODELS:
        try:
            logger.info(f"OCR Vision: trying model {model}")
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=4096,
                temperature=0.1,
            )
            text = response.choices[0].message.content or ""
            text = _clean_vision_output(text)

            if text and len(text.strip()) > 15:
                logger.info(f"OCR Vision [{model}] extracted {len(text)} chars")
                return {"method": "groq_vision", "text": text}
            else:
                logger.warning(f"OCR Vision [{model}] returned too little text ({len(text)} chars)")
                continue

        except Exception as e:
            last_error = e
            err_msg = str(e).lower()
            logger.warning(f"OCR Vision [{model}] failed: {type(e).__name__}: {e}")

            # Rate limited — wait and try next model
            if "rate_limit" in err_msg or "429" in err_msg:
                time.sleep(1)
                continue
            # Model not found — try next
            if "model" in err_msg and ("not found" in err_msg or "not supported" in err_msg or "does not exist" in err_msg):
                continue
            # Other error — try next model anyway
            continue

    logger.error(f"All vision models failed for OCR. Last error: {last_error}")
    return _extract_image_tesseract(file_bytes)


def _clean_vision_output(text: str) -> str:
    """Strip common LLM preamble patterns from vision OCR output."""
    text = text.strip()
    # Remove common prefixes
    prefixes = [
        "Here is the extracted text:",
        "Here is the text from the document:",
        "Here is the text from the image:",
        "Here is the text:",
        "The text in the image reads:",
        "The document reads:",
        "The image contains the following text:",
        "Extracted text:",
        "The text reads:",
        "Here's the extracted text:",
        "The medical document reads:",
        "The report reads:",
    ]
    lower_text = text.lower()
    for prefix in prefixes:
        if lower_text.startswith(prefix.lower()):
            text = text[len(prefix):].strip()
            break

    # Remove leading/trailing markdown code fences
    if text.startswith("```") and text.endswith("```"):
        text = text[3:]
        if text.startswith("\n"):
            text = text[1:]
        text = text[:-3].strip()

    return text


def _extract_image_tesseract(file_bytes: bytes) -> dict:
    """Fallback image OCR via Tesseract. Never crashes."""
    try:
        import pytesseract
        from PIL import Image

        pytesseract.pytesseract.tesseract_cmd = os.getenv(
            "TESSERACT_CMD", r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        )
        img = Image.open(io.BytesIO(file_bytes))

        # Enhance image for better OCR
        img = img.convert("L")  # Grayscale
        # Try with different PSM modes for better results
        for psm in ["6", "3", "4"]:
            text = pytesseract.image_to_string(img, config=f"--psm {psm}")
            if text and len(text.strip()) > 20:
                return {"method": "tesseract", "text": text.strip()}

    except Exception as e:
        logger.warning(f"Tesseract image fallback failed: {e}")
    return {"method": "failed", "text": ""}
