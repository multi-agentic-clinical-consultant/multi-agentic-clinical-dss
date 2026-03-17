from typing import TypedDict, Optional


class ClinicalState(TypedDict):
    patient_id: Optional[str]
    patient_text: str
    patient_history: Optional[str]
    intent: Optional[str]
    diagnosis: Optional[str]
    confidence: Optional[float]
    prescription: Optional[dict]
    referral: Optional[dict]
    soap_note: Optional[dict]
    requires_human_review: Optional[bool]
