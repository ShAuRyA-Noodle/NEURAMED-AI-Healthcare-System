from dotenv import load_dotenv
import os
import sys
import logging

# Fix Windows console encoding for Indian language support
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)

logger = logging.getLogger("neuramed")
logging.basicConfig(level=logging.INFO)

# Startup diagnostics — never log key prefixes/values
logger.info("=== NEURAMED STARTUP ===")
logger.info("GROQ KEY: %s", "LOADED" if os.getenv("GROQ_API_KEY") else "MISSING")
logger.info("ELEVENLABS KEY: %s", "LOADED" if os.getenv("ELEVENLABS_API_KEY") else "MISSING")
logger.info("ENVIRONMENT: %s", os.getenv("ENVIRONMENT", "development"))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware
from datetime import datetime

from slowapi import Limiter, _rate_limit_exceeded_handler  # type: ignore[import]
from slowapi.util import get_remote_address  # type: ignore[import]
from slowapi.errors import RateLimitExceeded  # type: ignore[import]
from db.database import engine, Base
from routers import voice, imaging, ocr, dashboard, patients, appointments, search, system, auth
from routers import drug_interactions, second_opinion, timeline, sarvam
from utils.auth import _decode_and_validate

Base.metadata.create_all(bind=engine)

_limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="NEURAMED API",
    docs_url=None if os.getenv("ENVIRONMENT") == "production" else "/docs",
    redoc_url=None if os.getenv("ENVIRONMENT") == "production" else "/redoc",
)

# Wire rate limiter — must happen before adding routes
app.state.limiter = _limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── Security headers middleware ───────────────────────────────────────────────
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        if os.getenv("ENVIRONMENT") == "production":
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# ── CORS: explicit origins only, never wildcard ───────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
if not _raw_origins or _raw_origins.strip() == "*":
    # Development fallback — only localhost
    _origins = ["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"]
    logger.warning("ALLOWED_ORIGINS not set — restricting CORS to localhost only")
else:
    _origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(voice.router)
app.include_router(imaging.router)
app.include_router(ocr.router)
app.include_router(dashboard.router)
app.include_router(patients.router)
app.include_router(appointments.router)

from routers import export
app.include_router(export.router)
app.include_router(search.router)
app.include_router(system.router)
app.include_router(drug_interactions.router)
app.include_router(second_opinion.router)
app.include_router(timeline.router)
app.include_router(sarvam.router)

from ws_manager import manager

# ── Authenticated WebSocket — doctors only ────────────────────────────────────
@app.websocket("/ws/live-feed")
async def websocket_endpoint(websocket: WebSocket):
    # Accept token from query param or cookie (cookies auto-sent same-origin)
    token = (
        websocket.query_params.get("token")
        or websocket.cookies.get("neuramed_session")
    )
    if not token:
        await websocket.close(code=4401, reason="Authentication required")
        return

    payload = _decode_and_validate(token, "access")
    if not payload:
        await websocket.close(code=4401, reason="Invalid or expired token")
        return

    if payload.get("role") != "doctor":
        await websocket.close(code=4403, reason="Access restricted to doctors")
        return

    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat() + "Z"}
