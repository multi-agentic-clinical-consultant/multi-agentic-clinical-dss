"""
Local Medical LLM Server
========================
Serves the KingLLM/medical-finetuned model (Qwen3-4B + LoRA adapters) as an
OpenAI-compatible API so the LiveKit voice agent can use it as its LLM.

Streaming strategy (solves LiveKit's 10s timeout):
  - Uses TextIteratorStreamer so the FIRST token reaches the client within
    1-3 seconds, well before LiveKit's per-attempt timeout fires.
  - Buffers the first PEEK_TOKENS tokens to detect Qwen3's <tool_call> tag.
    If detected → buffers full output, emits structured tool_calls at end.
    If not → flushes buffer immediately and streams subsequent tokens live.
  - For tool-call responses, sends periodic keep-alive SSE comments while
    buffering so LiveKit's read-timeout doesn't fire.

Usage:
    pip install fastapi uvicorn transformers torch accelerate peft
    python local_llm_server.py

Set LOCAL_LLM_URL=http://localhost:8001 in .env (default).
"""

import asyncio
import json
import logging
import os
import re
import time
import uuid
from threading import Thread

import torch
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from peft import PeftModel
from pydantic import BaseModel
from transformers import AutoModelForCausalLM, AutoTokenizer, TextIteratorStreamer

# ── Config ────────────────────────────────────────────────────────────────────
BASE_MODEL  = "Qwen/Qwen3-4B"
ADAPTER     = "KingLLM/medical-finetuned"
PORT        = int(os.environ.get("LOCAL_LLM_PORT", "8001"))
PEEK_TOKENS = 8   # tokens to peek before deciding text vs tool-call stream

if torch.backends.mps.is_available():
    DEVICE = "mps"
elif torch.cuda.is_available():
    DEVICE = "cuda"
else:
    DEVICE = "cpu"

logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("local_llm")

app = FastAPI(title="Local Medical LLM")

_tokenizer = None
_model     = None


def _load_model() -> None:
    global _tokenizer, _model
    logger.info("Loading tokenizer from '%s' …", ADAPTER)
    _tokenizer = AutoTokenizer.from_pretrained(ADAPTER)
    logger.info("Loading base model '%s' on %s …", BASE_MODEL, DEVICE)
    base = AutoModelForCausalLM.from_pretrained(BASE_MODEL, torch_dtype=torch.float16)
    logger.info("Applying LoRA adapter '%s' …", ADAPTER)
    base = PeftModel.from_pretrained(base, ADAPTER)
    base = base.merge_and_unload()
    _model = base.to(DEVICE)
    _model.eval()
    logger.info("Model ready on %s.", DEVICE)


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class _Message(BaseModel):
    role: str
    content: str | None = None
    tool_call_id: str | None = None
    tool_calls: list | None = None


class _Function(BaseModel):
    name: str
    description: str | None = None
    parameters: dict | None = None


class _Tool(BaseModel):
    type: str = "function"
    function: _Function


class ChatRequest(BaseModel):
    model: str = "medical-finetuned"
    messages: list[_Message]
    tools: list[_Tool] | None = None
    tool_choice: str | dict | None = None
    max_tokens: int = 512
    temperature: float = 0.7
    stream: bool = False


# ── Tool-call parsing ─────────────────────────────────────────────────────────
_TOOL_RE  = re.compile(r"<tool_call>\s*(\{.*?\})\s*</tool_call>", re.DOTALL)
_THINK_RE = re.compile(r"<think>.*?</think>", re.DOTALL)


def _parse_output(text: str) -> tuple[str | None, list | None]:
    text = _THINK_RE.sub("", text).strip()
    matches = _TOOL_RE.findall(text)
    if not matches:
        return text or None, None

    tool_calls = []
    for raw in matches:
        try:
            data = json.loads(raw)
            args = data.get("arguments") or data.get("parameters") or {}
            tool_calls.append({
                "id": f"call_{uuid.uuid4().hex[:8]}",
                "type": "function",
                "function": {
                    "name": data.get("name", ""),
                    "arguments": json.dumps(args),
                },
            })
        except (json.JSONDecodeError, KeyError):
            pass

    text_before = _TOOL_RE.split(text)[0].strip() or None
    return text_before, tool_calls or None


# ── Prompt builder ────────────────────────────────────────────────────────────

def _build_prompt(messages: list[_Message], tools: list[_Tool] | None) -> str:
    msg_dicts = []
    for m in messages:
        d: dict = {"role": m.role}
        if m.content is not None:
            d["content"] = m.content
        if m.tool_calls:
            d["tool_calls"] = m.tool_calls
        if m.tool_call_id:
            d["tool_call_id"] = m.tool_call_id
        msg_dicts.append(d)

    tools_list = [t.function.model_dump() for t in tools] if tools else None
    try:
        return _tokenizer.apply_chat_template(
            msg_dicts, tokenize=False, add_generation_prompt=True,
            tools=tools_list, enable_thinking=False,
        )
    except TypeError:
        return _tokenizer.apply_chat_template(
            msg_dicts, tokenize=False, add_generation_prompt=True,
            tools=tools_list,
        )


# ── SSE helpers ───────────────────────────────────────────────────────────────

def _chunk(cid: str, model: str, created: int, delta: dict, finish: str | None = None) -> str:
    return "data: " + json.dumps({
        "id": cid, "object": "chat.completion.chunk",
        "created": created, "model": model,
        "choices": [{"index": 0, "delta": delta, "finish_reason": finish}],
    }) + "\n\n"


# ── Async token iterator ──────────────────────────────────────────────────────

async def _aiter_tokens(streamer: TextIteratorStreamer):
    """Wrap a blocking TextIteratorStreamer into an async generator."""
    loop = asyncio.get_event_loop()
    _STOP = object()

    def _next():
        try:
            return next(streamer)
        except StopIteration:
            return _STOP

    while True:
        tok = await loop.run_in_executor(None, _next)
        if tok is _STOP:
            break
        yield tok


# ── Streaming SSE generator ───────────────────────────────────────────────────

async def _stream_sse(cid: str, req_model: str, created: int,
                      inputs, max_tokens: int, temperature: float):
    """
    True streaming with tool-call detection:
      • Role chunk sent immediately (prevents LiveKit connection timeout).
      • Peeks at first PEEK_TOKENS tokens; if <tool_call> detected, buffers all
        tokens and emits structured tool_calls at end with keep-alive comments.
      • Otherwise flushes buffer and streams tokens live.
    """
    streamer = TextIteratorStreamer(
        _tokenizer, skip_prompt=True, skip_special_tokens=True
    )

    def _generate():
        with torch.no_grad():
            _model.generate(
                **inputs,
                max_new_tokens=max_tokens,
                temperature=temperature,
                do_sample=temperature > 0,
                streamer=streamer,
            )

    Thread(target=_generate, daemon=True).start()

    # Always send role chunk immediately so LiveKit doesn't time out on connect
    yield _chunk(cid, req_model, created, {"role": "assistant"})

    peek_buf: list[str] = []
    text_started = False
    tool_call_mode = False
    all_tokens: list[str] = []  # full buffer when in tool_call_mode

    async for token in _aiter_tokens(streamer):
        if text_started:
            # Fast path: just stream tokens
            yield _chunk(cid, req_model, created, {"content": token})
            continue

        peek_buf.append(token)
        joined = "".join(peek_buf)

        if not tool_call_mode:
            # Check if a tool call is starting
            if "<tool_call>" in joined:
                tool_call_mode = True
                all_tokens = peek_buf[:]
                continue

            # After PEEK_TOKENS with no tool_call, flush and switch to live mode
            if len(peek_buf) >= PEEK_TOKENS:
                for t in peek_buf:
                    yield _chunk(cid, req_model, created, {"content": t})
                peek_buf = []
                text_started = True
        else:
            # In tool_call_mode: accumulate everything
            all_tokens.append(token)
            # Send a keep-alive SSE comment every ~10 tokens so LiveKit stays connected
            if len(all_tokens) % 10 == 0:
                yield ": keep-alive\n\n"

    # ── Generation finished ───────────────────────────────────────────────────
    if tool_call_mode:
        full_text = "".join(all_tokens)
        text_content, tool_calls = _parse_output(full_text)
        if tool_calls:
            for i, tc in enumerate(tool_calls):
                # Open tool call slot
                yield _chunk(cid, req_model, created, {
                    "tool_calls": [{"index": i, "id": tc["id"], "type": "function",
                                    "function": {"name": tc["function"]["name"], "arguments": ""}}]
                })
                # Stream arguments in small chunks
                args = tc["function"]["arguments"]
                for start in range(0, len(args), 20):
                    yield _chunk(cid, req_model, created, {
                        "tool_calls": [{"index": i, "function": {"arguments": args[start:start + 20]}}]
                    })
            yield _chunk(cid, req_model, created, {}, finish="tool_calls")
        else:
            # Model produced <tool_call> tags but parsing failed — emit as text
            for t in all_tokens:
                yield _chunk(cid, req_model, created, {"content": t})
            yield _chunk(cid, req_model, created, {}, finish="stop")
    elif not text_started:
        # Edge case: generation ended during peek window
        for t in peek_buf:
            yield _chunk(cid, req_model, created, {"content": t})
        yield _chunk(cid, req_model, created, {}, finish="stop")
    else:
        yield _chunk(cid, req_model, created, {}, finish="stop")

    yield "data: [DONE]\n\n"


# ── Non-streaming generation ──────────────────────────────────────────────────

def _generate_blocking(inputs, max_tokens: int, temperature: float) -> str:
    with torch.no_grad():
        output = _model.generate(
            **inputs, max_new_tokens=max_tokens,
            temperature=temperature, do_sample=temperature > 0,
        )
    return _tokenizer.decode(
        output[0][inputs["input_ids"].shape[1]:], skip_special_tokens=True
    )


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def _startup():
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _load_model)


@app.get("/health")
def health():
    return {"status": "ok" if _model is not None else "loading",
            "model": ADAPTER, "device": DEVICE}


@app.get("/v1/models")
def list_models():
    return {"object": "list",
            "data": [{"id": "medical-finetuned", "object": "model", "owned_by": "local"}]}


@app.post("/v1/chat/completions")
async def chat_completions(req: ChatRequest):
    if _model is None:
        from fastapi import HTTPException
        raise HTTPException(503, "Model is still loading — retry shortly.")

    prompt = _build_prompt(req.messages, req.tools)
    inputs = _tokenizer(prompt, return_tensors="pt").to(DEVICE)
    cid     = f"chatcmpl-{uuid.uuid4().hex[:8]}"
    created = int(time.time())

    if req.stream:
        return StreamingResponse(
            _stream_sse(cid, req.model, created, inputs, req.max_tokens, req.temperature),
            media_type="text/event-stream",
        )

    # Non-streaming
    loop = asyncio.get_event_loop()
    raw  = await loop.run_in_executor(
        None, lambda: _generate_blocking(inputs, req.max_tokens, req.temperature)
    )
    text_content, tool_calls = _parse_output(raw)

    if tool_calls:
        message = {"role": "assistant", "content": text_content, "tool_calls": tool_calls}
        finish  = "tool_calls"
    else:
        message = {"role": "assistant", "content": text_content}
        finish  = "stop"

    return {
        "id": cid, "object": "chat.completion", "created": created, "model": req.model,
        "choices": [{"index": 0, "message": message, "finish_reason": finish}],
        "usage": {"prompt_tokens": -1, "completion_tokens": -1, "total_tokens": -1},
    }


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    _load_model()
    uvicorn.run(app, host="0.0.0.0", port=PORT, log_level="info")
