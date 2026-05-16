from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from ws_manager import broadcast_to_clients
from datetime import datetime
from typing import Optional, List
from db.database import get_db
from agents import imaging_agent
from db.models import ScanResult, User
from db.schemas import ScanAnalysisResult, ScanResultResponse
from utils.auth import require_user

router = APIRouter(prefix="/api/imaging", tags=["Imaging"])

_MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB
_ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/tiff", "image/bmp", "image/gif"}

@router.post("/analyze", response_model=ScanAnalysisResult)
async def analyze_image(
    file: UploadFile = File(...),
    scan_type: str = Form(...),
    patient_id: Optional[int] = Form(None),
    session_id: Optional[int] = Form(None),
    body_region: str = Form("Chest"),
    clinical_indication: str = Form(""),
    patient_age: Optional[int] = Form(None),
    patient_gender: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_user)
):
    if file.content_type not in _ALLOWED_MIME:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {file.content_type}")
    try:
        contents = await file.read(_MAX_UPLOAD_BYTES + 1)
        if len(contents) > _MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="File exceeds 20 MB limit")
        if not contents:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        res = imaging_agent.analyze(
            image_bytes=contents, scan_type=scan_type,
            patient_id=patient_id, session_id=session_id, db=db,
            body_region=body_region, clinical_indication=clinical_indication,
            patient_age=patient_age, patient_gender=patient_gender
        )

        from db.models import Patient
        patient = db.query(Patient).filter(Patient.id == patient_id).first() if patient_id else None
        p_code = patient.patient_code if patient else "WALK-IN"

        finding_summary = (res.findings or res.clinical_impression or res.impression or "Scan analyzed")[:60]
        await broadcast_to_clients({
            "patient_code": p_code,
            "agent_type": "imaging",
            "condition": finding_summary,
            "confidence": res.confidence,
            "urgency": res.urgency if res.urgency != "routine" else ("high" if res.anomaly_detected else "low"),
            "timestamp": datetime.utcnow().isoformat()
        })
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Imaging analysis failed: {str(e)}")

@router.get("/scans", response_model=List[ScanResultResponse])
def get_scans(limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    return db.query(ScanResult).limit(limit).all()

@router.get("/scans/{scan_id}", response_model=ScanResultResponse)
def get_scan(scan_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    scan = db.query(ScanResult).filter(ScanResult.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan
