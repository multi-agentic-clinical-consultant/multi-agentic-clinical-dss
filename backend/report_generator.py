"""
Prescription Report Generator
==============================
Takes a completed session JSON file and produces a rich, structured
prescription report in JSON format.

The LLM acts as a compounder / doctor's assistant:
  - Extracts patient info, diagnosis, and original prescription from the transcript
  - NEVER alters the original prescription
  - Freely adds medical guidance: dos, don'ts, diet, precautions, emergency signs

Usage (CLI):
    python report_generator.py data/conversations/patient_xxx/session_yyy.json

    # Auto-discover and process all sessions without a report:
    python report_generator.py --all

Usage (as module):
    from report_generator import generate_report
    report = generate_report("path/to/session.json")
"""

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv
from groq import Groq

load_dotenv()

DOCTOR_NAME = "Dr. Aria"
MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# ── Report schema (returned by the LLM) ──────────────────────────────────────
REPORT_SCHEMA = """{
  "patient_name": "Full name extracted from conversation, or 'Unknown' if not mentioned",
  "chief_complaint": "One-sentence summary of what the patient came in for",
  "symptoms": ["list", "of", "symptoms", "mentioned"],
  "diagnosis": "Doctor's working diagnosis from the conversation",
  "prescription": [
    {
      "medicine_name": "Exact name as prescribed",
      "dosage": "Exact dosage as prescribed",
      "frequency": "How often to take",
      "duration": "How long to take",
      "route": "oral / topical / nasal / etc.",
      "special_instructions": "Any specific instructions mentioned"
    }
  ],
  "dos": [
    "Actionable things the patient SHOULD do (rest, hydrate, etc.)"
  ],
  "donts": [
    "Things the patient must AVOID (alcohol, certain foods, activities)"
  ],
  "diet_recommendations": [
    "Specific dietary advice relevant to the condition and medicines"
  ],
  "precautions": [
    "General precautions while on this medication / condition"
  ],
  "emergency_signs": [
    "Warning symptoms that require immediate emergency care"
  ],
  "follow_up": "When and why the patient should follow up",
  "additional_notes": "Any other clinically relevant remarks from the compounder"
}"""


def _build_transcript(messages: list[dict]) -> str:
    """Merge fragmented messages into a clean transcript."""
    lines = []
    for m in messages:
        role = m.get("role", "").upper()
        content = (m.get("content") or "").strip()
        if content:
            lines.append(f"{role}: {content}")
    return "\n".join(lines)


def _extract_original_prescription(session: dict) -> str:
    """
    Pull the original prescription text from prescription_report (if available).
    This is passed verbatim to the LLM so it cannot change it.
    """
    report = session.get("prescription_report")
    if not report:
        return ""

    prescription = report.get("prescription", {})
    if not prescription:
        return ""

    medications = prescription.get("medications", [])
    if not medications:
        return ""

    lines = ["ORIGINAL PRESCRIPTION (do not alter):"]
    for med in medications:
        name = med.get("name", "")
        dosage = med.get("dosage", "")
        instructions = med.get("instructions", "")
        line = f"  - {name}"
        if dosage:
            line += f", {dosage}"
        if instructions:
            line += f" — {instructions}"
        lines.append(line)

    treatment = prescription.get("treatment_plan", "")
    if treatment:
        lines.append(f"  Treatment plan: {treatment}")

    interaction = prescription.get("drug_interaction_check", "")
    if interaction:
        lines.append(f"  Interaction note: {interaction}")

    referral = report.get("referral", {})
    follow_up = referral.get("follow_up_plan", "")
    if follow_up:
        lines.append(f"  Follow-up: {follow_up}")

    return "\n".join(lines)


def _build_prompt(transcript: str, original_prescription: str) -> str:
    has_prescription = bool(original_prescription.strip())

    prescription_block = (
        f"""
ORIGINAL VERIFIED PRESCRIPTION
-------------------------------
{original_prescription}

IMPORTANT: Copy the prescription medicines from above into the \"prescription\" field of the JSON
EXACTLY as listed. Do NOT modify names, dosages, or instructions.
"""
        if has_prescription
        else """
No pre-validated prescription was provided. Extract medication details
directly from the DOCTOR's dialogue in the transcript.
"""
    )

    return f"""You are a senior compounder and doctor's assistant at a busy clinic.
A voice consultation just ended. Below is the full transcript, and (if available)
the doctor's verified prescription.

Your job:
1. Read the transcript carefully.
2. Fill in the JSON report schema below.
3. For the "prescription" field — copy it exactly from the ORIGINAL VERIFIED PRESCRIPTION
   if one is provided; otherwise extract it from the doctor's dialogue.
4. For dos, don'ts, diet, precautions, emergency_signs — you have FULL medical freedom
   to provide thorough, clinically sound advice based on the diagnosis and medicines.
   These fields are YOUR contribution as a knowledgeable compounder.
5. Speak like a caring, precise medical professional. No fluff.

CONSULTATION TRANSCRIPT
-----------------------
{transcript}
{prescription_block}
REPORT SCHEMA — return ONLY valid JSON matching this structure exactly:
{REPORT_SCHEMA}

Rules:
- Output ONLY the JSON object. No markdown, no explanation, no preamble.
- All list fields must be actual arrays, even if only one item.
- If you cannot determine a value, use a clear placeholder like "Not mentioned".
- Do NOT invent patient details not present in the transcript.
- emergency_signs must always contain at least 2 relevant red-flag symptoms for the condition.
"""


def _call_llm(prompt: str) -> dict:
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    response = client.chat.completions.create(
        model=MODEL,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a meticulous medical compounder producing structured prescription "
                    "reports. You always output strictly valid JSON with no extra text."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
    )

    raw = response.choices[0].message.content.strip()

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
        if raw.endswith("```"):
            raw = raw[:-3].strip()

    return json.loads(raw)


def _duration_str(start: str, end: str) -> str:
    try:
        s = datetime.fromisoformat(start)
        e = datetime.fromisoformat(end)
        secs = int((e - s).total_seconds())
        mins, seconds = divmod(secs, 60)
        return f"{mins}m {seconds}s"
    except Exception:
        return "Unknown"


def generate_report(session_path: str | Path) -> dict:
    """
    Generate a prescription report from a session JSON file.
    Returns the report dict and also writes it alongside the session file
    as `{session_id}_report.json`.
    """
    session_path = Path(session_path)
    if not session_path.exists():
        raise FileNotFoundError(f"Session file not found: {session_path}")

    with open(session_path) as f:
        session = json.load(f)

    messages = session.get("messages", [])
    if not messages:
        raise ValueError("Session has no messages — cannot generate report.")

    patient_id = session.get("patient_id", "unknown")
    session_id = session.get("session_id", "unknown")
    start_time = session.get("start_time", "")
    end_time = session.get("end_time", "")

    transcript = _build_transcript(messages)
    original_prescription = _extract_original_prescription(session)

    prompt = _build_prompt(transcript, original_prescription)
    llm_data = _call_llm(prompt)

    # ── Assemble the final report ─────────────────────────────────────────────
    report = {
        "report_id": f"RPT-{uuid.uuid4().hex[:10].upper()}",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "doctor_name": DOCTOR_NAME,
        "patient_id": patient_id,
        "session_id": session_id,
        "consultation_date": start_time[:10] if start_time else "Unknown",
        "consultation_start": start_time,
        "consultation_end": end_time,
        "consultation_duration": _duration_str(start_time, end_time),

        # ── LLM-extracted / LLM-generated fields ─────────────────────────────
        "patient_name": llm_data.get("patient_name", patient_id),
        "chief_complaint": llm_data.get("chief_complaint", ""),
        "symptoms": llm_data.get("symptoms", []),
        "diagnosis": llm_data.get("diagnosis", ""),
        "prescription": llm_data.get("prescription", []),

        # ── Compounder's additions ────────────────────────────────────────────
        "dos": llm_data.get("dos", []),
        "donts": llm_data.get("donts", []),
        "diet_recommendations": llm_data.get("diet_recommendations", []),
        "precautions": llm_data.get("precautions", []),
        "emergency_signs": llm_data.get("emergency_signs", []),
        "follow_up": llm_data.get("follow_up", ""),
        "additional_notes": llm_data.get("additional_notes", ""),
    }

    # ── Write report file ─────────────────────────────────────────────────────
    report_path = session_path.parent / f"{session_id}_report.json"
    with open(report_path, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"[report_generator] Report saved → {report_path}")
    return report


# ── CLI ───────────────────────────────────────────────────────────────────────

def _process_all(data_dir: str = "data/conversations") -> None:
    base = Path(data_dir)
    if not base.exists():
        print(f"Data directory not found: {base}")
        sys.exit(1)

    session_files = [
        p for p in base.rglob("*.json")
        if not p.name.endswith("_report.json")
    ]

    if not session_files:
        print("No session files found.")
        return

    for path in sorted(session_files):
        report_path = path.parent / f"{path.stem}_report.json"
        if report_path.exists():
            print(f"[skip] Report already exists for {path.name}")
            continue

        print(f"[processing] {path}")
        try:
            generate_report(path)
        except Exception as e:
            print(f"[error] {path.name}: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate prescription report from a session JSON file."
    )
    parser.add_argument(
        "session_file",
        nargs="?",
        help="Path to the session JSON file.",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="Process all sessions in data/conversations/ that don't have a report yet.",
    )
    parser.add_argument(
        "--data-dir",
        default="data/conversations",
        help="Base directory for conversations (used with --all).",
    )
    args = parser.parse_args()

    if args.all:
        _process_all(args.data_dir)
    elif args.session_file:
        try:
            report = generate_report(args.session_file)
            print(json.dumps(report, indent=2, ensure_ascii=False))
        except Exception as e:
            print(f"Error: {e}", file=sys.stderr)
            sys.exit(1)
    else:
        parser.print_help()
        sys.exit(1)
