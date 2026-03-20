export interface PatientRecord {
  id: string;
  name: string;
  age: number;
  gender: string;
  medicalHistory: string;
  consultations: Consultation[];
}

export interface Consultation {
  id: string;
  date: string;
  symptoms: string;
  transcript: string;
  diagnosis: DiagnosisResult;
  prescriptions: Prescription[];
  referrals: Referral[];
}

export interface DiagnosisResult {
  condition: string;
  confidence: number;
  requiresHumanReview: boolean;
  soapNote: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  xrayFindings?: XrayFinding[];
}

export interface XrayFinding {
  condition: string;
  probability: number;
  suggestion: string;
}

export interface Prescription {
  medication: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface Referral {
  specialistType: string;
  reason: string;
  urgency: "routine" | "urgent" | "emergency";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}
