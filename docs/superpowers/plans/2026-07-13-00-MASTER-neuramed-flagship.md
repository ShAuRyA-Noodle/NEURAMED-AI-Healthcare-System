# NEURAMED — Flagship Transformation Master Plan

> **This is the master plan.** Each phase has its own detailed, executable plan document. This file holds the audit findings, architecture decisions, verified tech stack, and the phase map. Read this first; execute from the phase plans.

**Goal:** Transform NEURAMED from a demo with real parts and theatrical parts into a genuinely real, end-to-end, mobile-first flagship clinical AI platform — where every feature performs real inference against real data sources, nothing is fabricated, and failure is always honest.

**Target:** Flagship portfolio/demo. Real end-to-end, hardened, responsive. Synthetic seed patients (no real PHI), no formal HIPAA certification — but built to a real-product security bar.

**Hard constraint:** **ZERO COST.** Free-tier APIs and open-weight models only. No paid clinical models, no DrugBank license, no paid inference.

**Execution order (user-directed):** Foundation → Real → UX → Security.

---

## Part 1 — Audit Findings (what we're actually working with)

Four independent deep-audit engines swept the codebase. Consolidated verdict:

### 1.1 Feature reality matrix

| Feature | Verdict | Evidence |
|---|---|---|
| **Voice diagnosis** | **REAL** | Genuine Groq LLM call, genuine STT (ElevenLabs `scribe_v1` / Google), serious clinical prompt with ICD-10 + urgency triggers. `backend/agents/voice_agent.py:196-234` |
| **OCR reports** | **REAL** | Genuine 3-tier extraction (PyMuPDF text layer → Groq Vision OCR → Tesseract), raises `ValueError` on empty rather than fabricating. Best pipeline in the repo. `backend/utils/ocr_engine.py:23-49`, `backend/agents/ocr_agent.py:167-173` |
| **Imaging / X-ray** | **HALF-REAL** | Real vision-LLM diagnosis, BUT: OpenCV "anomaly detection" is cosmetic (detects round bright blobs via `0.4 < circularity < 0.95 and mean_intensity > 140`, `imaging_agent.py:427`); mm measurements are **fabricated** from a hardcoded 350mm field-of-view (`imaging_agent.py:407`); `overall_confidence` is **seeded from blob geometry**, not the model (`imaging_agent.py:483`). Two of three vision model IDs are deprecated on Groq. |
| **Drug interactions** | **HALF-REAL** | No interaction database at all. Single Groq call whose "pharmacology" is a **static cheat-sheet baked into the prompt** (`drug_interactions.py:75-116`). RxNorm `rxcui` is fetched then **discarded** — `normalized_name` is always the raw input (`drug_interactions.py:51`). |
| **Second opinion** | **THEATER** | Not an ensemble. **Same model, 3 personas** (`second_opinion.py:69-104`). "Synthesis" is **hardcoded template strings** (`_build_synthesis`, `:148-154`). Consensus = exact string-set intersection on free text (`:128`) → always empty. |
| **Sarvam vernacular voice** | **MISLABELED** | Groq wearing a Sarvam label. Real Sarvam only reachable via **local Ollama** (`sarvam.py:166-202`) — never runs in deployment. **No server-side STT at all** — the endpoint takes `transcript: str` (`sarvam.py:58`). Ollama fallback hardcodes `urgency: "medium"` and emits a literal `"[Response in {lang}]"` placeholder (`:190-198`). |
| **Appointments** | REAL, no AI | Plain SQLAlchemy CRUD. No conflict detection, no availability logic. `location`/`duration_minutes` accepted but unused. |

### 1.2 The root rot — `_fallback()`

`backend/utils/llm.py:53-190` is the single most dangerous thing in the codebase.

On **any** LLM failure (missing key, rate limit, network), it returns a **schema-complete, plausible-looking clinical object**:

```python
# llm.py:59-62 — what a dead API key produces
"overall_confidence": 0.5,
"confidence": 0.5,
"urgency": "medium",
"urgency_reasoning": "Unable to assess — AI unavailable",
```

The caller cannot distinguish *"the AI assessed this as medium urgency"* from *"the AI never ran."* These values are written to `DiagnosisSession`, rendered in the PDF as a formal "NEURAMED CLINICAL REPORT", and **broadcast over WebSocket to every connected dashboard** as a live diagnosis event (`voice.py:37-44`).

Worst instance — `second_opinion`: on fallback all three personas return `primary_diagnosis: "AI unavailable"`, which are then all "in agreement" → `consensus_level = "full"` → `_build_synthesis` prints:

> *"All three physicians agree… Confidence is high. Proceed with recommended workup."*

**A dead API key produces a confident unanimous recommendation to proceed.** This is the defect that defines the whole project's honesty problem.

### 1.3 Fabricated numbers inventory

Every one of these is presented to the user as a real measurement:

| What | Where | Truth |
|---|---|---|
| Region size `~{n}mm` | `imaging_agent.py:407,440-452` | Hardcoded `350.0 / img_width` FOV. **Invented.** No DICOM spacing. |
| Imaging `overall_confidence` | `imaging_agent.py:483` | Seeded from OpenCV blob geometry (`circularity*0.5 + intensity/255*0.5`), only `max()`-raised by the LLM. **Not model confidence.** |
| OCR `confidence` | `ocr_agent.py:225-227` | Heuristic: `0.85 if method in (pymupdf, groq_vision) else 0.6`. **Not model confidence.** |
| OCR broadcast confidence | `ocr.py:36` | Hardcoded `1.0`. |
| `system_health` telemetry | `dashboard.py:108-114` | Hardcoded: `api_latency_ms: 42`, `model_uptime_pct: 99.98`, `gpu_utilization_pct: 45`, `memory_pct: 62`. **Pure fiction.** |
| Agent `accuracy` | `dashboard.py:82` | `min(99, avg_conf * 1.05)` — an invented "accuracy" derived from confidence. |
| "SYSTEM ONLINE" badge | `DashboardPage.tsx:245` | Hardcoded string, no health check behind it. |
| "LIVE" pill | `TopBar.tsx:228-242` | Decorative animation, not bound to any signal. |
| Notification bell red dot | `TopBar.tsx:218-225` | Permanent, no data source, no `onClick`. |

### 1.4 Dead code inventory

**Backend:** `utils/auth.py:51 get_current_user()` (never called), `routers/auth.py:101 logout()` (no-op stub, no revocation), `main.py:84-86 startup_event()` (empty `pass`), `sarvam.py:329-347 _parse_json_safely()` (never called), `fix_imports.py` (one-off dev script with hardcoded Windows path), `db/schemas.py:305 TokenData` + `ScanResultCreate`/`ReportCreate`/`DiagnosisSessionCreate` (no consumers).

**Frontend:** `hooks/useVoice.ts`, `hooks/useImaging.ts`, `hooks/useOCR.ts` (thin duplicates, never imported — `useVoice.ts` even **name-collides** with the canonical `useVoiceDiagnosis`); the dead shadcn toast trio (`hooks/use-toast.ts` + `ui/use-toast.ts` + `ui/toaster.tsx` — `<Toaster/>` is never mounted); `data/fallback.ts` (synthetic dashboard stats — **not wired**, safe delete); `components/CustomCursor.tsx` (root dup of `cursor/CustomCursor.tsx`); `components/NavLink.tsx`; `hooks/useActivityFeed.ts` + `api/dashboard.ts:7 getActivityFeed`; `hooks/useSessions.ts` (all 3 exports unused — pages reimplement inline); `App.css` (Vite boilerplate); ~45 unused `ui/*` shadcn files (no page imports any of them); 3 unused font families render-blocking in `index.html:11`.

**Unused API exports:** `getVoiceSessions`, `getScans`, `getReports`, `getPatient`, `getUpcomingAppointments`, `getTodayAppointments`, `sarvamTextDiagnose`, `getSarvamLanguages`, `timeline.ts:getSecondOpinion` (dup).

### 1.5 Broken wiring

- **WebSocket is a no-op.** `useLiveWebSocket` opens the socket, buffers events, auto-reconnects every 3s — and the Dashboard destructures only `isConnected`, then renders **neither** it nor `events` (`DashboardPage.tsx:173`). A permanent reconnecting socket whose entire payload is discarded.
- **`/patients/:id` renders the LIST**, not a detail page (`App.tsx:125`). The `getPatient`/`PatientDetail` machinery exists, unwired.
- **`/patients/:patientId/timeline` is orphaned** — a real, working page that nothing links to. Reachable only by typing the URL.
- **Doctor profile PATCH fails silently** — `await api.patch('/api/auth/profile', …)` inside a bare `catch {}` (`LoginPage.tsx:495-505`). A doctor's license can silently fail to save while registration "succeeds."
- **`.responsive-grid-4` is a phantom class** — referenced by the dashboard's loading skeletons (`DashboardPage.tsx:188-189`), **defined nowhere**. Skeletons render as stacked full-width blocks.

### 1.6 Design & mobile verdict — **5.5/10**

Striking on a 1440px monitor. Structurally broken everywhere else.

- **Mobile is broken by construction.** Nearly every layout uses **inline** `style={{ gridTemplateColumns: '5fr 7fr' }}` / `repeat(4, 1fr)` — inline styles, so **Tailwind responsive prefixes cannot reach them**. They never collapse. On a phone the voice/imaging/OCR workspace panels crush to ~150px side-by-side. (`VoicePage.tsx:330`, `OcrPage.tsx:240`, `ImagingPage.tsx:225`, `DashboardPage.tsx:337`, `SessionsPage.tsx:121`, `PatientsPage.tsx:104`, …)
- The dashboard's own KPI grids **do** use `repeat(auto-fill, minmax(...))` and reflow correctly — proof the author knows the pattern. It just wasn't applied anywhere else.
- **The shadcn HSL token bridge is BROKEN.** `tailwind.config.ts:16-59` maps `background`/`primary`/`muted`/`border`/`ring`/etc. to `hsl(var(--…))`, but **`index.css` defines none of those tokens**, and the ones it does define are the wrong type (`--border: rgba(...)`, `--foreground: var(--text)` → hex fed into `hsl()`). Result: `text-muted-foreground`, `bg-background`, `border-border`, `bg-primary` all produce **invalid colors** and are dropped by the browser. Two color systems now fight: pages use brand hex (`#00E5FF`), shared components use raw Tailwind palette (`cyan-500 #06b6d4`) — visibly different hues in the same table row.
- **3 cursor implementations, 1 dead, none touch-aware.** On phones the dot/ring initialize at screen center and, with no `mousemove`, render as **static cyan artifacts**. Global `* { cursor: none !important }` (`index.css:41`) nukes every affordance — no I-beam, no `not-allowed`, and if JS throws, no cursor at all.
- **LoginPage Three.js has NO mobile guard** — DNA helix + 500 particles + a **20-node O(n²) line rebuild every frame** (`LoginPage.tsx:398-408`), plus up to 2 more WebGL contexts from `RoleCard` mini-scenes. Up to 3 live contexts on a phone at the auth screen. (The other three scenes *do* guard correctly.)
- **Accessibility ≈ 0.** `--muted: #445566` on `--bg: #020608` ≈ **2.7:1** contrast (WCAG AA needs 4.5:1), used for most secondary text — much of it at 8–11px. No real `prefers-reduced-motion` (the only block targets a `.logo` that doesn't exist). Interactive rows/cards are `<div onClick>` with no `role`/`tabIndex`/`onKeyDown` → keyboard-unreachable, invisible to screen readers. Touch targets down to 28×28.
- **No typographic or spacing scale.** One-off magic numbers (8,9,10,11,12,13,14,15,16,18,22,28,30,32,42,52,64,72px), radii 6–24 with no discipline, cards re-implemented inline three different ways with three different hover mechanisms.

### 1.7 Security findings (deferred to Phase 4 by user decision — with one exception)

**EXCEPTION — do immediately, not in Phase 4:** Real Groq + ElevenLabs API keys are in **public git history** (`.env.example` in commits before `54e3f7d`). **Rotate both keys now.** Also `backend/neuramed.db.backup` (401KB, real password hashes + 50 patients' PHI) is **tracked at HEAD** — `.gitignore` covers `*.db` but not `*.db.backup`. Purged in Phase 1 (cheap).

Deferred to Phase 4:

| ID | Severity | Finding |
|---|---|---|
| C1 | **CRITICAL** | **Zero multi-tenancy.** No `WHERE owner_id` anywhere. Any registered user reads **every** patient's PHI by enumerating `patient_id 1..N`. `require_user` only proves *a* token exists. |
| C4 | **CRITICAL** | Default `SECRET_KEY` hardcoded in source (`utils/auth.py:13`); prod only `warnings.warn()`. Forge any JWT → become any doctor. |
| C5 | **CRITICAL** | Default doctor invite code in source (`NEURAMED-DOCTOR-2026`, `utils/auth.py:19`) → anyone self-grants the doctor role. |
| H1 | HIGH | `/uploads` mounted **public, unauthenticated** (`main.py:49`). Raw X-rays fetchable once a path leaks via the scans API. |
| H2 | HIGH | WebSocket unauthenticated (`main.py:71-78`); `broadcast()` sends every diagnosis (patient code + condition + urgency) to **all** clients. |
| H3 | HIGH | `allow_origins=["*"]` **with** `allow_credentials=True` (`main.py:37-46`). |
| H4/H5 | HIGH | No upload size/type limits (`await file.read()` unbounded) → memory DoS. No auth rate-limiting → brute force. |
| M1–M5 | MED | Logout is a no-op (30-day JWTs, no revocation); `detail=str(e)` leaks internals; unbounded `limit`/`offset`; `/docs` public; API-key prefix printed to stdout on boot. |

**Verified NOT vulnerable:** No SQL injection — every `.ilike(f"%{q}%")` passes the f-string as a **bound parameter**. No raw SQL anywhere. Password hashing is genuinely sound (PBKDF2-HMAC-SHA256, 260k iterations, per-user salt, constant-time compare).

---

## Part 2 — The Verified Free Stack (researched July 2026, all $0)

### What's DEAD (do not build on these)

- ☠️ **NLM / RxNav Drug Interaction API** — **discontinued 2 Jan 2024.** No replacement, no migration path.
- ☠️ **DrugBank free DDI Checker** — retiring ~25 Mar 2026.
- ⚠️ **DrugBank "Open Data" (CC0)** contains drug names/IDs only — **NO interactions.** A trap.
- ⚠️ **Sarvam AI API** — **no true free tier** (₹100 signup credit only, then pay-as-you-go). Do not architect on it.
- ⚠️ **Groq `llama-3.2-90b/11b-vision-preview`** — deprecated. Two of the three vision fallbacks in `imaging_agent.py` are already dead.

### What we build on

| Layer | Pick | License | Cost | Notes |
|---|---|---|---|---|
| **CXR classification** | **TorchXRayVision v1.5.2**, `densenet121-res224-all` | **Apache-2.0** | $0 | Maintained (released 2026-06-23). **18 real pathologies.** CPU-only fine (~8M params, few hundred ms, ~300–500MB RAM). |
| **DICOM** | **pydicom 3.x** + `pylibjpeg` plugins | MIT | $0 | Real pixel spacing, VOI LUT windowing, MONOCHROME1 inversion. |
| **DDI normalization** | **RxNorm + RxClass (RxNav)** | Public | $0, **no key** | 20 req/s. RxClass gives ATC/EPC/MoA → real **class-level** interaction rules. |
| **DDI evidence** | **openFDA `/drug/label.json` §7 `drug_interactions`** | **Public domain** | $0 (free key: 240/min, 120k/day) | Manufacturer-authored interaction prose for every FDA drug. **Citable to a real FDA label.** |
| **DDI severity** | **ONCHigh** (ONC high-priority DDI list, JAMIA expert panel, RxNorm-mapped) | Public | $0 | The expert-curated severity list. Was literally one of the two feeds behind the dead NLM API. |
| **DDI (optional)** | DDInter 2.0 — 302,516 DDIs / 2,310 drugs | ⚠️ **CC BY-NC** | $0 | Non-commercial only. **Fine for this portfolio project.** Mirror the download (their TLS cert was expired in July 2026). |
| **STT** | **Groq `whisper-large-v3`** | free tier | $0 | ~2,000 req/day, 7,200 audio-sec/hr, 25MB max. Real STT, zero infra. |
| **STT (offline)** | `faster-whisper` small/int8 | MIT | $0 | ~1.5–3× realtime on 4-core CPU. Privacy/offline path. |
| **Indic STT** | **`ai4bharat/indic-conformer-600m-multilingual`** | **MIT** | $0 | 22 Indian languages. **Far better than Whisper on Tamil/Telugu/Bengali.** |
| **Indic translate** | **`ai4bharat/indictrans2-indic-indic-dist-320M`** | **MIT** | $0 | 320M distilled = CPU-friendly. |
| **Indic TTS** | **`ai4bharat/indic-parler-tts`** | **Apache-2.0** | $0 | 21 languages, prompt-controllable voice. |
| **Ensemble** | **Gemini 2.5 Flash** + **Groq Llama-3.3-70B** + **OpenRouter DeepSeek-R1:free** | free tiers | $0 | **3 vendors, 3 model families, 3 separate rate-limit buckets.** Genuinely different pretraining + failure modes. |
| **Citations** | **Europe PMC REST** | free, **no key** | $0 | Best free citation source. Returns PMID/DOI/PMCID. |
| **ICD-10** | **NLM Clinical Table Search Service** | free, **no key** | $0 | Best free ICD-10-CM lookup. |
| **Patient-facing text** | **MedlinePlus Connect** | free, **no key** | $0 | Plain-language explanations keyed by ICD-10 or RxCUI. 100 req/min. |

**Total cost: ₹0 / $0.** Every component is free-tier or open-weights.

### New keys needed (all free signups)

| Key | Where | Why |
|---|---|---|
| `GEMINI_API_KEY` | aistudio.google.com | Ensemble member #2 |
| `OPENROUTER_API_KEY` | openrouter.ai | Ensemble member #3 (DeepSeek-R1) |
| `OPENFDA_API_KEY` | open.fda.gov/apis/authentication | 240/min instead of 240/min-1k/day |
| `GROQ_API_KEY` | **ROTATE — leaked in git history** | Primary LLM + Whisper STT |
| `ELEVENLABS_API_KEY` | **ROTATE — leaked in git history** | Optional; being superseded by Groq Whisper |

---

## Part 3 — The Three Honesty Laws

These are non-negotiable architectural invariants. Every phase enforces them. They are what make this project *actually* unique — most AI health demos fail all three.

### Law 1 — Fail loud, never fabricate

`_fallback()` dies. When inference fails, the API returns an explicit failure. It **never** returns a numeric confidence, an urgency, or a diagnosis.

Every result object carries provenance:

```json
{
  "status": "ok" | "degraded" | "unavailable",
  "provenance": {
    "source": "real_model" | "real_model_degraded" | "unavailable",
    "model": "densenet121-res224-all",
    "vendor": "torchxrayvision",
    "reason": null
  }
}
```

The frontend renders `unavailable` as an explicit "Analysis unavailable" state — never as a diagnosis.

### Law 2 — Never invent a number

- **No mm/cm measurements from PNG/JPG. Ever.** No pixel spacing → no physical measurement. Report `pixel_spacing_mm: null, measurements_enabled: false` and say why.
- Scale-invariant ratios (e.g. cardiothoracic ratio = cardiac width / thoracic width, both in px) **are** legitimate and dimensionless — report those, labeled as such.
- Confidence comes from the model that produced it. Not from blob geometry. Not from a heuristic. Not hardcoded.
- System telemetry is measured or absent. No `gpu_utilization: 45`.

### Law 3 — Cite or abstain

- Every drug interaction cites a real source (openFDA `setid` → DailyMed URL, or ONCHigh entry). **No hit → "No interaction found in the sources we checked"** + the list of sources checked. The LLM **explains** retrieved evidence; it never **invents** an interaction.
- Every literature citation is **verified to exist** in the retrieved set before display. LLMs fabricate PMIDs constantly; the check is cheap and mandatory.
- Ensemble **disagreement is the product.** Surface "2 of 3 models said X; the third said Y." Unanimity / majority / split are **distinct states**. A split lowers confidence — it is never averaged away. Models may **abstain**; a model forced to guess is worse than no model.

Plus a standing UI disclaimer: *"Absence of a warning does not mean absence of risk. Research tool. Not for clinical use."*

---

## Part 4 — Phase Map

Each phase ships working, testable software on its own. Detailed plan doc per phase.

### PHASE 1 — Foundation (`2026-07-13-01-foundation.md`) ← **detailed plan written, execute first**

Make the base solid and honest before adding anything.

1. **Test infrastructure** — pytest + httpx + fixtures for the backend (there are **zero** backend tests today); vitest already exists for the frontend. Every subsequent phase is TDD; this makes that possible.
2. **Kill `_fallback()`** → `InferenceUnavailable` exception + `provenance` envelope on every result. Law 1 goes in at the foundation, not bolted on later.
3. **Purge `neuramed.db.backup`** from git + fix `.gitignore` (`*.db*`, `*.backup`).
4. **Delete all dead code** — backend and frontend (§1.4). Reconcile the duplicate hook families.
5. **Delete the fabricated numbers** (§1.3) — hardcoded telemetry, invented accuracy, fake badges. Replace with real measurements or explicit absence.
6. **Postgres + Alembic** — SQLite on an ephemeral filesystem **loses all data on every redeploy**, and isn't safe under concurrent workers. No migrations exist at all (`Base.metadata.create_all` at import).
7. **Fix the `Patient` type contract** — the frontend's `PatientsPage` is entirely `any` and reads fields (`full_name`, `demographics`, `total_conditions_detected`) that aren't on the `Patient` interface. Generate types from the backend schema.
8. **Fix broken wiring** — `/patients/:id` detail route, the orphaned timeline route, the silent doctor-profile `catch {}`.

### PHASE 2 — Real (`2026-07-13-02-real.md`)

Every feature becomes genuinely real. Nothing is theater.

1. **Imaging → TorchXRayVision.** Real 18-pathology CXR classification with real probabilities. Real DICOM ingest via pydicom (pixel spacing, VOI LUT, MONOCHROME1). PNG/JPG path reports `measurements_enabled: false` and offers only dimensionless ratios. OpenCV demoted to an explicitly-labeled **visual overlay only** — it never touches `confidence_score` again. Vision-LLM writes the *narrative*, grounded in the classifier's *numbers*.
2. **Drug interactions → real RAG.** RxNorm normalize (actually **use** the rxcui) → local interaction table (openFDA SPL §7 + ONCHigh + RxClass class rules) → LLM explains **only retrieved evidence**, with a DailyMed citation per pair. No hit → honest "not found in sources checked."
3. **Second opinion → real ensemble.** Three vendors, three model families (Gemini Flash / Groq Llama-3.3-70B / OpenRouter DeepSeek-R1). Real embedding-based agreement, not string-set intersection. Real LLM synthesis, not template strings. **Dissent is surfaced.** Abstention allowed.
4. **Sarvam → real Indic voice.** Real server-side STT (IndicConformer for Indic, Groq Whisper for the rest) → IndicTrans2 to English → strongest free model reasons in English → IndicTrans2 back → Indic-Parler-TTS. Either it's really Sarvam-powered or the label goes.
5. **Voice → Groq Whisper.** Replace the unofficial `recognize_google` endpoint. Transcription failure raises — it is **never** fed to the diagnostic LLM as symptoms.
6. **Grounding layer (the differentiator).** Every differential gets a real ICD-10 code (NLM clinicaltables), real literature citations (Europe PMC, **PMID-verified**), and a real plain-language patient explainer (MedlinePlus).
7. **Appointments → real scheduling.** Conflict detection, availability windows. Use the `duration_minutes`/`location` fields that are currently accepted and ignored.

### PHASE 3 — UX (`2026-07-13-03-ux.md`)

Flagship-grade, mobile-first, accessible.

1. **One design system.** Fix the shadcn HSL token bridge **or** rip `ui/` out entirely (~45 unused files) and formalize the inline system into a real component library. Collapse to **one** color source of truth. Establish a real type scale, spacing scale, and radius scale.
2. **Responsive rebuild.** Kill every inline `gridTemplateColumns`. `minmax()` auto-fill + real breakpoints. Single-column forms under `sm`. Tables → card lists on mobile. Unify the 768px breakpoint (currently off-by-one between JS and CSS → at exactly 768px you get mobile chrome *and* desktop Three.js).
3. **One touch-aware cursor.** Delete the dead one, merge the other two, gate behind `matchMedia('(pointer:fine)')`, drop the global `cursor: none`.
4. **Motion discipline.** Real `prefers-reduced-motion` across Framer, CSS keyframes, Three.js, and count-ups. Mobile-guard the LoginPage WebGL (currently unguarded, up to 3 contexts on a phone). Fix the `useMiniScene` geometry/material leak.
5. **Accessibility to WCAG AA.** Lift `--muted`/`--dim` to ≥4.5:1. Convert div-buttons to real `<button>`. Keyboard nav, focus, `aria-label`, `aria-current`, 44px touch targets, associated form labels.
6. **Surface the real-time layer.** The WebSocket already broadcasts real events and the frontend already receives them and throws them away. Build the live activity ticker it was always meant to feed.
7. **The provenance UI.** This is the signature surface — every AI output shows *which model*, *what it was grounded in*, *how confident*, *where the models disagreed*, and *what the citation is*. No other portfolio health-AI project has this, because none of them have anything true to show.

### PHASE 4 — Security (`2026-07-13-04-security.md`)

Hardened to a real-product bar (minus formal HIPAA certification, per the portfolio target).

1. **C1 — Real multi-tenancy.** `Patient.owner_user_id` FK. Every read filtered by the caller. Doctors scoped to their patients, patients to their own record. This is the biggest single fix in the codebase.
2. **C4/C5 — Fail-closed config.** Hard-fail on startup if `SECRET_KEY` or `DOCTOR_INVITE_CODE` is unset/default in production. No defaults in source.
3. **H1 — Authorized file serving.** Unmount the public `/uploads`. Serve medical images through an ownership-checked endpoint.
4. **H2 — Authenticated WebSocket** + scoped broadcasts (no more every-diagnosis-to-every-client).
5. **H3/H4/H5** — CORS allowlist (never `*` with credentials), upload size/MIME limits, auth rate-limiting.
6. **M1–M5** — Short-lived JWT + refresh + revocation; generic 500s (stop leaking `str(e)`); clamp `limit`/`offset`; gate `/docs` in prod; stop printing the key prefix to stdout.
7. **Audit logging** — who accessed which patient record.

---

## Part 5 — What makes this actually novel

Most AI-health portfolio projects are a chat wrapper with a stethoscope icon. A few are honest wrappers. **None of them show their work.** After this transformation, NEURAMED's differentiator is not "it has three agents" — it's:

> **A clinical AI platform where every single output is traceable to a real model, a real data source, and a real citation — and where the system tells you, loudly, when it doesn't know.**

Concretely, the things no competitor demo has:
- A **real CXR classifier** (18 pathologies, Apache-2.0 weights) whose probabilities are the model's own — with the LLM writing narrative *around* real numbers instead of inventing them.
- A **real DDI engine** citing actual FDA labels, that says *"not found in the sources we checked"* instead of guessing.
- A **genuine 3-vendor ensemble** that **shows you where the models disagreed** instead of manufacturing consensus.
- **Verified PMID citations** — fabricated ones are dropped before display.
- **Zero fabricated numbers.** No fake mm. No fake GPU%. No fake uptime. When the AI is down, the UI says the AI is down.
- All of it, **end-to-end, for $0.**

---

## Part 6 — Immediate actions (before Phase 1 execution)

- [ ] **ROTATE `GROQ_API_KEY`** — leaked in git history (console.groq.com)
- [ ] **ROTATE `ELEVENLABS_API_KEY`** — leaked in git history (elevenlabs.io)
- [ ] Sign up (free, no card): `GEMINI_API_KEY` (aistudio.google.com), `OPENROUTER_API_KEY` (openrouter.ai), `OPENFDA_API_KEY` (open.fda.gov)

---

## Appendix — Sources for the free-stack research

[TorchXRayVision](https://github.com/mlmed/torchxrayvision) · [torchxrayvision PyPI](https://pypi.org/project/torchxrayvision/) · [pydicom pixel data](https://pydicom.github.io/pydicom/stable/guides/user/working_with_pixel_data.html) · [NLM DDI API discontinued](https://blog.drugbank.com/nih-discontinues-their-drug-interaction-api/) · [RxNorm API](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html) · [openFDA drug label API](https://open.fda.gov/apis/drug/label/) · [openFDA auth/limits](https://open.fda.gov/apis/authentication/) · [ONC high-priority DDIs (JAMIA)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3422823/) · [DDInter 2.0 (NAR)](https://academic.oup.com/nar/article/53/D1/D1356/7740584) · [Groq speech-to-text](https://console.groq.com/docs/speech-to-text) · [Groq rate limits](https://console.groq.com/docs/rate-limits) · [Sarvam pricing](https://docs.sarvam.ai/api-reference-docs/pricing) · [ai4bharat/indic-conformer-600m-multilingual](https://huggingface.co/ai4bharat/indic-conformer-600m-multilingual) · [IndicTrans2](https://github.com/AI4Bharat/IndicTrans2) · [ai4bharat/indic-parler-tts](https://huggingface.co/ai4bharat/indic-parler-tts) · [Gemini rate limits](https://ai.google.dev/gemini-api/docs/rate-limits) · [OpenRouter limits](https://openrouter.ai/docs/api/reference/limits) · [Europe PMC REST](https://europepmc.org/RestfulWebService) · [NLM Clinical Tables ICD-10-CM](https://clinicaltables.nlm.nih.gov/apidoc/icd10cm/v3/doc.html) · [MedlinePlus Connect](https://medlineplus.gov/medlineplus-connect/web-service/)
