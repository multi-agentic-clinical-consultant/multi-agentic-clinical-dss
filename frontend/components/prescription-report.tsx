"use client";

import { useState } from "react";
import {
  Stethoscope,
  User,
  Calendar,
  Clock,
  FileText,
  Pill,
  CheckCircle2,
  XCircle,
  Salad,
  ShieldAlert,
  AlertTriangle,
  CalendarClock,
  Plus,
  Printer,
  RefreshCw,
  Loader2,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Medicine {
  medicine_name?: string;
  name?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  route?: string;
  special_instructions?: string;
  instructions?: string;
}

interface ReportData {
  report_id?: string;
  generated_at?: string;
  doctor_name?: string;
  patient_id?: string;
  session_id?: string;
  consultation_date?: string;
  consultation_start?: string;
  consultation_end?: string;
  consultation_duration?: string;
  patient_name?: string;
  chief_complaint?: string;
  symptoms?: string[];
  diagnosis?: string;
  prescription?: Medicine[];
  dos?: string[];
  donts?: string[];
  diet_recommendations?: string[];
  precautions?: string[];
  emergency_signs?: string[];
  follow_up?: string;
  additional_notes?: string;
}

interface PrescriptionReportProps {
  report: Record<string, unknown>;
  onNewConsultation: () => void;
  onRegenerate?: () => Promise<void>;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function PrescriptionReport({ report: raw, onNewConsultation, onRegenerate }: PrescriptionReportProps) {
  const r = raw as ReportData;
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const handleRegenerate = async () => {
    if (!onRegenerate) return;
    setRegenerating(true);
    setRegenError(null);
    try {
      await onRegenerate();
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : "Failed to regenerate report.");
    } finally {
      setRegenerating(false);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString("en-IN", {
        day: "numeric", month: "long", year: "numeric",
      });
    } catch { return iso; }
  };

  const formatTime = (iso?: string) => {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleTimeString("en-IN", {
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return iso; }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 pb-12">

      {/* ── Sticky header ──────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
              <Stethoscope className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">MedBuddy AI</p>
              <p className="text-xs text-slate-500">Prescription Report</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </button>
            {onRegenerate && (
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Re-generate this report from the saved transcript"
              >
                {regenerating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                {regenerating ? "Generating…" : "Regenerate Report"}
              </button>
            )}
            <button
              onClick={onNewConsultation}
              className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              New Consultation
            </button>
          </div>
        </div>
      </header>

      {regenError && (
        <div className="mx-auto max-w-4xl px-4 pt-4">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            <span>⚠️ {regenError}</span>
            <button onClick={() => setRegenError(null)} className="ml-4 text-red-500 hover:text-red-700 font-bold">✕</button>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">

        {/* ── Report meta banner ─────────────────────────────────────── */}
        <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white shadow-lg">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-blue-200 text-xs font-medium uppercase tracking-wider mb-1">Consultation Report</p>
              <h1 className="text-2xl font-bold">{r.patient_name || "Patient"}</h1>
              <p className="mt-1 text-blue-200 text-sm">{r.chief_complaint || "General consultation"}</p>
            </div>
            <div className="text-right text-sm">
              <p className="text-blue-200 text-xs">Report ID</p>
              <p className="font-mono font-semibold">{r.report_id || "—"}</p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Calendar,  label: "Date",     value: formatDate(r.consultation_start) },
              { icon: Clock,     label: "Time",     value: formatTime(r.consultation_start) },
              { icon: FileText,  label: "Duration", value: r.consultation_duration || "—" },
              { icon: User,      label: "Doctor",   value: r.doctor_name || "Dr. Aria" },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="rounded-xl bg-white/10 px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="h-3 w-3 text-blue-200" />
                  <p className="text-xs text-blue-200">{label}</p>
                </div>
                <p className="text-sm font-semibold truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Diagnosis ─────────────────────────────────────────────── */}
        <Section title="Diagnosis" icon={<FileText className="h-4 w-4" />}>
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
            <p className="text-slate-800 font-medium leading-relaxed">
              {r.diagnosis || "See consultation notes"}
            </p>
            {r.symptoms && r.symptoms.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {r.symptoms.map((s, i) => (
                  <span key={i} className="rounded-full bg-blue-100 border border-blue-200 px-3 py-0.5 text-xs text-blue-700 font-medium">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* ── Prescription ───────────────────────────────────────────── */}
        <Section title="Prescription" icon={<Pill className="h-4 w-4" />}>
          {r.prescription && r.prescription.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Medicine</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Dosage</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide hidden sm:table-cell">Frequency</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide hidden md:table-cell">Route</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 text-xs uppercase tracking-wide">Instructions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {r.prescription.map((med, i) => (
                    <tr key={i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {med.medicine_name || med.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{med.dosage || "—"}</td>
                      <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{med.frequency || "—"}</td>
                      <td className="px-4 py-3 text-slate-600 hidden md:table-cell capitalize">{med.route || "oral"}</td>
                      <td className="px-4 py-3 text-slate-600 text-xs leading-relaxed">
                        {med.special_instructions || med.instructions || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyCard text="No medications prescribed at this time." />
          )}
        </Section>

        {/* ── Dos & Don'ts ───────────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Dos */}
          <Section title="Do's" icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} accent="emerald">
            <ul className="space-y-2">
              {(r.dos ?? []).length > 0 ? (
                r.dos!.map((item, i) => (
                  <ListItem key={i} text={item} icon="✅" color="text-emerald-700" />
                ))
              ) : (
                <EmptyCard text="No specific recommendations." small />
              )}
            </ul>
          </Section>

          {/* Don'ts */}
          <Section title="Don'ts" icon={<XCircle className="h-4 w-4 text-red-500" />} accent="red">
            <ul className="space-y-2">
              {(r.donts ?? []).length > 0 ? (
                r.donts!.map((item, i) => (
                  <ListItem key={i} text={item} icon="❌" color="text-red-700" />
                ))
              ) : (
                <EmptyCard text="No specific restrictions." small />
              )}
            </ul>
          </Section>
        </div>

        {/* ── Diet & Precautions ─────────────────────────────────────── */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Diet */}
          <Section title="Diet Recommendations" icon={<Salad className="h-4 w-4 text-green-600" />} accent="green">
            <ul className="space-y-2">
              {(r.diet_recommendations ?? []).length > 0 ? (
                r.diet_recommendations!.map((item, i) => (
                  <ListItem key={i} text={item} icon="🥗" color="text-green-700" />
                ))
              ) : (
                <EmptyCard text="No specific dietary advice." small />
              )}
            </ul>
          </Section>

          {/* Precautions */}
          <Section title="Precautions" icon={<ShieldAlert className="h-4 w-4 text-amber-600" />} accent="amber">
            <ul className="space-y-2">
              {(r.precautions ?? []).length > 0 ? (
                r.precautions!.map((item, i) => (
                  <ListItem key={i} text={item} icon="⚠️" color="text-amber-700" />
                ))
              ) : (
                <EmptyCard text="No special precautions noted." small />
              )}
            </ul>
          </Section>
        </div>

        {/* ── Emergency signs ────────────────────────────────────────── */}
        {(r.emergency_signs ?? []).length > 0 && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-red-800 text-sm">Emergency Warning Signs</h3>
                <p className="text-xs text-red-600">Seek immediate medical care if any of these occur</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {r.emergency_signs!.map((sign, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg bg-red-100 px-3 py-2">
                  <span className="mt-0.5 text-sm">🚨</span>
                  <p className="text-sm text-red-800 leading-snug">{sign}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Follow-up ─────────────────────────────────────────────── */}
        {r.follow_up && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
              <CalendarClock className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm mb-1">Follow-up Plan</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{r.follow_up}</p>
            </div>
          </div>
        )}

        {/* ── Additional notes ───────────────────────────────────────── */}
        {r.additional_notes && r.additional_notes !== "Not mentioned" && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100">
              <Plus className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-sm mb-1">Additional Notes</h3>
              <p className="text-slate-600 text-sm leading-relaxed">{r.additional_notes}</p>
            </div>
          </div>
        )}

        {/* ── Disclaimer ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-semibold">⚠️ Disclaimer:</span> This report is generated by an AI assistant
            for informational purposes only. It does not replace a formal diagnosis or prescription from
            a licensed healthcare professional. Always consult your doctor before starting, stopping, or
            changing any medication.
          </p>
        </div>

        {/* ── CTA ────────────────────────────────────────────────────── */}
        <div className="text-center pt-2">
          <button
            onClick={onNewConsultation}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-blue-200 hover:shadow-lg hover:shadow-blue-300 transition-all active:scale-95"
          >
            <RefreshCw className="h-4 w-4" />
            Start New Consultation
          </button>
        </div>
      </main>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Section({
  title,
  icon,
  accent = "blue",
  children,
}: {
  title: string;
  icon: React.ReactNode;
  accent?: string;
  children: React.ReactNode;
}) {
  const accentMap: Record<string, string> = {
    blue:    "bg-blue-50 border-blue-200",
    emerald: "bg-emerald-50 border-emerald-200",
    red:     "bg-red-50 border-red-200",
    green:   "bg-green-50 border-green-200",
    amber:   "bg-amber-50 border-amber-200",
  };
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${accentMap[accent] ?? "border-slate-200"}`}>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white shadow-sm border border-slate-200">
          {icon}
        </div>
        <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wide">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function ListItem({ text, icon, color }: { text: string; icon: string; color: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 text-sm shrink-0">{icon}</span>
      <p className={`text-sm leading-snug ${color}`}>{text}</p>
    </li>
  );
}

function EmptyCard({ text, small }: { text: string; small?: boolean }) {
  return (
    <div className={`rounded-lg bg-slate-50 border border-slate-200 text-center ${small ? "py-3" : "py-6"}`}>
      <p className="text-xs text-slate-400">{text}</p>
    </div>
  );
}
