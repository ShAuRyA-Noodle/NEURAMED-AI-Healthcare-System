import os
import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional, List
from db.database import get_db
from db.models import User, DiagnosisSession
from utils.auth import require_user
from utils.llm import call_llm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sarvam", tags=["Sarvam"])

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")

LANGUAGE_CONFIG = {
    "hi": {"name": "Hindi", "script": "Devanagari", "greeting": "\u0928\u092e\u0938\u094d\u0924\u0947"},
    "ta": {"name": "Tamil", "script": "Tamil", "greeting": "\u0bb5\u0ba3\u0b95\u0bcd\u0b95\u0bae\u0bcd"},
    "te": {"name": "Telugu", "script": "Telugu", "greeting": "\u0c28\u0c2e\u0c38\u0c4d\u0c15\u0c3e\u0c30\u0c02"},
    "bn": {"name": "Bengali", "script": "Bengali", "greeting": "\u09a8\u09ae\u09b8\u09cd\u0995\u09be\u09b0"},
    "mr": {"name": "Marathi", "script": "Devanagari", "greeting": "\u0928\u092e\u0938\u094d\u0915\u093e\u0930"},
    "kn": {"name": "Kannada", "script": "Kannada", "greeting": "\u0ca8\u0cae\u0cb8\u0ccd\u0c95\u0cbe\u0cb0"},
    "ml": {"name": "Malayalam", "script": "Malayalam", "greeting": "\u0d28\u0d2e\u0d38\u0d4d\u0d15\u0d3e\u0d30\u0d02"},
    "pa": {"name": "Punjabi", "script": "Gurmukhi", "greeting": "\u0a38\u0a24 \u0a38\u0a4d\u0a30\u0a40 \u0a05\u0a15\u0a3e\u0a32"},
    "en": {"name": "English", "script": "Latin", "greeting": "Hello"},
}


@router.get("/health")
async def sarvam_health():
    """Check if Ollama is running and Sarvam model is available."""
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags", timeout=3.0)
            models = r.json().get("models", [])
            sarvam_available = any("sarvam" in m.get("name", "") for m in models)
            model_names = [m.get("name", "") for m in models]
        return {
            "ollama_running": True,
            "sarvam_available": sarvam_available,
            "available_models": model_names,
            "model": "mashriram/sarvam-m-tools:latest",
        }
    except Exception:
        return {
            "ollama_running": False,
            "sarvam_available": False,
            "available_models": [],
            "note": "Ollama not running locally. Start with: ollama serve",
        }


@router.post("/diagnose")
async def sarvam_diagnose(
    transcript: str,
    language: str = "hi",
    patient_code: Optional[str] = None,
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    import httpx
    import re

    lang = LANGUAGE_CONFIG.get(language, LANGUAGE_CONFIG["hi"])
    result = None

    # STRATEGY: Use Groq with a simple English-focused prompt for reliable JSON,
    # then separately request native language response text via Sarvam/Ollama if available.

    api_key = os.getenv("GROQ_API_KEY", "").strip()
    logger.info(f"Sarvam: GROQ_API_KEY present={bool(api_key)}, language={language}")

    if api_key:
        try:
            from groq import Groq
            groq_client = Groq(api_key=api_key)

            # Step 1: Get structured medical analysis in English (reliable JSON)
            groq_resp = groq_client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": (
                        "You are an experienced physician. Analyze patient symptoms. "
                        "Respond ONLY with a JSON object. No markdown, no comments.\n"
                        "Keys: response_english (string, your full medical advice in English), "
                        "urgency (string, one of: low/medium/high/critical), "
                        "primary_concern (string, main health concern), "
                        "see_doctor_urgency (string, one of: routine/soon/urgent/emergency), "
                        "immediate_advice (string, what to do right now). "
                        "Be warm, empathetic. Never diagnose with certainty."
                    )},
                    {"role": "user", "content": f"Patient says: {transcript}"}
                ],
                temperature=0.3,
                max_tokens=800,
                response_format={"type": "json_object"},
            )
            raw = groq_resp.choices[0].message.content
            logger.info(f"Sarvam Groq raw: {raw[:300]}")

            # Clean common LLM JSON issues
            cleaned = re.sub(r'//[^\n]*', '', raw)  # remove JS comments
            cleaned = re.sub(r',\s*}', '}', cleaned)  # trailing commas
            cleaned = re.sub(r',\s*]', ']', cleaned)

            groq_data = json.loads(cleaned)
            if isinstance(groq_data, dict) and groq_data.get("response_english"):
                english_response = groq_data["response_english"]
                result = {
                    "response_native": english_response,  # will be replaced if native translation available
                    "response_english": english_response,
                    "urgency": groq_data.get("urgency", "medium"),
                    "primary_concern": groq_data.get("primary_concern", "See response"),
                    "immediate_advice_native": groq_data.get("immediate_advice", ""),
                    "see_doctor_urgency": groq_data.get("see_doctor_urgency", "routine"),
                    "medical_terms_explained": groq_data.get("medical_terms_explained", []),
                }
                logger.info("Sarvam: Groq returned valid English analysis")

                # Step 2: If non-English, translate via Groq
                if language != "en":
                    try:
                        trans_resp = groq_client.chat.completions.create(
                            model="llama-3.3-70b-versatile",
                            messages=[
                                {"role": "system", "content": (
                                    f"Translate the following medical advice to {lang['name']}. "
                                    f"Use {lang['script']} script. Write ONLY the translated text, nothing else."
                                )},
                                {"role": "user", "content": english_response}
                            ],
                            temperature=0.3,
                            max_tokens=800,
                        )
                        native_text = trans_resp.choices[0].message.content.strip()
                        if native_text and len(native_text) > 10:
                            result["response_native"] = native_text
                            # Also translate immediate advice
                            if result["immediate_advice_native"]:
                                try:
                                    adv_resp = groq_client.chat.completions.create(
                                        model="llama-3.3-70b-versatile",
                                        messages=[
                                            {"role": "system", "content": f"Translate to {lang['name']} ({lang['script']} script). Write ONLY the translation."},
                                            {"role": "user", "content": result["immediate_advice_native"]}
                                        ],
                                        temperature=0.3,
                                        max_tokens=200,
                                    )
                                    result["immediate_advice_native"] = adv_resp.choices[0].message.content.strip()
                                except Exception:
                                    pass
                            logger.info(f"Sarvam: Translated to {lang['name']} via Groq")
                    except Exception as e:
                        logger.warning(f"Sarvam: Translation failed: {e}")

        except json.JSONDecodeError as e:
            logger.warning(f"Sarvam: Groq JSON parse failed: {e}")
        except Exception as e:
            logger.warning(f"Sarvam: Groq API error: {type(e).__name__}: {e}")

    # FALLBACK 1: Sarvam model via Ollama for native language
    if not result:
        for model_name in ["mashriram/sarvam-m-tools:latest", "mashriram/sarvam-1:latest"]:
            try:
                async with httpx.AsyncClient(timeout=120.0) as ollama_client:
                    r = await ollama_client.post(
                        f"{OLLAMA_URL}/api/generate",
                        json={
                            "model": model_name,
                            "prompt": f"You are a doctor. Patient says: {transcript}\n\nGive medical advice in {lang['name']}. Be warm and empathetic. Recommend seeing a real doctor.",
                            "stream": False,
                            "options": {"temperature": 0.7, "num_predict": 512},
                        },
                    )
                    if r.status_code == 200:
                        sarvam_text = r.json().get("response", "").strip()
                        # Clean any embedded JSON — extract plain text only
                        if sarvam_text:
                            # If model returned JSON, extract the text value
                            try:
                                parsed = json.loads(sarvam_text)
                                if isinstance(parsed, dict):
                                    sarvam_text = parsed.get("response_native") or parsed.get("response_english") or parsed.get("response") or str(parsed)
                            except (json.JSONDecodeError, ValueError):
                                pass  # It's plain text, use as-is
                            result = {
                                "response_native": sarvam_text,
                                "response_english": sarvam_text if language == "en" else f"[Response in {lang['name']}]",
                                "urgency": "medium",
                                "primary_concern": "Medical advice provided",
                                "immediate_advice_native": "",
                                "see_doctor_urgency": "routine",
                                "medical_terms_explained": [],
                            }
                            logger.info(f"Sarvam: Got response from {model_name}")
                            break
            except Exception as e:
                logger.warning(f"Sarvam {model_name} failed: {e}")

    # FALLBACK 2: Use fallback dict
    if not result:
        from utils.llm import _fallback
        result = _fallback("sarvam")

    # Save session
    session_record = DiagnosisSession(
        patient_id=None,
        agent_type="sarvam_voice",
        input_summary=f"[{language}] {transcript[:100]}",
        result_json=result,
        confidence_score=0.7,
        urgency_level=result.get("urgency", "medium"),
        conditions_detected=[result.get("primary_concern", "")],
        processing_time_ms=0,
    )
    db.add(session_record)
    db.commit()
    db.refresh(session_record)

    result["session_id"] = session_record.id
    return result


@router.post("/text-diagnose")
async def sarvam_text_diagnose(
    message: str,
    language: str = "hi",
    conversation_history: List[dict] = [],
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    """Multi-turn text conversation in Indian languages."""
    # Build conversation context
    context = ""
    for msg in conversation_history[-5:]:  # Last 5 messages
        role = msg.get("role", "user")
        content = msg.get("content", "")
        context += f"{role}: {content}\n"
    context += f"user: {message}"

    # Reuse diagnose logic
    return await sarvam_diagnose(
        transcript=context,
        language=language,
        current_user=current_user,
        db=db,
    )


GTTS_LANG_MAP = {
    "hi": "hi", "ta": "ta", "te": "te", "bn": "bn",
    "mr": "mr", "kn": "kn", "ml": "ml", "pa": "pa", "en": "en",
}


from pydantic import BaseModel


class TTSRequest(BaseModel):
    text: str
    language: str = "hi"


@router.post("/tts")
async def text_to_speech(req: TTSRequest):
    """Convert text to speech using gTTS. Translates to target language first via Groq if needed."""
    from gtts import gTTS
    from fastapi.responses import StreamingResponse
    import io

    gtts_lang = GTTS_LANG_MAP.get(req.language, "hi")
    text_to_speak = req.text

    # Translate to target language via Groq before speaking
    if req.language != "en":
        api_key = os.getenv("GROQ_API_KEY", "").strip()
        if api_key:
            try:
                from groq import Groq
                groq_client = Groq(api_key=api_key)
                lang = LANGUAGE_CONFIG.get(req.language, LANGUAGE_CONFIG["hi"])
                trans_resp = groq_client.chat.completions.create(
                    model="llama-3.3-70b-versatile",
                    messages=[
                        {"role": "system", "content": (
                            f"Translate the following medical text to {lang['name']}. "
                            f"Use {lang['script']} script. Write ONLY the translated text, nothing else. "
                            f"If the text is already in {lang['name']}, return it as-is."
                        )},
                        {"role": "user", "content": req.text}
                    ],
                    temperature=0.3,
                    max_tokens=1000,
                )
                translated = trans_resp.choices[0].message.content.strip()
                if translated and len(translated) > 10:
                    text_to_speak = translated
                    logger.info(f"TTS: Translated to {lang['name']}, {len(translated)} chars")
            except Exception as e:
                logger.warning(f"TTS translation failed: {type(e).__name__}")

    try:
        tts = gTTS(text=text_to_speak, lang=gtts_lang, slow=False)
        audio_buffer = io.BytesIO()
        tts.write_to_fp(audio_buffer)
        audio_buffer.seek(0)
        return StreamingResponse(audio_buffer, media_type="audio/mpeg", headers={
            "Content-Disposition": "inline; filename=tts.mp3"
        })
    except Exception as e:
        logger.error(f"TTS failed: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {str(e)}")


@router.get("/languages")
async def get_supported_languages():
    return {
        "languages": [
            {"code": code, **config}
            for code, config in LANGUAGE_CONFIG.items()
        ]
    }


def _parse_json_safely(text: str) -> dict:
    if not text:
        return {"response_native": "", "response_english": "No response", "urgency": "medium"}
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        import re
        match = re.search(r'\{[\s\S]*\}', text)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
        return {
            "response_native": text,
            "response_english": text,
            "urgency": "medium",
            "primary_concern": "See response text",
        }
