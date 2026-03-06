import io
import re
import os
import time
import logging
from PIL import Image
from utils.llm import call_llm
from db.schemas import ReportAnalysisResult
from db.models import Report, DiagnosisSession
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

import pytesseract
pytesseract.pytesseract.tesseract_cmd = os.getenv(
    "TESSERACT_CMD",
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)

OCR_PROMPT = """You are a medical records specialist AI with expertise in clinical documentation. Analyze this medical report and extract all clinically relevant information.

Return ONLY this exact JSON, no markdown:
{
  "report_type": "Discharge Summary|Lab Report|Radiology Report|Prescription|Referral Letter|Clinic Note|Pathology Report|Other",
  "patient_info": {
    "name_redacted": true,
    "age_mentioned": "age if found, else null",
    "gender_mentioned": "gender if found, else null"
  },
  "summary": "3-4 sentence executive clinical summary of the entire report",
  "key_findings": [
    {"finding": "specific finding", "section": "where found", "significance": "high|medium|low"}
  ],
  "abnormal_values": [
    {
      "test": "test name",
      "value": "patient value",
      "normal_range": "normal range",
      "interpretation": "what this means clinically",
      "severity": "critical|high|medium|low"
    }
  ],
  "normal_values": [
    {"test": "test name", "value": "value", "normal_range": "range"}
  ],
  "medications": [
    {"name": "medication", "dose": "dose if found", "frequency": "frequency", "purpose": "what for"}
  ],
  "diagnoses": ["diagnosis1", "diagnosis2"],
  "procedures": ["procedure if any"],
  "allergies": ["allergy if mentioned"],
  "follow_up_instructions": ["specific instruction"],
  "critical_alerts": ["anything requiring immediate attention"],
  "doctor_info": "doctor name/specialty if mentioned",
  "facility": "hospital/clinic name if mentioned",
  "report_date": "date if found",
  "overall_health_score": "good|fair|poor|critical",
  "patient_action_items": [
    "Clear plain-English instruction for the patient"
  ],
  "urgency": "routine|soon|urgent|emergent",
  "conditions": ["condition1"],
  "abnormal_flags": ["flag1"],
  "sections_detected": ["section1"]
}

Rules:
- abnormal_values: only include genuinely abnormal results with clinical interpretation
- medications: extract dose and frequency when available
- patient_action_items: use simple patient-friendly language, not clinical jargon
- critical_alerts: only truly urgent findings that need immediate attention
- overall_health_score: based on the totality of findings"""


def analyze(file_bytes: bytes, filename: str, patient_id: int | None, db: Session) -> ReportAnalysisResult:
    start = time.time()
    extracted_text = ""

    try:
        filename_lower = filename.lower()
        if filename_lower.endswith('.pdf'):
            try:
                from pdf2image import convert_from_bytes
                images = convert_from_bytes(file_bytes, dpi=200)
                for img in images:
                    extracted_text += pytesseract.image_to_string(img, config='--psm 6') + "\n"
            except Exception as e:
                extracted_text = f"PDF conversion failed: {e}"
        else:
            img = Image.open(io.BytesIO(file_bytes))
            extracted_text = pytesseract.image_to_string(img, config='--psm 6')
    except pytesseract.TesseractNotFoundError:
        extracted_text = "Tesseract OCR not found. Check TESSERACT_CMD in .env"
    except Exception as e:
        extracted_text = f"OCR extraction failed: {str(e)}"

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

    # LLM interpretation
    llm_input = f"Medical report text:\n{extracted_text[:2000]}"
    llm_result = call_llm(OCR_PROMPT, llm_input, fallback_type="ocr")

    processing_ms = int((time.time() - start) * 1000)

    # DB Save
    session_record = DiagnosisSession(
        patient_id=patient_id,
        agent_type='ocr',
        input_summary=f"Report: {filename[:100]}",
        result_json=llm_result,
        confidence_score=0.85,
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
        medications=llm_result.get("medications", []),
        summary=llm_result.get("summary", "")
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

    return ReportAnalysisResult(
        sections=sections,
        key_findings=key_findings_list,
        abnormal_flags=llm_result.get("abnormal_flags", []),
        medications=llm_result.get("medications", []),
        summary=llm_result.get("summary") or "",
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
        overall_health_score=llm_result.get("overall_health_score") or "",
        patient_action_items=llm_result.get("patient_action_items") or [],
        follow_up_instructions=llm_result.get("follow_up_instructions") or [],
        doctor_info=llm_result.get("doctor_info") or "",
        facility=llm_result.get("facility") or "",
        report_date=llm_result.get("report_date") or ""
    )
