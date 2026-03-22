from typing import Optional, TypedDict


class PrescriptionState(TypedDict):
    """State passed through the background prescription LangGraph workflow."""

    # Session identifiers
    patient_id: str
    session_id: str

    # Full conversation transcript (e.g. "USER: ... \nASSISTANT: ...")
    full_transcript: str

    # Patient EHR / allergy notes (optional; defaults to none known)
    patient_history: str

    # Populated by diagnose_node
    diagnosis: Optional[str]
    confidence: Optional[float]

    # Populated by prescription_node
    prescription: Optional[dict]

    # Populated by soap_node
    soap_note: Optional[dict]
