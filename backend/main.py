from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel
from typing import Optional
import os

from graph.workflow import build_workflow
from agents.stt_agent import STTAgent

from agents.tts_agent import TTSAgent

app = FastAPI()

# -----------------------------------------
# Initialize Workflow and STT Agent
# -----------------------------------------
# Add ffmpeg to PATH for whisper
# This is a temporary fix to ensure ffmpeg is found without restart
import os
ffmpeg_path = r"C:\Users\bhoomi\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0.1-full_build\bin"
if os.path.exists(ffmpeg_path) and ffmpeg_path not in os.environ["PATH"]:
    os.environ["PATH"] += os.pathsep + ffmpeg_path

graph = build_workflow()
stt_agent = STTAgent()
tts_agent = TTSAgent()


# -----------------------------------------
# Root Endpoint
# -----------------------------------------
@app.get("/")
def read_root():
    return {"status": "Clinical DSS Backend Running"}


# -----------------------------------------
# Request Model for Text-Based Consultation
# -----------------------------------------
class PatientInput(BaseModel):
    message: str
    patient_history: Optional[str] = "No known allergies or past conditions."


# -----------------------------------------
# TEXT → Clinical Analysis
# -----------------------------------------
@app.post("/analyze")
def analyze_case(input_data: PatientInput):

    initial_state = {
        "patient_text": input_data.message,
        "patient_history": input_data.patient_history,
        "intent": None,
        "diagnosis": None,
        "confidence": None,
        "prescription": None,
        "referral": None,
        "soap_note": None,
        "requires_human_review": None
    }

    result = graph.invoke(initial_state)
    return result


# -----------------------------------------
# AUDIO → Transcript Only
# -----------------------------------------
@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):

    file_location = f"temp_{file.filename}"

    with open(file_location, "wb") as f:
        f.write(await file.read())

    transcript = stt_agent.transcribe(file_location)

    os.remove(file_location)

    return {"transcript": transcript}


# -----------------------------------------
# AUDIO → FULL VOICE CONSULT PIPELINE
# -----------------------------------------
@app.post("/voice-consult")
async def voice_consult(file: UploadFile = File(...)):

    file_location = f"temp_{file.filename}"

    # Save uploaded audio temporarily
    with open(file_location, "wb") as f:
        f.write(await file.read())

    # Step 1: Transcribe
    transcript = stt_agent.transcribe(file_location)

    # Delete temporary file
    os.remove(file_location)

    # Step 2: Send transcript to LangGraph workflow
    initial_state = {
        "patient_text": transcript,
        "patient_history": "No known allergies or past conditions.",
        "intent": None,
        "diagnosis": None,
        "confidence": None,
        "prescription": None,
        "referral": None,
        "soap_note": None,
        "requires_human_review": None
    }

    result = graph.invoke(initial_state)

    # Step 3: Generate TTS Audio
    # Extract the diagnosis or summary to speak
    diagnosis_text = result.get("diagnosis", "I could not generate a diagnosis.")
    
    # Generate timestamped filename to avoid caching/collisions
    import time
    output_audio_file = f"response_{int(time.time())}.mp3"
    
    tts_agent.speak(diagnosis_text, output_audio_file)

    return {
        "transcript": transcript,
        "clinical_response": result,
        "audio_path": output_audio_file
    }
