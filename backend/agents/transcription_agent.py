import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()


class TranscriptionAgent:
    def __init__(self):
        self.client = Groq(
            api_key=os.getenv("GROQ_API_KEY")
        )

    def generate_soap(self, patient_text: str, diagnosis: str):

        prompt = f"""
You are a clinical documentation assistant.

Patient Complaint:
{patient_text}

Diagnosis:
{diagnosis}

Generate structured SOAP note in JSON:

{{
  "subjective": "...",
  "objective": "...",
  "assessment": "...",
  "plan": "..."
}}

Only return valid JSON.
"""

        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a medical scribe."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.2
        )

        output_text = response.choices[0].message.content

        # Cleanup potential markdown code blocks
        if "```json" in output_text:
            output_text = output_text.split("```json")[1].split("```")[0].strip()
        elif "```" in output_text:
            output_text = output_text.split("```")[1].split("```")[0].strip()

        try:
            return json.loads(output_text)
        except Exception as e:
            print(f"Scribe Agent JSON Parsing Failed: {e}\nRaw Output: {output_text}")
            return {}
