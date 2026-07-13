from dotenv import load_dotenv
import os
import sys

# Fix Windows console encoding for Indian language support.
# Guarded so it does NOT run under pytest — replacing sys.stdout/stderr grabs
# pytest's capture buffer and crashes at teardown ("I/O operation on closed file").
if sys.platform == "win32" and "pytest" not in sys.modules:
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Define path to .env file relative to this script
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)

import logging
logging.basicConfig(level=logging.INFO)
_log = logging.getLogger("neuramed")
_log.info("NEURAMED starting | env=%s | groq=%s | elevenlabs=%s",
          os.getenv("ENVIRONMENT", "development"),
          "configured" if os.getenv("GROQ_API_KEY") else "MISSING",
          "configured" if os.getenv("ELEVENLABS_API_KEY") else "MISSING")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from datetime import datetime

from routers import voice, imaging, ocr, dashboard, patients, appointments, search, system, auth
from routers import drug_interactions, second_opinion, timeline, sarvam

# Schema is owned by Alembic migrations (see backend/migrations/).
# Run `alembic upgrade head` to create/update tables.

app = FastAPI(title="NEURAMED API")

from core.exceptions import InferenceUnavailable, inference_unavailable_handler
app.add_exception_handler(InferenceUnavailable, inference_unavailable_handler)

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*")
origins = ["*"] if ALLOWED_ORIGINS == "*" else [o.strip() for o in ALLOWED_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Include routers
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
app.include_router(auth.router)
app.include_router(drug_interactions.router)
app.include_router(second_opinion.router)
app.include_router(timeline.router)
app.include_router(sarvam.router)

from ws_manager import manager, broadcast_to_clients

@app.websocket("/ws/live-feed")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}
