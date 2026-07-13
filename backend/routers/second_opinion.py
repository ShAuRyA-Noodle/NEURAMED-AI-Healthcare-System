import json
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User, DiagnosisSession
from utils.auth import require_user
from ml import ensemble
from core.provenance import Provenance, InferenceStatus, wrap_result

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions", tags=["Second Opinion"])


@router.post("/{session_id}/second-opinion")
async def get_second_opinion(
    session_id: int,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    session = db.query(DiagnosisSession).filter(
        DiagnosisSession.id == session_id
    ).first()
    if not session:
        raise HTTPException(404, "Session not found")

    case_text = _build_case_text(session)

    # Real ensemble: three vendors vote independently. Raises
    # InferenceUnavailable (-> 503) if fewer than 2 real votes come back.
    result = await asyncio.to_thread(ensemble.second_opinion, case_text)

    wrapped = wrap_result(result, Provenance(
        status=InferenceStatus.OK,
        source="real_model",
        model="multi",
        vendor="ensemble:gemini+groq+cerebras",
        grounded_in=[],
    ))
    wrapped["session_id"] = session_id
    return wrapped


def _build_case_text(session: DiagnosisSession) -> str:
    """Compact case summary for the vote prompt.

    Kept deliberately small — Cerebras free tier caps context at ~8k tokens,
    so we cap free-text fields and only include the most decision-relevant
    parts of the session.
    """
    def clip(value, limit=600) -> str:
        text = value if isinstance(value, str) else json.dumps(value, default=str)
        text = text.strip()
        return text[:limit] + ("..." if len(text) > limit else "")

    parts = [f"Agent type: {session.agent_type}"]
    if session.input_summary:
        parts.append(f"Presentation: {clip(session.input_summary, 800)}")
    if session.conditions_detected:
        parts.append(f"Conditions detected: {clip(session.conditions_detected, 400)}")

    if isinstance(session.result_json, dict):
        result = session.result_json
        for key in ["summary", "executive_summary", "findings", "impression", "transcript"]:
            if result.get(key):
                parts.append(f"{key}: {clip(result[key], 500)}")
        if result.get("conditions"):
            parts.append(f"Original conditions: {clip(result['conditions'][:3], 400)}")

    parts.append(f"Original urgency: {session.urgency_level}")
    parts.append(f"Original confidence: {session.confidence_score}")
    parts.append(
        "Give your INDEPENDENT second opinion. Do not defer to the original."
    )
    return "\n".join(parts)
