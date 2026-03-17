from langgraph.graph import StateGraph, END
from graph.state import ClinicalState

from agents.consultant_agent import ConsultantAgent
from agents.scribe_agent import ScribeAgent
from agents.xray_agent import XRayAgent


# Initialize Agents
consultant_agent = ConsultantAgent()
scribe_agent = ScribeAgent()
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

    state["diagnosis"] = result.get("diagnosis")
    state["confidence"] = result.get("confidence")

    return state


# ---------------------------------------
# Node 3: Confidence Check
# ---------------------------------------
def confidence_node(state: ClinicalState) -> ClinicalState:

    if state["confidence"] is not None and state["confidence"] < 0.85:
        state["requires_human_review"] = True
    else:
        state["requires_human_review"] = False

    return state


# ---------------------------------------
# Node 4: Scribe Agent (SOAP Generation)
# ---------------------------------------
def scribe_node(state: ClinicalState) -> ClinicalState:

    soap = scribe_agent.generate_soap(
        state["patient_text"],
        state["diagnosis"]
    )

    state["soap_note"] = soap
    return state


# ---------------------------------------
# Build Workflow Graph
# ---------------------------------------
def build_workflow():

    workflow = StateGraph(ClinicalState)

    # Add nodes
    workflow.add_node("intent", intent_node)
    workflow.add_node("xray", xray_node)
    workflow.add_node("consultant", consultant_node)
    workflow.add_node("confidence_check", confidence_node)
    workflow.add_node("scribe", scribe_node)

    # Entry point
    workflow.set_entry_point("intent")

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

    # Always generate a SOAP note regardless of confidence
    workflow.add_edge("confidence_check", "scribe")

    workflow.add_edge("scribe", END)

    return workflow.compile()
