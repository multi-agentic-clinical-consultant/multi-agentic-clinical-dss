"use client";

import { useCallback, useRef, useState } from "react";
import {
  Stethoscope,
  Upload,
  X,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  Printer,
  RefreshCw,
  Activity,
  Bone,
  Eye,
  Info,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FractureDetail {
  location?: string;
  type?: string;
  displacement?: string;
  open_or_closed?: string;
  additional_notes?: string;
}

interface DislocationDetail {
  joint?: string;
  direction?: string;
  associated_fracture?: string;
  additional_notes?: string;
}

interface XRayReport {
  report_id?: string;
  generated_at?: string;
  model_used?: string;
  xray_type?: string;
  technique?: string;
  findings?: Record<string, string>;
  fractures?: FractureDetail[];
  dislocations?: DislocationDetail[];
  alignment?: string;
  impression?: string;
  recommendations?: string[];
  primary_diagnosis?: string;
  severity?: "normal" | "mild" | "moderate" | "severe";
  confidence?: number;
  requires_urgent_review?: boolean;
  detected_pathologies?: Record<string, number>;
  disclaimer?: string;
}

// ── Helper ────────────────────────────────────────────────────────────────────
function toLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface XRayAnalyzerProps {
  onBack: () => void;
}

// ── Severity config ───────────────────────────────────────────────────────────
const severityConfig = {
  normal:   { label: "Normal",   bg: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" },
  mild:     { label: "Mild",     bg: "bg-yellow-100",  text: "text-yellow-800",  border: "border-yellow-300"  },
  moderate: { label: "Moderate", bg: "bg-orange-100",  text: "text-orange-800",  border: "border-orange-300"  },
  severe:   { label: "Severe",   bg: "bg-red-100",     text: "text-red-800",     border: "border-red-300"     },
};

// ── Main component ─────────────────────────────────────────────────────────────
export function XRayAnalyzer({ onBack }: XRayAnalyzerProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<XRayReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── File handling ────────────────────────────────────────────────────────
  const handleFile = useCallback((f: File) => {
    if (!f.type.startsWith("image/")) {
      setError("Please upload a JPEG, PNG, or WebP image.");
      return;
    }
    setFile(f);
    setReport(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) handleFile(picked);
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setReport(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  // ── Analysis ──────────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_URL}/api/xray/analyze`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || `Server error ${res.status}`);
      }
      const data: XRayReport = await res.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const sev = report?.severity && severityConfig[report.severity]
    ? severityConfig[report.severity]
    : severityConfig.normal;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
                <Stethoscope className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800">X-Ray Analysis</p>
                <p className="text-xs text-slate-500">AI-powered radiology report</p>
              </div>
            </div>
          </div>
          {report && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </button>
              <button
                onClick={clearFile}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                New Analysis
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 space-y-6">
        {/* ── Upload panel ────────────────────────────────────────────── */}
        {!report && (
          <div className="grid md:grid-cols-2 gap-6">
            {/* Drop zone */}
            <div className="space-y-4">
              <div
                onDrop={onDrop}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onClick={() => inputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all ${
                  dragging
                    ? "border-blue-500 bg-blue-50"
                    : file
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-slate-300 bg-white hover:border-blue-400 hover:bg-blue-50/50"
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={onInputChange}
                />
                {file ? (
                  <>
                    <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
                    <p className="text-sm font-semibold text-emerald-700">{file.name}</p>
                    <p className="text-xs text-emerald-600 mt-1">
                      {(file.size / 1024).toFixed(0)} KB — ready to analyze
                    </p>
                    <button
                      onClick={(e) => { e.stopPropagation(); clearFile(); }}
                      className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:text-red-500 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </>
                ) : (
                  <>
                    <Upload className="h-10 w-10 text-slate-400 mb-3" />
                    <p className="text-sm font-semibold text-slate-700">
                      Drag & drop or click to upload
                    </p>
                    <p className="text-xs text-slate-500 mt-1">JPEG · PNG · WebP</p>
                    <p className="text-xs text-slate-400 mt-3 text-center leading-relaxed max-w-[200px]">
                      Chest, bone, joint, spine — any X-ray type supported
                    </p>
                  </>
                )}
              </div>

              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <button
                onClick={handleAnalyze}
                disabled={!file || loading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing X-ray…
                  </>
                ) : (
                  <>
                    <Activity className="h-4 w-4" />
                    Analyze X-Ray
                  </>
                )}
              </button>

              {loading && (
                <p className="text-center text-xs text-slate-500 animate-pulse">
                  Running AI radiology analysis — this takes 10–20 seconds…
                </p>
              )}
            </div>

            {/* Image preview */}
            <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm flex items-center justify-center min-h-[300px]">
              {preview ? (
                <img
                  src={preview}
                  alt="X-ray preview"
                  className="max-h-[400px] w-full object-contain p-2"
                />
              ) : (
                <div className="text-center p-8">
                  <div className="text-5xl mb-3">🩻</div>
                  <p className="text-sm text-slate-400">Image preview will appear here</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Report ──────────────────────────────────────────────────── */}
        {report && (
          <div className="space-y-5">
            {/* Banner */}
            <div className={`rounded-2xl border p-5 shadow-sm ${
              report.requires_urgent_review
                ? "bg-red-50 border-red-300"
                : "bg-gradient-to-r from-blue-600 to-indigo-700 text-white"
            }`}>
              {report.requires_urgent_review && (
                <div className="flex items-center gap-2 mb-3 text-red-800">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-bold text-sm uppercase tracking-wide">
                    Urgent Radiologist Review Required
                  </span>
                </div>
              )}
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className={`text-xs font-medium uppercase tracking-wider mb-1 ${report.requires_urgent_review ? "text-red-600" : "text-blue-200"}`}>
                    Primary Diagnosis
                  </p>
                  <h2 className={`text-xl font-bold ${report.requires_urgent_review ? "text-red-900" : "text-white"}`}>
                    {report.primary_diagnosis || "See findings below"}
                  </h2>
                  {report.xray_type && (
                    <p className={`text-xs mt-1 font-medium ${report.requires_urgent_review ? "text-red-700" : "text-blue-100"}`}>
                      {report.xray_type}
                    </p>
                  )}
                  <p className={`text-xs mt-0.5 ${report.requires_urgent_review ? "text-red-500" : "text-blue-200"}`}>
                    {report.technique}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${sev.bg} ${sev.text} ${sev.border}`}>
                    {sev.label} severity
                  </span>
                  {typeof report.confidence === "number" && (
                    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${
                      report.requires_urgent_review
                        ? "bg-red-100 text-red-700 border-red-300"
                        : "bg-white/20 text-white border-white/30"
                    }`}>
                      {Math.round(report.confidence * 100)}% confidence
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Findings grid — dynamic, adapts to any X-ray type */}
            {report.findings && Object.keys(report.findings).length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 border border-blue-200">
                    <Eye className="h-4 w-4 text-blue-600" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Findings</h3>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {Object.entries(report.findings).map(([key, val]) => (
                    <div key={key} className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                        {toLabel(key)}
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed">{val}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fractures */}
            {report.fractures && report.fractures.length > 0 && (
              <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-orange-300">
                    <Bone className="h-4 w-4 text-orange-600" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                    Fractures Detected ({report.fractures.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {report.fractures.map((frac, i) => (
                    <div key={i} className="rounded-xl bg-white border border-orange-200 p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-orange-800">{frac.location}</p>
                        {frac.type && (
                          <span className="shrink-0 rounded-full bg-orange-100 border border-orange-300 px-2 py-0.5 text-xs font-medium text-orange-700">
                            {frac.type}
                          </span>
                        )}
                      </div>
                      {frac.displacement && (
                        <p className="text-xs text-slate-600">
                          <span className="font-medium">Displacement:</span> {frac.displacement}
                        </p>
                      )}
                      {frac.open_or_closed && frac.open_or_closed.toLowerCase() !== "cannot determine" && (
                        <p className="text-xs text-slate-600">
                          <span className="font-medium">Wound:</span> {frac.open_or_closed}
                        </p>
                      )}
                      {frac.additional_notes && (
                        <p className="text-xs text-slate-500 italic">{frac.additional_notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dislocations */}
            {report.dislocations && report.dislocations.length > 0 && (
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-violet-300">
                    <AlertTriangle className="h-4 w-4 text-violet-600" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                    Dislocations / Subluxations ({report.dislocations.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {report.dislocations.map((dis, i) => (
                    <div key={i} className="rounded-xl bg-white border border-violet-200 p-3 space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-violet-800 capitalize">{dis.joint} joint</p>
                        {dis.direction && (
                          <span className="shrink-0 rounded-full bg-violet-100 border border-violet-300 px-2 py-0.5 text-xs font-medium text-violet-700 capitalize">
                            {dis.direction}
                          </span>
                        )}
                      </div>
                      {dis.associated_fracture && dis.associated_fracture.toLowerCase() !== "no" && (
                        <p className="text-xs text-slate-600">
                          <span className="font-medium">Associated fracture:</span> {dis.associated_fracture}
                        </p>
                      )}
                      {dis.additional_notes && (
                        <p className="text-xs text-slate-500 italic">{dis.additional_notes}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Alignment */}
            {report.alignment && (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 border border-slate-200">
                  <Activity className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Alignment</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{report.alignment}</p>
                </div>
              </div>
            )}

            {/* Impression */}
            {report.impression && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-indigo-200">
                    <Info className="h-4 w-4 text-indigo-600" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Impression</h3>
                </div>
                <p className="text-sm text-indigo-900 leading-relaxed whitespace-pre-line">
                  {report.impression}
                </p>
              </div>
            )}

            {/* Recommendations */}
            {report.recommendations && report.recommendations.length > 0 && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white border border-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">Recommendations</h3>
                </div>
                <ul className="space-y-2">
                  {report.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <p className="text-sm text-emerald-900 leading-snug">{rec}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Detected pathologies (TorchXRayVision) */}
            {report.detected_pathologies && Object.keys(report.detected_pathologies).length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 border border-slate-200">
                    <Activity className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">
                      Pathology Probability Scores
                    </h3>
                    <p className="text-xs text-slate-400">Generated by TorchXRayVision DenseNet121</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(report.detected_pathologies).map(([name, prob]) => (
                    <div key={name} className="flex items-center gap-3">
                      <p className="text-xs text-slate-600 w-32 shrink-0 font-medium">{name}</p>
                      <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            prob > 0.6
                              ? "bg-red-500"
                              : prob > 0.3
                              ? "bg-amber-400"
                              : "bg-blue-400"
                          }`}
                          style={{ width: `${Math.min(prob * 100, 100)}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-500 w-10 text-right font-mono">
                        {(prob * 100).toFixed(0)}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Image + metadata row */}
            {preview && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-900 overflow-hidden shadow-sm flex items-center justify-center">
                  <img
                    src={preview}
                    alt="Analyzed X-ray"
                    className="max-h-[300px] w-full object-contain"
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Report Metadata</h4>
                  {[
                    { label: "X-Ray Type",    value: report.xray_type },
                    { label: "Report ID",     value: report.report_id },
                    { label: "Generated",     value: report.generated_at ? new Date(report.generated_at).toLocaleString("en-IN") : undefined },
                    { label: "AI Model",      value: report.model_used },
                    { label: "Technique",     value: report.technique },
                  ].map(({ label, value }) =>
                    value ? (
                      <div key={label}>
                        <p className="text-xs text-slate-400">{label}</p>
                        <p className="text-sm text-slate-700 font-medium">{value}</p>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {/* Disclaimer */}
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-semibold">⚠️ Disclaimer:</span>{" "}
                {report.disclaimer ||
                  "This report is AI-generated and has NOT been reviewed by a licensed radiologist. It must not be used for clinical decision-making without professional medical review."}
              </p>
            </div>

            {/* CTA */}
            <div className="flex justify-center gap-3 pt-2">
              <button
                onClick={clearFile}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-200 hover:shadow-lg transition-all active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                Analyze Another X-Ray
              </button>
              <button
                onClick={onBack}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Home
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
