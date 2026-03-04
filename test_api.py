import requests

try:
    print("Testing /health")
    r1 = requests.get("http://localhost:8000/health")
    print(r1.status_code, r1.json())
except Exception as e:
    print("Failed /health:", e)

try:
    print("Testing /api/dashboard/stats")
    r2 = requests.get("http://localhost:8000/api/dashboard/stats")
    print(r2.status_code)
    data = r2.json()
    print("total_diagnoses:", data.get("total_diagnoses"))
    print("active_sessions_today:", data.get("active_sessions_today"))
except Exception as e:
    print("Failed /dashboard/stats:", e)

try:
    print("Testing /api/voice/diagnose (POST)")
    body = {"transcript": "chest pain and shortness of breath"}
    r3 = requests.post("http://localhost:8000/api/voice/diagnose", json=body)
    print(r3.status_code)
    try:
        print(r3.json())
    except:
        print(r3.text)
except Exception as e:
    print("Failed /voice/diagnose:", e)
