import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User, DiagnosisSession, Patient
from utils.auth import require_user
from utils.llm import call_llm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/patients", tags=["Timeline"])


@router.get("/{patient_id}/timeline")
def get_patient_timeline(
    patient_id: int,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(404, "Patient not found")

    sessions = (
        db.query(DiagnosisSession)
        .filter(
            DiagnosisSession.patient_id == patient_id,
            DiagnosisSession.is_deleted == False,
        )
        .order_by(DiagnosisSession.created_at.asc())
        .all()
    )

    timeline_data = []
    health_score_series = []
    for s in sessions:
        health_score = _extract_health_score(s)
        entry = {
            "id": s.id,
            "date": s.created_at.isoformat(),
            "agent_type": s.agent_type,
            "urgency": s.urgency_level,
            "primary_conditions": _extract_conditions(s),
            "health_score": health_score,
            "summary": _extract_summary(s),
            "confidence": s.confidence_score,
        }
        timeline_data.append(entry)
        if health_score is not None:
            health_score_series.append({
                "date": s.created_at.isoformat(),
                "score": health_score,
            })

    result = {
        "patient_id": patient_id,
        "patient_code": patient.patient_code,
        "total_sessions": len(sessions),
        "date_range": {
            "first": sessions[0].created_at.isoformat() if sessions else None,
            "last": sessions[-1].created_at.isoformat() if sessions else None,
        },
        "timeline": timeline_data,
        "health_score_series": health_score_series,
        "trend_analysis": None,
    }

    # Only do trend analysis if we have enough data
    if len(sessions) >= 2:
        result["trend_analysis"] = _analyze_trends(timeline_data)

    return result


def _extract_conditions(session: DiagnosisSession) -> list:
    if session.conditions_detected:
        return session.conditions_detected[:3]
    if session.result_json and isinstance(session.result_json, dict):
        conds = session.result_json.get("conditions", [])
        if isinstance(conds, list):
            return [c.get("name", str(c)) if isinstance(c, dict) else str(c) for c in conds[:3]]
    return []


def _extract_health_score(session: DiagnosisSession) -> int | None:
    if not session.result_json or not isinstance(session.result_json, dict):
        return None
    score = session.result_json.get("overall_health_score")
    if isinstance(score, (int, float)):
        return int(score)
    score_map = {"good": 80, "fair": 60, "poor": 40, "critical": 20}
    if isinstance(score, str) and score.lower() in score_map:
        return score_map[score.lower()]
    # Derive from confidence and urgency
    urgency_map = {"low": 80, "medium": 60, "high": 40, "critical": 20}
    return urgency_map.get(session.urgency_level, 50)


def _extract_summary(session: DiagnosisSession) -> str:
    if not session.result_json or not isinstance(session.result_json, dict):
        return session.input_summary or ""
    for key in ["executive_summary", "summary", "impression", "clinical_impression"]:
        if session.result_json.get(key):
            return str(session.result_json[key])[:200]
    return session.input_summary or ""


def _analyze_trends(timeline: list) -> dict:
    prompt = f"""You are a clinical epidemiologist analyzing a patient's longitudinal health data across {len(timeline)} medical encounters.

Timeline data:
{json.dumps(timeline, indent=2)}

Analyze patterns and return JSON:
{{
  "overall_trajectory": "improving | stable | declining | fluctuating",
  "trajectory_confidence": 0.75,
  "trajectory_summary": "2-3 sentence narrative of health direction",
  "improving_conditions": [
    {{
      "condition": "Condition name",
      "evidence": "What shows improvement",
      "timeline": "Improvement timeline"
    }}
  ],
  "worsening_conditions": [],
  "new_conditions": [
    {{
      "condition": "Condition name",
      "first_appeared": "date",
      "current_status": "persistent | resolved",
      "sessions_count": 1
    }}
  ],
  "recurring_conditions": [
    {{
      "condition": "Condition name",
      "occurrences": 2,
      "pattern": "Pattern description",
      "possible_cause": "Possible cause"
    }}
  ],
  "specialist_referral_recommended": [
    {{
      "specialty": "Specialty",
      "reason": "Why needed",
      "urgency": "soon | routine"
    }}
  ],
  "risk_trend": [
    {{"month": "2025-06", "risk_score": 0.3}}
  ]
}}

Return only valid JSON."""

    return call_llm(
        system_prompt="You are a clinical epidemiologist. Return only valid JSON.",
        user_message=prompt,
        fallback_type="timeline",
    )
