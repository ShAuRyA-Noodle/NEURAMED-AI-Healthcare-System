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
            "conditions": ["Undetermined — Groq API unavailable"],
            "confidence": 0.5,
            "urgency": "medium",
            "recommendations": ["Groq API key missing or invalid. Get one at console.groq.com and set GROQ_API_KEY in backend/.env"],
            "key_symptoms": [],
            "differential_diagnosis": "Unable to process without Groq API"
        }
    elif fallback_type == "imaging":
        return {
            "findings": "AI interpretation unavailable — Groq API not configured",
            "impression": "Manual review required",
            "recommendations": ["Check GROQ_API_KEY in .env"],
            "anomaly_type": "unknown",
            "follow_up": "Configure API key and retry",
            "urgency": "routine"
        }
    elif fallback_type == "ocr":
        return {
            "summary": "Report extraction completed but AI interpretation unavailable.",
            "key_findings": ["Groq API not configured"],
            "abnormal_flags": [],
            "medications": [],
            "conditions": [],
            "urgency": "low",
            "sections_detected": []
        }
    else:
        return {"error": "Unknown fallback type"}
