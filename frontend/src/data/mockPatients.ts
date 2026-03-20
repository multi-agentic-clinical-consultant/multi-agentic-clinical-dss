import { PatientRecord } from "@/types/medical";

export const mockPatients: PatientRecord[] = [
  {
    id: "PT-10492",
    name: "Sarah Johnson",
    age: 45,
    gender: "Female",
    medicalHistory: "Type 2 Diabetes (diagnosed 2018), Hypertension. Allergic to Penicillin. Previous surgery: Appendectomy (2010).",
    consultations: [
      {
        id: "C-001",
        date: "2025-12-15",
        symptoms: "Persistent headaches for the past 2 weeks, mild dizziness, elevated blood pressure readings at home (150/95).",
        transcript: "Patient reports recurring frontal headaches, worse in the morning. Denies visual disturbances. BP medication compliance confirmed. Last HbA1c was 7.2%.",
        diagnosis: {
          condition: "Hypertensive Crisis – Uncontrolled Hypertension",
          confidence: 88,
          requiresHumanReview: false,
          soapNote: {
            subjective: "Patient presents with 2-week history of persistent frontal headaches and mild dizziness. Reports home BP readings averaging 150/95 mmHg. Currently on Lisinopril 10mg daily. Compliant with medications.",
            objective: "BP: 152/96 mmHg. HR: 78 bpm. Neurological exam normal. Fundoscopy: no papilledema. BMI: 28.3.",
            assessment: "Uncontrolled essential hypertension with secondary headaches. Current antihypertensive regimen insufficient. Diabetes stable.",
            plan: "1. Increase Lisinopril to 20mg daily. 2. Add Amlodipine 5mg daily. 3. Home BP monitoring twice daily. 4. Follow-up in 2 weeks. 5. Repeat metabolic panel in 4 weeks.",
          },
        },
        prescriptions: [
          { medication: "Lisinopril", dosage: "20mg", frequency: "Once daily", duration: "Ongoing", instructions: "Take in the morning. Monitor for cough or dizziness." },
          { medication: "Amlodipine", dosage: "5mg", frequency: "Once daily", duration: "Ongoing", instructions: "Take with or without food. Report any ankle swelling." },
        ],
        referrals: [],
      },
      {
        id: "C-002",
        date: "2026-01-20",
        symptoms: "Follow-up visit. Headaches resolved. BP readings improved to 130/85.",
        transcript: "Patient reports significant improvement. Headaches resolved within 5 days of medication adjustment. Home BP averaging 128/84. No side effects from new medications.",
        diagnosis: {
          condition: "Hypertension – Improving with adjusted medication",
          confidence: 92,
          requiresHumanReview: false,
          soapNote: {
            subjective: "Follow-up visit. Patient reports resolution of headaches. Home BP readings averaging 128/84 mmHg. No medication side effects. Good compliance.",
            objective: "BP: 130/82 mmHg. HR: 72 bpm. No peripheral edema. Weight stable.",
            assessment: "Hypertension well-controlled with current regimen. Continue monitoring.",
            plan: "1. Continue current medications. 2. Maintain home BP log. 3. Follow-up in 3 months. 4. Schedule annual eye exam.",
          },
        },
        prescriptions: [
          { medication: "Lisinopril", dosage: "20mg", frequency: "Once daily", duration: "Ongoing", instructions: "Continue current dose." },
          { medication: "Amlodipine", dosage: "5mg", frequency: "Once daily", duration: "Ongoing", instructions: "Continue current dose." },
        ],
        referrals: [],
      },
    ],
  },
  {
    id: "PT-20831",
    name: "Michael Chen",
    age: 32,
    gender: "Male",
    medicalHistory: "No significant past medical history. Non-smoker. Social drinker. Active lifestyle.",
    consultations: [
      {
        id: "C-003",
        date: "2026-02-10",
        symptoms: "Patient fell while playing basketball. Severe pain in right wrist. Swelling and limited range of motion. Unable to grip objects.",
        transcript: "32-year-old male presents after fall on outstretched right hand during basketball 3 hours ago. Immediate onset of pain and swelling over distal radius. Unable to pronate/supinate. No numbness in fingers.",
        diagnosis: {
          condition: "Suspected Distal Radius Fracture (Colles' Fracture)",
          confidence: 78,
          requiresHumanReview: true,
          soapNote: {
            subjective: "Fall on outstretched right (dominant) hand during basketball. Immediate pain and swelling. Unable to grip or rotate wrist. No prior injuries to this area. Pain rated 7/10.",
            objective: "Right wrist: visible swelling and deformity over distal radius. Point tenderness over dorsal distal radius. Limited ROM in all planes. Neurovascular status intact. No open wound.",
            assessment: "Clinical presentation consistent with distal radius fracture. X-ray recommended to confirm and classify. Neurovascular status preserved.",
            plan: "1. X-ray right wrist (AP and lateral). 2. Temporary splint application. 3. Ice and elevation. 4. Ibuprofen 600mg TID for pain. 5. Orthopedic referral based on imaging.",
          },
          xrayFindings: [
            { condition: "Distal Radius Fracture", probability: 0.89, suggestion: "Fracture line visible at distal radius with dorsal angulation consistent with Colles' fracture." },
            { condition: "Scaphoid Fracture", probability: 0.12, suggestion: "No clear scaphoid fracture line identified, but clinical correlation advised." },
            { condition: "Soft Tissue Swelling", probability: 0.95, suggestion: "Significant soft tissue swelling noted around the wrist joint." },
          ],
        },
        prescriptions: [
          { medication: "Ibuprofen", dosage: "600mg", frequency: "Three times daily", duration: "7 days", instructions: "Take with food. Do not exceed prescribed dose." },
          { medication: "Acetaminophen", dosage: "500mg", frequency: "Every 6 hours as needed", duration: "7 days", instructions: "For breakthrough pain. Do not combine with other acetaminophen products." },
        ],
        referrals: [
          { specialistType: "Orthopedic Surgery", reason: "Distal radius fracture requiring specialist evaluation for possible reduction/casting vs surgical fixation", urgency: "urgent" },
        ],
      },
    ],
  },
];

export function findPatientById(id: string): PatientRecord | undefined {
  return mockPatients.find((p) => p.id.toLowerCase() === id.toLowerCase());
}
