from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from io import BytesIO

from backend.db.database import get_db
from backend.db.models import DiagnosisSession
from backend.utils.pdf_export import generate_session_pdf

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


@router.get("")
def list_sessions(
    agent_type: Optional[str] = None,
    urgency: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = db.query(DiagnosisSession)
    if agent_type:
        query = query.filter(DiagnosisSession.agent_type == agent_type)
    if urgency:
        query = query.filter(DiagnosisSession.urgency_level == urgency)
    total = query.count()
    sessions = query.order_by(DiagnosisSession.created_at.desc()).offset(offset).limit(limit).all()

    results = []
    for s in sessions:
        p_code = s.patient.patient_code if s.patient else f"PT-{s.patient_id}"
        results.append({
            "id": s.id,
            "patient_code": p_code,
            "patient_id": s.patient_id,
            "agent_type": s.agent_type,
            "confidence_score": s.confidence_score,
            "urgency_level": s.urgency_level,
            "conditions_detected": s.conditions_detected or [],
            "input_summary": s.input_summary,
            "processing_time_ms": s.processing_time_ms,
            "created_at": s.created_at.isoformat() if s.created_at else None,
        })
    return {"total": total, "sessions": results}


@router.get("/{session_id}")
def get_session_detail(session_id: int, db: Session = Depends(get_db)):
    session = db.query(DiagnosisSession).filter(DiagnosisSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    p_code = session.patient.patient_code if session.patient else f"PT-{session.patient_id}"
    result_json = session.result_json or {}

    recommendations = result_json.get("recommendations", [])
    if session.agent_type == "voice":
        transcript_or_findings = session.input_summary or ""
    elif session.agent_type == "imaging":
        transcript_or_findings = result_json.get("findings", "")
    elif session.agent_type == "ocr":
        transcript_or_findings = result_json.get("summary", "")
    else:
        transcript_or_findings = ""

    return {
        "id": session.id,
        "patient_code": p_code,
        "patient_id": session.patient_id,
        "agent_type": session.agent_type,
        "input_summary": session.input_summary,
        "confidence_score": session.confidence_score,
        "urgency_level": session.urgency_level,
        "conditions_detected": session.conditions_detected,
        "recommendations": recommendations,
        "transcript_or_findings": transcript_or_findings,
        "processing_time_ms": session.processing_time_ms,
        "created_at": session.created_at.isoformat() if session.created_at else None,
        "result_json": result_json,
    }


@router.get("/{session_id}/export-pdf")
def export_pdf(session_id: int, db: Session = Depends(get_db)):
    session = db.query(DiagnosisSession).filter(DiagnosisSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    pdf_bytes = generate_session_pdf(session)

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=report_{session_id}.pdf"}
    )
