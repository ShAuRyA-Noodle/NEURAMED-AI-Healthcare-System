"""DICOM reading with real pixel spacing + honest handling of raster uploads.

Law 2: never invent a number. A PNG/JPG has no pixel spacing, so no mm
measurement can be produced. DICOM may or may not carry spacing.
"""
import io
import logging

import numpy as np

logger = logging.getLogger(__name__)


def is_dicom(data: bytes) -> bool:
    return len(data) > 132 and data[128:132] == b"DICM"


def metadata_for_raster_image() -> dict:
    return {
        "pixel_spacing_mm": None,
        "spacing_source": "unavailable",
        "measurements_enabled": False,
        "note": ("Uploaded as PNG/JPG with no DICOM metadata. Physical "
                 "measurements (mm/cm) cannot be derived and are not reported. "
                 "Only scale-invariant ratios and probabilities are provided."),
    }


def read_dicom(data: bytes) -> tuple[np.ndarray, dict]:
    """Return (grayscale float32 image normalized 0-255, metadata dict)."""
    import pydicom
    from pydicom.pixels import apply_modality_lut, apply_voi_lut

    ds = pydicom.dcmread(io.BytesIO(data))
    arr = ds.pixel_array
    try:
        arr = apply_modality_lut(arr, ds)
    except Exception:
        pass
    try:
        arr = apply_voi_lut(arr, ds)
    except Exception:
        pass

    if getattr(ds, "PhotometricInterpretation", "") == "MONOCHROME1":
        arr = arr.max() - arr

    if arr.ndim == 3:
        arr = arr[0]

    arr = arr.astype("float64")
    rng = np.ptp(arr)
    arr = (arr - arr.min()) / (rng + 1e-8) * 255.0
    arr = arr.astype("float32")

    spacing = getattr(ds, "PixelSpacing", None) or getattr(ds, "ImagerPixelSpacing", None)
    if spacing is not None:
        spacing = [float(spacing[0]), float(spacing[1])]

    meta = {
        "pixel_spacing_mm": spacing,
        "spacing_source": "dicom" if spacing else "unavailable",
        "measurements_enabled": bool(spacing),
        "modality": str(getattr(ds, "Modality", "") or ""),
        "note": None if spacing else "DICOM has no PixelSpacing; measurements disabled.",
    }
    return arr, meta
