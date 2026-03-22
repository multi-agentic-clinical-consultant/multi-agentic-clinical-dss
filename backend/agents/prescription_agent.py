import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

class PrescriptionAgent:
    def __init__(self):
        self.client = Groq(
            api_key=os.getenv("GROQ_API_KEY")
        )

    def generate_prescription_and_referral(self, patient_text: str, diagnosis: str, patient_history: str = "No known allergies or past conditions."):

        # Step 1: Use LLM to extract potential drug names FIRST based on diagnosis
        extraction_prompt = f"""
        Based on the following diagnosis, what are 1 or 2 standard medication names typically prescribed?
        Reply ONLY with a comma separated list of the generic drug names.

        DIAGNOSIS: "{diagnosis}"
        """
        try:
            extraction_response = self.client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "user", "content": extraction_prompt}],
                temperature=0.1
            )
            suggested_drugs = extraction_response.choices[0].message.content.split(",")
            suggested_drugs = [d.strip() for d in suggested_drugs if d.strip()]
        except:
            suggested_drugs = []

        # Step 2: Query RxNorm API to Validate and check interactions (Simulated Interaction via identifier)
        rxnorm_data = ""
        import requests
        for drug in suggested_drugs[:2]:  # Limit to top 2 to avoid spamming the public API
            try:
                # 1. Get RxCUI (RxNorm Concept Unique Identifier)
                url = "https://rxnav.nlm.nih.gov/REST/rxcui.json"
                params = {"name": drug}
                response = requests.get(url, params=params, timeout=5)
                
                data = response.json()
                if "idGroup" in data and "rxnormId" in data["idGroup"]:
                    rxcui = data["idGroup"]["rxnormId"][0]
                    rxnorm_data += f"\n- {drug} verified in RxNorm database. (RxCUI: {rxcui})"
                    
                    # 2. Get Drug Interactions using RxCUI
                    interaction_url = f"https://rxnav.nlm.nih.gov/REST/interaction/interaction.json?rxcui={rxcui}"
                    int_response = requests.get(interaction_url, timeout=5)
                    int_data = int_response.json()
                    
                    if "interactionTypeGroup" in int_data:
                        # Extract the first interaction warning as a sample
                        warning = int_data["interactionTypeGroup"][0]["interactionType"][0]["interactionPair"][0]["description"]
                        rxnorm_data += f"\n  -> KNOWN INTERACTION WARNING: {warning}"
                    else:
                        rxnorm_data += f"\n  -> No major interactions found for isolated use."
                else:
                    rxnorm_data += f"\n- {drug} could not be verified in RxNorm database."
            except Exception as e:
                rxnorm_data += f"\n- {drug} RxNorm verification failed: {str(e)}"

        if not rxnorm_data:
            rxnorm_data = "No specific RxNorm data was retrieved."

        # Step 2.5: Query Web Search for recent FDA warnings (Simulated Web Search capability via DuckDuckGo)
        web_search_data = ""
        try:
            try:
                from ddgs import DDGS
            except ImportError:
                from duckduckgo_search import DDGS
            with DDGS() as ddgs:
                for drug in suggested_drugs[:1]: # search only the first drug to save time
                    results = ddgs.text(f"{drug} FDA warning safety interaction", max_results=2)
                    web_search_data += f"\nWeb Search Results for {drug}:\n"
                    for r in results:
                        web_search_data += f"- {r['title']}: {r['body']}\n"
        except Exception as e:
            web_search_data = f"Web Search Failed or unavailable: {e}"

        # Step 3: Pass the real API data to the final LLM prompt
        prompt = f"""
You are an expert Clinical Pharmacist and Referral Coordinator AI.

Based on the patient's complaint, the doctor's diagnosis, the patient's medical history (EHR), and the REAL RxNorm & Web Search database results below, generate a safe treatment plan.

PATIENT COMPLAINT: "{patient_text}"
PATIENT HISTORY / EHR: "{patient_history}"
DIAGNOSIS: "{diagnosis}"

RxNorm API VERIFICATIONS AND INTERACTIONS:
{rxnorm_data}

WEB SEARCH (FDA / Pharma constraints):
{web_search_data}

Return ONLY valid JSON:
{{
  "prescription": {{
    "medications": [
      {{"name": "...", "dosage": "...", "instructions": "..."}}
    ],
    "treatment_plan": "...",
    "drug_interaction_check": "..."
  }},
  "referral": {{
    "specialist_escalation": "...",
    "follow_up_plan": "..."
  }}
}}

Rules:
- Include the verified medications if applicable.
- Make SURE the "drug_interaction_check" accurately reflects the RxNorm WARNINGS provided above. If no warnings, state that it is clear based on RxNorm.
- If no medication is needed, explain why in "treatment_plan" and leave "medications" empty.
- Provide a sensible referral or follow-up plan.
- Output strictly valid JSON.
"""

        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a professional medical assistant focusing on pharmacology and care routing. You must accurately integrate the provided API interaction data."},
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
        except Exception as e:
            print(f"JSON Parsing Failed in Prescription Agent. Raw Output: {output_text}")
            return {
                "prescription": {
                    "medications": [],
                    "treatment_plan": "Error generating treatment plan",
                    "drug_interaction_check": "Error checking interactions."
                },
                "referral": {
                    "specialist_escalation": "Error generating referral",
                    "follow_up_plan": "Please consult a human doctor."
                }
            }
