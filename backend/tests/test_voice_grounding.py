from unittest.mock import patch
from agents import voice_agent


def test_ground_diagnosis_adds_icd_and_citations():
    result = {"conditions": [{"name": "Pneumonia", "probability": 0.7}],
              "provenance": {"grounded_in": []}}
    with patch.object(voice_agent.grounding, "icd10_lookup",
                      return_value=[{"code": "J18.9", "name": "Pneumonia, unspecified"}]), \
         patch.object(voice_agent.grounding, "evidence",
                      return_value=[{"pmid": "123", "title": "t", "year": "2023",
                                     "journal": "j", "url": "https://europepmc.org/article/MED/123"}]):
        out = voice_agent.ground_diagnosis(result)
    cond = out["conditions"][0]
    assert cond["icd_code"] == "J18.9"
    assert cond["icd10_candidates"][0]["code"] == "J18.9"
    assert cond["citations"][0]["pmid"] == "123"
    assert "https://europepmc.org/article/MED/123" in out["provenance"]["grounded_in"]


def test_ground_diagnosis_skips_undetermined():
    result = {"conditions": [{"name": "Undetermined — something"}]}
    with patch.object(voice_agent.grounding, "icd10_lookup", return_value=[{"code": "X", "name": "y"}]):
        out = voice_agent.ground_diagnosis(result)
    assert "icd10_candidates" not in out["conditions"][0]


def test_ground_diagnosis_never_raises_on_grounding_error():
    result = {"conditions": [{"name": "Asthma"}]}
    with patch.object(voice_agent.grounding, "icd10_lookup", side_effect=RuntimeError("boom")):
        out = voice_agent.ground_diagnosis(result)  # must not raise
    assert out["conditions"][0]["name"] == "Asthma"


def test_ground_diagnosis_preserves_existing_icd_code():
    result = {"conditions": [{"name": "Pneumonia", "icd_code": "J15.9"}]}
    with patch.object(voice_agent.grounding, "icd10_lookup",
                      return_value=[{"code": "J18.9", "name": "x"}]), \
         patch.object(voice_agent.grounding, "evidence", return_value=[]):
        out = voice_agent.ground_diagnosis(result)
    assert out["conditions"][0]["icd_code"] == "J15.9"  # not overwritten
