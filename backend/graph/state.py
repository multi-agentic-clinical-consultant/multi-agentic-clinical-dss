from typing import TypedDict, Optional


class ClinicalState(TypedDict):
    patient_text: str
    intent: Optional[str]
    image_path: Optional[str]
    vision_findings: Optional[dict]
    diagnosis: Optional[str]
    confidence: Optional[float]
    soap_note: Optional[dict]
    requires_human_review: Optional[bool]
