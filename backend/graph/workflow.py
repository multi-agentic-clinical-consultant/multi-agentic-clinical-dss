from langgraph.graph import StateGraph, END
from graph.state import ClinicalState

from agents.consultant_agent import ConsultantAgent
from agents.transcription_agent import TranscriptionAgent
from agents.prescription_agent import PrescriptionAgent
from database import ClinicalDatabase


# Initialize Agents & DB
consultant_agent = ConsultantAgent()
transcription_agent = TranscriptionAgent()
prescription_agent = PrescriptionAgent()
db = ClinicalDatabase()


# ---------------------------------------
# Node 1: Consultant Agent (Diagnosis)
# ---------------------------------------
def consultant_node(state: ClinicalState) -> ClinicalState:

    input_text = state["patient_text"]

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

    # Entry point
    workflow.set_entry_point("consultant")

    # Routing
    workflow.add_edge("consultant", "confidence_check")
    workflow.add_edge("confidence_check", "prescription")
    
    # Scribe/Transcription runs after prescription
    workflow.add_edge("prescription", "transcription")
    
    # Finally, save everything to the database
    workflow.add_edge("transcription", "database")

    workflow.add_edge("database", END)

    return workflow.compile()

