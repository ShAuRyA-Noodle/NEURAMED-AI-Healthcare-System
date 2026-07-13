import pytest
from core.exceptions import InferenceUnavailable
from agents import voice_agent


def test_whisper_missing_key_raises(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "")
    with pytest.raises(InferenceUnavailable):
        voice_agent.transcribe_with_whisper(b"fakeaudiobytes")


def test_whisper_success_returns_text(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_fake")

    class FakeResp:
        text = "patient reports chest pain and shortness of breath"

    class FakeClient:
        def __init__(self, *a, **k):
            self.audio = self
        @property
        def transcriptions(self):
            return self
        def create(self, **kwargs):
            return FakeResp()

    monkeypatch.setattr(voice_agent, "_get_groq_client", lambda key: FakeClient())
    text = voice_agent.transcribe_with_whisper(b"audio")
    assert "chest pain" in text


def test_whisper_empty_transcript_raises(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_fake")

    class FakeResp:
        text = "   "

    class FakeClient:
        def __init__(self, *a, **k):
            self.audio = self
        @property
        def transcriptions(self):
            return self
        def create(self, **kwargs):
            return FakeResp()

    monkeypatch.setattr(voice_agent, "_get_groq_client", lambda key: FakeClient())
    with pytest.raises(InferenceUnavailable):
        voice_agent.transcribe_with_whisper(b"audio")


def test_no_failure_string_returned_as_transcript():
    """Regression guard: the old placeholder must never be a return value."""
    import inspect
    src = inspect.getsource(voice_agent)
    assert 'return "Audio transcription failed' not in src
    assert "Audio transcription failed. Please use text input." not in src.replace("raise", "RAISE_OK")
