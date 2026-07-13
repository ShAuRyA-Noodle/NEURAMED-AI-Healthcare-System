import io

import pytest
from core.exceptions import InferenceUnavailable
from agents import voice_agent


def test_transcribe_uses_whisper_and_raises_without_key(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "")
    with pytest.raises(InferenceUnavailable):
        voice_agent.transcribe_with_whisper(b"audio", language="hi")


def test_no_response_placeholder_in_source():
    """Regression: the '[Response in X]' placeholder must be gone."""
    import inspect
    from routers import sarvam
    src = inspect.getsource(sarvam)
    assert "[Response in" not in src


def test_no_hardcoded_urgency_medium_literal_in_fallback():
    """Guard against re-introducing a hardcoded urgency in a non-model path.
    (Allow it only if clearly tied to real model output.)"""
    import inspect
    from routers import sarvam
    src = inspect.getsource(sarvam)
    # crude but effective: the specific fabricated placeholder pattern must be absent
    assert 'primary_concern": "Medical advice provided"' not in src
    assert "primary_concern': 'Medical advice provided'" not in src


def test_transcribe_endpoint_returns_transcript_and_provenance(auth_client, monkeypatch):
    """HTTP test: the real STT endpoint accepts a multipart audio upload,
    calls Whisper, and returns transcript + real-model provenance."""
    monkeypatch.setenv("GROQ_API_KEY", "gsk_fake")

    class FakeResp:
        text = "मुझे सिर दर्द है"  # "I have a headache" in Hindi

    class FakeClient:
        def __init__(self, *a, **k):
            self.audio = self

        @property
        def transcriptions(self):
            return self

        def create(self, **kwargs):
            return FakeResp()

    monkeypatch.setattr(voice_agent, "_get_groq_client", lambda key: FakeClient())

    resp = auth_client.post(
        "/api/sarvam/transcribe",
        files={"file": ("audio.wav", io.BytesIO(b"fakeaudiobytes"), "audio/wav")},
        data={"language": "hi"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["language"] == "hi"
    assert "सिर" in body["transcript"]
    prov = body["provenance"]
    assert prov["source"] == "real_model"
    assert prov["model"] == "whisper-large-v3"
    assert prov["vendor"] == "groq"


def test_transcribe_endpoint_503_without_key(auth_client, monkeypatch):
    """Failure must surface as 503, never a fabricated transcript."""
    monkeypatch.setenv("GROQ_API_KEY", "")
    resp = auth_client.post(
        "/api/sarvam/transcribe",
        files={"file": ("audio.wav", io.BytesIO(b"fakeaudiobytes"), "audio/wav")},
        data={"language": "hi"},
    )
    assert resp.status_code == 503, resp.text
