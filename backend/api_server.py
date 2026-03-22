"""
API Server
==========
Lightweight FastAPI server that the Next.js frontend calls for:
  - GET /api/token              → LiveKit access token
  - GET /api/report/{patient_id}/latest  → latest prescription report JSON
  - GET /api/health             → health check

Run alongside the LiveKit worker:
    uvicorn api_server:app --port 8000 --reload
"""

import asyncio
import json
import os
import uuid
from pathlib import Path

from dotenv import load_dotenv
import tempfile

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from livekit import api as livekit_api

load_dotenv()

DATA_DIR = Path("data/conversations")

app = FastAPI(title="Clinical DSS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── LiveKit token ─────────────────────────────────────────────────────────────

@app.get("/api/token")
def get_token(patient_name: str = "", patient_id: str = ""):
    """
    Generate a LiveKit access token for the frontend patient participant.
    - patient_name: display name shown in the room (e.g. "Kesha")
    - patient_id:   used as identity + passed as job metadata to the agent
                    (auto-generated if omitted)
    """
    livekit_url = os.environ.get("LIVEKIT_URL", "")
    api_key = os.environ.get("LIVEKIT_API_KEY", "")
    api_secret = os.environ.get("LIVEKIT_API_SECRET", "")

    if not all([livekit_url, api_key, api_secret]):
        raise HTTPException(500, "LiveKit credentials not configured on server.")

    if not patient_id:
        patient_id = f"patient_{uuid.uuid4().hex[:8]}"

    room_name = f"consult_{patient_id}_{uuid.uuid4().hex[:6]}"

    token = (
        livekit_api.AccessToken(api_key, api_secret)
        .with_identity(patient_id)
        .with_name(patient_name or patient_id)
        .with_metadata(patient_id)   # agent reads this as ctx.job.metadata
        .with_grants(
            livekit_api.VideoGrants(
                room=room_name,
                room_join=True,
                can_publish=True,
                can_subscribe=True,
            )
        )
    )

    return {
        "token": token.to_jwt(),
        "room": room_name,
        "patient_id": patient_id,
        "livekit_url": livekit_url,
    }


# ── Report endpoints ──────────────────────────────────────────────────────────

@app.get("/api/report/{patient_id}/latest")
def get_latest_report(patient_id: str):
    """
    Return the most recently generated prescription report for this patient.
    Returns 202 while the report is still being generated.
    """
    patient_dir = DATA_DIR / patient_id
    if not patient_dir.exists():
        raise HTTPException(404, f"No data found for patient '{patient_id}'.")

    reports = sorted(patient_dir.glob("*_report.json"), reverse=True)
    if not reports:
        # Session exists but report not generated yet
        raise HTTPException(202, "Report is still being generated. Please wait.")

    with open(reports[0]) as f:
        return json.load(f)


@app.post("/api/report/{patient_id}/{session_id}/regenerate")
async def regenerate_report(patient_id: str, session_id: str):
    """
    Re-run the report generator for a specific session and return the fresh report.
    Useful when a previous session produced an empty/corrupt report.
    """
    from report_generator import generate_report  # local import to avoid startup cost

    session_path = DATA_DIR / patient_id / f"{session_id}.json"
    if not session_path.exists():
        raise HTTPException(404, f"Session '{session_id}' not found for patient '{patient_id}'.")

    try:
        report = await asyncio.get_event_loop().run_in_executor(
            None, generate_report, str(session_path)
        )
    except Exception as exc:
        raise HTTPException(500, f"Report generation failed: {exc}") from exc

    if report is None:
        raise HTTPException(500, "Report generator returned no output.")

    return report


@app.get("/api/sessions/{patient_id}")
def list_sessions(patient_id: str):
    """List all session IDs for a patient."""
    patient_dir = DATA_DIR / patient_id
    if not patient_dir.exists():
        return {"sessions": []}
    sessions = [
        p.stem for p in sorted(patient_dir.glob("*.json"))
        if not p.name.endswith("_report.json")
    ]
    return {"patient_id": patient_id, "sessions": sessions}


# ── X-Ray analysis ────────────────────────────────────────────────────────────

# Lazy singleton — avoids re-instantiating on every request
_xray_agent = None

def _get_xray_agent():
    global _xray_agent
    if _xray_agent is None:
        from agents.xray_agent import XRayAgent
        _xray_agent = XRayAgent()
    return _xray_agent


@app.post("/api/xray/analyze")
async def analyze_xray(file: UploadFile = File(...)):
    """
    Accept an X-ray image (Chest, MSK, Spine, Pelvis, etc.) and return a 
    structured radiology report generated by Groq Vision (Llama 4 Scout).
    """
    allowed = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
    content_type = (file.content_type or "").lower()
    if content_type not in allowed:
        raise HTTPException(
            400,
            f"Unsupported file type '{content_type}'. Upload JPEG, PNG, or WebP.",
        )

    # Write upload to a temp file (Groq needs a path, not a stream)
    suffix = Path(file.filename or "xray.jpg").suffix or ".jpg"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        agent = _get_xray_agent()
        report = await asyncio.get_event_loop().run_in_executor(
            None, agent.analyze_xray, tmp_path
        )
        return report
    except Exception as exc:
        raise HTTPException(500, f"X-ray analysis failed: {exc}") from exc
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
