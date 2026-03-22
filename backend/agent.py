"""
AI Doctor Voice Agent
=====================
Real-time voice consultation powered by LiveKit with:
  - STT:  Deepgram nova-2
  - LLM:  Groq llama-3.3-70b (OpenAI-compatible endpoint)
  - TTS:  Deepgram Aura (or ElevenLabs if ELEVENLABS_API_KEY is set)
  - VAD:  Silero
  - RAG:  Moss semantic search over medical knowledge base (optional)
  - Store: JSON conversation files per patient session
  - Background: LangGraph prescription pipeline runs after session ends
"""

import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv
from livekit import agents, rtc
from livekit.agents import Agent, AgentSession, RunContext
from livekit.agents.llm import function_tool
from livekit.plugins import deepgram, openai, silero

load_dotenv()

logger = logging.getLogger("ai_doctor")
logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
)
from inferedge_moss import MossClient, QueryOptions

# ── ElevenLabs TTS (optional) ─────────────────────────────────────────────────
_USE_ELEVENLABS = bool(os.environ.get("ELEVENLABS_API_KEY"))
if _USE_ELEVENLABS:
    try:
        from livekit.plugins import elevenlabs
    except ImportError:
        _USE_ELEVENLABS = False
        logger.warning("livekit-plugins-elevenlabs not installed – using Deepgram TTS.")

# ── Doctor system prompt ──────────────────────────────────────────────────────
DOCTOR_INSTRUCTIONS = """
You are Dr. Aria, a warm and caring AI doctor. Think of yourself as a trusted friend who happens to have deep medical expertise — someone patients feel completely at ease with.

Your personality:
- Genuinely warm and human. Use everyday language, not clinical jargon.
- Show real empathy: "Oh, that sounds really uncomfortable" or "I can totally understand why that would worry you."
- Keep responses short and conversational — this is a voice call, so 2–3 natural sentences at a time.
- Ask only ONE follow-up question at a time. Never fire multiple questions at once.
- If the patient shares their name, use it naturally. If not, just talk to them warmly.
- Light reassurance goes a long way: "You were right to bring this up" or "We'll figure this out together."
- Never read out lists or bullet points — weave everything naturally into speech.

Before giving any medical guidance, always call `search_patient_history` first to check if the patient has mentioned anything relevant in past sessions.

Safety rules:
- If the patient describes a possible emergency (severe chest pain, can't breathe, stroke symptoms, etc.), calmly but firmly tell them to call emergency services or go to the ER immediately.
- Don't name or recommend specific prescription medications out loud — a detailed prescription report is prepared after the call ends.
- Always suggest the patient follow up with a licensed physician for a formal diagnosis.
""".strip()


class DoctorAgent(Agent):
    """LiveKit Agent acting as an AI doctor consultant."""

    def __init__(
        self,
        patient_id: str,
        session_id: str,
    ) -> None:
        super().__init__(instructions=DOCTOR_INSTRUCTIONS)

        self._patient_id = patient_id
        self._session_id = session_id

        # Moss setup
        moss_project_id = os.environ.get("MOSS_PROJECT_ID", "")
        moss_project_key = os.environ.get("MOSS_PROJECT_KEY", "")
        # Per-patient history index (sanitise patient_id to safe chars)
        safe_pid = "".join(c if c.isalnum() or c == "_" else "_" for c in patient_id)[:24]
        self._history_index_name = f"hist_{safe_pid}"
        self._history_index_ready = False
        self._msg_counter = 0

        self._moss_client = MossClient(moss_project_id, moss_project_key)

    async def on_enter(self) -> None:
        """Called when the agent session starts – initialise patient history index."""
        await super().on_enter()
        await self._ensure_history_index()

    async def _ensure_history_index(self) -> None:
        """Load the patient history index, creating it if it doesn't exist."""
        try:
            await self._moss_client.load_index(self._history_index_name)
            self._history_index_ready = True
            logger.info("Patient history index '%s' ready.", self._history_index_name)
        except Exception:
            # Index probably doesn't exist yet — try to create it
            try:
                await self._moss_client.create_index(self._history_index_name)
                self._history_index_ready = True
                logger.info("Created new patient history index '%s'.", self._history_index_name)
            except Exception as e:
                logger.warning("Could not create history index '%s': %s", self._history_index_name, e)

    async def store_message(self, role: str, content: str) -> None:
        """Store a conversation message in the patient's Moss history index."""
        self._msg_counter += 1
        doc = {
            "id": f"{self._session_id}_{self._msg_counter:04d}",
            "text": f"{role.upper()}: {content}",
            "metadata": {
                "session_id": self._session_id,
                "role": role,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        }
        try:
            await self._moss_client.add_documents(self._history_index_name, [doc])
        except Exception:
            logger.debug("Failed to store message in Moss history", exc_info=True)

    # ── Tools ─────────────────────────────────────────────────────────────────

    @function_tool
    async def search_patient_history(self, context: RunContext, query: str) -> str:
        """
        Search this patient's past consultation history for relevant context.
        Call this at the start of each response to maintain continuity.
        """
        if not self._history_index_ready:
            return "No prior history available for this patient."

        query = query.strip()
        if not query:
            return "Empty query."

        try:
            results = await self._moss_client.query(
                self._history_index_name,
                query,
                QueryOptions(top_k=5),
            )
            docs = list(getattr(results, "docs", []) or [])
            if not docs:
                return "No relevant history found for this patient."
            texts = [(doc.text or "").strip() for doc in docs if doc.text]
            logger.info("History search returned %d docs for: %s", len(texts), query)
            return "\n".join(texts)
        except Exception:
            logger.exception("Patient history search failed")
            return "Could not retrieve patient history."



# ── Entry point ───────────────────────────────────────────────────────────────

async def entrypoint(ctx: agents.JobContext) -> None:
    """
    Called once per incoming LiveKit room connection.
    job.metadata can carry the patient_id (set from the client or token).
    """
    from conversation_store import ConversationStore

    patient_id: str = (ctx.job.metadata or "").strip() or f"patient_{uuid.uuid4().hex[:8]}"
    session_id: str = (
        f"session_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
        f"_{uuid.uuid4().hex[:6]}"
    )

    logger.info("New session: patient=%s  session=%s", patient_id, session_id)

    store = ConversationStore(data_dir="data/conversations")
    store.create_session(patient_id, session_id)

    # ── Build TTS plugin ──────────────────────────────────────────────────────
    # Use Deepgram Aura by default (same key as STT, no extra permissions needed).
    # Set USE_ELEVENLABS=true in .env to switch to ElevenLabs (requires a key
    # with the text_to_speech permission scope enabled).
    use_elevenlabs = (
        _USE_ELEVENLABS
        and os.environ.get("USE_ELEVENLABS", "false").lower() == "true"
    )
    if use_elevenlabs:
        tts_plugin = elevenlabs.TTS(
            voice_id=os.environ.get("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb"),
            api_key=os.environ["ELEVENLABS_API_KEY"],
        )
        logger.info("TTS: ElevenLabs")
    else:
        tts_plugin = deepgram.TTS(model="aura-asteria-en")
        logger.info("TTS: Deepgram Aura")

    session = AgentSession(
        stt=deepgram.STT(model="nova-2"),
        llm=openai.LLM(
            model=os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
            base_url="https://api.groq.com/openai/v1",
            api_key=os.environ["GROQ_API_KEY"],
        ),
        tts=tts_plugin,
        vad=silero.VAD.load(),
    )

    # ── Build agent (keep reference for Moss history storage) ─────────────────
    doctor = DoctorAgent(patient_id=patient_id, session_id=session_id)

    # ── Capture transcript in real time + push to Moss history ────────────────
    messages_log: list[dict] = []

    @session.on("user_speech_committed")
    def _on_user(ev) -> None:
        msg = getattr(ev, "message", ev)
        text = getattr(msg, "text_content", None) or getattr(msg, "content", None)
        if text:
            text = str(text).strip()
            messages_log.append(
                {"role": "user", "content": text, "timestamp": datetime.now(timezone.utc).isoformat()}
            )
            asyncio.create_task(doctor.store_message("user", text))

    @session.on("agent_speech_committed")
    def _on_agent(ev) -> None:
        msg = getattr(ev, "message", ev)
        text = getattr(msg, "text_content", None) or getattr(msg, "content", None)
        if text:
            text = str(text).strip()
            messages_log.append(
                {"role": "assistant", "content": text, "timestamp": datetime.now(timezone.utc).isoformat()}
            )
            asyncio.create_task(doctor.store_message("assistant", text))

    # ── Start agent ───────────────────────────────────────────────────────────
    await session.start(
        room=ctx.room,
        agent=doctor,
    )

    await session.generate_reply(
        instructions=(
            "Greet the patient warmly and naturally — like you're genuinely happy to see them. "
            "Introduce yourself as Dr. Aria. Keep it short and inviting, then ask what's on their mind today."
        )
    )

    # ── Wait for disconnect ───────────────────────────────────────────────────
    # In livekit-agents 1.x, JobContext has no wait_for_disconnect().
    # Instead, listen to the room's "disconnected" event.
    disconnect_event = asyncio.Event()

    def _on_room_disconnected(*_args) -> None:
        disconnect_event.set()

    ctx.room.on("disconnected", _on_room_disconnected)
    await disconnect_event.wait()
    ctx.room.off("disconnected", _on_room_disconnected)

    # ── Finalize conversation JSON ─────────────────────────────────────────────
    # Fall back to session history if real-time capture missed messages
    if not messages_log:
        history = getattr(session, "history", None)
        if history:
            from livekit.agents import ChatMessage as CM
            for item in list(getattr(history, "items", [])):
                if isinstance(item, CM) and item.text_content:
                    messages_log.append(
                        {
                            "role": item.role,
                            "content": item.text_content.strip(),
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        }
                    )

    store.save_messages(patient_id, session_id, messages_log)
    store.end_session(patient_id, session_id)
    logger.info(
        "Session %s ended. %d messages saved. Launching prescription pipeline …",
        session_id,
        len(messages_log),
    )

    # ── Trigger background prescription pipeline ──────────────────────────────
    asyncio.create_task(_run_prescription_pipeline(patient_id, session_id, store))


async def _run_prescription_pipeline(
    patient_id: str,
    session_id: str,
    store,
) -> None:
    """Run LangGraph prescription workflow in the background after call ends."""
    from graph.workflow import build_prescription_workflow

    try:
        conversation = store.get_session(patient_id, session_id)
        if not conversation:
            logger.error("Prescription pipeline: no conversation found for %s/%s", patient_id, session_id)
            return

        messages = conversation.get("messages", [])
        if not messages:
            logger.warning("Prescription pipeline: no messages for session %s", session_id)
            return

        full_transcript = "\n".join(
            f"{m['role'].upper()}: {m['content']}" for m in messages
        )

        logger.info("Prescription pipeline: invoking workflow for session %s …", session_id)

        workflow = build_prescription_workflow()

        # Run sync LangGraph in executor to avoid blocking async loop
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            lambda: workflow.invoke(
                {
                    "patient_id": patient_id,
                    "session_id": session_id,
                    "full_transcript": full_transcript,
                    "patient_history": "No known allergies or past conditions.",
                    "diagnosis": None,
                    "confidence": None,
                    "prescription": None,
                    "soap_note": None,
                }
            ),
        )

        store.save_prescription(
            patient_id,
            session_id,
            {
                "diagnosis": result.get("diagnosis"),
                "confidence": result.get("confidence"),
                "prescription": result.get("prescription"),
                "soap_note": result.get("soap_note"),
                "generated_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        logger.info("Prescription saved for session %s.", session_id)

    except Exception:
        logger.exception("Prescription pipeline failed for session %s", session_id)


if __name__ == "__main__":
    agents.cli.run_app(agents.WorkerOptions(entrypoint_fnc=entrypoint))
