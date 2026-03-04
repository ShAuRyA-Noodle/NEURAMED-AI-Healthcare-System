# NEURAMED — Complete Project Reference

> AI-powered healthcare diagnostic dashboard. FastAPI + React 18 + Groq LLM + WebSocket live feed.

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI, SQLAlchemy, SQLite, Pydantic |
| AI/LLM | Groq (`llama-3.3-70b-versatile`), temp 0.3, JSON mode |
| Speech | ElevenLabs STT, Google SpeechRecognition fallback |
| Vision | OpenCV (CLAHE + contour detection), PyTesseract OCR |
| Frontend | React 18, TypeScript, Vite (port 8080), TailwindCSS |
| UI Kit | shadcn/ui (Radix primitives), Framer Motion, Recharts |
| Data | TanStack React Query (staleTime 20s, retry 1) |
| HTTP | Axios with interceptors (`src/api/client.ts`) |
| Realtime | WebSocket at `/ws/live-feed` (auto-reconnect) |
| PDF | ReportLab (backend generation, streamed download) |

---

## Project Structure

```
Project01/
├── backend/
│   ├── main.py                  # FastAPI app, CORS, router registration, WS endpoint, startup seed
│   ├── seed.py                  # Seeds 50 patients, 200 sessions, 20 appointments
│   ├── ws_manager.py            # ConnectionManager — broadcast() to all WS clients
│   ├── db/
│   │   ├── database.py          # Engine, SessionLocal, get_db dependency
│   │   ├── models.py            # Patient, DiagnosisSession, ScanResult, Report, Appointment
│   │   └── schemas.py           # Pydantic DTOs: DashboardStats, ActivityFeedItem, *Result, *Response
│   ├── agents/
│   │   ├── voice_agent.py       # Transcribe audio → LLM → DiagnosisResult
│   │   ├── imaging_agent.py     # OpenCV pipeline → LLM → ScanAnalysisResult
│   │   ├── ocr_agent.py         # PyTesseract → section parse → LLM → ReportAnalysisResult
│   │   └── appointment_agent.py # CRUD for appointments
│   ├── routers/
│   │   ├── voice.py             # POST /api/voice/diagnose, GET /api/voice/sessions
│   │   ├── imaging.py           # POST /api/imaging/analyze, GET /api/imaging/scans[/{id}]
│   │   ├── ocr.py               # POST /api/ocr/analyze-report, GET /api/ocr/reports[/{id}]
│   │   ├── patients.py          # POST/GET /api/patients, GET /api/patients/{id}
│   │   ├── appointments.py      # POST/GET /api/appointments, PATCH /{id}/status
│   │   ├── dashboard.py         # GET /api/dashboard/stats, /activity-feed, /recent-sessions
│   │   └── export.py            # GET /api/sessions, /{id}, /{id}/export-pdf
│   └── utils/
│       ├── llm.py               # call_llm(system, user, fallback_type) — Groq wrapper + fallbacks
│       ├── pdf_export.py        # generate_session_pdf(session) → bytes
│       └── file_handling.py     # bytes_to_b64()
│
├── frontend/  (junction → neural-care-hub-main/)
│   ├── src/
│   │   ├── App.tsx              # Routes, QueryClient, splash screen, Toast
│   │   ├── main.tsx             # ReactDOM.createRoot
│   │   ├── index.css            # CSS vars: --bg, --surface, --cyan, --green, --red, etc.
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx      # Stats cards, area/bar/pie charts, live feed, recent table
│   │   │   ├── VoicePage.tsx          # Audio record, waveform, transcript, symptom templates
│   │   │   ├── ImagingPage.tsx        # Drag-drop upload, before/after slider, anomaly regions
│   │   │   ├── OcrPage.tsx            # PDF/image upload, text extraction, section timeline
│   │   │   ├── PatientsPage.tsx       # Patient list, search, create form, session history
│   │   │   ├── AppointmentsPage.tsx   # Appointment list, status updates, create modal
│   │   │   ├── SessionsPage.tsx       # Filterable sessions table with pagination
│   │   │   ├── SessionDetailPage.tsx  # Full session view, PDF export button
│   │   │   └── NotFound.tsx           # 404 page
│   │   ├── api/
│   │   │   ├── client.ts        # Axios instance (VITE_API_BASE_URL)
│   │   │   ├── voice.ts         # diagnoseSpeech(), getVoiceSessions()
│   │   │   ├── imaging.ts       # analyzeImage(), getScans()
│   │   │   ├── ocr.ts           # analyzeReport(), getReports()
│   │   │   ├── patients.ts      # getPatients(), getPatient(), createPatient()
│   │   │   ├── appointments.ts  # getAppointments(), createAppointment(), updateStatus()
│   │   │   └── dashboard.ts     # getStats(), getActivityFeed(), getRecentSessions()
│   │   ├── hooks/
│   │   │   ├── useDashboardStats.ts   # React Query, 30s refetch
│   │   │   ├── useActivityFeed.ts     # React Query
│   │   │   ├── useRecentSessions.ts   # React Query, 10s refetch
│   │   │   ├── useLiveWebSocket.ts    # WS connect, parse events, auto-reconnect
│   │   │   ├── useVoiceDiagnosis.ts   # useMutation
│   │   │   ├── useImageAnalysis.ts    # useMutation
│   │   │   ├── useOcrAnalysis.ts      # useMutation
│   │   │   ├── usePatients.ts         # React Query with search
│   │   │   ├── useAppointments.ts     # React Query + mutations
│   │   │   ├── useToast.ts            # useSyncExternalStore global toast store
│   │   │   └── useCountUp.ts          # requestAnimationFrame counter
│   │   ├── components/
│   │   │   ├── shared/
│   │   │   │   ├── AgentBadge.tsx       # voice/imaging/ocr badge
│   │   │   │   ├── UrgencyBadge.tsx     # low/medium/high/critical
│   │   │   │   ├── ConfidenceMeter.tsx  # SVG radial meter (expects 0-1 value)
│   │   │   │   ├── CountUpNumber.tsx    # Animated number
│   │   │   │   ├── SparkLine.tsx        # Mini sparkline
│   │   │   │   ├── SkeletonCard.tsx     # Loading placeholder
│   │   │   │   ├── EmptyState.tsx       # Empty list placeholder
│   │   │   │   └── Toast.tsx            # Toast notification renderer
│   │   │   ├── layout/
│   │   │   │   ├── AppLayout.tsx        # Sidebar + TopBar wrapper
│   │   │   │   ├── Sidebar.tsx          # Nav items, logo, system status
│   │   │   │   └── TopBar.tsx           # Header bar
│   │   │   ├── cursor/
│   │   │   │   └── CustomCursor.tsx     # Custom cursor effect
│   │   │   └── ui/                      # 50+ shadcn/ui components
│   │   ├── types/index.ts       # All TypeScript interfaces
│   │   └── lib/utils.ts         # cn(), formatConfidence(), truncate(), capitalize()
│   ├── .env.local               # VITE_API_BASE_URL, VITE_WS_URL
│   ├── vite.config.ts           # @ alias, port 8080
│   ├── tailwind.config.ts       # Dark theme, custom vars
│   ├── vercel.json              # SPA rewrites
│   └── package.json             # React 18, Vite, Recharts, Framer Motion, etc.
│
├── .gitignore
├── Procfile                     # Heroku: uvicorn backend
├── nixpacks.toml                # Railway/Nixpacks deploy
├── runtime.txt                  # python-3.11.9
├── neuramed.db                  # SQLite (auto-created)
└── uploads/                     # Uploaded/annotated images
```

---

## Database Models (SQLAlchemy)

```
Patient (id, patient_code, age, gender, created_at)
  ├── sessions: [DiagnosisSession]
  └── appointments: [Appointment]

DiagnosisSession (id, patient_id, agent_type, input_summary, confidence_score,
                  urgency_level, conditions_detected[JSON], result_json[JSON],
                  processing_time_ms, created_at)

ScanResult (id, patient_id, scan_type, file_path, annotated_path,
            findings, anomaly_regions[JSON], confidence_score, created_at)

Report (id, patient_id, file_path, extracted_text, key_findings[JSON],
        medications[JSON], abnormal_flags[JSON], summary, created_at)

Appointment (id, patient_id, doctor_name, specialty, appointment_datetime,
             reason, status[scheduled|completed|cancelled], created_at)
```

---

## API Endpoints

### Voice Agent
| Method | Path | Body/Params | Returns |
|--------|------|-------------|---------|
| POST | `/api/voice/diagnose` | `{transcript?, audio_base64?, patient_id}` | DiagnosisSession |
| GET | `/api/voice/sessions` | `?limit=20` | Session[] |

### Imaging Agent
| Method | Path | Body/Params | Returns |
|--------|------|-------------|---------|
| POST | `/api/imaging/analyze` | multipart: `file`, `patient_id`, `scan_type` | ScanResult |
| GET | `/api/imaging/scans` | `?limit=20` | Scan[] |
| GET | `/api/imaging/scans/{id}` | — | ScanResult |

### OCR Agent
| Method | Path | Body/Params | Returns |
|--------|------|-------------|---------|
| POST | `/api/ocr/analyze-report` | multipart: `file`, `patient_id` | Report |
| GET | `/api/ocr/reports` | `?limit=20` | Report[] |
| GET | `/api/ocr/reports/{id}` | — | Report |

### Patients
| Method | Path | Body/Params | Returns |
|--------|------|-------------|---------|
| POST | `/api/patients` | `{age, gender}` | Patient (auto-generates PT-XXXX code) |
| GET | `/api/patients` | `?search=&limit=50&offset=0` | Enriched patient list |
| GET | `/api/patients/{id}` | — | Patient + sessions[] |

### Appointments
| Method | Path | Body/Params | Returns |
|--------|------|-------------|---------|
| POST | `/api/appointments` | `{patient_id, doctor_name, specialty, datetime, reason}` | Appointment |
| GET | `/api/appointments` | `?patient_id=&status=` | Appointment[] |
| PATCH | `/api/appointments/{id}/status` | `{status}` | Appointment |

### Dashboard
| Method | Path | Returns |
|--------|------|---------|
| GET | `/api/dashboard/stats` | DashboardStats (totals, 30-day chart, agent perf, conditions, urgency) |
| GET | `/api/dashboard/activity-feed` | ActivityFeedItem[] |
| GET | `/api/dashboard/recent-sessions` | RecentSession[] |

### Sessions
| Method | Path | Params | Returns |
|--------|------|--------|---------|
| GET | `/api/sessions` | `?agent_type=&urgency=&limit=50&offset=0` | `{total, sessions[]}` |
| GET | `/api/sessions/{id}` | — | Full session detail with result_json |
| GET | `/api/sessions/{id}/export-pdf` | — | PDF file stream |

### WebSocket
| Path | Behavior |
|------|----------|
| `ws://localhost:8000/ws/live-feed` | Real-time broadcast of new diagnoses as JSON |

---

## Key Patterns & Gotchas

### LLM Integration (`utils/llm.py`)
- `call_llm(system_prompt, user_message, fallback_type)` — Groq API, JSON response mode
- `fallback_type` = `"voice"` | `"imaging"` | `"ocr"` — each returns a type-specific fallback when API fails
- Temperature 0.3 for consistency
- Model: `llama-3.3-70b-versatile`

### Confidence Values
- **Backend stores** confidence as **0.0–1.0** float
- **ConfidenceMeter component** expects 0-1 and displays `Math.round(value * 100)%`
- **Dashboard stats** returns raw 0-1 (`round(avg_conf, 4)`) — do NOT multiply by 100 in backend
- **Activity feed** confidence is raw 0-1

### Toast System
- Uses `useSyncExternalStore` for global shared state (not per-component)
- Import: `import { useToast } from '@/hooks/useToast'`
- Usage: `const { addToast } = useToast(); addToast('success', 'Message')`
- Auto-dismiss after `duration` ms (default 3000)

### WebSocket Live Feed
- Connect to `VITE_WS_URL` env var (default `ws://localhost:8000/ws/live-feed`)
- Server broadcasts on every new diagnosis (voice/imaging/ocr)
- Auto-reconnect on close with 3s delay
- Events parsed as `ActivityFeedItem`

### Agent Processing Flow
```
1. Frontend sends POST with data (transcript/file/image)
2. Router receives request, calls agent
3. Agent processes input (audio→text, image→opencv, pdf→tesseract)
4. Agent calls call_llm() with clinical system prompt
5. LLM returns JSON with conditions, confidence, urgency, recommendations
6. Agent saves to database (DiagnosisSession / ScanResult / Report)
7. Router broadcasts result to WebSocket
8. Router returns response to frontend
```

### Patient Enrichment (GET /api/patients)
Backend computes per-patient:
- `total_sessions` — count of DiagnosisSessions
- `last_session_agent` — most recent session's agent_type
- `last_session_urgency` — most recent session's urgency
- `most_common_condition` — highest-frequency condition across all sessions
- `demographics` — `{age, gender, blood_type: "N/A"}`

### Dashboard 30-Day Chart
- Always returns exactly 30 data points (fills missing days with zeros)
- Keys: `{date, voice, imaging, ocr}` — counts per agent per day

### PDF Export (`utils/pdf_export.py`)
- `generate_session_pdf(session)` → raw bytes
- Extracts recommendations from `session.result_json` (not from model fields)
- Transcript/findings extracted based on `agent_type`:
  - voice → `input_summary`
  - imaging → `result_json.findings`
  - ocr → `result_json.summary`

---

## Environment Variables

### Backend (`.env`)
```
GROQ_API_KEY=gsk_...           # Required — Groq API key
ELEVENLABS_API_KEY=sk_...      # Optional — for ElevenLabs STT
TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe  # Required for OCR
DATABASE_URL=sqlite:///./neuramed.db
```

### Frontend (`.env.local` in `src/`)
```
VITE_API_BASE_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000/ws/live-feed
```

---

## Running Locally

```bash
# Backend (from project root)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend (from frontend/)
cd frontend
npm install
npm run dev          # → http://localhost:8080

# Seed database (auto-runs on startup, or manually)
cd ..
python -m backend.seed
```

---

## Common Bugs Fixed (Reference)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| avg_confidence showing 78000% | Backend returned `avg_conf * 100`, ConfidenceMeter did `value * 100` again | Return raw 0-1 from backend: `round(avg_conf, 4)` |
| Toast notifications not showing | Each `useToast()` had independent state | Switched to `useSyncExternalStore` global store |
| Dashboard chart empty | Field mismatch: `voice_count` vs `voice` | Aligned backend keys to `voice/imaging/ocr` |
| ImagingAI result fields wrong | `result.annotated_image` vs `annotated_image_b64` | Fixed all field references |
| OCR key_findings treated as objects | Frontend did `item.text` but items are strings | Changed to render strings directly |
| Sessions page 404 | No `/api/sessions` list endpoint, no page component | Created both endpoint and SessionsPage |
| export.py accessing non-existent fields | `session.recommendations` doesn't exist on model | Extract from `session.result_json` instead |
| Patients page empty | Backend returned basic fields, frontend expected enriched | Added computed fields in patients router |
| LLM fallback always voice-type | Single generic fallback regardless of agent | Added `fallback_type` parameter with per-agent fallbacks |

---

## Deployment

| Platform | Config File | Command |
|----------|------------|---------|
| Heroku | `Procfile` | `web: cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT` |
| Railway/Nixpacks | `nixpacks.toml` | Auto-detected, uses python311 + tesseract |
| Vercel (frontend) | `frontend/vercel.json` | `npm run build`, SPA rewrites to index.html |

---

## File Naming Convention

- Backend: `snake_case.py` (routers, agents, utils)
- Frontend pages: `PascalCasePage.tsx` (DashboardPage, VoicePage, etc.)
- Frontend hooks: `useCamelCase.ts`
- Frontend API: `camelCase.ts`
- Shared components: `PascalCase.tsx`
