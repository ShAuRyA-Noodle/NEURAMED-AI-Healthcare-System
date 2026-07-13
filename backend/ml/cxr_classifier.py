"""Real chest X-ray pathology classification via TorchXRayVision.

Model: densenet121-res224-all (Apache-2.0 open weights, ~8M params, CPU-fine).
Outputs per-pathology probabilities that ARE the confidence we report.
NOT a diagnosis — a research triage signal.
"""
import logging
import threading

import numpy as np

logger = logging.getLogger(__name__)

_model = None
_lock = threading.Lock()
_MODEL_NAME = "densenet121-res224-all"

DISCLAIMER = (
    "Probabilities from a research model (TorchXRayVision densenet121-res224-all). "
    "Not FDA/CE cleared. A screening signal, not a diagnosis. Degrades on "
    "out-of-distribution images (phone photos, pediatric, lateral views)."
)


def _get_model():
    global _model
    if _model is None:
        with _lock:
            if _model is None:
                import torchxrayvision as xrv
                m = xrv.models.DenseNet(weights=_MODEL_NAME)
                m.eval()
                _model = m
                logger.info("Loaded TorchXRayVision %s", _MODEL_NAME)
    return _model


def pathologies() -> list[str]:
    return list(_get_model().pathologies)


def model_name() -> str:
    return _MODEL_NAME


def _preprocess(img: np.ndarray) -> np.ndarray:
    """TorchXRayVision's required preprocessing (wrong preprocessing => garbage):
    grayscale, normalize pixel range to [-1024, 1024], center-crop + resize to 224."""
    import torchxrayvision as xrv

    if img.ndim == 3:
        img = img.mean(2)
    maxval = 255 if img.max() > 1.0 else 1.0
    img = xrv.datasets.normalize(img, maxval)  # -> [-1024, 1024]
    img = img[None, ...]  # (1, H, W)
    img = xrv.datasets.XRayCenterCrop()(img)
    img = xrv.datasets.XRayResizer(224)(img)
    return img


def classify(img: np.ndarray) -> dict[str, float]:
    import torch
    model = _get_model()
    arr = _preprocess(img)
    with torch.no_grad():
        out = model(torch.from_numpy(arr)[None, ...].float())
    return {p: float(v) for p, v in zip(model.pathologies, out[0].tolist())}


def top_findings(img: np.ndarray, k: int = 5) -> list[tuple[str, float]]:
    items = sorted(classify(img).items(), key=lambda kv: kv[1], reverse=True)
    return items[:k]
