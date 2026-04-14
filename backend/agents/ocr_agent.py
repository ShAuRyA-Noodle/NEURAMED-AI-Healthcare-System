import re
import time
import logging
from utils.llm import call_llm
from utils.ocr_engine import extract_text_from_file
from db.schemas import ReportAnalysisResult
from db.models import Report, DiagnosisSession
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

OCR_PROMPT = """You are a board-certified Medical Records Specialist and Clinical Pathologist with 20 years of experience analyzing laboratory reports, imaging reports, discharge summaries, and clinical documents.

CRITICAL VALUES requiring immediate action (flag these urgently):
  Potassium: <2.5 or >6.5 mEq/L
  Sodium: <120 or >160 mEq/L
  Glucose: <40 or >500 mg/dL
  INR/PT: >5 (on warfarin) or >3 (not on warfarin)
  Hemoglobin: <7 g/dL
  Platelets: <20,000 or >1,000,000
  Creatinine: >10 mg/dL (acute)
  Troponin: any elevation
  pH: <7.2 or >7.6
  pO2: <50 mmHg

Analyze the provided medical document and return a structured JSON:

{
  "report_type": "CBC | Metabolic Panel | Lipid Panel | Urinalysis | Thyroid | Pathology | Radiology | Discharge Summary | Prescription | Other",
  "report_date": "extracted date or null",
  "patient_name": "if present or null",
  "ordering_physician": "if present or null",

  "executive_summary": "2-3 sentence plain English overview of the entire report — what it means for the patient",

  "overall_health_score": 0,
  "overall_status": "normal | attention_needed | concerning | critical",

  "critical_alerts": [
    {
      "parameter": "parameter name",
      "value": "value with units",
      "reason": "why critical",
      "immediate_action": "what to do now",
      "severity": "critical"
    }
  ],

  "abnormal_values": [
    {
      "parameter": "test name",
      "value": "patient value",
      "unit": "unit",
      "reference_range": "normal range",
      "deviation_percent": 0,
      "deviation_direction": "high | low",
      "severity": "critical | high | moderate | mild",
      "clinical_meaning": "what this means clinically",
      "contributing_factors": ["possible causes"],
      "what_to_do": "actionable recommendation"
    }
  ],

  "normal_values": [
    {
      "parameter": "test name",
      "value": "value with units",
      "reference_range": "normal range",
      "status": "normal"
    }
  ],

  "medications_mentioned": [
    {
      "name": "medication name",
      "dose": "dose",
      "frequency": "frequency",
      "purpose": "what for",
      "drug_lab_flags": ["any concerning interactions with lab values"]
    }
  ],

  "drug_lab_interactions": [
    {
      "drug": "drug name",
      "lab_finding": "relevant lab value",
      "interaction": "description of interaction",
      "action": "what to do"
    }
  ],

  "patient_plain_language_summary": "Written for a patient with no medical background. Use simple words. Explain what each finding means for their daily life. Reassuring but honest tone.",

  "clinician_summary": "Written for the ordering physician. Technical language acceptable. Highlight actionable findings.",

  "action_items": [
    {
      "priority": 1,
      "urgency": "immediate | soon | routine",
      "action": "what to do",
      "timeframe": "when to do it"
    }
  ],

  "specialist_referrals": [
    {
      "specialty": "specialty name",
      "reason": "why needed",
      "urgency": "urgent | soon | routine"
    }
  ],

  "lifestyle_recommendations": ["recommendation1"],

  "follow_up_tests": [
    {
      "test": "test name",
      "reason": "why needed",
      "timeframe": "when"
    }
  ],

  "icd10_codes": [
    {"code": "ICD-10 code", "description": "description"}
  ],

  "key_findings": [
    {"finding": "finding text", "section": "where found", "significance": "high|medium|low"}
  ],

  "diagnoses": ["diagnosis1"],
  "procedures": ["procedure if any"],
  "allergies": ["allergy if mentioned"],
  "conditions": ["condition1"],
  "abnormal_flags": ["flag1"],
  "sections_detected": ["section1"],
  "urgency": "routine|soon|urgent|emergent",
  "summary": "executive summary for backward compatibility",
  "doctor_info": "doctor name/specialty if mentioned",
  "facility": "hospital/clinic name if mentioned",
  "patient_info": {"name_redacted": true, "age_mentioned": null, "gender_mentioned": null},
  "patient_action_items": ["plain language instruction"],
  "follow_up_instructions": ["specific instruction"]
}

Rules:
- abnormal_values: only include genuinely abnormal results with clinical interpretation
- overall_health_score: 0-100 integer based on totality of findings
- critical_alerts: only truly life-threatening values from the critical values list above
- patient_plain_language_summary: use simple patient-friendly language, not clinical jargon
- medications_mentioned: extract dose and frequency when available, flag drug-lab interactions
- Return ONLY valid JSON. No markdown. No explanation outside JSON.
"""


def analyze(file_bytes: bytes, filename: str, patient_id: int | None, db: Session) -> ReportAnalysisResult:
    start = time.time()

    # Use smart OCR engine instead of direct Tesseract
    content_type = _guess_content_type(filename)
    extraction = extract_text_from_file(filename, file_bytes, content_type)
    extracted_text = extraction.get("text", "")
    extraction_method = extraction.get("method", "unknown")

    logger.info(f"OCR extraction method: {extraction_method}, text length: {len(extracted_text)}")

    if not extracted_text or len(extracted_text.strip()) < 10:
        logger.error(f"OCR extraction failed or returned too little text (method={extraction_method})")
        raise ValueError(
            f"Could not extract text from '{filename}'. "
            "Ensure the file is a readable PDF or clear image of a medical document. "
            f"Extraction method attempted: {extraction_method}"
        )

    # Section parsing
    section_headers = [
        "Chief Complaint", "History of Present Illness",
        "Past Medical History", "Medications", "Allergies",
        "Physical Examination", "Assessment", "Plan",
        "Findings", "Impression", "Recommendations"
    ]
    sections = {}
    current_header = "General"
    current_content = []

    pattern = re.compile(r'(?i)\b(' + '|'.join(section_headers) + r')\b\s*[:\-]')
    lines = extracted_text.split('\n')
    for line in lines:
        match = pattern.search(line)
        if match:
            if current_content:
                sections[current_header] = "\n".join(current_content).strip()[:500]
            current_header = match.group(1).title()
            current_content = [line[match.end():].strip()]
        else:
            current_content.append(line)

    if current_content:
        sections[current_header] = "\n".join(current_content).strip()[:500]

    if not sections or (len(sections) == 1 and "General" in sections and not sections["General"].strip()):
        sections["Full Report"] = extracted_text[:1000]

    # LLM interpretation with enhanced prompt — send up to 8000 chars for thorough analysis
    llm_input = f"Medical report text:\n{extracted_text[:8000]}"
    llm_result = call_llm(OCR_PROMPT, llm_input, fallback_type="ocr")

    processing_ms = int((time.time() - start) * 1000)

    # Map overall_health_score to legacy string format for DB
    health_score_num = llm_result.get("overall_health_score", 0)
    if isinstance(health_score_num, int):
        if health_score_num >= 80:
            health_score_str = "good"
        elif health_score_num >= 60:
            health_score_str = "fair"
        elif health_score_num >= 40:
            health_score_str = "poor"
        else:
            health_score_str = "critical"
    else:
        health_score_str = str(health_score_num) if health_score_num else ""

    # Derive confidence from health score and extraction quality
    ocr_confidence = 0.85 if extraction_method in ("pymupdf", "groq_vision") else 0.6
    if isinstance(health_score_num, int) and health_score_num > 0:
        ocr_confidence = max(ocr_confidence, min(0.95, health_score_num / 100))

    # DB Save
    session_record = DiagnosisSession(
        patient_id=patient_id,
        agent_type='ocr',
        input_summary=f"Report: {filename[:100]}",
        result_json=llm_result,
        confidence_score=ocr_confidence,
        urgency_level=llm_result.get("urgency", "low"),
        conditions_detected=llm_result.get("conditions", []),
        processing_time_ms=processing_ms
    )
    db.add(session_record)
    db.commit()
    db.refresh(session_record)

    report_record = Report(
        session_id=session_record.id,
        extracted_text=extracted_text,
        sections=sections,
        key_findings=llm_result.get("key_findings", []),
        abnormal_flags=llm_result.get("abnormal_flags", []),
        medications=llm_result.get("medications_mentioned", llm_result.get("medications", [])),
        summary=llm_result.get("executive_summary", llm_result.get("summary", ""))
    )
    db.add(report_record)
    db.commit()

    # Handle key_findings — may be list of strings or list of dicts
    raw_findings = llm_result.get("key_findings", [])
    key_findings_list = []
    for f in raw_findings:
        if isinstance(f, dict):
            key_findings_list.append(f.get("finding", str(f)))
        else:
            key_findings_list.append(str(f))

    # Build medications list for backward compat
    meds = llm_result.get("medications_mentioned", llm_result.get("medications", []))

    return ReportAnalysisResult(
        sections=sections,
        key_findings=key_findings_list,
        abnormal_flags=llm_result.get("abnormal_flags", []),
        medications=meds,
        summary=llm_result.get("executive_summary", llm_result.get("summary", "")),
        extracted_text=extracted_text,
        session_id=session_record.id,
        conditions=llm_result.get("conditions") or llm_result.get("diagnoses") or [],
        urgency=llm_result.get("urgency") or "low",
        report_type=llm_result.get("report_type") or "",
        patient_info=llm_result.get("patient_info") or {},
        abnormal_values=llm_result.get("abnormal_values") or [],
        normal_values=llm_result.get("normal_values") or [],
        diagnoses=llm_result.get("diagnoses") or [],
        procedures=llm_result.get("procedures") or [],
        allergies=llm_result.get("allergies") or [],
        critical_alerts=llm_result.get("critical_alerts") or [],
        overall_health_score=health_score_str,
        patient_action_items=llm_result.get("patient_action_items") or [],
        follow_up_instructions=llm_result.get("follow_up_instructions") or [],
        doctor_info=llm_result.get("ordering_physician") or llm_result.get("doctor_info") or "",
        facility=llm_result.get("facility") or "",
        report_date=llm_result.get("report_date") or "",
        # New rich fields
        extraction_method=extraction_method,
        executive_summary=llm_result.get("executive_summary") or "",
        overall_health_score_numeric=health_score_num if isinstance(health_score_num, int) else 0,
        overall_status=llm_result.get("overall_status") or "",
        patient_plain_language_summary=llm_result.get("patient_plain_language_summary") or "",
        clinician_summary=llm_result.get("clinician_summary") or "",
        action_items=llm_result.get("action_items") or [],
        specialist_referrals=llm_result.get("specialist_referrals") or [],
        lifestyle_recommendations=llm_result.get("lifestyle_recommendations") or [],
        follow_up_tests=llm_result.get("follow_up_tests") or [],
        icd10_codes=llm_result.get("icd10_codes") or [],
        drug_lab_interactions=llm_result.get("drug_lab_interactions") or [],
        medications_mentioned=llm_result.get("medications_mentioned") or [],
    )


def _guess_content_type(filename: str) -> str:
    ext = filename.lower().rsplit(".", 1)[-1] if filename else ""
    mapping = {
        "pdf": "application/pdf",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "png": "image/png",
        "bmp": "image/bmp",
        "tiff": "image/tiff",
        "tif": "image/tiff",
        "webp": "image/webp",
    }
    return mapping.get(ext, "application/octet-stream")
