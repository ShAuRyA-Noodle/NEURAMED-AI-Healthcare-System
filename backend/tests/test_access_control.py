"""C1 — PHI browse/enumerate endpoints must be gated to the doctor role.

A self-registered patient proves the enumeration breach is closed (403),
a doctor keeps clinical access (200), and diagnostic/analyze endpoints
stay open to any authenticated user.
"""


def test_patient_cannot_list_all_patients(patient_client):
    r = patient_client.get("/api/patients")
    assert r.status_code == 403


def test_patient_cannot_read_arbitrary_patient(patient_client):
    r = patient_client.get("/api/patients/1")
    assert r.status_code == 403


def test_patient_cannot_browse_sessions(patient_client):
    r = patient_client.get("/api/sessions")
    assert r.status_code == 403


def test_patient_cannot_view_session_detail(patient_client):
    r = patient_client.get("/api/sessions/1")
    assert r.status_code == 403


def test_patient_cannot_search_phi(patient_client):
    r = patient_client.get("/api/search", params={"q": "a"})
    assert r.status_code == 403


def test_patient_cannot_view_patient_timeline(patient_client):
    r = patient_client.get("/api/patients/1/timeline")
    assert r.status_code == 403


def test_patient_cannot_view_dashboard_stats(patient_client):
    r = patient_client.get("/api/dashboard/stats")
    assert r.status_code == 403


def test_patient_cannot_browse_scans(patient_client):
    r = patient_client.get("/api/imaging/scans")
    assert r.status_code == 403


def test_patient_cannot_browse_reports(patient_client):
    r = patient_client.get("/api/ocr/reports")
    assert r.status_code == 403


def test_patient_cannot_list_appointments(patient_client):
    r = patient_client.get("/api/appointments")
    assert r.status_code == 403


def test_doctor_can_list_patients(auth_client):
    r = auth_client.get("/api/patients")
    assert r.status_code == 200


def test_doctor_can_browse_sessions(auth_client):
    r = auth_client.get("/api/sessions")
    assert r.status_code == 200


def test_doctor_can_view_dashboard_stats(auth_client):
    r = auth_client.get("/api/dashboard/stats")
    assert r.status_code == 200


def test_patient_can_still_use_diagnostic_tools(patient_client, monkeypatch):
    # A patient can run a voice diagnosis (analyze endpoints stay open).
    # With no GROQ key this should be 503 (InferenceUnavailable), NOT 403.
    monkeypatch.setenv("GROQ_API_KEY", "")
    r = patient_client.post(
        "/api/voice/diagnose",
        json={"transcript": "headache", "patient_id": None},
    )
    assert r.status_code != 403  # 503 or 200, but never forbidden
