from langgraph.graph import StateGraph, END
from graph.state import ClinicalState
from agents.xray_agent import XRayAgent
from agents.consultant_agent import ConsultantAgent
from agents.transcription_agent import TranscriptionAgent
from agents.prescription_agent import PrescriptionAgent
from database import ClinicalDatabase


# Initialize Agents & DB
consultant_agent = ConsultantAgent()
transcription_agent = TranscriptionAgent()
prescription_agent = PrescriptionAgent()
db = ClinicalDatabase()
xray_agent = XRayAgent()

# ---------------------------------------
# Node 0: Intent Classification (Enhanced)
# ---------------------------------------
def intent_node(state: ClinicalState) -> ClinicalState:
    from groq import Groq
    import os
    
    # Simple instatiation - in production, dependency inject or reuse global client
    client = Groq(api_key=os.getenv("GROQ_API_KEY"))
    
    user_text = state["patient_text"]
    
    system_prompt = """
    You are a clinical intent router. 
    Analyze the patient's request.
    
    If the user specifically mentions an "xray", "x-ray", "bone scan", "chest x-ray", or specifically asks you to analyze an image, classify as "xray".
    Otherwise, classify as "consultation".
    
    Return ONLY one word: "xray" or "consultation".
    """
    
    try:
        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_text}
            ],
            temperature=0.0
        )
        intent = response.choices[0].message.content.strip().lower()
        
        # Validation fallback
        if "xray" in intent or "x-ray" in intent:
            state["intent"] = "xray"
        else:
            state["intent"] = "consultation"
            
    except Exception as e:
        # Fallback to keyword matching if LLM fails
        print(f"Intent Router Error: {e}")
        text = user_text.lower()
        if "xray" in text or "x-ray" in text or "bone" in text or "chest" in text or "scan" in text or "image" in text or "picture" in text:
            state["intent"] = "xray"
        else:
            state["intent"] = "consultation"

    return state


# ---------------------------------------
# Node 1: XRay Agent (if X-ray/image provided)
# ---------------------------------------
def xray_node(state: ClinicalState) -> ClinicalState:

    if state.get("image_path"):
        findings = xray_agent.analyze_xray(state["image_path"])
        state["xray_findings"] = findings

    return state


# ---------------------------------------
# Node 2: Consultant Agent (Diagnosis)
# ---------------------------------------
def consultant_node(state: ClinicalState) -> ClinicalState:

    # If xray findings exist, append them to patient text
    input_text = state["patient_text"]

    if state.get("xray_findings"):
        input_text += f"\nX-Ray/Image Findings: {state['xray_findings']}"

    result = consultant_agent.handle_case(input_text)

    state["diagnosis"] = result.get("diagnosis", "Unknown Diagnosis")
    state["confidence"] = result.get("confidence", 0.0)

    return state


# ---------------------------------------
# Node 2: Confidence Check
# ---------------------------------------
def confidence_node(state: ClinicalState) -> ClinicalState:

    if state["confidence"] is not None and state["confidence"] < 0.85:
        state["requires_human_review"] = True
    else:
        state["requires_human_review"] = False

    return state


# ---------------------------------------
# Node 3: Prescription Agent (Meds & Referral)
# ---------------------------------------
def prescription_node(state: ClinicalState) -> ClinicalState:

    diagnosis = state["diagnosis"]
    if state["requires_human_review"]:
        # If confidence is low, we might still generate tentative plans or defer
        # But we'll just run it as a regular operation
        pass

    # Dynamically fetch patient history from MongoDB if a patient_id is provided
    # and no history was passed in the initial state
    patient_id = state.get("patient_id")
    current_history = state.get("patient_history")
    
    if patient_id and (not current_history or current_history == "No known allergies or past conditions."):
        print(f"Workflow: Fetching history for patient {patient_id} from MongoDB...")
        state["patient_history"] = db.get_patient_history(patient_id)

    result = prescription_agent.generate_prescription_and_referral(
        state["patient_text"],
        diagnosis,
        state.get("patient_history", "No known allergies or past conditions.")
    )
    state["prescription"] = result.get("prescription")
    state["referral"] = result.get("referral")
    return state


# ---------------------------------------
# Node 4: Transcription Agent (SOAP Generation)
# ---------------------------------------
def transcription_node(state: ClinicalState) -> ClinicalState:

    soap = transcription_agent.generate_soap(
        state["patient_text"],
        state["diagnosis"]
    )

    state["soap_note"] = soap
    return state


# ---------------------------------------
# Node 5: Database Node (Saving Results)
# ---------------------------------------
def database_node(state: ClinicalState) -> ClinicalState:
    patient_id = state.get("patient_id", "anonymous_patient")
    print(f"Workflow: Saving session for {patient_id} to MongoDB...")
    
    db.save_session(patient_id, state)
    
    return state


# ---------------------------------------
# Build Workflow Graph
# ---------------------------------------
def build_workflow():

    workflow = StateGraph(ClinicalState)

    # Add nodes
    workflow.add_node("consultant", consultant_node)
    workflow.add_node("confidence_check", confidence_node)
    workflow.add_node("prescription", prescription_node)
    workflow.add_node("transcription", transcription_node)
    workflow.add_node("database", database_node)
    workflow.add_node("xray", xray_node)
    # Entry point
    workflow.set_entry_point("consultant")

    # Routing
    def route_intent(state: ClinicalState):
        if not state.get("image_path"):
            return "consultant"
        if state.get("intent") == "xray":
            return "xray"
        return "consultant"

    workflow.add_conditional_edges(
        "intent",
        route_intent,
        {
            "xray": "xray",
            "consultant": "consultant"
        }
    )
    
    workflow.add_edge("xray", "consultant")
    workflow.add_edge("consultant", "confidence_check")
    workflow.add_edge("confidence_check", "prescription")
    
    # Scribe/Transcription runs after prescription
    workflow.add_edge("prescription", "transcription")
    
    # Finally, save everything to the database
    workflow.add_edge("transcription", "database")

    workflow.add_edge("database", END)

    return workflow.compile()

