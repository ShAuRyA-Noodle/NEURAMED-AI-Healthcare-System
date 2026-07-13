"""Real multi-vendor second-opinion ensemble.

Three different model families vote independently. We surface DISAGREEMENT
rather than manufacturing consensus. Models may abstain. Fewer than 2 real
votes => InferenceUnavailable (never a fabricated consensus).
"""
import json, logging, os
import httpx
from core.exceptions import InferenceUnavailable

logger = logging.getLogger(__name__)
_TIMEOUT = 40.0

PANEL = [
    # key_env may be a single name or a list of aliases tried in order.
    # Google AI Studio (Gemini) keys are commonly stored as GOOGLE_API_KEY.
    {"vendor": "gemini",   "base": "https://generativelanguage.googleapis.com/v1beta/openai", "key_env": ["GEMINI_API_KEY", "GOOGLE_API_KEY"], "model": "gemini-2.5-flash"},
    {"vendor": "groq",     "base": "https://api.groq.com/openai/v1",                            "key_env": "GROQ_API_KEY",     "model": "llama-3.3-70b-versatile"},
    {"vendor": "cerebras", "base": "https://api.cerebras.ai/v1",                                "key_env": ["CEREBRAS_API_KEY", "CEREBRAS_KEY"], "model": "gpt-oss-120b"},
]


def _resolve_key(key_env) -> tuple[str, str]:
    """Return (value, name) for the first set env var among key_env (str or list)."""
    names = [key_env] if isinstance(key_env, str) else list(key_env)
    for name in names:
        val = os.getenv(name, "").strip()
        if val:
            return val, name
    return "", names[0]

VOTE_SCHEMA_INSTRUCTION = (
    "You are an independent consulting physician giving a second opinion on the "
    "case below. Return ONLY JSON: {\"primary_diagnosis\": str, \"icd10\": str, "
    "\"confidence\": 0..1, \"reasoning\": str, \"key_evidence\": [str], "
    "\"differentials\": [str], \"agree_with_original\": bool, \"abstain\": bool, "
    "\"abstain_reason\": str}. If the case lacks enough information, set abstain=true."
)

def _call_one(member, case_text):
    key, key_name = _resolve_key(member["key_env"])
    if not key:
        return {"vendor": member["vendor"], "model": member["model"], "status": "unavailable", "reason": f"{key_name} not set"}
    try:
        r = httpx.post(
            f"{member['base']}/chat/completions",
            headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
            json={"model": member["model"], "temperature": 0.2,
                  "response_format": {"type": "json_object"},
                  "messages": [{"role": "system", "content": VOTE_SCHEMA_INSTRUCTION},
                               {"role": "user", "content": case_text}]},
            timeout=_TIMEOUT,
        )
        r.raise_for_status()
        content = r.json()["choices"][0]["message"]["content"]
        vote = json.loads(content)
        vote.update({"vendor": member["vendor"], "model": member["model"], "status": "ok"})
        return vote
    except Exception as e:
        logger.warning("ensemble member %s failed: %s", member["vendor"], e)
        return {"vendor": member["vendor"], "model": member["model"], "status": "error", "reason": f"{type(e).__name__}: {e}"}


def _get_panel():
    return PANEL


def second_opinion(case_text: str) -> dict:
    votes = [_call_one(m, case_text) for m in _get_panel()]
    real = [v for v in votes if v.get("status") == "ok" and not v.get("abstain")]
    if len(real) < 2:
        raise InferenceUnavailable(
            "Second opinion needs at least 2 independent model votes; "
            f"only {len(real)} available (set GEMINI_API_KEY / CEREBRAS_API_KEY).",
            vendor="ensemble",
        )
    return _aggregate(case_text, votes, real)


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def _aggregate(case_text, votes, real):
    # Agreement by normalized primary diagnosis
    from collections import Counter
    dx = [_norm(v.get("primary_diagnosis")) for v in real if v.get("primary_diagnosis")]
    counts = Counter(dx)
    top, top_n = (counts.most_common(1)[0] if counts else ("", 0))
    n = len(real)
    if top_n == n and n >= 2:
        consensus = "unanimous"
    elif top_n >= (n / 2) and top_n >= 2:
        consensus = "majority"
    else:
        consensus = "split"
    agreement_pct = round(top_n / n, 2) if n else 0.0
    # Dissent = votes whose primary diagnosis differs from the top
    dissent = [{"vendor": v["vendor"], "model": v["model"],
                "primary_diagnosis": v.get("primary_diagnosis"),
                "reasoning": v.get("reasoning")}
               for v in real if _norm(v.get("primary_diagnosis")) != top]
    return {
        "consensus_level": consensus,          # unanimous | majority | split
        "agreement_pct": agreement_pct,
        "agreed_diagnosis": top if top else None,
        "votes": votes,                        # full transparency incl. unavailable/error/abstain
        "dissent": dissent,                    # the product: where they disagreed
        "panel_size": len(votes),
        "real_votes": n,
        "abstained": [v["vendor"] for v in votes if v.get("abstain")],
        "unavailable": [v["vendor"] for v in votes if v.get("status") != "ok"],
        "disclaimer": "Independent AI models. Disagreement shown, not averaged. Research use only.",
    }
