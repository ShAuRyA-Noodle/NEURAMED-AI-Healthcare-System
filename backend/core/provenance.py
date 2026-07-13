"""Provenance envelope — every AI result declares what produced it.

The invariant this file exists to enforce: a failed inference must never
produce a confidence score, an urgency level, or a diagnosis. See the
Three Honesty Laws in docs/superpowers/plans/2026-07-13-00-MASTER-neuramed-flagship.md
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Optional

# Keys that a non-OK result may never carry — a clinician could read any
# of these as an assessment the model never actually made.
FORBIDDEN_ON_FAILURE = (
    "confidence",
    "overall_confidence",
    "confidence_score",
    "urgency",
    "urgency_level",
    "probability",
    "acr_category",
    "overall_risk",
)


class InferenceStatus(str, Enum):
    OK = "ok"                # real model, full pipeline
    DEGRADED = "degraded"    # real model, but a reduced path (e.g. text-only fallback)
    UNAVAILABLE = "unavailable"  # no inference happened


@dataclass
class Provenance:
    status: InferenceStatus
    source: str                      # real_model | real_model_degraded | unavailable
    model: Optional[str]             # e.g. "densenet121-res224-all"
    vendor: Optional[str]            # e.g. "torchxrayvision", "groq", "openrouter"
    reason: Optional[str] = None     # required when not OK
    grounded_in: list[str] = field(default_factory=list)  # citations/source URLs

    def __post_init__(self):
        if self.status is not InferenceStatus.OK and not self.reason:
            raise ValueError("reason is required when status is not OK")
        if self.status is InferenceStatus.OK and not self.model:
            raise ValueError("model is required when status is OK")

    def to_dict(self) -> dict[str, Any]:
        return {
            "status": self.status.value,
            "source": self.source,
            "model": self.model,
            "vendor": self.vendor,
            "reason": self.reason,
            "grounded_in": self.grounded_in,
        }


def wrap_result(payload: dict[str, Any], provenance: Provenance) -> dict[str, Any]:
    """Attach provenance to a result, stripping forbidden keys on failure."""
    result = dict(payload)
    if provenance.status is not InferenceStatus.OK:
        for key in FORBIDDEN_ON_FAILURE:
            result.pop(key, None)
    result["provenance"] = provenance.to_dict()
    return result
