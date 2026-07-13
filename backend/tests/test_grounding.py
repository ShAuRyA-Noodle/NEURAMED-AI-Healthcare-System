import pytest
from ml import grounding


def _network_or_skip():
    import httpx
    try:
        httpx.get("https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search",
                  params={"terms": "flu", "maxList": 1}, timeout=8.0).raise_for_status()
    except Exception:
        pytest.skip("no network for live grounding API test")


# ---- offline: verify_pmids ----
def test_verify_pmids_keeps_real_drops_fake():
    text = "Supported by evidence [PMID:12345] but also [PMID:99999]."
    out = grounding.verify_pmids(text, {"12345"})
    assert "[PMID:12345]" in out
    assert "99999" not in out


def test_verify_pmids_empty_text():
    assert grounding.verify_pmids("", {"1"}) == ""


def test_icd10_lookup_empty_term_returns_empty():
    assert grounding.icd10_lookup("") == []


def test_evidence_empty_query_returns_empty():
    assert grounding.evidence("") == []


# ---- network: real APIs ----
@pytest.mark.network
def test_icd10_lookup_real():
    _network_or_skip()
    res = grounding.icd10_lookup("pneumonia", 5)
    assert len(res) >= 1
    assert all("code" in r and "name" in r for r in res)
    # pneumonia ICD-10 codes start with J
    assert any(r["code"].startswith("J") for r in res)


@pytest.mark.network
def test_evidence_real():
    _network_or_skip()
    res = grounding.evidence("community acquired pneumonia treatment", 3)
    assert len(res) >= 1
    assert all(r.get("pmid") for r in res)


@pytest.mark.network
def test_patient_explainer_real():
    _network_or_skip()
    # J18.9 = pneumonia, unspecified
    res = grounding.patient_explainer("J18.9")
    # MedlinePlus may or may not have an entry; if it does, it has a title
    if res is not None:
        assert "title" in res
