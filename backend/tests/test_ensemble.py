import pytest
from unittest.mock import patch
from ml import ensemble
from core.exceptions import InferenceUnavailable


def _vote(vendor, dx, abstain=False, status="ok"):
    return {"vendor": vendor, "model": f"{vendor}-m", "status": status,
            "primary_diagnosis": dx, "confidence": 0.8, "reasoning": "r",
            "abstain": abstain, "differentials": []}


def test_fewer_than_two_votes_raises():
    with patch.object(ensemble, "_call_one",
                      side_effect=[_vote("gemini","X"),
                                   _vote("groq","",status="unavailable"),
                                   _vote("cerebras","",status="error")]):
        with pytest.raises(InferenceUnavailable):
            ensemble.second_opinion("case")


def test_unanimous_consensus():
    with patch.object(ensemble, "_call_one",
                      side_effect=[_vote("gemini","Pneumonia"),
                                   _vote("groq","pneumonia"),
                                   _vote("cerebras","Pneumonia")]):
        out = ensemble.second_opinion("case")
    assert out["consensus_level"] == "unanimous"
    assert out["dissent"] == []
    assert out["real_votes"] == 3


def test_split_surfaces_dissent():
    with patch.object(ensemble, "_call_one",
                      side_effect=[_vote("gemini","Pneumonia"),
                                   _vote("groq","Pulmonary embolism"),
                                   _vote("cerebras","Heart failure")]):
        out = ensemble.second_opinion("case")
    assert out["consensus_level"] == "split"
    assert len(out["dissent"]) >= 1


def test_abstain_not_counted_as_vote():
    with patch.object(ensemble, "_call_one",
                      side_effect=[_vote("gemini","Pneumonia"),
                                   _vote("groq","Pneumonia"),
                                   _vote("cerebras","x", abstain=True)]):
        out = ensemble.second_opinion("case")
    assert out["real_votes"] == 2
    assert "cerebras" in out["abstained"]
