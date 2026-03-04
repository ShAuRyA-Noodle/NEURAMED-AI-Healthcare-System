import time
import os
import logging
from backend.utils.llm import call_llm
from backend.db.schemas import DiagnosisResult
from backend.db.models import DiagnosisSession, Patient
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a clinical diagnostic AI.
Analyze the patient symptoms and return ONLY valid JSON, no markdown:
{
  "conditions": ["Most Likely Diagnosis", "Second Possibility", "Third Possibility"],
  "confidence": 0.87,
  "urgency": "high",
  "recommendations": [
    "Immediate action step",
    "Follow-up recommendation",
    "Lifestyle/medication advice"
  ],
  "key_symptoms": ["symptom1", "symptom2"],
  "differential_diagnosis": "Brief clinical reasoning sentence"
}
Rules:
- conditions: 1-3 specific medical diagnoses, most probable first
- confidence: 0.0-1.0, be honest about uncertainty
- urgency: exactly one of: low, medium, high, critical
- CRITICAL triggers: chest pain+dyspnea, active hemorrhage, altered consciousness, stroke signs, anaphylaxis
- HIGH triggers: severe pain, high fever, vomiting blood
- recommendations: 3-5 specific actionable clinical steps
- Never return generic advice like 'rest and hydration' for serious symptoms
- Be medically specific and accurate"""


def transcribe_audio_fallback(audio_bytes: bytes) -> str:
    import speech_recognition as sr
    import io
    recognizer = sr.Recognizer()
    try:
        with sr.AudioFile(io.BytesIO(audio_bytes)) as source:
            audio = recognizer.record(source)
        return recognizer.recognize_google(audio)
    except Exception as e:
        logger.error(f"SpeechRecognition failed: {e}")
        return "Audio transcription failed. Please use text input."


def transcribe_audio(audio_bytes: bytes) -> str:
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if api_key:
        try:
            from elevenlabs.client import ElevenLabs
            client = ElevenLabs(api_key=api_key)
            result = client.speech_to_text.convert(
                file=audio_bytes, model_id="scribe_v1"
            )
            return result.text
        except Exception as e:
            logger.error(f"ElevenLabs failed: {e}")
    return transcribe_audio_fallback(audio_bytes)


def diagnose(transcript: str = None,
             audio_bytes: bytes = None,
             audio_base64: str = None,
             patient_id: int = None,
             db: Session = None) -> DiagnosisResult:

    # Resolve input
    if not transcript:
        if audio_base64:
            import base64
            audio_bytes = base64.b64decode(audio_base64)
        if audio_bytes:
            transcript = transcribe_audio(audio_bytes)
        else:
            transcript = "No symptoms provided"

    start_time = time.time()

    result_json = call_llm(SYSTEM_PROMPT, f"Patient symptoms: {transcript}",
                           fallback_type="voice")

    processing_time_ms = int((time.time() - start_time) * 1000)

    # Save to db
    session_record = DiagnosisSession(
        patient_id=patient_id,
        agent_type='voice',
        input_summary=transcript[:200],
        result_json=result_json,
        confidence_score=float(result_json.get("confidence", 0.0)),
        urgency_level=result_json.get("urgency", "medium"),
        conditions_detected=result_json.get("conditions", []),
        processing_time_ms=processing_time_ms
    )
    db.add(session_record)
    db.commit()
    db.refresh(session_record)

    return DiagnosisResult(
        conditions=result_json.get("conditions", []),
        confidence=float(result_json.get("confidence", 0.0)),
        urgency=result_json.get("urgency", "medium"),
        recommendations=result_json.get("recommendations", []),
        transcript=transcript,
        processing_time_ms=processing_time_ms,
        session_id=session_record.id,
        differential_diagnosis=result_json.get("differential_diagnosis", "")
    )
