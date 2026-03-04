import random
from datetime import datetime, timedelta
from backend.db.database import SessionLocal
from backend.db.models import Patient, DiagnosisSession, Appointment

def seed_db():
    db = SessionLocal()
    
    if db.query(Patient).count() > 0:
        db.close()
        return # Skip if already seeded
        
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
    
    # 200 random sessions
    agents = ['voice', 'imaging', 'ocr']
    conditions = ["Pneumonia", "Hypertension", "Diabetes Type 2", 
      "GERD", "Anxiety Disorder", "Migraine", "Asthma", "COVID-19", "Bronchitis",
      "Arrhythmia", "Anemia", "Hypothyroidism", "UTI", "Appendicitis"]
    
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
        cond = [random.choice(conditions)]
        
        sess = DiagnosisSession(
            patient_id=p.id,
            agent_type=agent,
            input_summary=f"Sample {agent} input",
            result_json={"mock": "data"},
            confidence_score=conf,
            urgency_level=urg,
            conditions_detected=cond,
            processing_time_ms=random.randint(800, 3500),
            created_at=dt
        )
        db.add(sess)
        
    # 20 appointments
    for _ in range(20):
        p = random.choice(patients)
        days_ahead = random.randint(1, 30)
        dt = datetime.utcnow() + timedelta(days=days_ahead, hours=random.randint(9,16))
        app = Appointment(
            patient_id=p.id,
            doctor_name=f"Dr. {random.choice(['Smith', 'Jones', 'Williams', 'Brown'])}",
            specialty=random.choice(["Cardiology", "General Practice", "Neurology", "Orthopedics"]),
            appointment_datetime=dt,
            reason="Follow-up",
            status="scheduled"
        )
        db.add(app)
        
    db.commit()
    db.close()
    print("Seeding complete.")
