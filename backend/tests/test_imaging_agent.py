import numpy as np
import pytest
from unittest.mock import patch
from agents import imaging_agent


def _png_bytes():
    import cv2
    img = (np.random.rand(64, 64, 3) * 255).astype("uint8")
    ok, buf = cv2.imencode(".png", img)
    return buf.tobytes()


def test_confidence_comes_from_classifier_not_opencv(db_session):
    fake_probs = {"Cardiomegaly": 0.9, "Effusion": 0.1, "Pneumonia": 0.05}
    with patch.object(imaging_agent.cxr_classifier, "classify", return_value=fake_probs), \
         patch.object(imaging_agent, "analyze_scan_with_vision",
                      return_value={"clinical_impression": "Cardiomegaly",
                                    "overall_assessment": "clinically_significant",
                                    "confidence_score": 0.7, "urgency": "urgent"}):
        res = imaging_agent.analyze(_png_bytes(), "x-ray", None, None, db_session,
                                    body_region="chest")
    assert res.confidence >= 0.9 - 1e-6
    assert "Cardiomegaly" in str(res.pathology_scores)


def test_png_upload_reports_no_mm_measurements(db_session):
    fake_probs = {"Effusion": 0.3}
    with patch.object(imaging_agent.cxr_classifier, "classify", return_value=fake_probs), \
         patch.object(imaging_agent, "analyze_scan_with_vision",
                      return_value={"clinical_impression": "x", "measurements": "12 mm nodule",
                                    "confidence_score": 0.4}):
        res = imaging_agent.analyze(_png_bytes(), "x-ray", None, None, db_session,
                                    body_region="chest")
    assert res.measurements_enabled is False
    assert "mm" not in (res.measurements or "")


def test_no_model_available_raises(db_session, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "")
    from core.exceptions import InferenceUnavailable
    with patch.object(imaging_agent, "analyze_scan_with_vision", return_value={}):
        with pytest.raises(InferenceUnavailable):
            imaging_agent.analyze(_png_bytes(), "mri", None, None, db_session,
                                  body_region="brain")
