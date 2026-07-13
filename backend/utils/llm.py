import os
import json
import time
import logging

from core.exceptions import InferenceUnavailable

logger = logging.getLogger(__name__)

GROQ_MODELS = ["llama-3.3-70b-versatile", "llama3-70b-8192", "llama3-8b-8192"]


def _get_client(api_key: str):
    """Seam for testing — monkeypatch this, not the groq package."""
    from groq import Groq
    return Groq(api_key=api_key)


def call_llm(system_prompt: str, user_message: str) -> tuple[dict, str]:
    """Call Groq and return (parsed_json, model_name_that_answered).

    Raises InferenceUnavailable if no model produces a usable result.
    NEVER returns a fabricated result. The old `fallback_type` parameter is gone.
    """
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        raise InferenceUnavailable(
            "GROQ_API_KEY is not configured. Set it in backend/.env.",
            vendor="groq",
        )

    client = _get_client(api_key)
    last_error: str | None = None

    for model in GROQ_MODELS:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                temperature=0.3,
                max_tokens=2048,
                response_format={"type": "json_object"},
            )
            raw = response.choices[0].message.content
            return json.loads(raw), model
        except json.JSONDecodeError as e:
            last_error = f"{model} returned unparseable JSON: {e}"
            logger.error(last_error)
            continue
        except Exception as e:
            last_error = f"{model}: {type(e).__name__}: {e}"
            logger.warning(last_error)
            err = str(e).lower()
            if "rate_limit" in err or "429" in err:
                time.sleep(1)
            continue

    raise InferenceUnavailable(
        f"All Groq models failed. Last error: {last_error}",
        vendor="groq",
    )
