import time
import os
import logging
from backend.utils.llm import call_llm
from backend.db.schemas import DiagnosisResult, ConditionDetail, RecommendedTest
from backend.db.models import DiagnosisSession, Patient
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are Dr. NEURAMED, an expert clinical AI diagnostic assistant trained on medical literature. Analyze the patient's reported symptoms with the thoroughness of a senior physician.

Return ONLY this exact JSON structure, no markdown, no extra text:
{
  "conditions": [
    {
      "name": "Primary Diagnosis Name",
      "probability": 0.87,
      "icd_code": "J18.9",
      "description": "2-sentence clinical description of this condition",
      "matching_symptoms": ["symptom1", "symptom2"],
      "red_flags": ["warning sign if present"]
    }
  ],
  "overall_confidence": 0.84,
  "urgency": "high",
  "urgency_reasoning": "One sentence explaining why this urgency level",
  "immediate_actions": [
    "Specific action to take RIGHT NOW"
  ],
  "recommended_tests": [
    {"test": "Complete Blood Count (CBC)", "reason": "To rule out infection"}
  ],
  "medications_to_avoid": ["medication that could worsen condition"],
  "lifestyle_advice": ["specific actionable advice"],
  "follow_up": "Recommended follow-up timeframe and specialist",
  "differential_summary": "2-3 sentence clinical reasoning paragraph",
  "when_to_go_to_er": "Specific symptoms that warrant immediate ER visit"
}

Rules:
- conditions: exactly 3, ordered by probability descending
- probability: realistic, first condition 0.55-0.92, second 0.25-0.60, third 0.10-0.40
- icd_code: real ICD-10 code for each condition
- urgency: low/medium/high/critical — be accurate, not alarmist
- CRITICAL triggers: chest pain+dyspnea, active hemorrhage, altered consciousness, stroke signs, anaphylaxis
- HIGH triggers: severe pain, high fever >103F, vomiting blood, severe shortness of breath
- recommended_tests: 2-4 specific clinical tests with reasons
- never give generic advice like 'see a doctor' — be specific
- when_to_go_to_er: only include genuine ER indicators"""


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

    # Extract conditions - handle both new (dict) and old (string) format
    raw_conditions = result_json.get("conditions", [])
    condition_names = []
    condition_details = []

    if raw_conditions and isinstance(raw_conditions[0], dict):
        for c in raw_conditions:
            condition_details.append(ConditionDetail(
                name=c.get("name", "Unknown"),
                probability=float(c.get("probability", 0.5)),
                icd_code=c.get("icd_code", ""),
                description=c.get("description", ""),
                matching_symptoms=c.get("matching_symptoms", []),
                red_flags=c.get("red_flags", [])
            ))
            condition_names.append(c.get("name", "Unknown"))
    else:
        for c in raw_conditions:
            condition_details.append(ConditionDetail(
                name=str(c), probability=0.5, icd_code="", description=""
            ))
            condition_names.append(str(c))

    # Extract recommended tests
    raw_tests = result_json.get("recommended_tests", [])
    rec_tests = []
    for t in raw_tests:
        if isinstance(t, dict):
            rec_tests.append(RecommendedTest(test=t.get("test", ""), reason=t.get("reason", "")))
        else:
            rec_tests.append(RecommendedTest(test=str(t), reason=""))

    overall_conf = float(result_json.get("overall_confidence", result_json.get("confidence", 0.0)))

    # Save to db
    session_record = DiagnosisSession(
        patient_id=patient_id,
        agent_type='voice',
        input_summary=transcript[:200],
        result_json=result_json,
        confidence_score=overall_conf,
        urgency_level=result_json.get("urgency", "medium"),
        conditions_detected=condition_names,
        processing_time_ms=processing_time_ms
    )
    db.add(session_record)
    db.commit()
    db.refresh(session_record)

    return DiagnosisResult(
        session_id=session_record.id,
        conditions=condition_details,
        overall_confidence=overall_conf,
        confidence=overall_conf,
        urgency=result_json.get("urgency", "medium"),
        urgency_reasoning=result_json.get("urgency_reasoning", ""),
        immediate_actions=result_json.get("immediate_actions", []),
        recommended_tests=rec_tests,
        medications_to_avoid=result_json.get("medications_to_avoid", []),
        lifestyle_advice=result_json.get("lifestyle_advice", []),
        follow_up=result_json.get("follow_up", ""),
        differential_summary=result_json.get("differential_summary", ""),
        when_to_go_to_er=result_json.get("when_to_go_to_er", ""),
        transcript=transcript,
        processing_time_ms=processing_time_ms,
        recommendations=result_json.get("recommendations", result_json.get("immediate_actions", [])),
        differential_diagnosis=result_json.get("differential_summary", result_json.get("differential_diagnosis", ""))
    )
