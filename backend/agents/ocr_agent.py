import io
import re
import os
import time
import logging
from PIL import Image
from backend.utils.llm import call_llm
from backend.db.schemas import ReportAnalysisResult
from backend.db.models import Report, DiagnosisSession
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

import pytesseract
pytesseract.pytesseract.tesseract_cmd = os.getenv(
    "TESSERACT_CMD",
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)

OCR_PROMPT = """You are a medical records AI.
Analyze the extracted text from a medical report.
Return ONLY valid JSON, no markdown:
{
  "summary": "3 sentence clinical summary of key findings",
  "key_findings": ["Finding 1", "Finding 2", "Finding 3"],
  "abnormal_flags": ["Abnormal value or critical result"],
  "medications": ["Medication name and dose"],
  "conditions": ["Diagnosed condition"],
  "urgency": "low|medium|high|critical",
  "sections_detected": ["Chief Complaint", "Findings", "Impression"]
}"""


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

    return ReportAnalysisResult(
        sections=sections,
        key_findings=llm_result.get("key_findings", []),
        abnormal_flags=llm_result.get("abnormal_flags", []),
        medications=llm_result.get("medications", []),
        summary=llm_result.get("summary", ""),
        extracted_text=extracted_text,
        session_id=session_record.id,
        conditions=llm_result.get("conditions", []),
        urgency=llm_result.get("urgency", "low")
    )
