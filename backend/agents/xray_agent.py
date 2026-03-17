import os
import json
import torch
import torchvision
import torchxrayvision as xrv
import skimage.io
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

class XRayAgent:
    def __init__(self):
        # Initialize Groq client for the LLM Step
        self.client = Groq(
            api_key=os.getenv("GROQ_API_KEY")
        )
        # Fast, standard Groq text model since we are passing textual findings now
        self.llm_model = "llama-3.3-70b-versatile" 
        
        # Initialize TorchXRayVision Model for the Detection Step
        print("Loading TorchXRayVision model (DenseNet121)...")
        # Ensure we don't redownload weights pointlessly if cached
        self.vision_model = xrv.models.DenseNet(weights="densenet121-res224-all")
        self.vision_model.eval() # Set to evaluation mode
        
        # Image transformation pipeline expected by the model
        self.transform = torchvision.transforms.Compose([
            xrv.datasets.XRayCenterCrop(),
            xrv.datasets.XRayResizer(224)
        ])

    def detect_pathologies(self, image_path: str):
        """Step 1: Run TorchXRayVision to get disease probabilities"""
        try:
            # Load the image
            img = skimage.io.imread(image_path)
            
            # Normalize to [-1024, 1024] as expected by xrv
            img = xrv.datasets.normalize(img, 255) 
            
            # Check if image has multiple channels (e.g., RGB) and convert to 1 channel (grayscale)
            if len(img.shape) == 3:
                # Typically shape is (H, W, C) for skimage
                # xrv expects (C, H, W) where C=1
                img = img.mean(2)[None, ...] # Average channels, add C dim
            elif len(img.shape) == 2:
                # Just (H, W), add C dim
                img = img[None, ...]
                
            # Apply transforms (Crop -> Resize)
            img = self.transform(img)
            
            # Convert to PyTorch tensor and add Batch dimension: (1, 1, 224, 224)
            img_tensor = torch.from_numpy(img).unsqueeze(0)
            
            # Run inference
            with torch.no_grad():
                outputs = self.vision_model(img_tensor)
            
            # Map probabilities to pathology names
            results = dict(zip(self.vision_model.pathologies, outputs[0].detach().numpy()))
            
            # Filter and sort results (just keeping anything above a minimal threshold like 1% to give context to LLM)
            # Actually, let's just keep the top 5 or anything > 10%
            clinical_findings = {k: float(v) for k, v in results.items() if v > 0.05}
            # Sort by probability descending
            clinical_findings = dict(sorted(clinical_findings.items(), key=lambda item: item[1], reverse=True))
            
            return clinical_findings
            
        except Exception as e:
            print(f"Error in X-Ray Detection step: {e}")
            return None

    def synthesize_findings(self, clinical_findings: dict):
        """Step 2: Use LLM to synthesize detection probabilities into clinical suggestions"""
        try:
            if not clinical_findings:
                return {
                    "finding": "Error processing X-Ray.",
                    "confidence": 0.0,
                    "suggestions": "Review the image format and try again."
                }
                
            # Convert findings to readable string
            findings_str = "\n".join([f"- {k}: {v*100:.1f}% probability" for k, v in clinical_findings.items()])
            
            prompt = f"""
            You are a highly experienced clinical radiologist and diagnostician.
            An AI detection model has analyzed a patient's X-Ray and provided the following pathology probabilities:
            
            {findings_str}
            
            Assess these computational findings. Identify the most likely clinical issues (ignoring very low probabilities).
            
            Return ONLY valid JSON in the following format:
            {{
                "finding": "Detailed clinical synthesis of the probable pathologies...",
                "confidence": 0.0-1.0,
                "suggestions": "Recommended clinical next steps or suggestions based on these findings..."
            }}
            """

            response = self.client.chat.completions.create(
                model=self.llm_model,
                messages=[
                    {"role": "system", "content": "You are a clinical AI assistant that outputs strictly JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.1,
                max_tokens=500,
                response_format={"type": "json_object"}
            )
            
            output_text = response.choices[0].message.content
            
            return json.loads(output_text)

        except Exception as e:
            print(f"Error in X-Ray Synthesis step: {e}")
            return {
                "finding": f"Error synthesizing findings: {str(e)}",
                "confidence": 0.0,
                "suggestions": "Unable to provide suggestions due to an error."
            }

    def analyze_xray(self, image_path: str):
        """Full Pipeline: Detection -> Synthesis"""
        print(f"Analyzing X-Ray using TorchXRayVision: {image_path}")
        
        # Step 1: Computer Vision Detection
        findings = self.detect_pathologies(image_path)
        
        if findings is None:
             return {
                "finding": "Error running the TorchXRayVision detection model on the image.",
                "confidence": 0.0,
                "suggestions": "Please upload a valid DICOM, PNG, or JPEG X-Ray image."
            }
            
        print(f"Detection complete. Found probabilities: {findings}")
        
        # Step 2: LLM Synthesis
        print("Synthesizing findings with Groq LLM...")
        final_result = self.synthesize_findings(findings)
        
        return final_result
