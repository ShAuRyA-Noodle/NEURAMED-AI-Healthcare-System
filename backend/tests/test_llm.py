import json

import pytest
from core.exceptions import InferenceUnavailable
from utils.llm import call_llm


def test_missing_api_key_raises_instead_of_fabricating(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "")
    with pytest.raises(InferenceUnavailable) as exc:
        call_llm("You are a doctor.", "I have a headache.")
    assert "GROQ_API_KEY" in str(exc.value)


def test_all_models_failing_raises(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_fake_key_for_test")

    class BoomClient:
        def __init__(self, api_key):
            self.chat = self

        @property
        def completions(self):
            return self

        def create(self, **kwargs):
            raise RuntimeError("upstream exploded")

    import utils.llm as llm_module
    monkeypatch.setattr(llm_module, "_get_client", lambda key: BoomClient(key))

    with pytest.raises(InferenceUnavailable):
        call_llm("system", "user")


def test_fallback_function_no_longer_exists():
    import utils.llm as llm_module
    assert not hasattr(llm_module, "_fallback"), (
        "_fallback() fabricates clinical results on failure. It must not return."
    )


def _auth_headers(client):
    """Register + login a patient and return a Bearer auth header."""
    reg = client.post("/api/auth/register", json={
        "email": "patient503@example.com",
        "full_name": "Test Patient",
        "password": "password123",
        "role": "patient",
    })
    assert reg.status_code == 200, reg.text
    token = reg.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_voice_diagnose_returns_503_without_confidence_or_urgency(
    client, monkeypatch
):
    """Inference failure surfaces as HTTP 503 carrying no clinical assessment.

    Uses a real authenticated request against /api/voice/diagnose with the
    Groq key blanked so call_llm raises InferenceUnavailable.
    """
    monkeypatch.setenv("GROQ_API_KEY", "")
    headers = _auth_headers(client)

    resp = client.post(
        "/api/voice/diagnose",
        json={"transcript": "I have a severe headache and blurred vision."},
        headers=headers,
    )

    assert resp.status_code == 503, resp.text
    body = resp.json()
    # The honest failure carries NO fabricated clinical assessment.
    text = json.dumps(body).lower()
    assert "confidence" not in text
    assert "urgency" not in text
    assert "diagnosis" not in text
    assert body["detail"]["status"] == "unavailable"
