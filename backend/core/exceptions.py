"""Inference failure is an error, not a result."""
from fastapi import Request
from fastapi.responses import JSONResponse


class InferenceUnavailable(Exception):
    """Raised when a model could not produce a real result.

    Never catch this to substitute a default. The whole point is that the
    caller — and ultimately the user — finds out that no inference happened.
    """

    def __init__(self, reason: str, vendor: str | None = None,
                 model: str | None = None):
        self.reason = reason
        self.vendor = vendor
        self.model = model
        super().__init__(reason)

    def to_dict(self) -> dict:
        return {
            "status": "unavailable",
            "source": "unavailable",
            "reason": self.reason,
            "vendor": self.vendor,
            "model": self.model,
        }


async def inference_unavailable_handler(
    request: Request, exc: InferenceUnavailable
) -> JSONResponse:
    """503 Service Unavailable — the honest status code.
    Deliberately carries no confidence, no urgency, no diagnosis."""
    return JSONResponse(status_code=503, content={"detail": exc.to_dict()})
