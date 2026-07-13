import time
import os
import logging
from utils.llm import call_llm
from core.provenance import Provenance, InferenceStatus, wrap_result
from ml import grounding
from db.schemas import DiagnosisResult, ConditionDetail, RecommendedTest
from db.models import DiagnosisSession, Patient
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

LANGUAGE_CONFIG = {
    "hi": {"name": "Hindi", "script": "Devanagari"},
    "ta": {"name": "Tamil", "script": "Tamil"},
    "te": {"name": "Telugu", "script": "Telugu"},
    "bn": {"name": "Bengali", "script": "Bengali"},
    "mr": {"name": "Marathi", "script": "Devanagari"},
    "kn": {"name": "Kannada", "script": "Kannada"},
    "ml": {"name": "Malayalam", "script": "Malayalam"},
    "pa": {"name": "Punjabi", "script": "Gurmukhi"},
    "en": {"name": "English", "script": "Latin"},
}


def _translate_via_groq(text: str, target_lang: str) -> str:
    """Translate text to target language using Groq. Returns original on failure."""
    if not text or target_lang == "en":
        return text
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return text
    lang = LANGUAGE_CONFIG.get(target_lang, LANGUAGE_CONFIG["hi"])
    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": (
                    f"Translate the following medical text to {lang['name']}. "
                    f"Use {lang['script']} script. Write ONLY the translated text, nothing else. "
                    f"If the text is already in {lang['name']}, return it as-is."
                )},
                {"role": "user", "content": text}
            ],
            temperature=0.3,
            max_tokens=1000,
        )
        translated = resp.choices[0].message.content.strip()
        if translated and len(translated) > 5:
            return translated
    except Exception as e:
        logger.warning(f"Translation to {target_lang} failed: {e}")
    return text


def _batch_translate(texts: list, target_lang: str) -> list:
    """Translate a list of texts in a single Groq call using numbered format."""
    if not texts or target_lang == "en":
        return texts
    # Filter out empty strings
    non_empty = [(i, t) for i, t in enumerate(texts) if t and t.strip()]
    if not non_empty:
        return texts
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return texts
    lang = LANGUAGE_CONFIG.get(target_lang, LANGUAGE_CONFIG["hi"])
    try:
        import json as _json
        from groq import Groq
        client = Groq(api_key=api_key)
        # Build numbered input
        numbered = "\n".join(f"[{i+1}] {t}" for i, (_, t) in enumerate(non_empty))
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": (
                    f"Translate each numbered medical text below to {lang['name']} ({lang['script']} script). "
                    f"Return ONLY a JSON array of translated strings in the same order. No extra text."
                )},
                {"role": "user", "content": numbered}
            ],
            temperature=0.3,
            max_tokens=3000,
            response_format={"type": "json_object"},
        )
        raw = resp.choices[0].message.content.strip()
        parsed = _json.loads(raw)
        # Handle both {"translations": [...]} and direct array
        if isinstance(parsed, dict):
            translated_list = parsed.get("translations") or parsed.get("results") or list(parsed.values())[0]
        else:
            translated_list = parsed
        if isinstance(translated_list, list) and len(translated_list) == len(non_empty):
            result = list(texts)  # copy
            for idx, (orig_i, _) in enumerate(non_empty):
                result[orig_i] = str(translated_list[idx])
            logger.info(f"Batch translated {len(non_empty)} texts to {lang['name']}")
            return result
    except Exception as e:
        logger.warning(f"Batch translation failed: {e}, falling back to individual")
    # Fallback: translate individually
    return [_translate_via_groq(t, target_lang) for t in texts]


def _translate_to_english(text: str, source_lang: str) -> str:
    """Translate non-English text to English for LLM processing."""
    if not text or source_lang == "en":
        return text
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return text
    lang = LANGUAGE_CONFIG.get(source_lang, LANGUAGE_CONFIG["hi"])
    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        resp = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": (
                    f"The following text is in {lang['name']} ({lang['script']} script). "
                    "Translate it to English accurately. Write ONLY the English translation."
                )},
                {"role": "user", "content": text}
            ],
            temperature=0.3,
            max_tokens=1000,
        )
        translated = resp.choices[0].message.content.strip()
        if translated and len(translated) > 5:
            logger.info(f"Translated {lang['name']} transcript to English")
            return translated
    except Exception as e:
        logger.warning(f"Translation from {source_lang} to English failed: {e}")
    return text

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


def _get_groq_client(api_key: str):
    """Seam for testing — monkeypatch this, not the groq package."""
    from groq import Groq
    return Groq(api_key=api_key)


def transcribe_with_whisper(audio_bytes: bytes, language: str = None) -> str:
    """Transcribe audio via Groq's Whisper (whisper-large-v3).

    Uses the OpenAI-compatible Groq audio API. Raises InferenceUnavailable on
    any failure — a failed transcription must NEVER be returned as if it were
    real patient speech.
    """
    from core.exceptions import InferenceUnavailable
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise InferenceUnavailable(
            "GROQ_API_KEY not configured for speech-to-text.", vendor="groq")
    client = _get_groq_client(api_key)
    try:
        resp = client.audio.transcriptions.create(
            file=("audio.wav", audio_bytes),
            model="whisper-large-v3",
            language=language,            # None => auto-detect
            response_format="verbose_json",
            temperature=0.0,
        )
        text = (getattr(resp, "text", "") or "").strip()
    except Exception as e:
        raise InferenceUnavailable(
            f"Whisper transcription failed: {type(e).__name__}: {e}",
            vendor="groq")
    if not text:
        raise InferenceUnavailable("Whisper returned empty transcript.", vendor="groq")
    return text


def transcribe_audio(audio_bytes: bytes, language: str = None) -> str:
    """Transcribe audio to text.

    Primary path is Groq Whisper. ElevenLabs is tried ONLY when its API key is
    set; on any ElevenLabs failure we fall through to Whisper. If every path
    fails, InferenceUnavailable propagates — we never return a placeholder
    string that could be diagnosed as symptoms.
    """
    eleven_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if eleven_key:
        try:
            from elevenlabs.client import ElevenLabs
            client = ElevenLabs(api_key=eleven_key)
            result = client.speech_to_text.convert(
                file=audio_bytes, model_id="scribe_v1"
            )
            text = (getattr(result, "text", "") or "").strip()
            if text:
                return text
            logger.warning("ElevenLabs returned empty transcript; falling back to Whisper.")
        except Exception as e:
            logger.error(f"ElevenLabs failed, falling back to Whisper: {e}")
    return transcribe_with_whisper(audio_bytes, language=language)


def ground_diagnosis(result: dict) -> dict:
    """Attach real ICD-10 codes + verified citations to each differential.
    Best-effort: never raises. Adds provenance.grounded_in with citation URLs."""
    try:
        conditions = result.get("conditions") or []
        grounded_urls = []
        for cond in conditions:
            if not isinstance(cond, dict):
                continue
            name = (cond.get("name") or "").strip()
            if not name or name.lower().startswith("undetermined"):
                continue
            # Real ICD-10 code (only set if the model didn't already provide a valid one)
            icd = grounding.icd10_lookup(name, 3)
            if icd:
                cond["icd10_candidates"] = icd
                if not cond.get("icd_code"):
                    cond["icd_code"] = icd[0]["code"]
            # Up to 2 real citations
            cites = grounding.evidence(name, 2)
            if cites:
                cond["citations"] = cites
                grounded_urls.extend(c["url"] for c in cites if c.get("url"))
        if grounded_urls:
            prov = result.get("provenance")
            if isinstance(prov, dict):
                existing = prov.get("grounded_in") or []
                prov["grounded_in"] = existing + grounded_urls
        return result
    except Exception as e:
        logger.warning("ground_diagnosis failed (non-fatal): %s", e)
        return result


def diagnose(transcript: str = None,
             audio_bytes: bytes = None,
             audio_base64: str = None,
             patient_id: int = None,
             language: str = "en",
             db: Session = None) -> DiagnosisResult:

    # Resolve input
    if not transcript:
        if audio_base64:
            import base64
            audio_bytes = base64.b64decode(audio_base64)
        if audio_bytes:
            # May raise InferenceUnavailable — let it propagate. A failed
            # transcription must never be fed to the diagnostic LLM as symptoms.
            stt_lang = language if language and language != "en" else None
            transcript = transcribe_audio(audio_bytes, language=stt_lang)
        else:
            transcript = "No symptoms provided"

    # Guard against empty or too-short transcripts
    if not transcript or len(transcript.strip()) < 3:
        transcript = "No symptoms provided"

    # If non-English, translate transcript to English for the LLM
    if language and language != "en":
        transcript = _translate_to_english(transcript, language)

    start_time = time.time()

    result_json, model_used = call_llm(SYSTEM_PROMPT, f"Patient symptoms: {transcript}")
    payload = wrap_result(result_json, Provenance(
        status=InferenceStatus.OK, source="real_model",
        model=model_used, vendor="groq"))

    # Ground each differential with real ICD-10 codes + verified citations.
    # payload is a shallow copy of result_json, so payload["conditions"] shares
    # the same condition dicts — enriching here fills icd_code before both the
    # persisted envelope and the condition_details extraction below. Best-effort:
    # ground_diagnosis never raises, so a grounding hiccup cannot break diagnosis.
    payload = ground_diagnosis(payload)

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
        result_json=payload,
        confidence_score=overall_conf,
        urgency_level=result_json.get("urgency", "medium"),
        conditions_detected=condition_names,
        processing_time_ms=processing_time_ms
    )
    try:
        db.add(session_record)
        db.commit()
        db.refresh(session_record)
    except Exception as e:
        db.rollback()
        logger.error(f"DB commit failed: {e}")
        raise

    # Translate results to target language if non-English
    urgency_val = result_json.get("urgency", "medium")
    urgency_reasoning = result_json.get("urgency_reasoning", "")
    immediate_actions = result_json.get("immediate_actions", [])
    meds_to_avoid = result_json.get("medications_to_avoid", [])
    lifestyle = result_json.get("lifestyle_advice", [])
    follow_up_text = result_json.get("follow_up", "")
    diff_summary = result_json.get("differential_summary", "")
    er_text = result_json.get("when_to_go_to_er", "")

    if language and language != "en":
        logger.info(f"Translating diagnosis results to {language}")
        # Collect ALL translatable text into one batch for speed
        all_texts = [
            urgency_reasoning, follow_up_text, diff_summary, er_text,
            *immediate_actions, *meds_to_avoid, *lifestyle,
        ]
        # Add condition fields
        for cd in condition_details:
            all_texts.extend([cd.name, cd.description, *cd.matching_symptoms, *cd.red_flags])
        # Add test fields
        for rt in rec_tests:
            all_texts.extend([rt.test, rt.reason])

        translated = _batch_translate(all_texts, language)

        # Unpack back
        idx = 0
        urgency_reasoning = translated[idx]; idx += 1
        follow_up_text = translated[idx]; idx += 1
        diff_summary = translated[idx]; idx += 1
        er_text = translated[idx]; idx += 1
        immediate_actions = translated[idx:idx+len(immediate_actions)]; idx += len(immediate_actions)
        meds_to_avoid = translated[idx:idx+len(meds_to_avoid)]; idx += len(meds_to_avoid)
        lifestyle = translated[idx:idx+len(lifestyle)]; idx += len(lifestyle)
        for cd in condition_details:
            cd.name = translated[idx]; idx += 1
            cd.description = translated[idx]; idx += 1
            sym_count = len(cd.matching_symptoms)
            cd.matching_symptoms = translated[idx:idx+sym_count]; idx += sym_count
            rf_count = len(cd.red_flags)
            cd.red_flags = translated[idx:idx+rf_count]; idx += rf_count
        for rt in rec_tests:
            rt.test = translated[idx]; idx += 1
            rt.reason = translated[idx]; idx += 1

    return DiagnosisResult(
        session_id=session_record.id,
        conditions=condition_details,
        overall_confidence=overall_conf,
        confidence=overall_conf,
        urgency=urgency_val,
        urgency_reasoning=urgency_reasoning,
        immediate_actions=immediate_actions,
        recommended_tests=rec_tests,
        medications_to_avoid=meds_to_avoid,
        lifestyle_advice=lifestyle,
        follow_up=follow_up_text,
        differential_summary=diff_summary,
        when_to_go_to_er=er_text,
        transcript=transcript,
        processing_time_ms=processing_time_ms,
        recommendations=result_json.get("recommendations", immediate_actions),
        differential_diagnosis=diff_summary
    )
