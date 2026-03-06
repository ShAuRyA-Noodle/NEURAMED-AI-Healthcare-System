from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ws_manager import broadcast_to_clients
from datetime import datetime
from pydantic import BaseModel
from typing import Optional, List
from db.database import get_db
from agents import voice_agent
from db.models import DiagnosisSession
from db.schemas import DiagnosisResult, DiagnosisSessionResponse

router = APIRouter(prefix="/api/voice", tags=["Voice"])

class DiagnoseRequest(BaseModel):
    transcript: Optional[str] = None
    audio_base64: Optional[str] = None
    patient_id: Optional[int] = None

@router.post("/diagnose", response_model=DiagnosisResult)
async def diagnose(request: DiagnoseRequest, db: Session = Depends(get_db)):
    try:
        res = voice_agent.diagnose(
            transcript=request.transcript, 
            audio_base64=request.audio_base64,
            patient_id=request.patient_id, 
            db=db
        )
        
        # Load patient
        from db.models import Patient
        patient = db.query(Patient).filter(Patient.id == request.patient_id).first() if request.patient_id else None
        p_code = patient.patient_code if patient else f"PT-{request.patient_id}"

        await broadcast_to_clients({
            "patient_code": p_code,
            "agent_type": "voice",
            "condition": res.conditions[0].name if res.conditions else "Unknown",
            "confidence": res.confidence,
            "urgency": res.urgency,
            "timestamp": datetime.utcnow().isoformat()
        })
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/sessions", response_model=List[DiagnosisSessionResponse])
def get_sessions(limit: int = 20, offset: int = 0, db: Session = Depends(get_db)):
    sessions = db.query(DiagnosisSession).filter(DiagnosisSession.agent_type == 'voice').offset(offset).limit(limit).all()
    return sessions

@router.get("/sessions/{session_id}", response_model=DiagnosisSessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(DiagnosisSession).filter(DiagnosisSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session
