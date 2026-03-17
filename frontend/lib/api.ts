// API Service Layer - Easy integration with FastAPI backend
import type { ClinicalState, PatientIntakeRequest } from "./types";

// Configure your FastAPI backend URL here
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// API Endpoints
const ENDPOINTS = {
  analyze: "/api/analyze",
  health: "/api/health",
} as const;

// API Response wrapper
interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

// Main API function to analyze a case
export async function analyzeCase(
  data: PatientIntakeRequest
): Promise<ApiResponse<ClinicalState>> {
  try {
    const requestBody = {
      patient_id: data.patient_id || "anonymous_patient",
      message: data.symptoms,
      patient_history: data.medical_history || "No known allergies or past conditions.",
    };

    const response = await fetch(`${API_BASE_URL}${ENDPOINTS.analyze}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        data: null,
        error: errorData.detail || `HTTP error ${response.status}`,
        status: response.status,
      };
    }

    const result = await response.json();
    return {
      data: result,
      error: null,
      status: response.status,
    };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Network error occurred",
      status: 0,
    };
  }
}

// Health check function
export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}${ENDPOINTS.health}`);
    return response.ok;
  } catch {
    return false;
  }
}

// Mock data for development/demo purposes
// Remove this when integrating with actual backend
export function getMockClinicalState(patientId: string): ClinicalState {
  return {
    patient_id: patientId,
    diagnosis: "Suspected Distal Radius Fracture (Colles' Fracture)",
    confidence: 87,
    soap_note: {
      subjective:
        "Patient reports falling on outstretched hand approximately 2 hours ago. Describes severe pain in right wrist, rated 8/10. Denies any previous wrist injuries. Reports immediate swelling after the fall.",
      objective:
        "Physical examination reveals visible deformity of the distal forearm with dorsal angulation. Significant swelling and tenderness over the distal radius. Limited range of motion due to pain. Neurovascular status intact - radial pulse present, sensation normal in all digits.",
      assessment:
        "Clinical presentation consistent with distal radius fracture, likely Colles' fracture pattern. X-ray imaging confirms displaced fracture of the distal radius with dorsal angulation.",
      plan: "1. Closed reduction under local anesthesia. 2. Application of short arm cast. 3. Orthopedic referral for follow-up. 4. Pain management with NSAIDs. 5. Follow-up X-ray in 1 week.",
    },
    xray_findings: {
      probabilities: {
        fracture: 0.92,
        dislocation: 0.15,
        soft_tissue_swelling: 0.88,
        normal: 0.08,
      },
      llm_suggestions:
        "The radiograph demonstrates a transverse fracture of the distal radius with dorsal displacement and angulation, consistent with a Colles' fracture pattern. Associated soft tissue swelling is noted. No evidence of carpal bone involvement. Recommend orthopedic consultation for definitive management.",
      detected_conditions: [
        "Distal radius fracture",
        "Soft tissue swelling",
        "Dorsal angulation",
      ],
    },
    timestamp: new Date().toISOString(),
  };
}
