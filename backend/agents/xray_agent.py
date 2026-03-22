import base64
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from openai import OpenAI
from groq import Groq
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("xray_agent")


# ── Prompts ───────────────────────────────────────────────────────────────────
_SYSTEM_PROMPT = (
    "You are a senior board-certified radiologist with expert subspecialty training in MSK (musculoskeletal) "
    "and thoracic imaging. Your goal is to provide a highly accurate, systematic analysis of any X-ray image. "
    "\n\nGUIDELINES FOR ANALYSIS:"
    "\n1. SYSTEMATIC SEARCH: For bones, trace every cortical margin for breaks, step-offs, or lucency. "
    "\n2. JOINT CONGRUITY: Evaluate every joint for widening, narrowing, or subluxation. "
    "\n3. FRACTURES: Be extremely vigilant for subtle fractures (e.g., scaphoid, tibial plateau, compression). "
    "\n4. PATHOLOGY: Look for lung nodules, effusions, bowel gas patterns, or calcifications as appropriate. "
    "\n5. UNCERTAINTY: If a finding is subtle, state 'suspicious for' or 'suggestive of' rather than reporting as definitive. "
    "\n\nOUTPUT RULES:"
    "\n- Output strictly valid JSON."
    "\n- No conversational filler, no markdown fences (unless explicitly requested), no prose outside JSON."
)

_USER_PROMPT_TEMPLATE = """\
Perform a Comprehensive X-Ray Analysis using a Chain-of-Thought approach.

PHASE 1: IDENTIFICATION
Identify the exact body part, projection(s) (e.g. AP, Lateral, Oblique), and image quality.

PHASE 2: SYSTEMATIC REVIEW
Perform a step-by-step review of:
- BONES: Review all cortical surfaces, trabecular patterns, and density.
- JOINTS: Assess alignment, joint space width, and subchondral surfaces.
- SOFT TISSUES: Look for swelling, joint effusions, or foreign bodies.
- OTHER (if applicable): Review lungs, mediastinum, or abdomen if visualized.

PHASE 3: TARGETED SEARCH FOR FRACTURES/ISSUES
Specifically search for:
- Discontinuity in cortical lines.
- Lucent lines or sclerotic bands (impaction).
- Abnormal angulation, rotation, or shortening.
- Avulsion sites at ligament/tendon attachments.

Return ONLY valid JSON with this structure:
{{
  "xray_type": "Body part and projection",
  "technique": "Image quality and views",
  "findings": {{
    "bones": "Description of osseous structures",
    "joints": "Description of articulations",
    "soft_tissues": "Soft tissue findings",
    "other": "Lungs/abdomen/etc if applicable"
  }},
  "fractures": [
    {{
      "location": "Specific anatomical site (e.g. distal radius)",
      "type": "Pattern (transverse, oblique, spiral, comminuted, avulsion, buckle, etc.)",
      "displacement": "Degree and direction (e.g. 2mm dorsal displacement)",
      "certainty": "Definitive | Suspicious | Subtle",
      "notes": "Intra-articular extension, etc."
    }}
  ],
  "dislocations": [
    {{
      "joint": "Joint name",
      "direction": "Direction of displacement",
      "notes": "Associated findings"
    }}
  ],
  "impression": [
    "Most significant finding first",
    "Secondary findings"
  ],
  "primary_diagnosis": "Single most likely diagnosis (e.g. Distal Radius Fracture)",
  "severity": "normal | mild | moderate | severe",
  "requires_urgent_review": true/false
}}
"""

class XRayAgent:
    """
    Analyzes X-ray images using Groq Vision VLMs with a specialized radiologist persona.
    """

    def __init__(self):
        self.client = OpenAI(api_key=os.environ["OPENAI_API_KEY"])
        self.vlm_model = "gpt-5.4"

    @staticmethod
    def _encode_image(image_path: str) -> tuple[str, str]:
        """Return (base64_string, mime_type) for the image."""
        suffix = Path(image_path).suffix.lower()
        mime_map = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
        }
        mime_type = mime_map.get(suffix, "image/jpeg")
        with open(image_path, "rb") as fh:
            data = base64.b64encode(fh.read()).decode("utf-8")
        return data, mime_type

    def _analyze_with_vlm(self, image_path: str, model: str) -> dict:
        """Send image to Groq VLM for analysis."""
        image_b64, mime_type = self._encode_image(image_path)
        try:
            model="gpt-5.4"
        except Exception as e:
            logger.error("Failed to load model: %s", e)
            raise RuntimeError(f"Failed to load model: {e}") from e
        response = self.client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime_type};base64,{image_b64}"
                            },
                        },
                        {"type": "text", "text": _USER_PROMPT_TEMPLATE},
                    ],
                },
            ],
            temperature=0.5,  # Lower temperature for more consistent clinical output
            # max_tokens=2000,
        )

        text = response.choices[0].message.content.strip()
        
        # Clean up JSON if model includes markdown fences
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError as e:
            logger.error("VLM output was not valid JSON: %s", text)
            raise RuntimeError(f"Failed to parse VLM response: {e}") from e

    def analyze_xray(self, image_path: str) -> dict:
        """
        Full pipeline:
          1. Groq VLM analysis with specialized radiologist prompt.
          2. Fallback to larger VLM if first choice fails.
          3. Metadata enrichment.
        """
        logger.info("X-ray analysis started: %s", image_path)

        report: dict | None = None
        errors = []
        FALLBACK_VLM = "gpt-5.4"
        # Sequential attempt with fallback
        for model in [self.vlm_model, FALLBACK_VLM]:
            try:
                logger.info("Running VLM analysis with %s...", model)
                report = self._analyze_with_vlm(image_path, model=model)
                break
            except Exception as exc:
                logger.warning("VLM %s failed: %s", model, exc)
                errors.append(f"{model}: {str(exc)}")

        if report is None:
            raise RuntimeError(
                f"X-ray analysis failed for all models. Errors: {'; '.join(errors)}"
            )

        # Attach metadata
        report["report_id"] = f"xray_{uuid.uuid4().hex[:8]}"
        report["generated_at"] = datetime.now(timezone.utc).isoformat()
        report["model_used"] = report.get("model_used", self.vlm_model)
        report["disclaimer"] = (
            "This report is AI-generated and has NOT been reviewed by a licensed "
            "radiologist. It must not be used for clinical decision-making without "
            "professional medical review. No patient-identifiable data was processed."
        )

        logger.info(
            "X-ray analysis complete. Primary Diagnosis: %s (Severity: %s)",
            report.get("primary_diagnosis", "Unknown"),
            report.get("severity", "Unknown")
        )
        return report
