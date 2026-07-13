"""Security hardening tests (C4/C5, H4, H5, M3).

All tests are hermetic: env-dependent behavior is exercised via monkeypatch
and the helpers are tested directly where an HTTP round-trip is fiddly.
"""
import pytest
from fastapi import HTTPException

from utils.auth import assert_production_secrets
from utils.file_handling import (
    check_upload_size,
    validate_imaging_file,
    validate_ocr_file,
    clamp_pagination,
    MAX_UPLOAD_BYTES,
)
from utils.rate_limit import _enforce


class _FakeUpload:
    def __init__(self, filename="", content_type=""):
        self.filename = filename
        self.content_type = content_type


class _FakeRequest:
    def __init__(self, host="1.2.3.4"):
        self.client = type("C", (), {"host": host})()


# ---------------------------------------------------------------- C4/C5

def test_assert_production_secrets_raises_on_default_secret(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "neuramed-secret-key-change-in-production-2026")
    monkeypatch.setenv("DOCTOR_INVITE_CODE", "some-real-code")
    with pytest.raises(RuntimeError):
        assert_production_secrets()


def test_assert_production_secrets_raises_on_default_invite(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "a-strong-secret")
    monkeypatch.setenv("DOCTOR_INVITE_CODE", "NEURAMED-DOCTOR-2026")
    with pytest.raises(RuntimeError):
        assert_production_secrets()


def test_assert_production_secrets_raises_on_unset(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.delenv("SECRET_KEY", raising=False)
    monkeypatch.delenv("DOCTOR_INVITE_CODE", raising=False)
    with pytest.raises(RuntimeError):
        assert_production_secrets()


def test_assert_production_secrets_ok_with_real_values(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "production")
    monkeypatch.setenv("SECRET_KEY", "a-strong-secret")
    monkeypatch.setenv("DOCTOR_INVITE_CODE", "a-real-invite")
    assert_production_secrets() is None


def test_assert_production_secrets_noop_outside_production(monkeypatch):
    # Default/test env must never raise, even with default secrets.
    monkeypatch.setenv("ENVIRONMENT", "test")
    monkeypatch.setenv("SECRET_KEY", "neuramed-secret-key-change-in-production-2026")
    assert_production_secrets() is None


# ---------------------------------------------------------------- H4

def test_upload_size_limit_rejects_oversize():
    oversize = b"x" * (MAX_UPLOAD_BYTES + 1)
    with pytest.raises(HTTPException) as exc:
        check_upload_size(oversize)
    assert exc.value.status_code == 413


def test_upload_size_limit_allows_ok():
    check_upload_size(b"x" * 1024)  # no raise


def test_imaging_accepts_image_and_dicom():
    validate_imaging_file(_FakeUpload("scan.png", "image/png"))
    validate_imaging_file(_FakeUpload("scan.dcm", "application/octet-stream"))
    validate_imaging_file(_FakeUpload("scan.bin", "application/dicom"))


def test_imaging_rejects_unsupported_type():
    with pytest.raises(HTTPException) as exc:
        validate_imaging_file(_FakeUpload("evil.exe", "application/x-msdownload"))
    assert exc.value.status_code == 415


def test_ocr_accepts_pdf_and_images():
    validate_ocr_file(_FakeUpload("report.pdf", "application/pdf"))
    validate_ocr_file(_FakeUpload("scan.jpg", "image/jpeg"))


def test_ocr_rejects_unsupported_type():
    with pytest.raises(HTTPException) as exc:
        validate_ocr_file(_FakeUpload("evil.exe", "application/x-msdownload"))
    assert exc.value.status_code == 415


def test_imaging_upload_endpoint_rejects_oversize(auth_client):
    """End-to-end 413 for an oversize multipart upload."""
    import io
    big = io.BytesIO(b"x" * (MAX_UPLOAD_BYTES + 1))
    resp = auth_client.post(
        "/api/imaging/analyze",
        files={"file": ("huge.png", big, "image/png")},
        data={"scan_type": "xray"},
    )
    assert resp.status_code == 413, resp.text


def test_imaging_upload_endpoint_rejects_bad_type(auth_client):
    import io
    resp = auth_client.post(
        "/api/imaging/analyze",
        files={"file": ("evil.exe", io.BytesIO(b"MZ"), "application/x-msdownload")},
        data={"scan_type": "xray"},
    )
    assert resp.status_code == 415, resp.text


# ---------------------------------------------------------------- M3

def test_clamp_pagination_caps_high_limit():
    limit, offset = clamp_pagination(999999, 0)
    assert limit == 100


def test_clamp_pagination_floors_low_limit():
    limit, offset = clamp_pagination(0, 0)
    assert limit == 1


def test_clamp_pagination_floors_negative_offset():
    limit, offset = clamp_pagination(50, -100)
    assert offset == 0
    assert limit == 50


# ---------------------------------------------------------------- H5

def test_rate_limit_disabled_in_test_env(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "test")
    req = _FakeRequest()
    # A burst well over the limit must never raise under test env.
    for _ in range(50):
        _enforce(req)


def test_rate_limit_enforced_outside_test_env(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "development")
    req = _FakeRequest(host="9.9.9.9")  # distinct IP to avoid cross-test state
    with pytest.raises(HTTPException) as exc:
        for _ in range(20):
            _enforce(req)
    assert exc.value.status_code == 429
