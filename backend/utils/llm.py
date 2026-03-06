import os
import json
import logging

logger = logging.getLogger(__name__)


def call_llm(system_prompt: str, user_message: str, fallback_type: str = "voice") -> dict:
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        logger.error("GROQ_API_KEY missing — using fallback")
        return _fallback(fallback_type, user_message)
    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_message}
            ],
            temperature=0.3,
            max_tokens=1024,
            response_format={"type": "json_object"}
        )
        raw = response.choices[0].message.content
        logger.info(f"Groq response: {raw[:200]}")
        return json.loads(raw)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse failed: {e} — raw: {raw}")
        return _fallback(fallback_type, user_message)
    except Exception as e:
        logger.error(f"Groq API error: {type(e).__name__}: {e}")
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
            "findings": "AI interpretation unavailable — Groq API not configured",
            "impression": "Manual review required",
            "recommendations": [{"priority": "immediate", "action": "Check GROQ_API_KEY in .env"}],
            "anomaly_type": "unknown",
            "acr_category": "",
            "acr_description": "",
            "measurements": "",
            "distribution": "",
            "follow_up_imaging": "",
            "clinical_correlation": "",
            "differential_diagnoses": [],
            "follow_up": "Configure API key and retry",
            "urgency": "routine",
            "confidence": 0.0
        }
    elif fallback_type == "ocr":
        return {
            "report_type": "Other",
            "patient_info": {"name_redacted": True, "age_mentioned": None, "gender_mentioned": None},
            "summary": "Report extraction completed but AI interpretation unavailable.",
            "key_findings": ["Groq API not configured"],
            "abnormal_values": [],
            "normal_values": [],
            "abnormal_flags": [],
            "medications": [],
            "diagnoses": [],
            "conditions": [],
            "procedures": [],
            "allergies": [],
            "follow_up_instructions": [],
            "critical_alerts": [],
            "doctor_info": "",
            "facility": "",
            "report_date": "",
            "overall_health_score": "",
            "patient_action_items": ["Configure GROQ_API_KEY for AI analysis"],
            "urgency": "low",
            "sections_detected": []
        }
    elif fallback_type == "insights":
        return {
            "insights": [
                {"title": "AI Insights Unavailable", "description": "Configure GROQ_API_KEY for AI-powered insights.", "icon_emoji": "⚠️", "severity": "low"}
            ]
        }
    else:
        return {"error": "Unknown fallback type"}
