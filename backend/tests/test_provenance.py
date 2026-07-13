import pytest
from core.provenance import Provenance, InferenceStatus, wrap_result


def test_real_model_result_carries_model_identity():
    prov = Provenance(
        status=InferenceStatus.OK,
        source="real_model",
        model="llama-3.3-70b-versatile",
        vendor="groq",
    )
    assert prov.status == InferenceStatus.OK
    assert prov.model == "llama-3.3-70b-versatile"
    assert prov.reason is None


def test_unavailable_provenance_requires_a_reason():
    with pytest.raises(ValueError, match="reason is required"):
        Provenance(
            status=InferenceStatus.UNAVAILABLE,
            source="unavailable",
            model=None,
            vendor=None,
        )


def test_wrap_result_attaches_provenance():
    prov = Provenance(
        status=InferenceStatus.OK,
        source="real_model",
        model="densenet121-res224-all",
        vendor="torchxrayvision",
    )
    wrapped = wrap_result({"finding": "cardiomegaly"}, prov)
    assert wrapped["finding"] == "cardiomegaly"
    assert wrapped["provenance"]["model"] == "densenet121-res224-all"
    assert wrapped["provenance"]["status"] == "ok"


def test_unavailable_result_has_no_confidence_and_no_urgency():
    """The core safety invariant: a failed inference must never emit
    a number a clinician could mistake for an assessment."""
    prov = Provenance(
        status=InferenceStatus.UNAVAILABLE,
        source="unavailable",
        model=None,
        vendor=None,
        reason="GROQ_API_KEY not configured",
    )
    wrapped = wrap_result({}, prov)
    assert "confidence" not in wrapped
    assert "overall_confidence" not in wrapped
    assert "urgency" not in wrapped
    assert wrapped["provenance"]["reason"] == "GROQ_API_KEY not configured"
