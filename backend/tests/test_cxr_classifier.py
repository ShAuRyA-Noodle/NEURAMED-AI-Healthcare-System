import numpy as np
import pytest
from ml import cxr_classifier


def test_classify_returns_probabilities_for_known_pathologies():
    img = (np.random.rand(224, 224) * 255).astype("uint8")
    result = cxr_classifier.classify(img)
    assert isinstance(result, dict)
    for path in ("Cardiomegaly", "Effusion", "Pneumonia", "Edema"):
        assert path in result, f"missing pathology {path}"
        assert 0.0 <= result[path] <= 1.0


def test_pathologies_list_is_nonempty():
    assert len(cxr_classifier.pathologies()) >= 14


def test_top_findings_sorted_desc():
    img = (np.random.rand(224, 224) * 255).astype("uint8")
    top = cxr_classifier.top_findings(img, k=3)
    assert len(top) == 3
    probs = [p for _, p in top]
    assert probs == sorted(probs, reverse=True)
