import torch
from unsloth import FastLanguageModel
from datasets import load_dataset, Dataset
from trl import SFTTrainer, SFTConfig

max_seq_length = 2048
lora_rank = 16

# ---------------------------------------------------------------------------
# Model + LoRA
# ---------------------------------------------------------------------------
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = "unsloth/Qwen3-4B",  # instruct model — has chat template built in
    max_seq_length = max_seq_length,
    load_in_4bit = True,
    dtype = torch.float16,             # T4 doesn't support bf16
)

model = FastLanguageModel.get_peft_model(
    model,
    r = lora_rank,
    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj",
                      "gate_proj", "up_proj", "down_proj"],
    lora_alpha = lora_rank * 2,
    use_gradient_checkpointing = "unsloth",
    random_state = 3407,
)

# ---------------------------------------------------------------------------
# Dataset
# ---------------------------------------------------------------------------
SYSTEM_PROMPT = "You are an expert medical doctor. Answer the patient's question with a clear diagnosis and treatment advice."

raw = load_dataset(
    "Malikeh1375/medical-question-answering-datasets",
    name = "chatdoctor_healthcaremagic",
    split = "train",
)

raw = raw.select(range(5000))
def format_row(x):
    question = x["input"].strip() if x["input"] else x["instruction"].strip()
    return tokenizer.apply_chat_template([
        {"role": "system",    "content": SYSTEM_PROMPT},
        {"role": "user",      "content": question},
        {"role": "assistant", "content": x["output"].strip()},
    ], tokenize=False)

raw = raw.map(lambda x: {"text": format_row(x)},
              remove_columns=raw.column_names)

# ---------------------------------------------------------------------------
# Train
# ---------------------------------------------------------------------------
trainer = SFTTrainer(
    model = model,
    tokenizer = tokenizer,
    train_dataset = raw,
    args = SFTConfig(
        dataset_text_field = "text",
        max_seq_length = max_seq_length,
        per_device_train_batch_size = 2,
        gradient_accumulation_steps = 4,
        warmup_steps = 10,
        num_train_epochs = 1,
        learning_rate = 2e-4,
        logging_steps = 25,
        optim = "adamw_8bit",
        weight_decay = 0.01,
        lr_scheduler_type = "cosine",
        seed = 3407,
        output_dir = "outputs",
        report_to = "none",
    ),
)
trainer.train()

# ---------------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------------
model.save_pretrained("medical_lora")
tokenizer.save_pretrained("medical_lora")

# Merge LoRA into base weights → standard HF model, no Unsloth needed for inference
merged = model.merge_and_unload()
merged.save_pretrained("medical_merged")
tokenizer.save_pretrained("medical_merged")
if False: model.save_pretrained_gguf("medical_gguf",   tokenizer, quantization_method = "q4_k_m")
# if False: model.push_to_hub_merged("HF_USERNAME/medical_sft", tokenizer, save_method = "merged_16bit", token = "YOUR_HF_TOKEN")
