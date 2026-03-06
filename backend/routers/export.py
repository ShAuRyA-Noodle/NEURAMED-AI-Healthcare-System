from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, cast, String
from typing import Optional
from datetime import datetime, timedelta
from io import BytesIO

from db.database import get_db
from db.models import DiagnosisSession
from utils.pdf_export import generate_session_pdf

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


@router.get("/stats")
def get_session_stats(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    today_start = datetime(now.year, now.month, now.day)
    week_start = today_start - timedelta(days=now.weekday())

    total = db.query(DiagnosisSession).filter(
        DiagnosisSession.is_deleted != True
    ).count()
    today = db.query(DiagnosisSession).filter(
        DiagnosisSession.created_at >= today_start,
        DiagnosisSession.is_deleted != True
    ).count()
    this_week = db.query(DiagnosisSession).filter(
        DiagnosisSession.created_at >= week_start,
        DiagnosisSession.is_deleted != True
    ).count()

    # By agent
    by_agent = {}
    for agent in ["voice", "imaging", "ocr"]:
        by_agent[agent] = db.query(DiagnosisSession).filter(
            DiagnosisSession.agent_type == agent,
            DiagnosisSession.is_deleted != True
        ).count()

    # By urgency
    by_urgency = {}
    for urg in ["low", "medium", "high", "critical"]:
        by_urgency[urg] = db.query(DiagnosisSession).filter(
            DiagnosisSession.urgency_level == urg,
            DiagnosisSession.is_deleted != True
        ).count()

    avg_confidence = db.query(func.avg(DiagnosisSession.confidence_score)).filter(
        DiagnosisSession.is_deleted != True
    ).scalar() or 0.0

    avg_processing_time = db.query(func.avg(DiagnosisSession.processing_time_ms)).filter(
        DiagnosisSession.is_deleted != True
    ).scalar() or 0

    return {
        "total": total,
        "today": today,
        "this_week": this_week,
        "by_agent": by_agent,
        "by_urgency": by_urgency,
        "avg_confidence": round(avg_confidence, 4),
        "avg_processing_time": round(avg_processing_time)
    }


@router.get("")
def list_sessions(
    agent_type: Optional[str] = None,
    urgency: Optional[str] = None,
    patient_id: Optional[int] = None,
    condition: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = db.query(DiagnosisSession).filter(
        DiagnosisSession.is_deleted != True
    )
    if agent_type:
        query = query.filter(DiagnosisSession.agent_type == agent_type)
    if urgency:
        query = query.filter(DiagnosisSession.urgency_level == urgency)
    if patient_id:
        query = query.filter(DiagnosisSession.patient_id == patient_id)
    if condition:
        query = query.filter(cast(DiagnosisSession.conditions_detected, String).ilike(f"%{condition}%"))
    if date_from:
        query = query.filter(DiagnosisSession.created_at >= date_from)
    if date_to:
        query = query.filter(DiagnosisSession.created_at <= date_to)

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

    # Related sessions from same patient
    related = []
    if session.patient_id:
        related_query = db.query(DiagnosisSession).filter(
            DiagnosisSession.patient_id == session.patient_id,
            DiagnosisSession.id != session.id,
            DiagnosisSession.is_deleted != True
        ).order_by(DiagnosisSession.created_at.desc()).limit(3).all()
        for r in related_query:
            related.append({
                "id": r.id,
                "agent_type": r.agent_type,
                "conditions_detected": r.conditions_detected or [],
                "confidence_score": r.confidence_score,
                "urgency_level": r.urgency_level,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })

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
        "related_sessions": related,
    }


@router.delete("/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(DiagnosisSession).filter(DiagnosisSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.is_deleted = True
    db.commit()
    return {"status": "deleted", "id": session_id}


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
