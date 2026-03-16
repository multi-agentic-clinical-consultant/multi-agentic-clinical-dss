import os
import base64
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()


class VisionAgent:
    def __init__(self):
        self.client = Groq(
            api_key=os.getenv("GROQ_API_KEY")
        )

    def encode_image(self, image_path):
        with open(image_path, "rb") as image_file:
            return base64.b64encode(image_file.read()).decode('utf-8')

    def analyze_image(self, image_path: str):
        
        try:
            base64_image = self.encode_image(image_path)
            
            prompt = """
            You are a highly experienced medical imaging analyst.
            Analyze this medical image and identify any potential abnormalities or clinical findings.
            
            Return ONLY valid JSON in the following format:
            {
                "finding": "Detailed description of the visual finding...",
                "confidence": 0.0-1.0 (float)
            }
            """

            response = self.client.chat.completions.create(
                model="meta-llama/llama-4-maverick-17b-128e-instruct",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{base64_image}"
                                },
                            },
                        ],
                    }
                ],
                temperature=0.1,
                max_tokens=300,
                response_format={"type": "json_object"}
            )
            
            output_text = response.choices[0].message.content
            
            # Simple cleanup in case the model adds markdown ticks
            if "```json" in output_text:
                output_text = output_text.split("```json")[1].split("```")[0].strip()
            elif "```" in output_text:
                output_text = output_text.split("```")[1].split("```")[0].strip()

            return json.loads(output_text)

        except Exception as e:
            print(f"Vision Agent Error: {e}")
            return {
                "finding": f"Error interpreting image: {str(e)}",
                "confidence": 0.0
            }

