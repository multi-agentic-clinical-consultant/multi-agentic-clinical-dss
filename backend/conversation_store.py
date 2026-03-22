"""
Conversation Store
==================
Manages patient conversation sessions as JSON files.

Directory layout:
    data/conversations/{patient_id}/{session_id}.json

Session JSON schema:
{
    "patient_id":          str,
    "session_id":          str,
    "start_time":          ISO-8601,
    "end_time":            ISO-8601 | null,
    "messages": [
        { "role": "user"|"assistant", "content": str, "timestamp": ISO-8601 }
    ],
    "prescription_report": {
        "diagnosis":    str,
        "confidence":   float,
        "prescription": { ... },   # from PrescriptionAgent
        "soap_note":    { ... },   # from TranscriptionAgent
        "generated_at": ISO-8601
    } | null
}
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional


class ConversationStore:
    def __init__(self, data_dir: str = "data/conversations") -> None:
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _patient_dir(self, patient_id: str) -> Path:
        p = self.data_dir / patient_id
        p.mkdir(parents=True, exist_ok=True)
        return p

    def _session_path(self, patient_id: str, session_id: str) -> Path:
        return self._patient_dir(patient_id) / f"{session_id}.json"

    def _load(self, path: Path) -> Optional[dict]:
        if not path.exists():
            return None
        with open(path) as f:
            return json.load(f)

    def _save(self, path: Path, data: dict) -> None:
        with open(path, "w") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    # ── Session lifecycle ─────────────────────────────────────────────────────

    def create_session(self, patient_id: str, session_id: str) -> dict:
        """Create a new empty session file and return the session dict."""
        session = {
            "patient_id": patient_id,
            "session_id": session_id,
            "start_time": datetime.now(timezone.utc).isoformat(),
            "end_time": None,
            "messages": [],
            "prescription_report": None,
        }
        self._save(self._session_path(patient_id, session_id), session)
        return session

    def get_session(self, patient_id: str, session_id: str) -> Optional[dict]:
        """Load and return a session dict, or None if not found."""
        return self._load(self._session_path(patient_id, session_id))

    def end_session(self, patient_id: str, session_id: str) -> None:
        """Stamp end_time on the session."""
        path = self._session_path(patient_id, session_id)
        session = self._load(path)
        if session is None:
            return
        session["end_time"] = datetime.now(timezone.utc).isoformat()
        self._save(path, session)

    # ── Message operations ────────────────────────────────────────────────────

    def add_message(
        self,
        patient_id: str,
        session_id: str,
        role: str,
        content: str,
    ) -> None:
        """Append a single message to the session (live, call-by-call)."""
        path = self._session_path(patient_id, session_id)
        session = self._load(path)
        if session is None:
            return
        session["messages"].append(
            {
                "role": role,
                "content": content,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        )
        self._save(path, session)

    def save_messages(
        self,
        patient_id: str,
        session_id: str,
        messages: list[dict],
    ) -> None:
        """Replace the entire messages list (used at session end)."""
        path = self._session_path(patient_id, session_id)
        session = self._load(path)
        if session is None:
            return
        session["messages"] = messages
        self._save(path, session)

    # ── Prescription ──────────────────────────────────────────────────────────

    def save_prescription(
        self,
        patient_id: str,
        session_id: str,
        prescription_report: dict,
    ) -> None:
        """Save the background prescription report into the session JSON."""
        path = self._session_path(patient_id, session_id)
        session = self._load(path)
        if session is None:
            return
        session["prescription_report"] = prescription_report
        self._save(path, session)

    # ── Listing ───────────────────────────────────────────────────────────────

    def list_sessions(self, patient_id: str) -> list[dict]:
        """Return all sessions for a patient, sorted by start time."""
        patient_dir = self.data_dir / patient_id
        if not patient_dir.exists():
            return []
        sessions = []
        for p in sorted(patient_dir.glob("*.json")):
            data = self._load(p)
            if data:
                sessions.append(data)
        return sessions

    def list_patients(self) -> list[str]:
        """Return all patient IDs that have sessions stored."""
        return [d.name for d in sorted(self.data_dir.iterdir()) if d.is_dir()]
