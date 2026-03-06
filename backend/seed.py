import random
from datetime import datetime, timedelta
from db.database import SessionLocal
from db.models import Patient, DiagnosisSession, Appointment, User
from utils.auth import get_password_hash


def seed_users(db):
    """Seed demo doctor and patient accounts."""
    if db.query(User).filter(User.email == "demo@doctor.com").first():
        return  # Already seeded

    print("Seeding demo users...")

    # Demo doctor
    doctor = User(
        email="demo@doctor.com",
        full_name="Dr. Demo Singh",
        hashed_password=get_password_hash("demo1234"),
        role="doctor",
        avatar_emoji="👨‍⚕️",
    )
    db.add(doctor)

    # Demo patient — link to PT-0001
    patient = User(
        email="demo@patient.com",
        full_name="Demo Patient",
        hashed_password=get_password_hash("demo1234"),
        role="patient",
        patient_code="PT-0001",
        avatar_emoji="🧑‍🦽",
    )
    db.add(patient)
    db.commit()
    print("Demo users seeded: demo@doctor.com / demo@patient.com (password: demo1234)")


def seed_db():
    db = SessionLocal()

    # Always seed users (idempotent)
    seed_users(db)

    if db.query(Patient).count() > 0:
        db.close()
        return  # Skip if already seeded

    print("Seeding database...")

    # 50 patients
    patients = []
    genders = ["Male", "Female", "Other"]
    for i in range(1, 51):
        p = Patient(
            patient_code=f"PT-{i:04d}",
            age=random.randint(18, 90),
            gender=random.choice(genders)
        )
        db.add(p)
        patients.append(p)
    db.commit()

    # Condition data for realistic seeds
    voice_conditions = [
        {"name": "Pneumonia", "icd": "J18.9", "desc": "Acute lower respiratory infection with lung inflammation. Commonly presents with cough, fever, and dyspnea."},
        {"name": "Hypertension", "icd": "I10", "desc": "Chronic elevated blood pressure requiring ongoing management. May present with headaches and dizziness."},
        {"name": "Diabetes Type 2", "icd": "E11.9", "desc": "Metabolic disorder characterized by insulin resistance and hyperglycemia. Associated with polyuria and polydipsia."},
        {"name": "GERD", "icd": "K21.0", "desc": "Gastroesophageal reflux with chronic acid exposure to esophageal mucosa. Presents with heartburn and regurgitation."},
        {"name": "Anxiety Disorder", "icd": "F41.1", "desc": "Generalized anxiety with persistent worry and somatic symptoms. May include palpitations and muscle tension."},
        {"name": "Migraine", "icd": "G43.909", "desc": "Recurrent moderate-to-severe headache disorder with neurovascular etiology. Often unilateral with photophobia."},
        {"name": "Asthma", "icd": "J45.909", "desc": "Chronic airway inflammation with reversible bronchoconstriction. Characterized by wheezing and dyspnea."},
        {"name": "COVID-19", "icd": "U07.1", "desc": "SARS-CoV-2 viral infection affecting respiratory system. Variable severity from mild to critical."},
        {"name": "Bronchitis", "icd": "J20.9", "desc": "Acute inflammation of bronchial airways, typically viral. Persistent cough with sputum production."},
        {"name": "Arrhythmia", "icd": "I49.9", "desc": "Cardiac rhythm disturbance with irregular heartbeat patterns. May cause palpitations or syncope."},
        {"name": "Anemia", "icd": "D64.9", "desc": "Reduced hemoglobin or red blood cell count causing tissue hypoxia. Presents with fatigue and pallor."},
        {"name": "Hypothyroidism", "icd": "E03.9", "desc": "Underactive thyroid with insufficient hormone production. Causes fatigue, weight gain, and cold intolerance."},
        {"name": "UTI", "icd": "N39.0", "desc": "Urinary tract infection commonly caused by E. coli. Presents with dysuria, frequency, and urgency."},
        {"name": "Appendicitis", "icd": "K37", "desc": "Acute inflammation of the vermiform appendix. Presents with RLQ pain, fever, and leukocytosis."},
    ]

    recommended_tests_pool = [
        {"test": "Complete Blood Count (CBC)", "reason": "To assess for infection or anemia"},
        {"test": "Basic Metabolic Panel (BMP)", "reason": "To evaluate electrolytes and kidney function"},
        {"test": "Chest X-Ray", "reason": "To visualize lung fields for consolidation"},
        {"test": "ECG/EKG", "reason": "To assess cardiac rhythm and conduction"},
        {"test": "Urinalysis", "reason": "To detect infection or metabolic abnormalities"},
        {"test": "HbA1c", "reason": "To assess long-term glycemic control"},
        {"test": "TSH Panel", "reason": "To evaluate thyroid function"},
        {"test": "CT Scan", "reason": "For detailed cross-sectional imaging"},
        {"test": "Blood Culture", "reason": "To identify causative organism in suspected bacteremia"},
        {"test": "Lipid Panel", "reason": "To assess cardiovascular risk factors"},
    ]

    agents = ['voice', 'imaging', 'ocr']

    for _ in range(200):
        p = random.choice(patients)
        agent = random.choice(agents)
        days_ago = random.randint(0, 30)
        dt = datetime.utcnow() - timedelta(days=days_ago, hours=random.randint(0,23))

        urg_choice = random.random()
        if urg_choice < 0.6: urg = "low"
        elif urg_choice < 0.85: urg = "medium"
        elif urg_choice < 0.97: urg = "high"
        else: urg = "critical"

        conf = min(0.99, max(0.4, random.gauss(0.78, 0.12)))

        # Pick conditions
        c1 = random.choice(voice_conditions)
        c2 = random.choice([c for c in voice_conditions if c["name"] != c1["name"]])
        c3 = random.choice([c for c in voice_conditions if c["name"] not in (c1["name"], c2["name"])])

        cond_names = [c1["name"]]

        if agent == "voice":
            tests = random.sample(recommended_tests_pool, k=random.randint(2, 4))
            result_json = {
                "conditions": [
                    {"name": c1["name"], "probability": round(random.uniform(0.55, 0.92), 2), "icd_code": c1["icd"], "description": c1["desc"], "matching_symptoms": ["symptom1", "symptom2"], "red_flags": []},
                    {"name": c2["name"], "probability": round(random.uniform(0.25, 0.60), 2), "icd_code": c2["icd"], "description": c2["desc"], "matching_symptoms": ["symptom1"], "red_flags": []},
                    {"name": c3["name"], "probability": round(random.uniform(0.10, 0.40), 2), "icd_code": c3["icd"], "description": c3["desc"], "matching_symptoms": ["symptom1"], "red_flags": []},
                ],
                "overall_confidence": round(conf, 2),
                "confidence": round(conf, 2),
                "urgency": urg,
                "urgency_reasoning": f"Based on symptom severity and clinical presentation",
                "immediate_actions": ["Monitor vital signs", "Schedule follow-up within 48 hours"],
                "recommended_tests": [{"test": t["test"], "reason": t["reason"]} for t in tests],
                "medications_to_avoid": [],
                "lifestyle_advice": ["Maintain adequate hydration", "Get sufficient rest"],
                "follow_up": "Follow up with primary care physician within 1 week",
                "differential_summary": f"Primary consideration is {c1['name']} given the clinical presentation.",
                "when_to_go_to_er": "Seek emergency care if symptoms worsen significantly or new symptoms develop.",
                "recommendations": ["Monitor symptoms", "Follow up as directed"],
                "key_symptoms": ["symptom1", "symptom2"],
                "differential_diagnosis": f"Most likely {c1['name']}"
            }
        elif agent == "imaging":
            acr_cats = ["ACR 1", "ACR 2", "ACR 3", "ACR 4", "ACR 5"]
            acr_weights = [0.3, 0.3, 0.2, 0.15, 0.05]
            acr = random.choices(acr_cats, weights=acr_weights, k=1)[0]
            result_json = {
                "findings": f"Analysis of {random.choice(['CT', 'MRI', 'X-Ray'])} scan reveals notable region characteristics.",
                "impression": c1["name"],
                "recommendations": [{"priority": "routine", "action": "Follow-up imaging in 6 months"}],
                "anomaly_type": random.choice(["nodule", "opacity", "normal", "calcification"]),
                "follow_up": "Repeat imaging in 3-6 months",
                "urgency": random.choice(["routine", "urgent"]),
                "primary_finding": f"Identified region of interest consistent with {c1['name']}",
                "acr_category": acr,
                "acr_description": f"{acr} classification based on imaging characteristics",
                "measurements": "12.5mm x 8.3mm",
                "distribution": "Right upper region",
                "differential_diagnoses": [c1["name"], c2["name"], c3["name"]],
                "clinical_correlation": "Clinical correlation recommended",
                "follow_up_imaging": "CT follow-up in 3 months",
                "confidence": round(conf, 2)
            }
        else:  # ocr
            result_json = {
                "summary": f"Medical report analysis indicates findings related to {c1['name']}.",
                "key_findings": [f"Evidence of {c1['name']}", "Vital signs within acceptable range"],
                "abnormal_flags": [f"Elevated marker related to {c1['name']}"],
                "medications": [{"name": "Metformin", "dose": "500mg", "frequency": "twice daily", "purpose": "Blood sugar management"}],
                "conditions": [c1["name"]],
                "urgency": urg,
                "sections_detected": ["Chief Complaint", "Findings", "Impression"],
                "report_type": random.choice(["Lab Report", "Discharge Summary", "Radiology Report"]),
                "patient_info": {"name_redacted": True, "age_mentioned": str(p.age), "gender_mentioned": p.gender},
                "abnormal_values": [
                    {"test": "Glucose", "value": "156 mg/dL", "normal_range": "70-100 mg/dL", "interpretation": "Elevated fasting glucose", "severity": "medium"}
                ],
                "normal_values": [
                    {"test": "Hemoglobin", "value": "14.2 g/dL", "normal_range": "12-17 g/dL"}
                ],
                "diagnoses": [c1["name"]],
                "procedures": [],
                "allergies": [],
                "critical_alerts": [],
                "overall_health_score": random.choice(["good", "fair", "poor"]),
                "patient_action_items": ["Schedule follow-up appointment", "Continue current medications"],
                "follow_up_instructions": ["Return in 2 weeks for re-evaluation"],
                "doctor_info": f"Dr. {random.choice(['Smith', 'Jones', 'Williams'])}",
                "facility": "NEURAMED Medical Center",
                "report_date": dt.strftime("%Y-%m-%d")
            }

        sess = DiagnosisSession(
            patient_id=p.id,
            agent_type=agent,
            input_summary=f"Sample {agent} input for {c1['name']}",
            result_json=result_json,
            confidence_score=conf,
            urgency_level=urg,
            conditions_detected=cond_names,
            processing_time_ms=random.randint(800, 3500),
            created_at=dt
        )
        db.add(sess)

    # 20 appointments
    specialties = ["Cardiology", "General Practice", "Neurology", "Orthopedics",
                   "Pulmonology", "Endocrinology", "Gastroenterology", "Dermatology"]
    apt_types = ["initial", "follow_up", "emergency", "teleconsult"]
    for _ in range(20):
        p = random.choice(patients)
        days_ahead = random.randint(1, 30)
        dt = datetime.utcnow() + timedelta(days=days_ahead, hours=random.randint(9,16))
        app = Appointment(
            patient_id=p.id,
            doctor_name=f"Dr. {random.choice(['Smith', 'Jones', 'Williams', 'Brown', 'Davis', 'Wilson'])}",
            specialty=random.choice(specialties),
            appointment_datetime=dt,
            reason=random.choice(["Follow-up", "Initial consultation", "Lab review", "Imaging review"]),
            status="scheduled",
            appointment_type=random.choice(apt_types),
            duration_minutes=random.choice([15, 30, 45, 60]),
            location=random.choice(["Room 101", "Room 205", "Video Call", "Room 312"])
        )
        db.add(app)

    db.commit()
    db.close()
    print("Seeding complete.")
