import os
import sys
import shutil
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from backend.db.database import get_db
from backend.db.models import DiagnosisSession

router = APIRouter(prefix="/api/system", tags=["System"])

SERVER_START_TIME = datetime.utcnow()


@router.get("/info")
def get_system_info(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    uptime = now - SERVER_START_TIME
    total_sessions = db.query(DiagnosisSession).count()

    # Database size
    db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "neuramed.db")
    db_size_mb = 0.0
    if os.path.exists(db_path):
        db_size_mb = round(os.path.getsize(db_path) / (1024 * 1024), 2)

    # Tesseract check
    tesseract_cmd = os.getenv("TESSERACT_CMD", "")
    tesseract_available = bool(tesseract_cmd and (os.path.exists(tesseract_cmd) or shutil.which("tesseract")))

    return {
        "server_start_time": SERVER_START_TIME.isoformat(),
        "uptime_seconds": int(uptime.total_seconds()),
        "total_sessions": total_sessions,
        "groq_key_present": bool(os.getenv("GROQ_API_KEY", "").strip()),
        "elevenlabs_key_present": bool(os.getenv("ELEVENLABS_API_KEY", "").strip()),
        "tesseract_available": tesseract_available,
        "database_size_mb": db_size_mb,
        "python_version": sys.version.split()[0],
        "environment": os.getenv("ENVIRONMENT", "development")
    }


@router.get("/health")
def detailed_health(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    uptime = now - SERVER_START_TIME
    return {
        "status": "ok",
        "timestamp": now.isoformat(),
        "uptime_seconds": int(uptime.total_seconds()),
        "database": "connected",
        "groq_api": "configured" if os.getenv("GROQ_API_KEY", "").strip() else "missing",
    }
