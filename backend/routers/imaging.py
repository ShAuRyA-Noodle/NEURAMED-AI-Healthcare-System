from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from backend.ws_manager import broadcast_to_clients
from datetime import datetime
from typing import Optional, List
from backend.db.database import get_db
from backend.agents import imaging_agent
from backend.db.models import ScanResult
from backend.db.schemas import ScanAnalysisResult, ScanResultResponse

router = APIRouter(prefix="/api/imaging", tags=["Imaging"])

@router.post("/analyze", response_model=ScanAnalysisResult)
async def analyze_image(
    file: UploadFile = File(...),
    scan_type: str = Form(...),
    patient_id: Optional[int] = Form(None),
    session_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        contents = await file.read()
        res = imaging_agent.analyze(image_bytes=contents, scan_type=scan_type, patient_id=patient_id, session_id=session_id, db=db)
        
        from backend.db.models import Patient
        patient = db.query(Patient).filter(Patient.id == patient_id).first() if patient_id else None
        p_code = patient.patient_code if patient else f"PT-{patient_id}"

        await broadcast_to_clients({
            "patient_code": p_code,
            "agent_type": "imaging",
            "condition": res.findings[:30] if hasattr(res, 'findings') else (res.anomaly_regions[0] if res.anomaly_regions else "Unknown"),
            "confidence": res.confidence,
            "urgency": "high" if res.anomaly_detected else "low",
            "timestamp": datetime.utcnow().isoformat()
        })
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/scans", response_model=List[ScanResultResponse])
def get_scans(limit: int = 20, db: Session = Depends(get_db)):
    return db.query(ScanResult).limit(limit).all()

@router.get("/scans/{scan_id}", response_model=ScanResultResponse)
def get_scan(scan_id: int, db: Session = Depends(get_db)):
    scan = db.query(ScanResult).filter(ScanResult.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    return scan
