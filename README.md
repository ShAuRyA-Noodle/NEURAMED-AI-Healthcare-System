# NEURAMED - AI Healthcare Dashboard

Neuramed is a full-stack, real-time AI healthcare diagnostic dashboard. It provides continuous integrations with state-of-the-art AI agents acting as specialists for various medical data formats.

The platform is designed to:
- Provide real-time processing of patient voices for automated symptom extraction and initial diagnosis.
- Seamlessly analyze medical imaging (X-Ray, CT Scans, MRI, Ultrasound) for abnormalities.
- Parse unstructured OCR clinical notes into structured findings and flagged metrics.
- Broadcast all results live across a beautiful, dynamic, and fully responsive Dashboard using WebSockets.

## 🚀 Technology Stack
**Frontend:**
- React 18 & TypeScript
- Vite
- TailwindCSS (Utility classes) & Vanilla CSS Variables (Core theming)
- React Query & Axios for Data Fetching & Caching
- Recharts (Data Visualization) & Framer Motion (Animations)
- Lucide React (Icons)

**Backend:**
- Python & FastAPI
- SQLite & SQLAlchemy ORM
- WebSocket (Live Real-Time Broadcasting)
- Groq / LLaMA (LLM Inference for text/voice agents)
- OpenCV & PIL (Image processing)
- PyTesseract (OCR Extraction)
- ReportLab (PDF PDF Export Generation)

## 📂 Project Architecture

```
Project Root
├── backend/                  # FastAPI Application
│   ├── main.py               # Entry point and WebSocket broadcaster
│   ├── db/                   # SQLAlchemy models, schemas and Database Config
│   ├── routers/              # API Route Controllers (Voice, Imaging, OCR, Dashboard)
│   ├── agents/               # AI Agent Logic (Groq wrapper, CV, PyTesseract)
│   └── seed.py               # Database seeder code
│
└── neural-care-hub-main/     # React Frontend Application
    ├── src/
    │   ├── api/              # Axios API client setup
    │   ├── hooks/            # Tanstack React Query integrations and Live WS connection
    │   ├── components/       # Shared UI Reusable Blocks & Layout (TopBar, Sidebar)
    │   ├── types/            # Typescript Models
    │   └── pages/            # View Pages (Dashboard, Specific Agents, Patients, etc.)
    └── index.css             # Core CSS Variables & Reset
```

## 🛠️ Setup Instructions

### 1. Backend Setup (FastAPI)
```bash
cd backend
python -m venv venv
source venv/bin/activate       # On Linux/Mac
venv\Scripts\activate          # On Windows

# Install dependencies
pip install -r requirements.txt
pip install pandas reportlab

# Set up environment variables
cp .env.example .env
# Edit .env and add your GROQ_API_KEY

# Seed the database
python seed.py

# Run the API server
uvicorn main:app --reload
```

### 2. Frontend Setup (React/Vite)
```bash
cd neural-care-hub-main
npm install

# Setup environment details
echo "VITE_API_BASE_URL=http://localhost:8000" > .env.local
echo "VITE_WS_URL=ws://localhost:8000/ws/live-feed" >> .env.local

# Run the development server
npm run dev
```

## 🔌 API Endpoints
- **WebSocket:** `ws://localhost:8000/ws/live-feed` (Broadcasts live diagnostic sessions)

**REST APIs:**
- `GET /api/dashboard/stats` - High-level metrics for dashboard cards and charts
- `GET /api/dashboard/recent-sessions` - Pagination for sessions table
- `POST /api/voice/diagnose` - Triggers Voice Agent Analysis
- `POST /api/imaging/analyze` - Triggers Vision Agent Analysis
- `POST /api/ocr/analyze-report` - Triggers clinical OCR Agent Analysis
- `GET /api/patients/` - Fetch registered patients list
- `GET /api/appointments/` - Fetch global appointments list
- `GET /api/sessions/{id}` - Fetch unified details for a single diagnosis session
- `GET /api/sessions/{id}/export-pdf` - Returns a dynamically generated PDF report string

## 🎨 UI/UX Features
- **Dynamic CSS Variables Theme:** Dark mode first with cyan and green futuristic aesthetics.
- **Micro-Animations:** Fluid CSS transitions, hover interactions, state loaders and Framer Motion layouts.
- **Custom Hardware Cursor:** Overridden pointer with jitter-free tracking and interactive pulsing.
- **Fully Responsive:** Gracefully scales gracefully on Desktop, Tablet, and Mobile displays with an interactive burger menu on small sizes.
