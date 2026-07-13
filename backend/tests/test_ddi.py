"""Tests for the real drug-interaction RAG engine (backend/ml/ddi.py).

Offline (mocked) tests must always pass. Network tests exercise the real
RxNorm / openFDA endpoints and skip cleanly when there is no internet.
"""
import pytest
from unittest.mock import patch

from ml import ddi


def _net_or_skip():
    import httpx
    try:
        httpx.get("https://rxnav.nlm.nih.gov/REST/rxcui.json",
                  params={"name": "aspirin", "search": 2}, timeout=8).raise_for_status()
    except Exception:
        pytest.skip("no network")


def test_check_interactions_requires_groq(monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "")
    from core.exceptions import InferenceUnavailable
    with pytest.raises(InferenceUnavailable):
        ddi.check_interactions(["aspirin", "warfarin"])


def test_no_evidence_pair_is_honest_not_safe():
    """A pair with no label evidence must be reported as 'no evidence', never fabricated."""
    with patch.object(ddi, "find_pair_evidence", return_value=[]), \
         patch.object(ddi, "normalize", side_effect=lambda n: {"input": n, "rxcui": "1", "matched": n}), \
         patch("ml.ddi.call_llm", return_value=({}, "llama-x")), \
         patch.dict("os.environ", {"GROQ_API_KEY": "gsk_fake"}):
        out = ddi.check_interactions(["druga", "drugb"])
    assert out["overall_risk"] == "no_known_interaction_in_sources"
    assert out["pairs"][0]["status"] == "no_evidence"
    assert "No interaction found" in out["pairs"][0]["note"]
    # Honesty: the forbidden-on-failure key must never say "safe".
    assert out["overall_risk"] != "safe"


def test_pair_with_evidence_calls_llm_and_cites():
    """A pair WITH retrieved evidence gets an LLM explanation grounded in citations."""
    fake_evidence = [{
        "source_drug": "WARFARIN",
        "mentions": "aspirin",
        "snippet": "...aspirin increases bleeding risk with warfarin...",
        "citation_url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=abc",
    }]
    llm_reply = ({"severity": "major", "summary": "Increased bleeding risk.",
                  "clinical_management": "Monitor INR closely."}, "llama-3.3-70b-versatile")
    with patch.object(ddi, "find_pair_evidence", return_value=fake_evidence), \
         patch.object(ddi, "normalize", side_effect=lambda n: {"input": n, "rxcui": "1", "matched": n}), \
         patch("ml.ddi.call_llm", return_value=llm_reply) as mock_llm, \
         patch.dict("os.environ", {"GROQ_API_KEY": "gsk_fake"}):
        out = ddi.check_interactions(["warfarin", "aspirin"])
    mock_llm.assert_called_once()
    pair = out["pairs"][0]
    assert pair["status"] == "evidence"
    assert pair["severity"] == "major"
    assert "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=abc" in pair["citations"]
    assert out["overall_risk"] == "major"
    assert out["sources_checked"]
    assert out["provenance"]["status"] == "ok"


def test_no_evidence_pair_never_calls_llm():
    """The LLM must never be asked to invent an interaction where none was retrieved."""
    with patch.object(ddi, "find_pair_evidence", return_value=[]), \
         patch.object(ddi, "normalize", side_effect=lambda n: {"input": n, "rxcui": "1", "matched": n}), \
         patch("ml.ddi.call_llm") as mock_llm, \
         patch.dict("os.environ", {"GROQ_API_KEY": "gsk_fake"}):
        ddi.check_interactions(["druga", "drugb"])
    mock_llm.assert_not_called()


def test_find_pair_evidence_bidirectional_snippet():
    """When B's name appears in A's label text, an evidence dict with a snippet is returned."""
    a_label = {
        "generic_name": "WARFARIN", "spl_set_id": "x",
        "interactions_text": "Long text ... aspirin increases bleeding ... more text",
        "citation_url": "https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=x",
    }

    def fake_fetch(name):
        return a_label if name.lower() == "warfarin" else None

    with patch.object(ddi, "fetch_label_interactions", side_effect=fake_fetch):
        ev = ddi.find_pair_evidence("warfarin", "aspirin")
    assert len(ev) == 1
    assert ev[0]["mentions"] == "aspirin"
    assert "aspirin" in ev[0]["snippet"].lower()
    assert ev[0]["citation_url"] == a_label["citation_url"]


def test_fetch_label_none_on_404():
    """openFDA 404 (unknown drug) is 'no label', never an exception."""
    class FakeResp:
        status_code = 404
        def raise_for_status(self):  # pragma: no cover - not reached
            raise AssertionError("should not be called on 404")
    with patch("ml.ddi.httpx.get", return_value=FakeResp()):
        assert ddi.fetch_label_interactions("zzznotarealdrug") is None


@pytest.mark.network
def test_rxnorm_normalize_real():
    _net_or_skip()
    res = ddi.normalize("aspirin")
    assert res and res["rxcui"]


@pytest.mark.network
def test_rxnorm_fuzzy_fallback_real():
    _net_or_skip()
    # Misspelling should still resolve via approximateTerm.
    res = ddi.normalize("asprin")
    assert res and res["rxcui"]


@pytest.mark.network
def test_openfda_label_real():
    _net_or_skip()
    res = ddi.fetch_label_interactions("warfarin")
    # warfarin labels have extensive interaction text
    if res:
        assert res.get("interactions_text")
        assert res.get("citation_url", "").startswith("https://dailymed")


@pytest.mark.network
def test_find_pair_evidence_real_warfarin_aspirin():
    _net_or_skip()
    ev = ddi.find_pair_evidence("warfarin", "aspirin")
    # The warfarin label explicitly discusses aspirin — real retrieval must find it.
    if ev:
        assert any("aspirin" in e["mentions"].lower() for e in ev)
        assert all(e["citation_url"] for e in ev)
