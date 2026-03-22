"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useVoiceAssistant,
  useRoomContext,
  BarVisualizer,
} from "@livekit/components-react";
import { RoomEvent, type TranscriptionSegment, type Participant } from "livekit-client";
import {
  PhoneOff,
  Mic,
  MicOff,
  Clock,
  Stethoscope,
  User,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  text: string;
  speaker: "doctor" | "patient";
  final: boolean;
  ts: number;
}

interface ConsultationRoomProps {
  token: string;
  serverUrl: string;
  roomName: string;
  patientName: string;
  patientId: string;
  onSessionEnd: () => void;
}

// ── Root wrapper (provides LiveKitRoom) ──────────────────────────────────────
export function ConsultationRoom(props: ConsultationRoomProps) {
  const { token, serverUrl, onSessionEnd, ...rest } = props;

  return (
    <LiveKitRoom
      token={token}
      serverUrl={serverUrl}
      connect
      audio
      video={false}
      onDisconnected={onSessionEnd}
      className="h-screen"
    >
      <RoomAudioRenderer />
      <ConsultationUI onSessionEnd={onSessionEnd} {...rest} />
    </LiveKitRoom>
  );
}

// ── Inner UI (has access to LiveKit hooks) ────────────────────────────────────
function ConsultationUI({
  patientName,
  onSessionEnd,
}: {
  patientName: string;
  patientId: string;
  roomName: string;
  onSessionEnd: () => void;
}) {
  const room = useRoomContext();
  const { state: agentState, audioTrack } = useVoiceAssistant();

  const [messages, setMessages] = useState<Message[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Session timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  // ── Transcription listener ─────────────────────────────────────────────────

  // Strip Groq inline tool-call markup before displaying
  const cleanTranscriptText = (raw: string): string => {
    let text = raw
      .replace(/<function=[^>]+>[\s\S]*?(?:<\/function>|$)/g, "")
      .replace(/\s*\{"(?:diagnosis|symptoms|patient_history)"[\s\S]*/g, "")
      .trim();
    return text;
  };

  useEffect(() => {
    const handleTranscription = (
      segments: TranscriptionSegment[],
      participant: Participant | undefined
    ) => {
      const isDoctor = participant?.isAgent ?? false;

      setMessages((prev) => {
        const next = [...prev];
        for (const seg of segments) {
          const cleaned = cleanTranscriptText(seg.text);
          if (!cleaned) continue; // pure tool call — skip entirely

          const idx = next.findIndex((m) => m.id === seg.id);
          const msg: Message = {
            id: seg.id,
            text: cleaned,
            speaker: isDoctor ? "doctor" : "patient",
            final: seg.final,
            ts: Date.now(),
          };
          if (idx >= 0) {
            next[idx] = msg;
          } else {
            next.push(msg);
          }
        }
        return next;
      });
    };

    room.on(RoomEvent.TranscriptionReceived, handleTranscription);
    return () => {
      room.off(RoomEvent.TranscriptionReceived, handleTranscription);
    };
  }, [room]);

  // ── Auto-scroll transcript ────────────────────────────────────────────────
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Mute toggle ───────────────────────────────────────────────────────────
  const toggleMute = useCallback(async () => {
    const local = room.localParticipant;
    if (!local) return;
    await local.setMicrophoneEnabled(isMuted);
    setIsMuted((m) => !m);
  }, [room, isMuted]);

  // ── End call ──────────────────────────────────────────────────────────────
  const handleEndCall = useCallback(async () => {
    await room.disconnect();
    onSessionEnd();
  }, [room, onSessionEnd]);

  // ── Agent state display ───────────────────────────────────────────────────
  const stateConfig: Record<string, { label: string; color: string; pulse: boolean }> = {
    disconnected: { label: "Waiting to connect…", color: "text-slate-400", pulse: false },
    connecting:   { label: "Connecting…",         color: "text-blue-400",  pulse: true  },
    initializing: { label: "Initialising…",       color: "text-blue-400",  pulse: true  },
    listening:    { label: "Listening…",           color: "text-emerald-400", pulse: true },
    thinking:     { label: "Thinking…",            color: "text-amber-400", pulse: true  },
    speaking:     { label: "Speaking…",            color: "text-blue-400",  pulse: true  },
  };
  const cfg = stateConfig[agentState] ?? stateConfig.disconnected;

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-white/10 bg-white/5 px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/80">
            <Stethoscope className="h-4 w-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">MediConsult AI</p>
            <p className="text-xs text-slate-400">Secure consultation</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-mono text-slate-300">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            {formatTime(elapsed)}
          </div>
          <div className={`flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium ${cfg.color}`}>
            {cfg.pulse && <span className={`h-2 w-2 rounded-full bg-current ${cfg.pulse ? "animate-pulse" : ""}`} />}
            {cfg.label}
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: Doctor panel */}
        <aside className="flex w-72 shrink-0 flex-col items-center justify-between border-r border-white/10 bg-white/5 px-6 py-8">
          <div className="flex flex-col items-center gap-5 text-center">
            {/* Avatar */}
            <div className="relative">
              <div
                className={`flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-5xl shadow-2xl ring-4 transition-all duration-500 ${
                  agentState === "speaking"
                    ? "ring-blue-400 shadow-blue-500/40"
                    : agentState === "listening"
                    ? "ring-emerald-400 shadow-emerald-500/20"
                    : "ring-white/10"
                }`}
              >
                👩‍⚕️
              </div>
              {/* Ripple when speaking */}
              {agentState === "speaking" && (
                <span className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping opacity-40" />
              )}
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">Dr. Aria</h2>
              <p className="text-xs text-slate-400 mt-0.5">AI Health Consultant</p>
            </div>

            {/* Audio visualizer */}
            {audioTrack && (
              <div className="w-full rounded-xl bg-white/5 p-3">
                <BarVisualizer
                  track={audioTrack}
                  barCount={20}
                  className="h-12 w-full"
                  style={{ "--lk-bar-color": "#60a5fa" } as React.CSSProperties}
                />
              </div>
            )}

            {/* State badge */}
            <div className={`rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium ${cfg.color}`}>
              {cfg.label}
            </div>
          </div>

          {/* Patient info */}
          <div className="w-full rounded-xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700">
                <User className="h-4 w-4 text-slate-300" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-slate-400">Patient</p>
                <p className="text-sm font-semibold text-white truncate">{patientName}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Right: Chat transcript */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-white/10 bg-white/5 px-6 py-3">
            <h3 className="text-sm font-semibold text-slate-300">Live Transcript</h3>
          </div>

          <div
            ref={transcriptRef}
            className="flex-1 overflow-y-auto px-6 py-5 space-y-4 scrollbar-thin scrollbar-thumb-white/10"
          >
            {messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center space-y-2">
                  <p className="text-4xl">💬</p>
                  <p className="text-slate-400 text-sm">Conversation will appear here…</p>
                  <p className="text-slate-500 text-xs">Start speaking to begin</p>
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))
            )}
          </div>
        </main>
      </div>

      {/* ── Bottom controls ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-4 border-t border-white/10 bg-white/5 px-6 py-5 backdrop-blur-sm">
        {/* Mute */}
        <button
          onClick={toggleMute}
          className={`flex h-12 w-12 items-center justify-center rounded-full border transition-all ${
            isMuted
              ? "border-red-400/50 bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "border-white/20 bg-white/10 text-slate-300 hover:bg-white/20"
          }`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* End call */}
        <button
          onClick={handleEndCall}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-900/50 hover:bg-red-500 active:scale-95 transition-all"
          title="End consultation"
        >
          <PhoneOff className="h-6 w-6" />
        </button>

        <p className="text-xs text-slate-500 max-w-[160px] text-center leading-tight">
          End call to generate your prescription report
        </p>
      </div>
    </div>
  );
}

// ── Chat bubble ───────────────────────────────────────────────────────────────
function ChatBubble({ message }: { message: Message }) {
  const isDoctor = message.speaker === "doctor";

  return (
    <div className={`flex gap-3 ${isDoctor ? "justify-start" : "justify-end"}`}>
      {isDoctor && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600/80 text-sm mt-1">
          👩‍⚕️
        </div>
      )}
      <div
        className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition-opacity duration-200 ${
          message.final ? "opacity-100" : "opacity-60"
        } ${
          isDoctor
            ? "rounded-tl-sm bg-white/10 text-slate-100 border border-white/10"
            : "rounded-tr-sm bg-blue-600 text-white"
        }`}
      >
        {!message.final && (
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-current opacity-70 animate-pulse" />
        )}
        {message.text}
      </div>
      {!isDoctor && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-600 text-sm mt-1">
          <User className="h-4 w-4 text-slate-300" />
        </div>
      )}
    </div>
  );
}
