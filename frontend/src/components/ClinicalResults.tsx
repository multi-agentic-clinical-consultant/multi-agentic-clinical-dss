import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Pill, UserCheck, Activity, FileText, Stethoscope } from "lucide-react";
import type { DiagnosisResult, Prescription, Referral } from "@/types/medical";

interface ClinicalResultsProps {
  diagnosis: DiagnosisResult;
  prescriptions: Prescription[];
  referrals: Referral[];
}

const ConfidenceBar = ({ value }: { value: number }) => {
  const color = value >= 85 ? "confidence-bar-green" : value >= 50 ? "confidence-bar-yellow" : "confidence-bar-red";
  return (
    <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${value}%` }} />
    </div>
  );
};

const AccordionItem = ({ title, icon: Icon, children, defaultOpen = false }: {
  title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-4 text-sm text-foreground leading-relaxed">{children}</div>}
    </div>
  );
};

const ClinicalResults = ({ diagnosis, prescriptions, referrals }: ClinicalResultsProps) => {
  return (
    <div className="glass-card rounded-2xl p-6 space-y-5 animate-slide-in-right">
      <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        Clinical Results
      </h2>

      {/* Diagnosis */}
      <div className="p-4 rounded-xl bg-muted/40 border border-border/50 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-bold text-foreground">{diagnosis.condition}</h3>
          {diagnosis.requiresHumanReview && (
            <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-semibold">
              <AlertTriangle className="h-3.5 w-3.5" />
              Doctor Review Required
            </span>
          )}
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Confidence</span>
            <span className="font-semibold">{diagnosis.confidence}%</span>
          </div>
          <ConfidenceBar value={diagnosis.confidence} />
        </div>
      </div>

      {/* SOAP Note */}
      <div className="space-y-2">
        <AccordionItem title="Subjective" icon={FileText} defaultOpen>
          {diagnosis.soapNote.subjective}
        </AccordionItem>
        <AccordionItem title="Objective" icon={Stethoscope}>
          {diagnosis.soapNote.objective}
        </AccordionItem>
        <AccordionItem title="Assessment" icon={Activity}>
          {diagnosis.soapNote.assessment}
        </AccordionItem>
        <AccordionItem title="Plan" icon={FileText}>
          {diagnosis.soapNote.plan}
        </AccordionItem>
      </div>

      {/* X-Ray Findings */}
      {diagnosis.xrayFindings && diagnosis.xrayFindings.length > 0 && (
        <AccordionItem title="X-Ray Findings" icon={FileText}>
          <div className="space-y-3">
            {diagnosis.xrayFindings.map((f, i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-medium">{f.condition}</span>
                  <span className="text-xs font-semibold text-primary">{(f.probability * 100).toFixed(0)}%</span>
                </div>
                <p className="text-xs text-muted-foreground">{f.suggestion}</p>
              </div>
            ))}
          </div>
        </AccordionItem>
      )}

      {/* Prescriptions */}
      {prescriptions.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
            <Pill className="h-4 w-4 text-primary" />
            Prescriptions
          </h3>
          <div className="space-y-2">
            {prescriptions.map((p, i) => (
              <div key={i} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm text-foreground">{p.medication}</span>
                  <span className="text-xs font-medium text-primary">{p.dosage}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{p.frequency} • {p.duration}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{p.instructions}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Referrals */}
      {referrals.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
            <UserCheck className="h-4 w-4 text-primary" />
            Referrals
          </h3>
          <div className="space-y-2">
            {referrals.map((r, i) => (
              <div key={i} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-sm text-foreground">{r.specialistType}</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    r.urgency === "emergency" ? "bg-destructive/10 text-destructive" :
                    r.urgency === "urgent" ? "bg-warning/10 text-warning" :
                    "bg-primary/10 text-primary"
                  }`}>{r.urgency}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{r.reason}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClinicalResults;
