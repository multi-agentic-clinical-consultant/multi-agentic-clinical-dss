import os
import json
from groq import Groq
from dotenv import load_dotenv
from rag.vector_store import MedicalVectorStore

load_dotenv()


class ConsultantAgent:
    def __init__(self):
        self.client = Groq(
            api_key=os.getenv("GROQ_API_KEY")
        )
        self.vector_store = MedicalVectorStore()

    def handle_case(self, input_text: str):

        # Retrieve relevant medical knowledge
        retrieved_docs = self.vector_store.retrieve(input_text)
        context = "\n\n".join(retrieved_docs)

        prompt = f"""
You are an evidence-based clinical decision support AI.

Use the medical knowledge provided below if available to structure your response, but if none is provided or it is insufficient, use your own broad medical knowledge.

MEDICAL KNOWLEDGE:
{context}

PATIENT COMPLAINT:
"{input_text}"

Return ONLY valid JSON:

{{
  "diagnosis": "...",
  "confidence": 0.0-1.0
}}

Rules:
- Give your best possible diagnosis or differential diagnosis based on the symptoms.
- Reduce confidence if uncertain, but do not just output "Insufficient information" unless it is completely unintelligible.
- Output strictly valid JSON.
"""

        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a professional ENT doctor."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )

        output_text = response.choices[0].message.content
        
        # Cleanup potential markdown
        if "```json" in output_text:
            output_text = output_text.split("```json")[1].split("```")[0].strip()
        elif "```" in output_text:
            output_text = output_text.split("```")[1].split("```")[0].strip()

        try:
            return json.loads(output_text)
        except:
            print(f"JSON Parsing Failed. Raw Output: {output_text}")
            return {
                "diagnosis": "Parsing Error",
                "confidence": 0.0
            }
