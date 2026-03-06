import cv2
import numpy as np
from PIL import Image
from io import BytesIO
import base64
import os
import uuid
import time
import logging
from utils.llm import call_llm
from db.schemas import ScanAnalysisResult
from db.models import ScanResult, DiagnosisSession
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

IMAGING_PROMPT = """You are a board-certified radiologist AI assistant.
Analyze the following medical scan region statistics and provide a comprehensive radiological report.

Return ONLY this exact JSON, no markdown:
{
  "primary_finding": "Most significant finding in one clinical sentence",
  "findings": "Detailed radiological findings paragraph (3-4 sentences, clinical language)",
  "impression": "Radiological impression — what this likely means clinically",
  "anomaly_type": "nodule|mass|opacity|effusion|calcification|consolidation|normal|artifact",
  "acr_category": "ACR 1|ACR 2|ACR 3|ACR 4|ACR 5",
  "acr_description": "What this ACR category means for the patient",
  "measurements": "Estimated size/extent of primary finding if applicable",
  "distribution": "Unilateral/bilateral, location description",
  "recommendations": [
    {"priority": "immediate|routine|optional", "action": "specific recommendation"}
  ],
  "follow_up_imaging": "Specific follow-up scan recommended and timeframe",
  "clinical_correlation": "How findings should be correlated with patient symptoms",
  "differential_diagnoses": ["diagnosis1", "diagnosis2", "diagnosis3"],
  "urgency": "routine|urgent|emergent",
  "confidence": 0.81,
  "follow_up": "Recommended next diagnostic step"
}

Rules:
- acr_category: ACR 1=Negative, ACR 2=Benign, ACR 3=Probably Benign, ACR 4=Suspicious, ACR 5=Highly Suggestive of Malignancy
- If no anomalies detected, use ACR 1 or ACR 2
- recommendations: include priority level for each
- Be clinically specific, avoid vague language
- confidence: 0.0-1.0 based on image quality and finding clarity"""


def bytes_to_b64(img_bytes: bytes) -> str:
    return base64.b64encode(img_bytes).decode('utf-8')


def analyze(image_bytes: bytes, scan_type: str, patient_id: int | None, session_id: int | None, db: Session) -> ScanAnalysisResult:
    start = time.time()

    # Decode bytes to numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")

    original_b64 = bytes_to_b64(image_bytes)

    # Scan-type specific OpenCV pipeline
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    img_height, img_width = gray.shape[:2]

    # Adjust CLAHE parameters by scan type
    scan_lower = scan_type.lower() if scan_type else ""
    if "ct" in scan_lower:
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    elif "mri" in scan_lower:
        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(16, 16))
    else:
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))

    enhanced = clahe.apply(gray)
    blurred = cv2.GaussianBlur(enhanced, (5, 5), 0)
    _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)

    # Estimate pixel size for measurements (assume standard FOV ~350mm for chest)
    pixel_size_mm = 350.0 / max(img_width, 1)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    annotated = img.copy()
    regions = []
    anomaly_detected = False

    for i, cnt in enumerate(contours):
        area = cv2.contourArea(cnt)
        if area < 500:
            continue
        perimeter = cv2.arcLength(cnt, True)
        circularity = (4 * np.pi * area / (perimeter ** 2)) if perimeter > 0 else 0
        x, y, w, h = cv2.boundingRect(cnt)
        roi = gray[y:y + h, x:x + w]
        mean_intensity = float(np.mean(roi))

        is_anomaly = 0.4 < circularity < 0.95 and mean_intensity > 140
        confidence = min(0.95, (circularity * 0.5 + mean_intensity / 255 * 0.5))

        if is_anomaly:
            anomaly_detected = True
            color = (0, 0, 255)
        else:
            color = (0, 255, 255)

        cv2.rectangle(annotated, (x, y), (x + w, y + h), color, 2)
        label = f"R{i + 1}: {confidence:.0%}"
        cv2.putText(annotated, label, (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

        # Estimate real-world size
        size_w_mm = round(w * pixel_size_mm, 1)
        size_h_mm = round(h * pixel_size_mm, 1)

        regions.append({
            "id": i + 1,
            "location": f"Region at ({x},{y})",
            "area": int(area),
            "circularity": round(circularity, 3),
            "mean_intensity": round(mean_intensity, 1),
            "confidence": round(confidence, 3),
            "is_anomaly": is_anomaly,
            "bounding_box": {"x": x, "y": y, "w": w, "h": h},
            "size_mm": f"~{size_w_mm}mm x {size_h_mm}mm"
        })

    # Encode annotated image
    _, buf = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
    annotated_bytes = buf.tobytes()
    annotated_b64 = bytes_to_b64(annotated_bytes)

    overall_confidence = max([r["confidence"] for r in regions], default=0.1)

    # Save files
    os.makedirs("uploads", exist_ok=True)
    file_id = str(uuid.uuid4())
    orig_path = f"uploads/{file_id}_original.png"
    anno_path = f"uploads/{file_id}_annotated.png"
    with open(orig_path, "wb") as f:
        f.write(image_bytes)
    with open(anno_path, "wb") as f:
        f.write(annotated_bytes)

    # LLM interpretation
    stats_summary = f"""
    Scan type: {scan_type}
    Regions analyzed: {len(regions)}
    Anomalies detected: {sum(1 for r in regions if r['is_anomaly'])}
    Highest confidence region: {max([r['confidence'] for r in regions], default=0):.2%}
    Region details: {regions[:3]}
    """
    llm_result = call_llm(IMAGING_PROMPT, stats_summary, fallback_type="imaging")

    processing_ms = int((time.time() - start) * 1000)

    # Save to DB
    if not session_id:
        session_record = DiagnosisSession(
            patient_id=patient_id,
            agent_type='imaging',
            input_summary=f"{scan_type} scan analysis",
            result_json=llm_result,
            confidence_score=overall_confidence,
            urgency_level=llm_result.get("urgency", "routine"),
            conditions_detected=[llm_result.get("impression", "Scan analyzed")],
            processing_time_ms=processing_ms
        )
        db.add(session_record)
        db.commit()
        db.refresh(session_record)
        session_id = session_record.id

    scan_result = ScanResult(
        session_id=session_id,
        scan_type=scan_type,
        anomaly_detected=anomaly_detected,
        anomaly_regions=regions,
        confidence_score=overall_confidence,
        model_findings=llm_result.get("findings", ""),
        original_file_path=orig_path,
        annotated_file_path=anno_path
    )
    db.add(scan_result)
    db.commit()

    return ScanAnalysisResult(
        anomaly_detected=anomaly_detected,
        anomaly_regions=regions,
        confidence=overall_confidence,
        findings=llm_result.get("findings", ""),
        scan_type=scan_type,
        original_image_b64=original_b64,
        annotated_image_b64=annotated_b64,
        session_id=session_id,
        impression=llm_result.get("impression", ""),
        recommendations=llm_result.get("recommendations", []),
        follow_up=llm_result.get("follow_up", ""),
        primary_finding=llm_result.get("primary_finding", ""),
        acr_category=llm_result.get("acr_category", ""),
        acr_description=llm_result.get("acr_description", ""),
        measurements=llm_result.get("measurements", ""),
        distribution=llm_result.get("distribution", ""),
        differential_diagnoses=llm_result.get("differential_diagnoses", []),
        clinical_correlation=llm_result.get("clinical_correlation", ""),
        follow_up_imaging=llm_result.get("follow_up_imaging", ""),
        anomaly_type=llm_result.get("anomaly_type", ""),
        urgency=llm_result.get("urgency", "routine")
    )
