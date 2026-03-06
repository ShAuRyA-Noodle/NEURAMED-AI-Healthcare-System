from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from ws_manager import broadcast_to_clients
from datetime import datetime
from typing import Optional, List
from db.database import get_db
from agents import ocr_agent
from db.models import Report
from db.schemas import ReportAnalysisResult, ReportResponse

router = APIRouter(prefix="/api/ocr", tags=["OCR"])

@router.post("/analyze-report", response_model=ReportAnalysisResult)
async def analyze_report(
    file: UploadFile = File(...),
    patient_id: Optional[int] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        contents = await file.read()
        res = ocr_agent.analyze(file_bytes=contents, filename=file.filename, patient_id=patient_id, db=db)
        
        from db.models import Patient
        patient = db.query(Patient).filter(Patient.id == patient_id).first() if patient_id else None
        p_code = patient.patient_code if patient else f"PT-{patient_id}"

        await broadcast_to_clients({
            "patient_code": p_code,
            "agent_type": "ocr",
            "condition": res.key_findings[0] if res.key_findings else "Unknown",
            "confidence": 1.0,
            "urgency": "medium" if res.abnormal_flags else "low",
            "timestamp": datetime.utcnow().isoformat()
        })
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/reports", response_model=List[ReportResponse])
def get_reports(limit: int = 20, db: Session = Depends(get_db)):
    return db.query(Report).limit(limit).all()

@router.get("/reports/{report_id}", response_model=ReportResponse)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(Report).filter(Report.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report
