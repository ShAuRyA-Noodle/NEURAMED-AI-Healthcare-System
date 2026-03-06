from dotenv import load_dotenv
import os

# Define path to .env file relative to this script
env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(dotenv_path=env_path)

print("=== NEURAMED STARTUP ===")
_gk = os.getenv('GROQ_API_KEY', '')
print(f"GROQ KEY: {'LOADED' if _gk else 'MISSING'} (starts with: {_gk[:8]}...)" if _gk else "GROQ KEY: MISSING")
print(f"ELEVENLABS KEY: {'LOADED' if os.getenv('ELEVENLABS_API_KEY') else 'MISSING'}")
print(f"TESSERACT: {os.getenv('TESSERACT_CMD', 'NOT SET')}")
print(f"ENVIRONMENT: {os.getenv('ENVIRONMENT', 'not set')}")
print(f".env file exists at {env_path}: {os.path.exists(env_path)}")

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from datetime import datetime

from db.database import engine, Base
from routers import voice, imaging, ocr, dashboard, patients, appointments, search, system, auth
from seed import seed_db

# Create all tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="NEURAMED API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

@app.on_event("startup")
def startup_event():
    seed_db()
