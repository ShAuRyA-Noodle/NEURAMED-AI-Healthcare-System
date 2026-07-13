import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("ENVIRONMENT", "test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-for-production")
os.environ.setdefault("DOCTOR_INVITE_CODE", "TEST-INVITE")

from db.database import Base, get_db  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture
def db_session():
    """Fresh in-memory database per test. StaticPool keeps the same
    connection alive so :memory: survives across the session."""
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client(db_session):
    """TestClient with the DB dependency overridden to the test session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_client(client):
    """A TestClient already carrying a valid Bearer token for a fresh DOCTOR user.

    Doctors have clinical access, so existing tests that browse PHI
    (patients, sessions, dashboard, appointments) keep passing.
    """
    reg = client.post("/api/auth/register", json={
        "email": "test.doctor@example.com",
        "password": "TestPass123!",
        "full_name": "Test Doctor",
        "role": "doctor",
        "invite_code": "TEST-INVITE",
    })
    assert reg.status_code in (200, 201), reg.text
    token = reg.json().get("access_token")
    if not token:
        login = client.post("/api/auth/login", json={
            "email": "test.doctor@example.com",
            "password": "TestPass123!",
        })
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


@pytest.fixture
def patient_client(client):
    """A TestClient carrying a valid Bearer token for a self-registered PATIENT.

    Used to prove PHI browse/enumerate endpoints are forbidden (403) to
    non-doctor accounts while diagnostic/analyze endpoints stay open.
    """
    reg = client.post("/api/auth/register", json={
        "email": "test.patient@example.com",
        "password": "TestPass123!",
        "full_name": "Test Patient",
        "role": "patient",
    })
    assert reg.status_code in (200, 201), reg.text
    token = reg.json().get("access_token")
    if not token:
        login = client.post("/api/auth/login", json={
            "email": "test.patient@example.com",
            "password": "TestPass123!",
        })
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


@pytest.fixture
def no_api_keys(monkeypatch):
    """Simulate every AI provider being unavailable."""
    for key in ("GROQ_API_KEY", "ELEVENLABS_API_KEY", "GEMINI_API_KEY",
                "OPENROUTER_API_KEY"):
        monkeypatch.setenv(key, "")
