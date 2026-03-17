// Clinical DSS Types - Designed for FastAPI Backend Integration

// Request Types (sent to backend)
export interface PatientIntakeRequest {
  patient_id: string;
  medical_history: string;
  symptoms: string;
  image_file?: File | null;
  audio_file?: File | null;
}

// Response Types (received from backend)
export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface XRayFindings {
  probabilities: Record<string, number>;
  llm_suggestions: string;
  detected_conditions: string[];
}



export interface ClinicalState {
  diagnosis: string;
  confidence: number; // 0-100
  soap_note: SOAPNote;
  xray_findings: XRayFindings | null;
  timestamp: string;
  patient_id: string;
}

// Form State Types
export interface PatientFormData {
  patientId: string;
  medicalHistory: string;
  symptoms: string;
  imageFile: File | null;
  imagePreview: string | null;
  isRecording: boolean;
  audioBlob: Blob | null;
}

// UI State Types
export interface AnalysisState {
  isLoading: boolean;
  error: string | null;
  result: ClinicalState | null;
}

// Confidence Level Helper
export type ConfidenceLevel = "high" | "medium" | "low";

export function getConfidenceLevel(confidence: number): ConfidenceLevel {
  if (confidence >= 85) return "high";
  if (confidence >= 50) return "medium";
  return "low";
}

export function getConfidenceColor(level: ConfidenceLevel): string {
  switch (level) {
    case "high":
      return "bg-success";
    case "medium":
      return "bg-warning";
    case "low":
      return "bg-destructive";
  }
}
