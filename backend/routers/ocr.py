from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from ws_manager import broadcast_to_clients
from datetime import datetime
from typing import Optional, List
from db.database import get_db
from agents import ocr_agent
from db.models import Report, User
from db.schemas import ReportAnalysisResult, ReportResponse
from utils.auth import require_user

router = APIRouter(prefix="/api/ocr", tags=["OCR"])

_MAX_UPLOAD_BYTES = 20 * 1024 * 1024  # 20 MB
_ALLOWED_MIME = {
    "image/jpeg", "image/png", "image/tiff", "image/bmp", "image/webp",
    "application/pdf",
}

@router.post("/analyze-report", response_model=ReportAnalysisResult)
async def analyze_report(
    file: UploadFile = File(...),
    patient_id: Optional[int] = Form(None),
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
        res = ocr_agent.analyze(file_bytes=contents, filename=file.filename, patient_id=patient_id, db=db)

        from db.models import Patient
        patient = db.query(Patient).filter(Patient.id == patient_id).first() if patient_id else None
        p_code = patient.patient_code if patient else "WALK-IN"

        first_finding = res.key_findings[0] if res.key_findings else (res.summary[:60] if res.summary else "Report analyzed")
        await broadcast_to_clients({
            "patient_code": p_code,
            "agent_type": "ocr",
            "condition": first_finding,
            "confidence": 1.0,
            "urgency": res.urgency if res.urgency != "low" else ("medium" if res.abnormal_flags else "low"),
            "timestamp": datetime.utcnow().isoformat()
        })
        return res
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report analysis failed: {str(e)}")

@router.get("/reports", response_model=List[ReportResponse])
def get_reports(limit: int = 20, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    return db.query(Report).limit(limit).all()

@router.get("/reports/{report_id}", response_model=ReportResponse)
def get_report(report_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_user)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report
