"""Security tests: authorized image serving, authenticated WebSocket,
gated appointment PHI endpoints."""
import pytest


def test_uploads_static_mount_removed(client):
    # The public static mount must be gone (path should 404, not serve a file).
    r = client.get("/uploads/anything.png")
    assert r.status_code in (404, 405)


def test_image_file_endpoint_requires_doctor(patient_client):
    # require_doctor runs before the 404 lookup, so a patient gets 403.
    r = patient_client.get("/api/imaging/file/1/original")
    assert r.status_code == 403


def test_image_file_endpoint_rejects_unauthenticated(client):
    r = client.get("/api/imaging/file/1/original")
    assert r.status_code == 401


def test_image_file_endpoint_404_for_missing_scan(auth_client):
    r = auth_client.get("/api/imaging/file/999999/original")
    assert r.status_code == 404


def test_image_file_endpoint_rejects_bad_kind(auth_client):
    r = auth_client.get("/api/imaging/file/1/../../etc/passwd")
    assert r.status_code in (404, 422, 400)


def test_appointments_upcoming_requires_doctor(patient_client):
    r = patient_client.get("/api/appointments/upcoming")
    assert r.status_code == 403


def test_appointments_today_requires_doctor(patient_client):
    r = patient_client.get("/api/appointments/today")
    assert r.status_code == 403


def test_ws_rejects_without_token(client):
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/live-feed") as ws:
            ws.receive_text()


def test_ws_rejects_invalid_token(client):
    with pytest.raises(Exception):
        with client.websocket_connect("/ws/live-feed?token=not-a-real-jwt") as ws:
            ws.receive_text()


def test_ws_accepts_valid_token(client):
    reg = client.post("/api/auth/register", json={
        "email": "ws.doctor@example.com",
        "password": "TestPass123!",
        "full_name": "WS Doctor",
        "role": "doctor",
        "invite_code": "TEST-INVITE",
    })
    assert reg.status_code in (200, 201), reg.text
    token = reg.json().get("access_token")
    assert token
    with client.websocket_connect(f"/ws/live-feed?token={token}") as ws:
        # Connection accepted; no exception on enter means the handshake passed.
        assert ws is not None
