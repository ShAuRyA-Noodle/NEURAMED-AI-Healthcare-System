import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from ws_manager import broadcast_to_clients
from datetime import datetime
from typing import Optional, List
from db.database import get_db
from agents import imaging_agent
from db.models import ScanResult, User
from db.schemas import ScanAnalysisResult, ScanResultResponse
from utils.auth import require_user, require_doctor
from utils.file_handling import check_upload_size, validate_imaging_file, clamp_pagination
from core.exceptions import InferenceUnavailable

logger = logging.getLogger("neuramed.imaging")

router = APIRouter(prefix="/api/imaging", tags=["Imaging"])

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
    try:
        validate_imaging_file(file)
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Empty file uploaded")
        check_upload_size(contents)
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
    except InferenceUnavailable:
        raise
    except Exception:
        logger.exception("Imaging analysis failed")
        raise HTTPException(status_code=500, detail="Internal error processing request")

@router.get("/scans", response_model=List[ScanResultResponse])
def get_scans(limit: int = 20, offset: int = 0, db: Session = Depends(get_db), current_user: User = Depends(require_doctor)):
    limit, offset = clamp_pagination(limit, offset)
    return db.query(ScanResult).offset(offset).limit(limit).all()

@router.get("/scans/{scan_id}", response_model=ScanResultResponse)
def get_scan(scan_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_doctor)):
    scan = db.query(ScanResult).filter(ScanResult.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan
