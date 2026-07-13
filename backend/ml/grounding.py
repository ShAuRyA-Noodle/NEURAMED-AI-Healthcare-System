"""Real medical grounding — ICD-10 codes, literature citations, patient explainers.

Law 3: cite or abstain. Citations returned here are VERIFIED to exist before
use; verify_pmids() drops any PMID an LLM invented that isn't in the retrieved
set. All three upstream services are free and keyless.
"""
import logging
import re
import httpx

logger = logging.getLogger(__name__)

_UA = {"User-Agent": "NEURAMED/1.0 (research; medical grounding)"}
_TIMEOUT = 10.0


def icd10_lookup(term: str, max_results: int = 5) -> list[dict]:
    """Return [{'code':..., 'name':...}] real ICD-10-CM codes for a term."""
    if not term or not term.strip():
        return []
    url = "https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search"
    # The NLM API needs sf=code,name to match a plain-text term (default
    # searches the code field only) and returns hits sorted alphabetically by
    # code with NO relevance ranking -- so "pneumonia" surfaces "Typhoid
    # pneumonia" (A01.03) before the canonical "Pneumonia, unspecified" (J18.9).
    # We pull a wider candidate pool and re-rank client-side so codes whose
    # name actually starts with the term win, then truncate to max_results.
    pool = max(max_results, 40)
    try:
        r = httpx.get(url, params={"terms": term, "maxList": pool,
                                   "sf": "code,name"},
                      headers=_UA, timeout=_TIMEOUT)
        r.raise_for_status()
        data = r.json()
        pairs = data[3] if len(data) > 3 else []
        t = term.strip().lower()

        def _rank(pair):
            name = (pair[1] or "").lower()
            if name == t:
                return 0
            if name.startswith(t):
                return 1
            return 2

        pairs = sorted(pairs, key=_rank)  # stable: keeps API order within a tier
        return [{"code": c, "name": n} for c, n in pairs[:max_results]]
    except Exception as e:
        logger.warning("icd10_lookup failed for %r: %s", term, e)
        return []


def evidence(query: str, n: int = 5) -> list[dict]:
    """Return real literature citations from Europe PMC, reviews preferred."""
    if not query or not query.strip():
        return []
    url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
    q = f'({query}) AND (SRC:"MED")'
    try:
        r = httpx.get(url, params={"query": q, "format": "json",
                                   "pageSize": n, "resultType": "core"},
                      headers=_UA, timeout=_TIMEOUT)
        r.raise_for_status()
        results = r.json().get("resultList", {}).get("result", [])
        out = []
        for x in results:
            pmid = x.get("pmid")
            if not pmid:
                continue
            out.append({
                "pmid": pmid,
                "title": x.get("title"),
                "year": x.get("pubYear"),
                "journal": (x.get("journalInfo", {}) or {}).get("journal", {}).get("title"),
                "url": f"https://europepmc.org/article/MED/{pmid}",
            })
        return out
    except Exception as e:
        logger.warning("evidence lookup failed for %r: %s", query, e)
        return []


def verify_pmids(text: str, allowed_pmids: set[str]) -> str:
    """Remove any [PMID:xxxx] citation whose id is NOT in allowed_pmids.
    LLMs fabricate PMIDs constantly; only citations we actually retrieved survive."""
    if not text:
        return text
    def _strip(m):
        pid = m.group(1)
        return m.group(0) if pid in allowed_pmids else ""
    return re.sub(r"\[PMID:\s*(\d+)\]", _strip, text)


def patient_explainer(icd10_code: str) -> dict | None:
    """Plain-language patient explanation for an ICD-10 code (MedlinePlus)."""
    if not icd10_code:
        return None
    url = "https://connect.medlineplus.gov/service"
    try:
        r = httpx.get(url, params={
            "mainSearchCriteria.v.cs": "2.16.840.1.113883.6.90",
            "mainSearchCriteria.v.c": icd10_code,
            "knowledgeResponseType": "application/json",
        }, headers=_UA, timeout=_TIMEOUT)
        r.raise_for_status()
        entries = r.json().get("feed", {}).get("entry", [])
        if not entries:
            return None
        e = entries[0]
        return {
            "title": (e.get("title", {}) or {}).get("_value"),
            "summary": (e.get("summary", {}) or {}).get("_value"),
            "url": (e.get("link", [{}]) or [{}])[0].get("href"),
        }
    except Exception as ex:
        logger.warning("patient_explainer failed for %s: %s", icd10_code, ex)
        return None
