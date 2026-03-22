"use client";

import { useState, useEffect, useCallback } from "react";
import { ConsultationRoom } from "@/components/consultation-room";
import { PrescriptionReport } from "@/components/prescription-report";
import { XRayAnalyzer } from "@/components/xray-analyzer";
import {
  Stethoscope,
  Activity,
  Shield,
  Clock,
  ChevronRight,
  Loader2,
  HeartPulse,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type AppState = "join" | "consultation" | "processing" | "report" | "error" | "xray";

interface TokenData {
  token: string;
  room: string;
  patient_id: string;
  livekit_url: string;
}

export default function Home() {
  const [appState, setAppState] = useState<AppState>("join");
  const [patientName, setPatientName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [pollCount, setPollCount] = useState(0);

  // ── Poll for report after call ends ──────────────────────────────────────
  useEffect(() => {
    if (appState !== "processing" || !tokenData?.patient_id) return;

    const patientId = tokenData.patient_id;
    let attempts = 0;
    const MAX_ATTEMPTS = 40; // 2 minutes at 3s intervals

    const poll = async () => {
      attempts++;
      setPollCount(attempts);
      try {
        const res = await fetch(`${API_URL}/api/report/${patientId}/latest`);
        if (res.ok) {
          const data = await res.json();
          setReport(data);
          setAppState("report");
          return true;
        }
        if (res.status === 404) {
          // Patient not found yet — session still saving
          return false;
        }
      } catch {
        // network error, keep polling
      }
      return false;
    };

    const interval = setInterval(async () => {
      if (attempts >= MAX_ATTEMPTS) {
        clearInterval(interval);
        setErrorMsg("Report generation timed out. Please check back later.");
        setAppState("error");
        return;
      }
      const done = await poll();
      if (done) clearInterval(interval);
    }, 3000);

    return () => clearInterval(interval);
  }, [appState, tokenData]);

  // ── Start consultation ────────────────────────────────────────────────────
  const handleStart = async () => {
    const name = nameInput.trim();
    if (!name) return;
    setIsStarting(true);
    try {
      const patientId = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
      const res = await fetch(
        `${API_URL}/api/token?patient_name=${encodeURIComponent(name)}&patient_id=${encodeURIComponent(patientId)}`
      );
      if (!res.ok) throw new Error(`Token request failed: ${res.status}`);
      const data: TokenData = await res.json();
      setPatientName(name);
      setTokenData(data);
      setAppState("consultation");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not connect. Is the backend running?");
      setAppState("error");
    } finally {
      setIsStarting(false);
    }
  };

  // ── Session ended (user clicked End or room disconnected) ─────────────────
  const handleSessionEnd = useCallback(() => {
    setAppState("processing");
    setPollCount(0);
  }, []);

  // ── Reset ────────────────────────────────────────────────────────────────
  const handleReset = () => {
    setAppState("join");
    setNameInput("");
    setPatientName("");
    setTokenData(null);
    setReport(null);
    setErrorMsg("");
    setPollCount(0);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (appState === "consultation" && tokenData) {
    return (
      <ConsultationRoom
        token={tokenData.token}
        serverUrl={tokenData.livekit_url}
        roomName={tokenData.room}
        patientName={patientName}
        patientId={tokenData.patient_id}
        onSessionEnd={handleSessionEnd}
      />
    );
  }

  const handleRegenerate = async () => {
    // Prefer IDs from the report; fall back to the token from the last session
    let patientId = (report as Record<string, string>)?.patient_id || tokenData?.patient_id || "";
    let sessionId = (report as Record<string, string>)?.session_id || "";

    if (!patientId) throw new Error("Cannot determine patient ID. Please start a new consultation.");

    // If session_id is missing, fetch the latest session for this patient
    if (!sessionId) {
      const sessRes = await fetch(`${API_URL}/api/sessions/${patientId}`);
      if (!sessRes.ok) throw new Error(`Could not fetch sessions for patient '${patientId}'.`);
      const sessData = await sessRes.json();
      const sessions: string[] = sessData.sessions ?? [];
      if (sessions.length === 0) throw new Error("No sessions found. Please complete a consultation first.");
      sessionId = sessions[sessions.length - 1]; // most recent
    }

    const res = await fetch(`${API_URL}/api/report/${patientId}/${sessionId}/regenerate`, {
      method: "POST",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Server error ${res.status}`);
    }
    const fresh = await res.json();
    setReport(fresh);
  };

  if (appState === "report" && report) {
    return (
      <PrescriptionReport
        report={report}
        onNewConsultation={handleReset}
        onRegenerate={handleRegenerate}
      />
    );
  }

  if (appState === "processing") {
    return <ProcessingScreen pollCount={pollCount} />;
  }

  if (appState === "xray") {
    return <XRayAnalyzer onBack={handleReset} />;
  }

  if (appState === "error") {
    return <ErrorScreen message={errorMsg} onRetry={handleReset} />;
  }

  // ── Join Screen ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col">
      {/* Header */}
      <header className="border-b border-blue-100 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md">
              <Stethoscope className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800 tracking-tight">MedBuddy AI</p>
              <p className="text-xs text-slate-500">Intelligent Health Consultation</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-emerald-700">System Online</span>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Info */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 border border-blue-200 px-4 py-1.5 text-sm font-medium text-blue-700">
                <HeartPulse className="h-4 w-4" />
                AI-Powered Voice Consultation
              </div>
              <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
                Your health,{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
                  guided by AI
                </span>
              </h1>
              <p className="text-lg text-slate-600 leading-relaxed">
                Speak naturally with Dr. Aria, your AI health consultant. Get
                a personalized prescription report with do&apos;s, don&apos;ts,
                diet advice, and follow-up guidance — all powered by clinical AI.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { icon: Activity, label: "Real-time Voice", desc: "Natural conversation" },
                { icon: Shield, label: "RxNorm Validated", desc: "Safe prescriptions" },
                { icon: Clock, label: "Instant Report", desc: "After every session" },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="flex gap-3 p-3 rounded-xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                    <Icon className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-700">{label}</p>
                    <p className="text-xs text-slate-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Join card */}
          <div className="w-full max-w-sm mx-auto lg:mx-0 lg:ml-auto">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
              {/* Card header */}
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-6 py-8 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/20 ring-4 ring-white/30">
                  <img
                    src="/placeholder-user.jpg"
                    alt="Dr. Aria"
                    className="h-16 w-16 rounded-full object-cover"
                    onError={(e) => {
                      const t = e.target as HTMLImageElement;
                      t.style.display = "none";
                      t.parentElement!.innerHTML =
                        '<span class="text-3xl">👩‍⚕️</span>';
                    }}
                  />
                </div>
                <h2 className="text-xl font-bold text-white">Dr. Aria</h2>
                <p className="mt-1 text-blue-200 text-sm">AI Health Consultant</p>
                <div className="mt-3 flex items-center justify-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-blue-100">Available now</span>
                </div>
              </div>

              {/* Card body */}
              <div className="px-6 py-6 space-y-5">
                <div>
                  <label
                    htmlFor="patient-name"
                    className="block text-sm font-semibold text-slate-700 mb-2"
                  >
                    Your name
                  </label>
                  <input
                    id="patient-name"
                    type="text"
                    placeholder="e.g. Keshav"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !isStarting && handleStart()}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 placeholder-slate-400 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all"
                    autoFocus
                    maxLength={60}
                  />
                </div>

                <button
                  onClick={handleStart}
                  disabled={!nameInput.trim() || isStarting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                  {isStarting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Connecting…
                    </>
                  ) : (
                    <>
                      Start Consultation
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                <div className="relative flex items-center gap-3">
                  <div className="flex-1 border-t border-slate-200" />
                  <span className="text-xs text-slate-400">or</span>
                  <div className="flex-1 border-t border-slate-200" />
                </div>

                <button
                  onClick={() => setAppState("xray")}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-all"
                >
                  🩻 Analyze X-Ray
                </button>

                <p className="text-center text-xs text-slate-400 leading-relaxed">
                  By continuing, you acknowledge this is an AI assistant and
                  not a substitute for professional medical advice.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/60 py-4">
        <p className="text-center text-xs text-slate-400">
          MedBuddy AI · Clinical Decision Support System · For educational use only
        </p>
      </footer>
    </div>
  );
}

// ── Processing screen ─────────────────────────────────────────────────────────
function ProcessingScreen({ pollCount }: { pollCount: number }) {
  const steps = [
    "Saving consultation transcript…",
    "Running clinical diagnosis pipeline…",
    "Validating medications with RxNorm…",
    "Checking drug interactions…",
    "Generating prescription report…",
    "Adding personalised guidance…",
  ];
  const step = steps[Math.min(Math.floor(pollCount / 2), steps.length - 1)];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-sm">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 ring-8 ring-blue-50">
          <Loader2 className="h-9 w-9 text-blue-600 animate-spin" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-800">Preparing your report</h2>
          <p className="text-sm text-slate-500">{step}</p>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-blue-600 h-1.5 rounded-full transition-all duration-700"
            style={{ width: `${Math.min(((pollCount / 40) * 100), 95)}%` }}
          />
        </div>
        <p className="text-xs text-slate-400">This usually takes 30–60 seconds</p>
      </div>
    </div>
  );
}

// ── Error screen ──────────────────────────────────────────────────────────────
function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-6">
      <div className="text-center space-y-5 max-w-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <span className="text-3xl">⚠️</span>
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800 mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-500">{message}</p>
        </div>
        <button
          onClick={onRetry}
          className="px-6 py-2.5 rounded-xl bg-slate-800 text-sm font-semibold text-white hover:bg-slate-700 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
