import base64
import os
from fastapi import HTTPException, UploadFile

# H4 — hard cap on upload size (15 MB).
MAX_UPLOAD_BYTES = 15 * 1024 * 1024

# Accepted file extensions per endpoint.
IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".dcm", ".dicom"}
OCR_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff"}


def bytes_to_b64(file_bytes: bytes) -> str:
    """Helper to convert bytes to base64 string for JSON responses."""
    return base64.b64encode(file_bytes).decode('utf-8')


def _ext(filename) -> str:
    if not filename:
        return ""
    return os.path.splitext(str(filename))[1].lower()


def check_upload_size(contents: bytes) -> None:
    """Raise 413 if the uploaded payload exceeds MAX_UPLOAD_BYTES."""
    if contents is not None and len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="File too large (max 15MB)")


def validate_imaging_file(file: UploadFile) -> None:
    """Accept images + DICOM. Raise 415 otherwise."""
    ext = _ext(getattr(file, "filename", ""))
    ct = (getattr(file, "content_type", "") or "").lower()
    if ext in IMAGE_EXTENSIONS:
        return
    if ct.startswith("image/") or ct.startswith("application/dicom"):
        return
    raise HTTPException(status_code=415, detail="Unsupported file type")


def validate_ocr_file(file: UploadFile) -> None:
    """Accept PDFs + images. Raise 415 otherwise."""
    ext = _ext(getattr(file, "filename", ""))
    ct = (getattr(file, "content_type", "") or "").lower()
    if ext in OCR_EXTENSIONS:
        return
    if ct.startswith("image/") or ct.startswith("application/pdf"):
        return
    raise HTTPException(status_code=415, detail="Unsupported file type")


def clamp_pagination(limit: int, offset: int = 0, max_limit: int = 100):
    """Clamp pagination params to prevent DoS via huge limits / negative offsets."""
    try:
        limit = int(limit)
    except (TypeError, ValueError):
        limit = 1
    try:
        offset = int(offset)
    except (TypeError, ValueError):
        offset = 0
    limit = max(1, min(limit, max_limit))
    offset = max(0, offset)
    return limit, offset
