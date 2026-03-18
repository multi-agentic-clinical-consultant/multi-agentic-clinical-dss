"use client";

import { useState } from "react";
import { PatientIntakeForm } from "@/components/patient-intake-form";
import { ClinicalOutput } from "@/components/clinical-output";
import { Activity, Stethoscope } from "lucide-react";
import type { PatientFormData, ClinicalState, AnalysisState } from "@/lib/types";
import { getMockClinicalState, analyzeCase } from "@/lib/api";

// Set to true to use mock data, false to connect to actual FastAPI backend
const USE_MOCK_DATA = true;

export default function ClinicalDSSPage() {
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    isLoading: false,
    error: null,
    result: null,
  });

  const handleFormSubmit = async (formData: PatientFormData) => {
    setAnalysisState({ isLoading: true, error: null, result: null });

    try {
      if (USE_MOCK_DATA) {
        // Simulate API delay for demo purposes
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const mockResult = getMockClinicalState(formData.patientId || "PT-DEMO");
        setAnalysisState({ isLoading: false, error: null, result: mockResult });
      } else {
        // Real API call to FastAPI backend
        const audioFile = formData.audioBlob
          ? new File([formData.audioBlob], "recording.wav", { type: "audio/wav" })
          : null;

        const response = await analyzeCase({
          patient_id: formData.patientId,
          medical_history: formData.medicalHistory,
          symptoms: formData.symptoms,
          image_file: formData.imageFile,
          audio_file: audioFile,
        });

        if (response.error) {
          setAnalysisState({
            isLoading: false,
            error: response.error,
            result: null,
          });
        } else {
          setAnalysisState({
            isLoading: false,
            error: null,
            result: response.data,
          });
        }
      }
    } catch (err) {
      setAnalysisState({
        isLoading: false,
        error: err instanceof Error ? err.message : "An unexpected error occurred",
        result: null,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Stethoscope className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Clinical DSS</h1>
              <p className="text-xs text-muted-foreground">
                AI-Powered Clinical Decision Support
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full bg-success/10 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="text-xs font-medium text-success">System Online</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Error Banner */}
        {analysisState.error && (
          <div className="mb-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <p className="text-sm font-medium text-destructive">
              Error: {analysisState.error}
            </p>
            <p className="mt-1 text-xs text-destructive/80">
              Please check your connection and try again.
            </p>
          </div>
        )}

        {/* Two-Panel Layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Panel: Patient Intake */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <PatientIntakeForm
              onSubmit={handleFormSubmit}
              isLoading={analysisState.isLoading}
            />
          </div>

          {/* Right Panel: Clinical Output */}
          <div className="min-h-[600px]">
            <ClinicalOutput
              result={analysisState.result}
              isLoading={analysisState.isLoading}
            />
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 border-t border-border/50 pt-6">
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
            <p className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Clinical Decision Support System v1.0
            </p>
            <p>
              {USE_MOCK_DATA
                ? "Demo Mode - Using simulated data"
                : "Connected to FastAPI Backend"}
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
