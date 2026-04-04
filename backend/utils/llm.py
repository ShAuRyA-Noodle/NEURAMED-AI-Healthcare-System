import os
import json
import time
import logging

logger = logging.getLogger(__name__)

GROQ_MODELS = ["llama-3.3-70b-versatile", "llama3-70b-8192", "llama3-8b-8192"]


def call_llm(system_prompt: str, user_message: str, fallback_type: str = "voice") -> dict:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        logger.error("GROQ_API_KEY missing — using fallback")
        return _fallback(fallback_type, user_message)

    from groq import Groq
    client = Groq(api_key=api_key)

    for model in GROQ_MODELS:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.3,
                max_tokens=2048,
                response_format={"type": "json_object"}
            )
            raw = response.choices[0].message.content
            logger.info(f"Groq [{model}] response: {raw[:200]}")
            return json.loads(raw)
        except json.JSONDecodeError as e:
            logger.error(f"JSON parse failed [{model}]: {e}")
            continue
        except Exception as e:
            err_msg = str(e).lower()
            logger.warning(f"Groq [{model}] failed: {type(e).__name__}: {e}")
            if "rate_limit" in err_msg or "429" in err_msg:
                logger.info(f"Rate limited on {model}, trying next model...")
                time.sleep(1)
                continue
            if "model" in err_msg and "not found" in err_msg:
                continue
            break

    logger.error("All Groq models failed — using fallback")
    return _fallback(fallback_type, user_message)


def _fallback(fallback_type: str, context: str = "") -> dict:
    if fallback_type == "voice":
        return {
            "conditions": [
                {"name": "Undetermined — Groq API unavailable", "probability": 0.5, "icd_code": "", "description": "AI analysis unavailable. Configure GROQ_API_KEY.", "matching_symptoms": [], "red_flags": []}
            ],
            "overall_confidence": 0.5,
            "confidence": 0.5,
            "urgency": "medium",
            "urgency_reasoning": "Unable to assess — AI unavailable",
            "immediate_actions": ["Get a Groq API key at console.groq.com and set GROQ_API_KEY in backend/.env"],
            "recommended_tests": [],
            "medications_to_avoid": [],
            "lifestyle_advice": [],
            "follow_up": "Configure API and retry",
            "differential_summary": "Unable to process without Groq API",
            "when_to_go_to_er": "",
            "recommendations": ["Configure GROQ_API_KEY in backend/.env"],
            "key_symptoms": [],
            "differential_diagnosis": "Unable to process without Groq API"
        }
    elif fallback_type == "imaging":
        return {
            "primary_finding": "AI interpretation unavailable",
            "clinical_impression": "AI interpretation unavailable — Groq API not configured",
            "findings": "AI interpretation unavailable — Groq API not configured",
            "impression": "Manual review required",
            "recommendations": [{"priority": 1, "action": "Check GROQ_API_KEY in .env", "timeframe": "Now", "rationale": "Required for AI analysis", "guideline_reference": ""}],
            "anomaly_type": "unknown",
            "acr_category": 1,
            "acr_category_meaning": "Unable to assess",
            "acr_description": "",
            "overall_assessment": "normal",
            "confidence_score": 0.0,
            "confidence_reasoning": "No AI analysis available",
            "systematic_findings": {},
            "secondary_findings": [],
            "differential_diagnoses": [],
            "red_flags": [],
            "measurements": "",
            "distribution": "",
            "follow_up_imaging": "",
            "clinical_correlation": "",
            "comparison_note": "",
            "icd10_codes": [],
            "report_text": "",
            "follow_up": "Configure API key and retry",
            "urgency": "routine",
            "confidence": 0.0
        }
    elif fallback_type == "ocr":
        return {
            "report_type": "Other",
            "patient_info": {"name_redacted": True, "age_mentioned": None, "gender_mentioned": None},
            "summary": "Report extraction completed but AI interpretation unavailable.",
            "executive_summary": "AI analysis unavailable. Configure GROQ_API_KEY.",
            "key_findings": ["Groq API not configured"],
            "abnormal_values": [],
            "normal_values": [],
            "abnormal_flags": [],
            "medications": [],
            "medications_mentioned": [],
            "diagnoses": [],
            "conditions": [],
            "procedures": [],
            "allergies": [],
            "follow_up_instructions": [],
            "critical_alerts": [],
            "doctor_info": "",
            "ordering_physician": None,
            "patient_name": None,
            "facility": "",
            "report_date": None,
            "overall_health_score": 0,
            "overall_status": "normal",
            "patient_action_items": ["Configure GROQ_API_KEY for AI analysis"],
            "patient_plain_language_summary": "AI analysis is currently unavailable.",
            "clinician_summary": "AI analysis unavailable — configure GROQ_API_KEY.",
            "action_items": [],
            "specialist_referrals": [],
            "lifestyle_recommendations": [],
            "follow_up_tests": [],
            "icd10_codes": [],
            "drug_lab_interactions": [],
            "urgency": "low",
            "sections_detected": []
        }
    elif fallback_type == "insights":
        return {
            "insights": [
                {"title": "AI Insights Unavailable", "description": "Configure GROQ_API_KEY for AI-powered insights.", "icon_emoji": "⚠️", "severity": "low"}
            ]
        }
    elif fallback_type == "drug_interactions":
        return {
            "overall_risk": "safe",
            "interaction_count": {"contraindicated": 0, "major": 0, "moderate": 0, "minor": 0, "none": 0},
            "interactions": [],
            "safe_pairs": [],
            "overall_recommendations": ["AI analysis unavailable — configure GROQ_API_KEY"]
        }
    elif fallback_type == "second_opinion":
        return {
            "physician_id": "unknown",
            "primary_diagnosis": "AI unavailable",
            "confidence": 0.0,
            "reasoning": "Groq API not configured.",
            "agreed_findings": [],
            "disputed_findings": [],
            "additional_diagnoses": [],
            "recommended_tests": [],
            "urgency_assessment": "same",
            "key_message": "Configure GROQ_API_KEY for second opinion analysis."
        }
    elif fallback_type == "timeline":
        return {
            "overall_trajectory": "stable",
            "trajectory_confidence": 0.0,
            "trajectory_summary": "AI trend analysis unavailable.",
            "improving_conditions": [],
            "worsening_conditions": [],
            "new_conditions": [],
            "recurring_conditions": [],
            "specialist_referral_recommended": [],
            "risk_trend": []
        }
    elif fallback_type == "sarvam":
        return {
            "response_native": "AI service unavailable",
            "response_english": "AI service unavailable. Please configure API keys.",
            "urgency": "medium",
            "primary_concern": "Unknown",
            "immediate_advice_native": "",
            "see_doctor_urgency": "routine",
            "medical_terms_explained": []
        }
    else:
        return {"error": "Unknown fallback type"}
