import os
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

class STTAgent:
    def __init__(self):
        # We use Groq's super fast Whisper API instead of local Whisper
        # This prevents the computer from freezing and offers instantaneous transcription
        self.client = Groq(api_key=os.getenv("GROQ_API_KEY"))

    def transcribe(self, audio_path: str):
        print(f"STTAgent: Transcribing {audio_path} via Groq Whisper...")
        try:
            with open(audio_path, "rb") as file:
                translation = self.client.audio.transcriptions.create(
                  file=(audio_path, file.read()),
                  model="whisper-large-v3",
                  language="en",
                  response_format="json",
                  temperature=0.0
                )
            return translation.text
        except Exception as e:
            print(f"STTAgent Error: {e}")
            return "Transcription failed due to an error."
