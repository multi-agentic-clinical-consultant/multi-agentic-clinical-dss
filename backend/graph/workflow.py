"""
Background Prescription LangGraph Workflow
==========================================
Runs after a voice consultation ends.

Nodes:
  diagnose     → extract primary diagnosis + confidence from transcript
  prescription → generate medications / treatment plan (RxNorm-validated)

Input: PrescriptionState (full_transcript, patient_history, patient_id, session_id)
Output: PrescriptionState with diagnosis, confidence, prescription populated
"""

import json
import logging
import os

from langgraph.graph import END, StateGraph

from agents.prescription_agent import PrescriptionAgent
from graph.state import PrescriptionState

logger = logging.getLogger("prescription_workflow")

_prescription_agent = PrescriptionAgent()


# ── Node 1: Diagnose ──────────────────────────────────────────────────────────

def diagnose_node(state: PrescriptionState) -> PrescriptionState:
    """Extract the primary diagnosis and confidence from the transcript."""
    from groq import Groq

    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    prompt = f"""
You are a clinical AI reviewing a doctor-patient conversation transcript.
Identify the patient's primary medical complaint and likely diagnosis.

TRANSCRIPT:
{state["full_transcript"]}

Return ONLY valid JSON (no markdown fences):
{{
  "diagnosis": "...",
  "confidence": 0.0
}}

Rules:
- "diagnosis": concise clinical description of the primary condition.
- "confidence": 0.0–1.0; be conservative if the transcript is vague.
- If no medical content, set diagnosis to "Undetermined" and confidence to 0.1.
"""
    try:
        response = client.chat.completions.create(
            model=os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        text = response.choices[0].message.content.strip()
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        result = json.loads(text)
        state["diagnosis"] = result.get("diagnosis", "Undetermined")
        state["confidence"] = float(result.get("confidence", 0.5))
        logger.info("Diagnosis: '%s' (confidence=%.2f)", state["diagnosis"], state["confidence"])
    except Exception:
        logger.exception("diagnose_node failed")
        state["diagnosis"] = "Undetermined"
        state["confidence"] = 0.0

    return state


# ── Node 2: Prescription ──────────────────────────────────────────────────────

def prescription_node(state: PrescriptionState) -> PrescriptionState:
    """Generate a prescription / treatment plan using RxNorm validation."""
    try:
        result = _prescription_agent.generate_prescription_and_referral(
            patient_text=state["full_transcript"],
            diagnosis=state["diagnosis"],
            patient_history=state.get("patient_history", "No known allergies or past conditions."),
        )
        state["prescription"] = result
        logger.info("Prescription generated for session %s", state["session_id"])
    except Exception:
        logger.exception("prescription_node failed")
        state["prescription"] = {
            "prescription": {
                "medications": [],
                "treatment_plan": "Error generating treatment plan.",
                "drug_interaction_check": "Error.",
            },
            "referral": {
                "specialist_escalation": "Please consult a licensed physician.",
                "follow_up_plan": "Follow up with your primary care provider.",
            },
        }
    return state


# ── Build workflow ────────────────────────────────────────────────────────────

def build_prescription_workflow():
    """Compile and return the LangGraph prescription pipeline."""
    workflow = StateGraph(PrescriptionState)

    workflow.add_node("diagnose", diagnose_node)
    workflow.add_node("prescription", prescription_node)

    workflow.set_entry_point("diagnose")
    workflow.add_edge("diagnose", "prescription")
    workflow.add_edge("prescription", END)

    return workflow.compile()
