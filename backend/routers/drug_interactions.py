import os
import json
import logging
from itertools import combinations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from db.database import get_db
from db.models import User
from utils.auth import require_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/drugs", tags=["Drug Interactions"])


@router.post("/check-interactions")
async def check_interactions(
    drugs: List[str],
    current_user: User = Depends(require_user),
    db: Session = Depends(get_db),
):
    if len(drugs) < 2:
        raise HTTPException(400, "Provide at least 2 drugs")
    if len(drugs) > 10:
        raise HTTPException(400, "Maximum 10 drugs at once")

    # Normalize drug names via RxNorm API
    normalized = await normalize_drug_names(drugs)
    result = analyze_drug_interactions(normalized)
    return result


async def normalize_drug_names(drugs: List[str]) -> List[dict]:
    """Call RxNorm API to normalize drug names."""
    import httpx

    normalized = []
    async with httpx.AsyncClient() as client:
        for drug in drugs:
            try:
                r = await client.get(
                    "https://rxnav.nlm.nih.gov/REST/rxcui.json",
                    params={"name": drug, "search": 1},
                    timeout=5.0,
                )
                data = r.json()
                rxcui = data.get("idGroup", {}).get("rxnormId", [None])[0]
                normalized.append({
                    "input_name": drug,
                    "normalized_name": drug,
                    "rxcui": rxcui,
                })
            except Exception:
                normalized.append({
                    "input_name": drug,
                    "normalized_name": drug,
                    "rxcui": None,
                })
    return normalized


def analyze_drug_interactions(drugs: List[dict]) -> dict:
    drug_names = [d["normalized_name"] for d in drugs]
    pairs = list(combinations(drug_names, 2))

    system_prompt = """You are a board-certified clinical pharmacologist and PharmD with deep expertise in drug-drug interactions, CYP450 enzyme metabolism, P-glycoprotein transport, and pharmacokinetic/pharmacodynamic principles.

You MUST return ONLY valid JSON. No markdown, no code fences, no explanatory text outside JSON."""

    prompt = f"""Analyze ALL drug-drug interactions for these medications: {json.dumps(drug_names)}

You MUST analyze each of these {len(pairs)} pairs individually: {json.dumps([list(p) for p in pairs])}

USE THIS PHARMACOLOGICAL KNOWLEDGE to guide your analysis:

**CYP450 Enzyme Interactions (key inhibitors/inducers/substrates):**
- CYP3A4 inhibitors: ketoconazole, itraconazole, clarithromycin, erythromycin, ritonavir, grapefruit juice, diltiazem, verapamil
- CYP3A4 inducers: rifampin, carbamazepine, phenytoin, St. John's Wort, phenobarbital
- CYP3A4 substrates: simvastatin, atorvastatin, amlodipine, midazolam, cyclosporine, tacrolimus, apixaban
- CYP2D6 inhibitors: fluoxetine, paroxetine, bupropion, quinidine, duloxetine
- CYP2D6 substrates: codeine, tramadol, metoprolol, carvedilol, tamoxifen, aripiprazole
- CYP2C19 inhibitors: omeprazole, esomeprazole, fluconazole, fluvoxamine
- CYP2C19 substrates: clopidogrel (prodrug requiring activation), diazepam, phenytoin
- CYP2C9 inhibitors: fluconazole, amiodarone, metronidazole
- CYP2C9 substrates: warfarin (S-enantiomer), phenytoin, glipizide, losartan
- CYP1A2 inhibitors: fluvoxamine, ciprofloxacin
- CYP1A2 substrates: theophylline, clozapine, tizanidine

**High-Risk Well-Known Interactions:**
- Warfarin + NSAIDs: increased bleeding risk (pharmacodynamic + CYP2C9)
- Warfarin + antibiotics (metronidazole, fluconazole, TMP-SMX): enhanced anticoagulation
- SSRIs + MAOIs: serotonin syndrome (CONTRAINDICATED)
- SSRIs + triptans/tramadol/linezolid: serotonin syndrome risk
- ACE inhibitors + potassium-sparing diuretics: hyperkalemia
- ACE inhibitors + ARBs: dual RAAS blockade (avoid)
- Metformin + contrast dye: lactic acidosis risk
- Statins + fibrates (gemfibrozil): rhabdomyolysis risk
- Digoxin + amiodarone/verapamil/quinidine: digoxin toxicity
- QT-prolonging drugs combined: torsades de pointes risk (fluoroquinolones, azithromycin, antipsychotics, ondansetron, sotalol, amiodarone)
- Methotrexate + NSAIDs/TMP-SMX: methotrexate toxicity (reduced renal clearance)
- Lithium + NSAIDs/ACE inhibitors/thiazides: lithium toxicity
- Clopidogrel + omeprazole: reduced clopidogrel activation via CYP2C19

**Severity Scoring Rules:**
- severity_score 10: CONTRAINDICATED — must never be combined (e.g., SSRI + MAOI, methotrexate + live vaccines)
- severity_score 7-9: MAJOR — can cause serious harm, hospitalization, or death; avoid combination or use only with close monitoring (e.g., warfarin + fluconazole, simvastatin + clarithromycin)
- severity_score 4-6: MODERATE — may worsen patient condition; monitor closely, adjust dose if needed (e.g., ACEi + potassium supplements, SSRI + tramadol)
- severity_score 1-3: MINOR — limited clinical significance; be aware but usually safe (e.g., antacids + some antibiotics timing issue)
- severity_score 0: NONE — no known clinically significant interaction

For EACH interacting pair, you MUST provide:
1. **mechanism**: The specific pharmacological mechanism (e.g., "Fluoxetine inhibits CYP2D6, reducing conversion of codeine to morphine (active metabolite), resulting in therapeutic failure of codeine analgesia")
2. **clinical_effect**: Specific clinical consequences with symptoms (e.g., "Patient may experience inadequate pain relief. In CYP2D6 ultra-rapid metabolizers, the opposite effect occurs with potential opioid toxicity")
3. **management**: Concrete actionable steps (e.g., "Switch analgesic to acetaminophen or a non-CYP2D6-dependent opioid like morphine. If combination unavoidable, monitor pain scores closely and consider alternative SSRI like sertraline which has weaker CYP2D6 inhibition")

Return this exact JSON structure:
{{
  "overall_risk": "safe | caution | avoid | contraindicated",
  "interaction_count": {{
    "contraindicated": 0,
    "major": 0,
    "moderate": 0,
    "minor": 0,
    "none": 0
  }},
  "interactions": [
    {{
      "drug_a": "exact drug name",
      "drug_b": "exact drug name",
      "severity": "contraindicated | major | moderate | minor | none",
      "severity_score": 0,
      "mechanism": "Detailed pharmacological mechanism including specific enzymes, receptors, or pathways involved",
      "clinical_effect": "Specific clinical consequences with signs and symptoms the patient or clinician would observe",
      "onset": "rapid (within 24h) | delayed (days to weeks)",
      "documentation": "established | probable | suspected | theoretical",
      "management": "Step-by-step clinical management: dose adjustments, monitoring parameters (specific lab values and frequency), or alternative therapy",
      "alternatives": [
        {{
          "replace": "Drug to replace",
          "with": "Safer alternative drug",
          "note": "Why this alternative avoids the interaction"
        }}
      ],
      "references": ["Clinical guideline or pharmacology reference"]
    }}
  ],
  "safe_pairs": [
    {{
      "drug_a": "Drug A",
      "drug_b": "Drug B",
      "note": "Brief explanation why no significant interaction exists (e.g., different metabolic pathways)"
    }}
  ],
  "overall_recommendations": [
    "Prioritized actionable recommendation for the prescriber"
  ]
}}

IMPORTANT RULES:
- You MUST include an entry for EVERY pair — either in "interactions" (if severity is minor or above) or in "safe_pairs" (if no interaction).
- The total entries in "interactions" + "safe_pairs" MUST equal {len(pairs)}.
- interaction_count values MUST match the actual number of interactions at each severity level.
- overall_risk should reflect the HIGHEST severity found among all pairs.
- Do NOT invent interactions that don't exist. If two drugs are safe together, put them in safe_pairs.
- Return ONLY the JSON object, nothing else."""

    # Direct Groq API call with higher token limit for comprehensive analysis
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        logger.error("GROQ_API_KEY missing for drug interaction analysis")
        return {
            "overall_risk": "unknown",
            "interaction_count": {"contraindicated": 0, "major": 0, "moderate": 0, "minor": 0, "none": 0},
            "interactions": [],
            "safe_pairs": [],
            "overall_recommendations": ["Drug interaction analysis unavailable — GROQ_API_KEY not configured. Please configure it in backend/.env"],
            "error": "API key not configured"
        }

    try:
        from groq import Groq
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=4096,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        logger.info(f"Drug interaction Groq response length: {len(raw)} chars")
        logger.debug(f"Drug interaction raw response: {raw[:500]}")
        result = json.loads(raw)

        # Validate the response has required fields
        required_keys = ["overall_risk", "interaction_count", "interactions", "safe_pairs", "overall_recommendations"]
        for key in required_keys:
            if key not in result:
                logger.warning(f"Drug interaction response missing key: {key}")
                if key == "interactions":
                    result[key] = []
                elif key == "safe_pairs":
                    result[key] = []
                elif key == "overall_recommendations":
                    result[key] = []
                elif key == "interaction_count":
                    result[key] = {"contraindicated": 0, "major": 0, "moderate": 0, "minor": 0, "none": 0}
                elif key == "overall_risk":
                    result[key] = "caution"

        return result

    except json.JSONDecodeError as e:
        logger.error(f"Drug interaction JSON parse failed: {e}")
        return {
            "overall_risk": "unknown",
            "interaction_count": {"contraindicated": 0, "major": 0, "moderate": 0, "minor": 0, "none": 0},
            "interactions": [],
            "safe_pairs": [],
            "overall_recommendations": ["Analysis failed due to response parsing error. Please try again."],
            "error": "Failed to parse AI response"
        }
    except Exception as e:
        logger.error(f"Drug interaction Groq API error: {type(e).__name__}: {e}")
        return {
            "overall_risk": "unknown",
            "interaction_count": {"contraindicated": 0, "major": 0, "moderate": 0, "minor": 0, "none": 0},
            "interactions": [],
            "safe_pairs": [],
            "overall_recommendations": [f"Analysis failed: {type(e).__name__}. Please try again."],
            "error": str(e)
        }
