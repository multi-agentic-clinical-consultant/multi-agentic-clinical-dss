"""
Local Mac inference for KingLLM/medical-finetuned (LoRA adapter repo)
Install deps once:
    pip install -U transformers torch accelerate peft
"""
import torch
from transformers import AutoModelForCausalLM, AutoTokenizer, TextStreamer
from peft import PeftModel

BASE_MODEL = "Qwen/Qwen3-4B"            # base model (downloaded ~8 GB once, then cached)
ADAPTER    = "KingLLM/medical-finetuned" # LoRA adapter weights (~132 MB)

# Apple Silicon → MPS; Intel Mac → CPU
device = "mps" if torch.backends.mps.is_available() else "cpu"
print(f"Using device: {device}")

tokenizer = AutoTokenizer.from_pretrained(ADAPTER)  # adapter repo has the tokenizer

model = AutoModelForCausalLM.from_pretrained(
    BASE_MODEL,
    torch_dtype = torch.float16,
)
model = PeftModel.from_pretrained(model, ADAPTER)   # apply LoRA adapters
model = model.merge_and_unload()                    # bake adapters into weights (faster inference)
model = model.to(device)
model.eval()

SYSTEM_PROMPT = "You are Dr. Arthur. Answer the patient's question with a clear diagnosis and treatment advice."

def ask(question: str):
    text = tokenizer.apply_chat_template([
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": question},
    ], tokenize=False, add_generation_prompt=True)

    inputs = tokenizer(text, return_tensors="pt").to(device)
    with torch.no_grad():
        model.generate(
            **inputs,
            max_new_tokens = 512,
            temperature    = 0.2,
            do_sample      = True,
            streamer       = TextStreamer(tokenizer, skip_prompt=True),
        )

ask("I have had a fever of 100 degree farenheit, sore throat, and fatigue for 3 days. What should I do?")
# ask("I am a 45-year-old male with high blood pressure. Can I take ibuprofen?")
