import requests
import json

url = "http://localhost:8000/api/voice/diagnose"
payload = {"transcript": "fever vomiting blood severe abdominal pain"}
headers = {"Content-Type": "application/json"}

try:
    response = requests.post(url, data=json.dumps(payload), headers=headers)
    print(f"Status Code: {response.status_code}")
    print("Response JSON:")
    print(json.dumps(response.json(), indent=2))
except Exception as e:
    print(f"Error: {e}")
