"""Real drug-drug interaction engine — retrieval-augmented, cite or abstain.

Law 3: the model EXPLAINS retrieved evidence; it never invents pharmacology.
Pipeline per request:
  1. normalize   — RxNorm rxcui (exact, then fuzzy fallback)
  2. retrieve    — openFDA drug labels (SPL Section 7, drug_interactions)
  3. pair-match  — does A's label mention B (or vice versa)? keep the snippet.
  4. explain     — for pairs WITH real evidence, Groq explains ONLY that text.
                   Pairs WITH NO evidence are reported honestly as "no_evidence"
                   — never a fabricated "safe".

Every network call is fail-safe (returns None / [] on any error, never raises),
because a retrieval failure must degrade the pair to "no_evidence", not 500.
The one hard requirement is GROQ for the explanation step: without it we raise
InferenceUnavailable rather than emit an unexplained (and thus untrustworthy)
result. `overall_risk` is a forbidden-on-failure key and is only ever set from
real retrieved evidence.
"""
import os
import json
import logging
from itertools import combinations

import httpx

from core.exceptions import InferenceUnavailable
from core.provenance import Provenance, InferenceStatus, wrap_result
from utils.llm import call_llm

logger = logging.getLogger(__name__)

_UA = {"User-Agent": "NEURAMED/1.0 (research; drug-interaction retrieval)"}
_TIMEOUT = 10.0

_DISCLAIMER = (
    "Absence of a warning does not mean absence of risk. "
    "Not a complete interaction database. "
    "FDA-label-derived; research use only."
)


def _openfda_key_param() -> dict:
    """openFDA works keyless at lower rate limits; append the key if set."""
    key = os.getenv("OPENFDA_API_KEY", "").strip()
    return {"api_key": key} if key else {}


def normalize(name: str) -> dict | None:
    """Resolve a drug name to an RxNorm rxcui. Never raises.

    Returns {"input": name, "rxcui": <id or None>, "matched": <name>}.
    Tries the exact rxcui endpoint first, then the fuzzy approximateTerm
    fallback. Returns None only for empty input.
    """
    if not name or not name.strip():
        return None
    name = name.strip()

    # Exact match: GET /REST/rxcui.json?name=<name>&search=2
    try:
        r = httpx.get(
            "https://rxnav.nlm.nih.gov/REST/rxcui.json",
            params={"name": name, "search": 2},
            headers=_UA, timeout=_TIMEOUT,
        )
        r.raise_for_status()
        ids = (r.json().get("idGroup", {}) or {}).get("rxnormId", []) or []
        if ids:
            return {"input": name, "rxcui": ids[0], "matched": name}
    except Exception as e:
        logger.warning("rxcui exact lookup failed for %r: %s", name, e)

    # Fuzzy fallback: GET /REST/approximateTerm.json?term=<name>&maxEntries=1
    try:
        r = httpx.get(
            "https://rxnav.nlm.nih.gov/REST/approximateTerm.json",
            params={"term": name, "maxEntries": 1},
            headers=_UA, timeout=_TIMEOUT,
        )
        r.raise_for_status()
        candidates = (r.json().get("approximateGroup", {}) or {}).get("candidate", []) or []
        if candidates:
            return {"input": name, "rxcui": candidates[0].get("rxcui"), "matched": name}
    except Exception as e:
        logger.warning("rxcui approximate lookup failed for %r: %s", name, e)

    return {"input": name, "rxcui": None, "matched": name}


def fetch_label_interactions(name: str) -> dict | None:
    """Fetch the FDA label's drug-interaction section (SPL Section 7). Never raises.

    Returns {"generic_name", "spl_set_id", "interactions_text", "citation_url"}
    or None when no label / no interaction section is available (openFDA 404 for
    an unknown drug is treated as "no label", not an error).
    """
    if not name or not name.strip():
        return None
    name = name.strip()
    q = (f'(openfda.generic_name:"{name}" OR openfda.brand_name:"{name}")')
    params = {"search": q, "limit": 1, **_openfda_key_param()}
    try:
        r = httpx.get("https://api.fda.gov/drug/label.json",
                      params=params, headers=_UA, timeout=_TIMEOUT)
        if r.status_code == 404:
            return None  # no label for this drug — honest absence, not an error
        r.raise_for_status()
        results = r.json().get("results", []) or []
        if not results:
            return None
        res = results[0]
        interactions = res.get("drug_interactions") or []
        if not interactions:
            return None
        text = "\n".join(s for s in interactions if isinstance(s, str)).strip()
        if not text:
            return None
        openfda = res.get("openfda", {}) or {}
        generic = (openfda.get("generic_name") or [None])[0]
        spl_set_id = (openfda.get("spl_set_id") or [None])[0]
        citation_url = (
            f"https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={spl_set_id}"
            if spl_set_id else "https://open.fda.gov/apis/drug/label/"
        )
        return {
            "generic_name": generic or name,
            "spl_set_id": spl_set_id,
            "interactions_text": text,
            "citation_url": citation_url,
        }
    except Exception as e:
        logger.warning("openFDA label fetch failed for %r: %s", name, e)
        return None


def _snippet(text: str, needle: str, window: int = 300) -> str:
    """Return ±window chars around the first case-insensitive hit of needle."""
    idx = text.lower().find(needle.lower())
    if idx < 0:
        return ""
    start = max(0, idx - window)
    end = min(len(text), idx + len(needle) + window)
    prefix = "..." if start > 0 else ""
    suffix = "..." if end < len(text) else ""
    return f"{prefix}{text[start:end].strip()}{suffix}"


def find_pair_evidence(drug_a: str, drug_b: str) -> list[dict]:
    """Retrieve real bidirectional interaction evidence for an unordered pair.

    Checks whether B's name appears in A's label interaction text (and vice
    versa). Returns one evidence dict per hit; empty list when neither label
    mentions the other. Never raises.
    """
    evidence: list[dict] = []
    for source, other in ((drug_a, drug_b), (drug_b, drug_a)):
        label = fetch_label_interactions(source)
        if not label or not label.get("interactions_text"):
            continue
        text = label["interactions_text"]
        if other.lower() in text.lower():
            evidence.append({
                "source_drug": label.get("generic_name") or source,
                "mentions": other,
                "snippet": _snippet(text, other),
                "citation_url": label["citation_url"],
            })
    return evidence


_SYS_PROMPT = (
    "You are a clinical pharmacology assistant. You are given VERBATIM excerpts "
    "from FDA-approved drug labels (SPL Section 7, Drug Interactions). Your ONLY "
    "job is to EXPLAIN what these excerpts say about the interaction between two "
    "named drugs. You MUST ground every statement strictly in the provided text. "
    "Do NOT add pharmacology, mechanisms, or severity that is not supported by the "
    "excerpts. If the excerpts are vague, say so. Return ONLY valid JSON."
)

_SEVERITY_RANK = {
    "contraindicated": 4,
    "major": 3,
    "moderate": 2,
    "minor": 1,
    "unspecified": 0,
}


def _explain_pair(a: str, b: str, evidence: list[dict]) -> dict:
    """Ask Groq to explain ONLY the retrieved snippets for one pair."""
    snippets_block = "\n\n".join(
        f"[Source: {e['source_drug']} label — {e['citation_url']}]\n{e['snippet']}"
        for e in evidence
    )
    user_msg = (
        f"Drug A: {a}\nDrug B: {b}\n\n"
        f"FDA label excerpts describing their interaction:\n\n{snippets_block}\n\n"
        "Explain the interaction using ONLY the text above. Return JSON with keys: "
        '"severity" (one of: contraindicated, major, moderate, minor, unspecified '
        "— pick the level the excerpts support, use unspecified if unclear), "
        '"summary" (1-2 sentences on what happens, grounded in the text), '
        '"clinical_management" (what the label advises; empty string if not stated). '
        "Do not invent anything absent from the excerpts."
    )
    parsed, model = call_llm(_SYS_PROMPT, user_msg)
    severity = str(parsed.get("severity", "unspecified")).lower().strip()
    if severity not in _SEVERITY_RANK:
        severity = "unspecified"
    return {
        "pair": [a, b],
        "status": "evidence",
        "severity": severity,
        "summary": parsed.get("summary", ""),
        "clinical_management": parsed.get("clinical_management", ""),
        "citations": [e["citation_url"] for e in evidence],
        "evidence": evidence,
        "_model": model,
    }


def check_interactions(drugs: list[str]) -> dict:
    """Retrieval-augmented drug-interaction check. Cite or abstain.

    Requires GROQ for the explanation step — raises InferenceUnavailable if the
    key is missing (never returns a fabricated "safe"/"unknown"). Every pair is
    resolved to real FDA-label evidence or honestly marked "no_evidence".
    """
    if not os.getenv("GROQ_API_KEY", "").strip():
        raise InferenceUnavailable(
            "GROQ_API_KEY not configured for interaction explanation.",
            vendor="groq",
        )

    normalized = [n for n in (normalize(d) for d in drugs) if n]
    names = [n["input"] for n in normalized]

    pairs_out: list[dict] = []
    all_citations: list[str] = []
    model_used: str | None = None
    max_rank = -1

    for a, b in combinations(names, 2):
        evidence = find_pair_evidence(a, b)
        if evidence:
            explained = _explain_pair(a, b, evidence)
            model_used = explained.pop("_model", None) or model_used
            for c in explained.get("citations", []):
                if c and c not in all_citations:
                    all_citations.append(c)
            rank = _SEVERITY_RANK.get(explained["severity"], 0)
            if rank > max_rank:
                max_rank = rank
            pairs_out.append(explained)
        else:
            pairs_out.append({
                "pair": [a, b],
                "status": "no_evidence",
                "note": "No interaction found in the FDA labels we checked.",
                "sources_checked": [a, b],
            })

    if max_rank >= 0:
        rank_to_sev = {v: k for k, v in _SEVERITY_RANK.items()}
        overall_risk = rank_to_sev.get(max_rank, "unspecified")
    else:
        overall_risk = "no_known_interaction_in_sources"

    payload = {
        "drugs_normalized": normalized,
        "pairs": pairs_out,
        "sources_checked": all_citations,
        "overall_risk": overall_risk,
        "disclaimer": _DISCLAIMER,
    }

    provenance = Provenance(
        status=InferenceStatus.OK,
        source="real_model",
        model=model_used or "llama-3.3-70b-versatile",
        vendor="groq+openfda+rxnorm",
        grounded_in=all_citations,
    )
    return wrap_result(payload, provenance)
