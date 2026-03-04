import requests

try:
    with open("backend/requirements.txt", "rb") as f:
        r1 = requests.post("http://localhost:8000/api/ocr/analyze-report", files={"file": f})
        print("OCR Status:", r1.status_code)
        d = r1.json()
        print("OCR Extract:", str(d)[:100])
except Exception as e:
    print("OCR Request Error:", e)

try:
    r2 = requests.post("http://localhost:8000/api/voice/diagnose", json={"transcript": "fever and headache for 2 days"})
    print("Voice Status:", r2.status_code)
    d2 = r2.json()
    print("Voice Result:", d2.get('conditions', []))
except Exception as e:
    print("Voice Request Error:", e)
