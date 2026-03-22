import os
import json
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User, DiagnosisSession
from utils.auth import require_user
from utils.llm import call_llm

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

    session_content = _extract_session_content(session)

    # Run 3 analyses in parallel
    conservative, balanced, differential = await asyncio.gather(
        asyncio.to_thread(analyze_with_persona, session_content, "conservative"),
        asyncio.to_thread(analyze_with_persona, session_content, "balanced"),
        asyncio.to_thread(analyze_with_persona, session_content, "differential"),
    )

    synthesis = synthesize_opinions(conservative, balanced, differential)

    return {
        "session_id": session_id,
        "opinions": {
            "conservative": conservative,
            "balanced": balanced,
            "differential": differential,
        },
        "synthesis": synthesis,
    }


def _extract_session_content(session: DiagnosisSession) -> str:
    parts = [f"Agent type: {session.agent_type}"]
    if session.input_summary:
        parts.append(f"Input: {session.input_summary}")
    if session.conditions_detected:
        parts.append(f"Conditions: {json.dumps(session.conditions_detected)}")
    if session.result_json:
        result = session.result_json if isinstance(session.result_json, dict) else {}
        for key in ["summary", "executive_summary", "findings", "impression", "transcript"]:
            if result.get(key):
                parts.append(f"{key}: {result[key]}")
        if result.get("conditions"):
            parts.append(f"Conditions detail: {json.dumps(result['conditions'][:3])}")
    parts.append(f"Urgency: {session.urgency_level}")
    parts.append(f"Confidence: {session.confidence_score}")
    return "\n".join(parts)


PERSONAS = {
    "conservative": """You are Dr. Chen — a cautious, safety-first physician with 25 years in academic medicine. You always consider the worst-case diagnosis first. You over-investigate rather than under-investigate. Your bias: err on the side of caution. Recommend more tests. Never miss a serious diagnosis even if it means more false positives.""",

    "balanced": """You are Dr. Patel — an evidence-based clinician following current clinical practice guidelines strictly. You balance investigation burden against clinical probability. Your bias: evidence and statistics. Bayesian reasoning. Prior probabilities matter.""",

    "differential": """You are Dr. Rodriguez — a diagnostician who loves challenging the obvious diagnosis. You look for zebras when everyone sees horses. Your bias: always consider the alternative. Push back on the primary diagnosis. What else could this be? Rare but important conditions are your specialty.""",
}


def analyze_with_persona(content: str, persona: str) -> dict:
    prompt = f"""{PERSONAS[persona]}

Review this clinical presentation and provide your assessment:
{content}

Return JSON:
{{
  "physician_id": "{persona}",
  "primary_diagnosis": "your top diagnosis",
  "confidence": 0.75,
  "reasoning": "your clinical reasoning (3-5 sentences)",
  "agreed_findings": ["findings you agree with from original analysis"],
  "disputed_findings": ["findings you challenge or disagree with"],
  "additional_diagnoses": ["conditions original analysis may have missed"],
  "recommended_tests": ["tests you would order that were not suggested"],
  "urgency_assessment": "lower | same | higher",
  "key_message": "one sentence summary of your perspective"
}}

Return only valid JSON."""

    return call_llm(
        system_prompt="You are a physician. Return only valid JSON.",
        user_message=prompt,
        fallback_type="second_opinion",
    )


def synthesize_opinions(conservative: dict, balanced: dict, differential: dict) -> dict:
    diagnoses = [
        conservative.get("primary_diagnosis", "Unknown"),
        balanced.get("primary_diagnosis", "Unknown"),
        differential.get("primary_diagnosis", "Unknown"),
    ]

    unique_diagnoses = list(set(d.lower().strip() for d in diagnoses))
    if len(unique_diagnoses) == 1:
        consensus_level = "full"
    elif len(unique_diagnoses) == 2:
        consensus_level = "partial"
    else:
        consensus_level = "disputed"

    # Find common agreed findings
    agreed_sets = [
        set(conservative.get("agreed_findings", [])),
        set(balanced.get("agreed_findings", [])),
        set(differential.get("agreed_findings", [])),
    ]
    common_agreed = list(agreed_sets[0] & agreed_sets[1] & agreed_sets[2]) if all(agreed_sets) else []

    # Collect all disputed findings
    all_disputed = list(set(
        conservative.get("disputed_findings", []) +
        balanced.get("disputed_findings", []) +
        differential.get("disputed_findings", [])
    ))

    return {
        "consensus_level": consensus_level,
        "consensus_diagnosis": diagnoses[0] if consensus_level == "full" else None,
        "majority_diagnosis": max(set(diagnoses), key=diagnoses.count) if consensus_level == "partial" else None,
        "agreement_areas": common_agreed,
        "dispute_areas": all_disputed,
        "synthesized_recommendation": _build_synthesis(conservative, balanced, differential, consensus_level),
        "clinical_note": "AI opinions diverge — clinical judgment essential" if consensus_level == "disputed" else "",
    }


def _build_synthesis(c: dict, b: dict, d: dict, consensus: str) -> str:
    if consensus == "full":
        return f"All three physicians agree on {c.get('primary_diagnosis', 'the diagnosis')}. Confidence is high. Proceed with recommended workup."
    elif consensus == "partial":
        return f"Two of three physicians agree. Consider both {c.get('primary_diagnosis', '')} and the alternative diagnosis raised by the dissenting opinion. Additional testing recommended."
    else:
        return "Significant diagnostic disagreement exists. Recommend multidisciplinary team review and additional diagnostic workup before proceeding."
