"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertTriangle,
  Activity,
  FileText,
  CheckCircle2,
  XCircle,
  Scan,
  Clock,
} from "lucide-react";
import type { ClinicalState } from "@/lib/types";
import { getConfidenceLevel, getConfidenceColor } from "@/lib/types";

interface ClinicalOutputProps {
  result: ClinicalState | null;
  isLoading: boolean;
}

export function ClinicalOutput({ result, isLoading }: ClinicalOutputProps) {
  if (isLoading) {
    return (
      <Card className="flex h-full items-center justify-center border-border/50 shadow-lg">
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
          <div>
            <p className="text-lg font-medium text-foreground">
              Analyzing Case...
            </p>
            <p className="text-sm text-muted-foreground">
              AI is processing the clinical data
            </p>
          </div>
        </div>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card className="flex h-full items-center justify-center border-border/50 shadow-lg">
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Activity className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="text-lg font-medium text-foreground">
              No Analysis Yet
            </p>
            <p className="text-sm text-muted-foreground">
              Fill in the patient intake form and click &quot;Analyze Case&quot;
              to see AI-generated clinical insights
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const confidenceLevel = getConfidenceLevel(result.confidence);
  const confidenceColorClass = getConfidenceColor(confidenceLevel);

  return (
    <Card className="h-full overflow-auto border-border/50 shadow-lg">
      <CardHeader className="border-b border-border/50 bg-card">
        <CardTitle className="flex items-center gap-3 text-xl font-semibold text-foreground">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Activity className="h-5 w-5 text-accent" />
          </div>
          Clinical Analysis
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6 p-6">
        {/* Diagnosis & Alert Section */}
        <DiagnosisSection
          diagnosis={result.diagnosis}
          confidence={result.confidence}
          confidenceLevel={confidenceLevel}
          confidenceColorClass={confidenceColorClass}
          patientId={result.patient_id}
          timestamp={result.timestamp}
        />

        {/* SOAP Notes Section */}
        <SOAPSection soapNote={result.soap_note} />

        {/* X-Ray Findings Section */}
        {result.xray_findings && (
          <XRaySection findings={result.xray_findings} />
        )}
      </CardContent>
    </Card>
  );
}

// Diagnosis Section Component
function DiagnosisSection({
  diagnosis,
  confidence,
  confidenceLevel,
  confidenceColorClass,
  patientId,
  timestamp,
}: {
  diagnosis: string;
  confidence: number;
  confidenceLevel: string;
  confidenceColorClass: string;
  patientId: string;
  timestamp: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border/50 bg-muted/20 p-4">
      {/* Patient & Timestamp */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {patientId || "No ID"}
          </Badge>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {new Date(timestamp).toLocaleString()}
        </div>
      </div>

      {/* Diagnosis */}
      <div>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Diagnosis
        </h3>
        <p className="text-xl font-semibold text-foreground">{diagnosis}</p>
      </div>

      {/* Confidence Meter */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">
            Confidence Score
          </span>
          <span className="text-sm font-semibold text-foreground">
            {confidence}%
          </span>
        </div>
        <div className="relative h-3 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full transition-all duration-500 ${confidenceColorClass}`}
            style={{ width: `${confidence}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {confidenceLevel === "high" && "High confidence - AI is confident in this assessment"}
          {confidenceLevel === "medium" && "Medium confidence - Review recommended"}
          {confidenceLevel === "low" && "Low confidence - Human verification required"}
        </p>
      </div>

    </div>
  );
}

// SOAP Notes Section Component
function SOAPSection({ soapNote }: { soapNote: ClinicalState["soap_note"] }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        <FileText className="h-4 w-4" />
        SOAP Note
      </h3>
      <Accordion type="multiple" defaultValue={["subjective", "assessment"]} className="w-full">
        <AccordionItem value="subjective" className="border-border/50">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            Subjective
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            {soapNote.subjective}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="objective" className="border-border/50">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            Objective
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            {soapNote.objective}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="assessment" className="border-border/50">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            Assessment
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            {soapNote.assessment}
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="plan" className="border-border/50">
          <AccordionTrigger className="text-sm font-medium hover:no-underline">
            Plan
          </AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            {soapNote.plan}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

// X-Ray Findings Section Component
function XRaySection({
  findings,
}: {
  findings: NonNullable<ClinicalState["xray_findings"]>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
        <Scan className="h-4 w-4" />
        X-Ray Findings
      </h3>
      <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
        {/* Detected Conditions */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Detected Conditions
          </p>
          <div className="flex flex-wrap gap-2">
            {findings.detected_conditions.map((condition, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {condition}
              </Badge>
            ))}
          </div>
        </div>

        {/* Probabilities */}
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Detection Probabilities
          </p>
          <div className="flex flex-col gap-2">
            {Object.entries(findings.probabilities).map(([key, value]) => (
              <div key={key} className="flex items-center gap-3">
                <span className="w-32 text-xs capitalize text-foreground">
                  {key.replace(/_/g, " ")}
                </span>
                <div className="flex-1">
                  <Progress value={value * 100} className="h-2" />
                </div>
                <span className="w-12 text-right text-xs text-muted-foreground">
                  {(value * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* LLM Suggestions */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            AI Analysis
          </p>
          <p className="text-sm text-muted-foreground">
            {findings.llm_suggestions}
          </p>
        </div>
      </div>
    </div>
  );
}

