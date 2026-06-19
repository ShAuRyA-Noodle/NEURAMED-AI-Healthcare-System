import cv2
import numpy as np
import base64
import os
import uuid
import time
import json
import logging
from utils.llm import call_llm
from db.schemas import ScanAnalysisResult
from db.models import ScanResult, DiagnosisSession
from sqlalchemy.orm import Session
from typing import Optional

logger = logging.getLogger(__name__)

# Vision models to try in order — best first, smallest last
VISION_MODELS = [
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "llama-3.2-90b-vision-preview",
    "llama-3.2-11b-vision-preview",
]


# ── Examination protocols by scan type + body region ──

EXAMINATION_PROTOCOLS = {
    ("ct", "chest"): """Systematically examine:
1. Lung parenchyma (density, nodules, consolidation, ground-glass)
2. Airways (trachea, main bronchi, lobar bronchi)
3. Pleura (effusion, pneumothorax, thickening, calcification)
4. Mediastinum (lymphadenopathy, masses, vascular structures)
5. Cardiac silhouette (size, pericardium, calcification)
6. Chest wall (ribs, sternum, soft tissues)
7. Upper abdomen (liver dome, stomach fundus, adrenals)""",

    ("mri", "brain"): """Systematically examine:
1. Cerebral cortex all lobes (gray-white differentiation, atrophy)
2. White matter (signal changes, lesions, periventricular disease)
3. Deep gray matter (basal ganglia, thalami, internal capsule)
4. Ventricular system (size, configuration, hydrocephalus)
5. Posterior fossa (cerebellum, brainstem, 4th ventricle)
6. Vascular structures (flow voids, aneurysm, AVM)
7. Extra-axial spaces (subdural, epidural, subarachnoid)
8. Skull base and calvarium""",

    ("x-ray", "chest"): """Systematically examine (PA and lateral if available):
1. Lung fields (opacity, hyperlucency, nodules, masses)
2. Costophrenic angles (blunting = effusion threshold ~200mL)
3. Cardiac silhouette (CTR > 0.5 = cardiomegaly on PA)
4. Mediastinum (width, contour, tracheal deviation)
5. Hilum (size, density, position)
6. Diaphragm (elevation, free air beneath)
7. Bones (fractures, lytic lesions, sclerosis)
8. Soft tissues (surgical emphysema, foreign bodies)""",

    ("ct", "abdomen"): """Systematically examine:
1. Liver (size, density, lesions, vasculature, biliary)
2. Gallbladder and bile ducts (stones, wall thickening, dilation)
3. Pancreas (size, density, ductal dilation, peripancreatic fat)
4. Spleen (size, density, lesions)
5. Kidneys bilateral (size, cortex, collecting system, stones)
6. Adrenal glands (size, density, nodules)
7. Bowel (wall thickening, obstruction, pneumatosis, free air)
8. Mesentery and lymph nodes
9. Aorta and major vessels
10. Pelvis (bladder, reproductive organs, rectum)""",

    ("mri", "spine"): """Systematically examine:
1. Vertebral bodies (height, signal, alignment, fracture)
2. Intervertebral discs (height, signal, herniation, bulge)
3. Spinal canal (stenosis measurement in mm)
4. Neural foramina bilateral (compression, narrowing)
5. Spinal cord (signal, compression, syrinx)
6. Posterior elements (facets, ligamentum flavum, spinous)
7. Paraspinal soft tissues
8. Level-by-level assessment""",

    ("ultrasound", "abdomen"): """Systematically examine:
1. Liver (echogenicity, size, focal lesions, vasculature)
2. Gallbladder (stones, wall thickness, pericholecystic fluid)
3. Common bile duct (diameter, stones)
4. Pancreas (echogenicity, size, duct)
5. Spleen (size, echogenicity)
6. Kidneys bilateral (size, cortical thickness, hydronephrosis, stones)
7. Aorta (diameter, aneurysm)
8. Free fluid assessment""",

    ("ct", "brain"): """Systematically examine:
1. Brain parenchyma (density, edema, mass effect)
2. Ventricles (size, midline shift)
3. Extra-axial spaces (hemorrhage, collections)
4. Skull (fractures, calvarial lesions)
5. Orbits and sinuses
6. Vascular structures (calcifications, dense vessel sign)""",

    ("mri", "knee"): """Systematically examine:
1. Menisci (medial and lateral — tears, degeneration)
2. Cruciate ligaments (ACL, PCL — integrity, signal)
3. Collateral ligaments (MCL, LCL)
4. Articular cartilage (defects, thickness)
5. Bone marrow (edema, fracture, lesions)
6. Joint effusion and synovium
7. Extensor mechanism (patellar tendon, quadriceps)
8. Periarticular soft tissues""",
}


def get_examination_protocol(scan_type: str, body_region: str) -> str:
    key = (scan_type.lower().replace("-", "").replace(" ", ""), body_region.lower())
    if key in EXAMINATION_PROTOCOLS:
        return EXAMINATION_PROTOCOLS[key]
    # Try partial matches
    for (st, br), protocol in EXAMINATION_PROTOCOLS.items():
        if st in scan_type.lower() and br in body_region.lower():
            return protocol
    return f"Systematically examine all structures visible on this {scan_type} of the {body_region}."


def get_radiologist_system_prompt(
    scan_type: str, body_region: str, examination_protocol: str,
    patient_age: Optional[int], patient_gender: Optional[str],
    clinical_indication: str
) -> str:
    age_str = f"{patient_age} year old" if patient_age else "Unknown age"
    gender_str = patient_gender or "Unknown gender"

    return f"""You are a board-certified radiologist with subspecialty training in {scan_type} interpretation. You have 15 years of experience at a tertiary academic medical center.

Patient: {age_str} {gender_str}
Clinical indication: {clinical_indication}
Scan type: {scan_type} — {body_region}

Examination protocol:
{examination_protocol}

REPORTING STANDARDS:
- Follow ACR (American College of Radiology) reporting guidelines
- Use ACR BI-RADS / TI-RADS / Li-RADS / Lung-RADS as appropriate
- Measurements in millimeters
- Density/signal in standardized terminology
- Laterality always specified (right/left/bilateral)
- Compare to expected normal for patient's age and gender
- Be thorough and clinically precise — this is a real medical analysis
- DO NOT give generic or placeholder responses — analyze what you actually see in the image

Return ONLY this JSON structure:

{{
  "clinical_impression": "One sentence headline finding based on what you actually observe",
  "acr_category": 1,
  "acr_category_meaning": "ACR category description",
  "overall_assessment": "normal | incidental_finding | clinically_significant | urgent | critical",
  "confidence_score": 0.85,
  "confidence_reasoning": "Why this confidence level — what you can and cannot determine from this image",
  "systematic_findings": {{
    "finding_1": {{
      "name": "Anatomy name",
      "status": "normal | abnormal",
      "finding": "Detailed description of what you observe",
      "significance": "Clinical meaning",
      "measurement": "if applicable in mm"
    }}
  }},
  "primary_finding": {{
    "description": "Most significant finding in one clinical sentence",
    "location": "Location",
    "size_mm": [0, 0, 0],
    "characteristics": ["characteristic1"]
  }},
  "secondary_findings": [
    {{
      "description": "Incidental finding",
      "clinical_significance": "low | moderate | high",
      "action_required": "action"
    }}
  ],
  "differential_diagnoses": [
    {{
      "diagnosis": "Diagnosis name",
      "probability": 0.65,
      "icd10": "ICD-10 code",
      "supporting_features": ["feature1"],
      "against_features": ["feature1"],
      "next_step": "Recommended next step"
    }}
  ],
  "red_flags": [
    {{
      "finding": "Finding description",
      "urgency": "urgent | critical",
      "action": "Required action",
      "guideline": "Clinical guideline reference"
    }}
  ],
  "measurements": [
    {{
      "structure": "Structure name",
      "dimension_1_mm": 0,
      "dimension_2_mm": 0,
      "dimension_3_mm": 0,
      "measurement_method": "method"
    }}
  ],
  "comparison_note": "Note about prior imaging comparison",
  "recommendations": [
    {{
      "priority": 1,
      "action": "Recommended action",
      "timeframe": "When to do it",
      "rationale": "Why",
      "guideline_reference": "Guideline"
    }}
  ],
  "icd10_codes": [
    {{"code": "ICD-10", "description": "Description"}}
  ],
  "report_text": "Full formal radiology report: TECHNIQUE: ... COMPARISON: ... FINDINGS: ... IMPRESSION: ...",
  "anomaly_type": "nodule|mass|opacity|effusion|calcification|consolidation|normal|artifact",
  "findings": "Detailed findings paragraph",
  "impression": "Clinical impression",
  "urgency": "routine|urgent|emergent"
}}

Return ONLY valid JSON. No markdown."""


def analyze_scan_with_vision(
    image_bytes: bytes,
    scan_type: str,
    body_region: str,
    clinical_indication: str,
    patient_age: Optional[int] = None,
    patient_gender: Optional[str] = None,
) -> dict:
    """Send actual image pixels to Groq Vision for real radiological analysis.
    Tries multiple vision models with fallback chain."""
    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        logger.warning("No GROQ_API_KEY for vision analysis")
        return {}

    try:
        from groq import Groq
        client = Groq(api_key=api_key)
    except Exception as e:
        logger.error(f"Failed to initialize Groq client: {e}")
        return {}

    image_b64 = base64.b64encode(image_bytes).decode("utf-8")

    examination_protocol = get_examination_protocol(scan_type, body_region)
    system_prompt = get_radiologist_system_prompt(
        scan_type, body_region, examination_protocol,
        patient_age, patient_gender, clinical_indication
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {
            "role": "user",
            "content": [
                {
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_b64}"
                    },
                },
                {
                    "type": "text",
                    "text": (
                        f"Analyze this {scan_type} of the {body_region}. "
                        f"Clinical indication: {clinical_indication}. "
                        "Examine the image carefully and provide your complete radiological assessment as JSON. "
                        "Be specific about what you observe — do not give generic placeholder responses."
                    ),
                },
            ],
        },
    ]

    last_error = None
    for model in VISION_MODELS:
        try:
            logger.info(f"Imaging Vision: trying model {model}")
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=4096,
                temperature=0.2,
            )

            raw = response.choices[0].message.content or ""
            result = _parse_vision_json(raw)

            if result and (result.get("clinical_impression") or result.get("findings") or result.get("impression")):
                logger.info(f"Imaging Vision [{model}] returned valid analysis")
                return result
            else:
                logger.warning(f"Imaging Vision [{model}] returned empty/incomplete result")
                continue

        except Exception as e:
            last_error = e
            err_msg = str(e).lower()
            logger.warning(f"Imaging Vision [{model}] failed: {type(e).__name__}: {e}")

            if "rate_limit" in err_msg or "429" in err_msg:
                import time as _time
                _time.sleep(1)
                continue
            if "model" in err_msg and ("not found" in err_msg or "not supported" in err_msg or "does not exist" in err_msg):
                continue
            continue

    logger.error(f"All vision models failed for imaging. Last error: {last_error}")
    return {}


def _parse_vision_json(raw: str) -> dict:
    """Robust JSON extraction from vision model response."""
    import re
    if not raw:
        return {}

    # Try direct parse
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Try extracting from markdown code blocks
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', raw)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # Try finding the outermost JSON object
    json_match = re.search(r'\{[\s\S]*\}', raw)
    if json_match:
        try:
            return json.loads(json_match.group(0))
        except json.JSONDecodeError:
            pass

    logger.error(f"Could not parse vision response as JSON: {raw[:300]}")
    return {}


# ── OpenCV annotation pipeline ──

def bytes_to_b64(img_bytes: bytes) -> str:
    return base64.b64encode(img_bytes).decode('utf-8')


def _format_measurements(raw) -> str:
    """Convert measurements (list of dicts, string, or other) into readable text."""
    if isinstance(raw, str):
        return raw
    if isinstance(raw, list):
        parts = []
        for m in raw:
            if isinstance(m, dict):
                struct = m.get("structure", "")
                dims = [str(m[k]) for k in ("dimension_1_mm", "dimension_2_mm", "dimension_3_mm") if m.get(k)]
                dim_str = (" x ".join(dims) + " mm") if dims else ""
                method = m.get("measurement_method", "")
                entry = f"{struct}: {dim_str}" if dim_str else struct
                if method:
                    entry += f" ({method})"
                if entry.strip():
                    parts.append(entry)
            elif isinstance(m, str):
                parts.append(m)
        return "; ".join(parts) if parts else ""
    return str(raw) if raw else ""


def _extract_primary_finding_text(raw) -> str:
    """Extract readable string from primary_finding (may be dict or string)."""
    if isinstance(raw, str):
        return raw
    if isinstance(raw, dict):
        return raw.get("description", "") or raw.get("finding", "") or ""
    return str(raw) if raw else ""


def _create_annotated_image(img, gray, scan_type: str) -> tuple:
    """Create OpenCV annotated image with region detection.
    Returns (annotated_bytes, regions, opencv_anomaly_detected)."""
    img_height, img_width = gray.shape[:2]

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

    pixel_size_mm = 350.0 / max(img_width, 1)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    annotated = img.copy()
    regions = []
    opencv_anomaly = False

    # Dynamic minimum area — at least 0.3% of image to reduce noise
    min_contour_area = max(800, int(img_height * img_width * 0.003))

    for i, cnt in enumerate(contours):
        area = cv2.contourArea(cnt)
        if area < min_contour_area:
            continue
        perimeter = cv2.arcLength(cnt, True)
        circularity = (4 * np.pi * area / (perimeter ** 2)) if perimeter > 0 else 0
        x, y, w, h = cv2.boundingRect(cnt)
        roi = gray[y:y + h, x:x + w]
        mean_intensity = float(np.mean(roi))

        is_anomaly = 0.4 < circularity < 0.95 and mean_intensity > 140
        confidence = min(0.95, (circularity * 0.5 + mean_intensity / 255 * 0.5))

        if is_anomaly:
            opencv_anomaly = True
            color = (0, 0, 255)
        else:
            color = (0, 255, 255)

        cv2.rectangle(annotated, (x, y), (x + w, y + h), color, 2)
        label = f"R{i + 1}: {confidence:.0%}"
        cv2.putText(annotated, label, (x, y - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.4, color, 1)

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

    _, buf = cv2.imencode('.jpg', annotated, [cv2.IMWRITE_JPEG_QUALITY, 85])
    annotated_bytes = buf.tobytes()

    return annotated_bytes, regions, opencv_anomaly


def analyze(
    image_bytes: bytes, scan_type: str,
    patient_id: int | None, session_id: int | None, db: Session,
    body_region: str = "Chest",
    clinical_indication: str = "",
    patient_age: Optional[int] = None,
    patient_gender: Optional[str] = None,
) -> ScanAnalysisResult:
    start = time.time()

    # Decode bytes to numpy array for OpenCV annotation
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image")

    # Guard against decompression bombs: reject absurd pixel dimensions that a
    # small compressed file could expand into. ~50 MP is generous for real scans.
    _h, _w = img.shape[:2]
    if _h * _w > 50_000_000:
        raise ValueError("Image dimensions exceed the 50 megapixel limit")

    original_b64 = bytes_to_b64(image_bytes)

    # OpenCV annotation (for visual overlay — NOT for diagnosis)
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    annotated_bytes, regions, opencv_anomaly = _create_annotated_image(img, gray, scan_type)
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

    # ── Primary: Groq Vision analysis (real image pixels, multi-model) ──
    vision_result = analyze_scan_with_vision(
        image_bytes, scan_type, body_region,
        clinical_indication or "general screening",
        patient_age, patient_gender
    )

    if not vision_result:
        # Fallback: text-only LLM with OpenCV stats
        stats_summary = f"""
        Scan type: {scan_type}
        Body region: {body_region}
        Clinical indication: {clinical_indication}
        Patient age: {patient_age or 'unknown'}
        Patient gender: {patient_gender or 'unknown'}
        Regions analyzed: {len(regions)}
        Anomalies detected by image processing: {sum(1 for r in regions if r['is_anomaly'])}
        Highest confidence region: {max([r['confidence'] for r in regions], default=0):.2%}
        Region details: {json.dumps(regions[:5])}

        NOTE: You are analyzing computed statistics, NOT viewing the image directly.
        Be honest about confidence limits. Do not fabricate findings you cannot verify.
        """
        vision_result = call_llm(IMAGING_PROMPT_FALLBACK, stats_summary, fallback_type="imaging")

    processing_ms = int((time.time() - start) * 1000)

    # Use vision model confidence (check both field names)
    vision_conf = vision_result.get("confidence_score") or vision_result.get("confidence")
    if isinstance(vision_conf, (int, float)) and vision_conf > 0:
        overall_confidence = max(overall_confidence, float(vision_conf))

    # CRITICAL: Override OpenCV anomaly_detected with LLM's actual medical assessment
    # OpenCV only detects round bright objects — meaningless for real radiology
    anomaly_detected = opencv_anomaly  # Start with OpenCV as baseline
    llm_assessment = vision_result.get("overall_assessment", "").lower()
    llm_acr = vision_result.get("acr_category", 1)
    try:
        llm_acr = int(llm_acr)
    except (ValueError, TypeError):
        llm_acr = 1
    llm_red_flags = vision_result.get("red_flags", [])
    llm_urgency = vision_result.get("urgency", "routine").lower()

    # LLM says anomaly if: ACR >= 3, or assessment is not normal, or red flags exist
    if llm_acr >= 3 or llm_assessment in ("clinically_significant", "urgent", "critical", "suspicious") \
            or llm_red_flags or llm_urgency in ("urgent", "emergent", "critical", "stat"):
        anomaly_detected = True
    elif llm_acr >= 2 and llm_assessment not in ("normal", ""):
        anomaly_detected = True
    # LLM says normal — trust the LLM over OpenCV
    elif llm_assessment == "normal" and llm_acr <= 1:
        anomaly_detected = False

    # Save to DB with rollback protection
    try:
        if not session_id:
            session_record = DiagnosisSession(
                patient_id=patient_id,
                agent_type='imaging',
                input_summary=f"{scan_type} scan — {body_region}",
                result_json=vision_result,
                confidence_score=overall_confidence,
                urgency_level=vision_result.get("urgency", "routine"),
                conditions_detected=[vision_result.get("clinical_impression", vision_result.get("impression", "Scan analyzed"))],
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
            model_findings=vision_result.get("findings", ""),
            original_file_path=orig_path,
            annotated_file_path=anno_path
        )
        db.add(scan_result)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"DB commit failed in imaging: {e}")
        raise

    # Extract differential diagnoses
    raw_diffs = vision_result.get("differential_diagnoses", [])
    diff_list = []
    for d in raw_diffs:
        if isinstance(d, str):
            diff_list.append(d)
        elif isinstance(d, dict):
            diff_list.append(d.get("diagnosis", str(d)))

    return ScanAnalysisResult(
        anomaly_detected=anomaly_detected,
        anomaly_regions=regions,
        confidence=overall_confidence,
        findings=vision_result.get("findings", ""),
        scan_type=scan_type,
        original_image_b64=original_b64,
        annotated_image_b64=annotated_b64,
        session_id=session_id,
        impression=vision_result.get("impression", vision_result.get("clinical_impression", "")),
        recommendations=vision_result.get("recommendations", []),
        follow_up=vision_result.get("follow_up", ""),
        primary_finding=_extract_primary_finding_text(vision_result.get("primary_finding", "")),
        acr_category=str(vision_result.get("acr_category", "")),
        acr_description=vision_result.get("acr_category_meaning", vision_result.get("acr_description", "")),
        measurements=_format_measurements(vision_result.get("measurements", "")),
        distribution=vision_result.get("distribution", ""),
        differential_diagnoses=diff_list,
        clinical_correlation=vision_result.get("clinical_correlation", ""),
        follow_up_imaging=vision_result.get("follow_up_imaging", ""),
        anomaly_type=vision_result.get("anomaly_type", ""),
        urgency=vision_result.get("urgency", "routine"),
        # Rich fields
        clinical_impression=vision_result.get("clinical_impression", ""),
        overall_assessment=vision_result.get("overall_assessment", ""),
        confidence_reasoning=vision_result.get("confidence_reasoning", ""),
        systematic_findings=vision_result.get("systematic_findings", {}),
        primary_finding_detail=vision_result.get("primary_finding", {}) if isinstance(vision_result.get("primary_finding"), dict) else {},
        secondary_findings=vision_result.get("secondary_findings", []),
        differential_diagnoses_detail=[d for d in raw_diffs if isinstance(d, dict)],
        red_flags=vision_result.get("red_flags", []),
        comparison_note=vision_result.get("comparison_note", ""),
        icd10_codes=vision_result.get("icd10_codes", []),
        report_text=vision_result.get("report_text", ""),
        body_region=body_region,
    )


# Fallback prompt when vision is unavailable
IMAGING_PROMPT_FALLBACK = """You are a board-certified radiologist AI assistant.
Analyze the following medical scan region statistics and provide a comprehensive radiological report.
NOTE: You are analyzing computed image statistics, NOT the image directly. Be honest about confidence limits.
Do not fabricate findings — only report what can be reasonably inferred from the statistics provided.

Return ONLY this exact JSON, no markdown:
{
  "clinical_impression": "One sentence clinical headline finding",
  "primary_finding": {"description": "Most significant finding in one clinical sentence", "location": "", "size_mm": [], "characteristics": []},
  "findings": "Detailed radiological findings paragraph (3-4 sentences, clinical language)",
  "impression": "Radiological impression — what this likely means clinically",
  "overall_assessment": "normal | incidental_finding | clinically_significant | urgent | critical",
  "anomaly_type": "nodule|mass|opacity|effusion|calcification|consolidation|normal|artifact",
  "acr_category": 1,
  "acr_category_meaning": "ACR category meaning",
  "confidence_score": 0.5,
  "confidence_reasoning": "Note: analysis based on image statistics, not direct visualization",
  "measurements": "",
  "distribution": "Unilateral/bilateral, location description",
  "systematic_findings": {},
  "recommendations": [
    {"priority": 1, "action": "specific recommendation", "timeframe": "when", "rationale": "why", "guideline_reference": ""}
  ],
  "follow_up_imaging": "Specific follow-up scan recommended and timeframe",
  "clinical_correlation": "How findings should be correlated with patient symptoms",
  "differential_diagnoses": [
    {"diagnosis": "diagnosis1", "probability": 0.5, "icd10": "", "supporting_features": [], "against_features": [], "next_step": ""}
  ],
  "red_flags": [],
  "icd10_codes": [{"code": "", "description": ""}],
  "report_text": "TECHNIQUE: ... FINDINGS: ... IMPRESSION: ...",
  "urgency": "routine|urgent|emergent",
  "follow_up": "Recommended next diagnostic step",
  "comparison_note": "",
  "secondary_findings": []
}"""
