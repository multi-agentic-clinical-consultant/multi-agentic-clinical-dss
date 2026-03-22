# Multi-Agentic Clinical Decision Support System

A full-stack, AI-powered Clinical Decision Support System built on a **Multi-Agent Orchestration** architecture. The system combines real-time voice consultation, multimodal X-ray analysis, autonomous prescription generation, and persistent patient memory into a unified clinical workflow.

---

## Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend                         │
│  Patient Intake → Voice Consultation → X-Ray Analyzer →        │
│  Clinical Output → Prescription Report                         │
└────────────────────────┬────────────────────────────────────────┘
                         │ REST + LiveKit WebRTC
┌────────────────────────▼────────────────────────────────────────┐
│                    FastAPI Backend (api_server.py)               │
│                                                                  │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │  Voice Agent    │  │   X-Ray Agent    │  │   LangGraph   │  │
│  │  (agent.py)     │  │  (xray_agent.py) │  │   Pipeline    │  │
│  │                 │  │                  │  │               │  │
│  │ STT: Deepgram   │  │ VLM: Llama-4     │  │ Prescription  │  │
│  │ LLM: Groq       │  │ Scout (Groq)     │  │ + SOAP Note   │  │
│  │ TTS: Deepgram   │  │                  │  │               │  │
│  │ VAD: Silero     │  │ General X-Ray:   │  │               │  │
│  │ RAG: Moss       │  │ chest, ortho,    │  │               │  │
│  └─────────────────┘  │ spine, skull     │  └───────────────┘  │
│                        └──────────────────┘                     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Persistent Storage: JSON sessions per patient           │   │
│  │  (backend/data/conversations/<patient_id>/)              │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Features

### Real-Time Voice Consultation

- **LiveKit WebRTC** for low-latency, bidirectional voice communication
- **Deepgram nova-2** STT — medical-grade transcription
- **Groq `llama-3.3-70b-versatile`** as the conversational LLM (OpenAI-compatible endpoint via `livekit-plugins-openai`)
- **Deepgram Aura** TTS (or **ElevenLabs** if `ELEVENLABS_API_KEY` is set)
- **Silero VAD** — voice activity detection to avoid false triggers

### AI Doctor Agent (Dr. Arthur)

- Warm, conversational persona — asks one follow-up question at a time, avoids clinical jargon
- Per-session **patient history** via `search_patient_history` tool call at every turn
- **Moss semantic RAG** over medical PDFs for evidence-based answers (optional)
- **SOAP note generation** and **prescription pipeline** triggered automatically on session end
- Session transcripts and reports saved to `backend/data/conversations/<patient_id>/`

### Multimodal X-Ray Analysis

- Upload any X-ray image (chest, orthopedic, spine, pelvis, skull, abdomen)
- Powered by **Groq `meta-llama/llama-4-scout-17b-16e-instruct`** (vision LLM)
- **3-phase Chain-of-Thought** prompt:
  1. **Identification** — body part, projection (AP/Lateral/Oblique), image quality
  2. **Systematic Review** — bones, joints, soft tissues, additional structures
  3. **Targeted Fracture/Dislocation Search** — cortical breaks, lucent lines, avulsion sites, joint congruity
- Structured JSON output with dynamic findings, `fractures[]`, `dislocations[]`, `alignment`, `impression`, `recommendations`
- Supports **subtle fractures** (scaphoid, tibial plateau, compression fractures, buckle/torus deformities)
- Frontend renders findings dynamically — adapts to any X-ray type without hardcoded fields

### Prescription & SOAP Pipeline (LangGraph)

- Runs asynchronously in the background after the voice session ends
- **Prescription Agent** — drug lookup via RxNorm API, FDA safety search via DuckDuckGo
- **SOAP Note Agent** — structures the session into Subjective / Objective / Assessment / Plan
- Report saved as `<session_id>_report.json` alongside the conversation file

### Fine-Tuned Local LLM (Optional / Disabled by Default)

- `backend/local_llm_server.py` — OpenAI-compatible FastAPI server wrapping **Qwen3-4B + `KingLLM/medical-finetuned`** LoRA adapters
- True streaming via `TextIteratorStreamer` with PEEK_TOKENS tool-call detection
- SSE keep-alive comments prevent LiveKit read-timeout during buffered tool calls
- Disabled by default in `agent.py` (commented out); set `LOCAL_LLM_URL` and uncomment to enable

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui |
| Voice Transport | LiveKit WebRTC |
| STT | Deepgram nova-2 |
| LLM (voice) | Groq `llama-3.3-70b-versatile` |
| VLM (X-ray) | Groq `meta-llama/llama-4-scout-17b-16e-instruct` |
| TTS | Deepgram Aura / ElevenLabs (optional) |
| VAD | Silero |
| RAG | Moss (inferedge-moss) |
| Orchestration | LangGraph + LangChain Core |
| Backend API | FastAPI + Uvicorn |
| Storage | JSON files (per-patient sessions) |
| Local LLM | Qwen3-4B + KingLLM/medical-finetuned LoRA (optional) |

---

## Getting Started

### Prerequisites

- Python 3.10+ (tested on 3.11)
- Node.js 18+ and pnpm
- [FFmpeg](https://ffmpeg.org/) in PATH (required for LiveKit audio processing)

### 1. Backend Setup

```bash
cd multi-agentic-clinical-dss/backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```env
# LiveKit
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# Groq (LLM + VLM)
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile        # optional, this is the default

# Deepgram (STT + TTS)
DEEPGRAM_API_KEY=your_deepgram_api_key

# ElevenLabs (optional — higher-quality TTS)
# ELEVENLABS_API_KEY=your_elevenlabs_api_key
# ELEVENLABS_VOICE_ID=JBFqnCBsd6RMkjVDRZzb

# Moss RAG (optional — medical knowledge search)
# MOSS_PROJECT_ID=your_moss_project_id
# MOSS_PROJECT_KEY=your_moss_project_key
# MOSS_INDEX_NAME=medical_knowledge
```

### 3. Run the Backend

```bash
# Terminal 1 — FastAPI server (X-ray analysis + session API)
cd backend
uvicorn api_server:app --reload --port 8000

# Terminal 2 — LiveKit voice agent
cd backend
python agent.py dev
```

### 4. Frontend Setup

```bash
cd frontend
pnpm install
cp .env.local.example .env.local
# Fill in NEXT_PUBLIC_LIVEKIT_URL and your backend URL
pnpm dev
```

Frontend runs at `http://localhost:3000`.

---

## Project Structure

```text
multi-agentic-clinical-dss/
├── backend/
│   ├── agent.py                   # LiveKit voice agent (Dr. Arthur)
│   ├── api_server.py              # FastAPI REST API
│   ├── local_llm_server.py        # OpenAI-compatible server for local fine-tuned model
│   ├── conversation_store.py      # Session persistence (JSON files)
│   ├── report_generator.py        # Post-session report builder
│   ├── main.py                    # Entrypoint / app factory
│   ├── requirements.txt
│   ├── .env.example
│   ├── agents/
│   │   ├── xray_agent.py          # Multimodal X-ray analysis (Groq VLM)
│   │   └── prescription_agent.py  # Drug lookup + safety checks
│   ├── graph/
│   │   ├── workflow.py            # LangGraph pipeline definition
│   │   └── state.py               # LangGraph shared state
│   └── data/
│       └── conversations/         # Per-patient session JSON files
│           └── <patient_id>/
│               ├── session_<id>.json
│               └── session_<id>_report.json
├── frontend/
│   ├── app/                       # Next.js App Router pages
│   ├── components/
│   │   ├── patient-intake-form.tsx
│   │   ├── consultation-room.tsx  # Live voice UI
│   │   ├── xray-analyzer.tsx      # X-ray upload + results display
│   │   ├── clinical-output.tsx    # Session summary view
│   │   └── prescription-report.tsx
│   ├── lib/
│   │   ├── api.ts                 # Backend API client
│   │   └── types.ts               # Shared TypeScript types
│   └── hooks/
└── README.md
```

---

## X-Ray Analysis — Supported Finding Types

The X-ray agent produces a structured JSON report. Findings adapt dynamically based on the detected X-ray type:

| Field | Description |
| --- | --- |
| `xray_type` | Detected body part and projection (e.g., "Right Knee AP + Lateral") |
| `findings` | Dynamic key-value pairs appropriate for the X-ray type |
| `fractures[]` | Array of fracture objects: `location`, `type`, `displacement`, `open_or_closed` |
| `dislocations[]` | Array of dislocation objects: `joint`, `direction`, `associated_fracture` |
| `alignment` | Overall bone/joint alignment assessment |
| `impression` | Summary diagnosis |
| `recommendations` | Follow-up imaging or clinical steps |
| `confidence_level` | `low` / `moderate` / `high` |

---

## Local Fine-Tuned LLM (Optional)

To run the medical fine-tuned model locally instead of Groq:

```bash
# Install extra deps
pip install transformers torch accelerate peft fastapi uvicorn

# Start the local server (downloads ~8 GB base model on first run)
python backend/local_llm_server.py
```

Then in `backend/agent.py`, uncomment the local LLM block and set:

```env
LOCAL_LLM_URL=http://localhost:8001
LOCAL_LLM_MODEL=medical-finetuned
```

**Model**: `Qwen/Qwen3-4B` base + `KingLLM/medical-finetuned` LoRA adapters, merged at startup.

**Device**: Apple Silicon (MPS) → CUDA → CPU fallback.
