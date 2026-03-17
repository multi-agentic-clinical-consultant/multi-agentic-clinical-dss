import os
from pymongo import MongoClient
from dotenv import load_dotenv
from datetime import datetime

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

class ClinicalDatabase:
    """
    Handles MongoDB connections for saving session states, 
    clinical notes (SOAP), and tracking patient history.
    """
    def __init__(self):
        # Fallback to local MongoDB instance on port 27017 if URI is missing
        mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
        
        try:
            self.client = MongoClient(mongo_uri, serverSelectionTimeoutMS=5000)
            # Access the 'clinical_dss' database
            self.db = self.client["clinical_dss"]
            
            # Key collections based on the architecture diagram
            self.sessions = self.db["sessions"]   # Stores full flow of each consult
            self.patients = self.db["patients"]   # Stores longitudinal EHR profiles
            
            # Test connection
            self.client.admin.command('ping')
            print("Successfully connected to MongoDB!")
            
        except Exception as e:
            print(f"MongoDB Connection Warning/Error: {e}")
            self.db = None

    def save_session(self, patient_id: str, state: dict):
        """Saves the final output of the LangGraph workflow directly into MongoDB"""
        if self.db is None:
            print("Skipping DB save: Not connected to MongoDB")
            return None

        # Prepare a clean dictionary for the database
        session_record = {
            "patient_id": patient_id,
            "timestamp": datetime.utcnow(),
            "patient_complaint": state.get("patient_text"),
            "diagnosis": state.get("diagnosis"),
            "confidence": state.get("confidence"),
            "prescription_generated": state.get("prescription"),
            "referral_generated": state.get("referral"),
            "final_soap_note": state.get("soap_note")
        }
        
        # Save to the 'sessions' collection
        try:
            result = self.sessions.insert_one(session_record)
            print(f"Saved session '{result.inserted_id}' to MongoDB.")
            return str(result.inserted_id)
        except Exception as e:
            print(f"Failed to save session to DB: {e}")
            return None

    def get_patient_history(self, patient_id: str) -> str:
        """Retrieves past records from the database to inject into the AI's prompt as 'Memory'"""
        if self.db is None:
            return "No known allergies or past conditions. (Database Offline)"

        past_sessions = list(self.sessions.find({"patient_id": patient_id}).sort("timestamp", -1).limit(5))
        
        if not past_sessions:
            return "No previous visits on record."
            
        # Build a text summary of the patient's history based on the database
        history_summary = "Patient's Past Visits from MongoDB:\n"
        for session in past_sessions:
            date_str = session["timestamp"].strftime("%Y-%m-%d")
            diag = session.get("diagnosis", "Unknown Diagnosis")
            history_summary += f"- {date_str}: Diagnosed with {diag}\n"
            
        return history_summary
