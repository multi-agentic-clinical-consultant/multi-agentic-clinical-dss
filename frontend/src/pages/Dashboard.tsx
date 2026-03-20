import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Activity, ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import PatientIntake from "@/components/PatientIntake";
import ClinicalResults from "@/components/ClinicalResults";
import ChatInterface from "@/components/ChatInterface";
import Footer from "@/components/Footer";
import PatientEntryDialog from "@/components/PatientEntryDialog";
import { findPatientById } from "@/data/mockPatients";
import type { PatientRecord, DiagnosisResult, Prescription, Referral } from "@/types/medical";

const Dashboard = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<{
    diagnosis: DiagnosisResult;
    prescriptions: Prescription[];
    referrals: Referral[];
  } | null>(null);

  const pid = searchParams.get("pid");
  const isNew = searchParams.get("new") === "true";
  const paramName = searchParams.get("name") || "";
  const paramAge = searchParams.get("age") || "";
  const paramGender = searchParams.get("gender") || "";

  const existingPatient = pid ? findPatientById(pid) : null;

  const initialPatient: PatientRecord | null = existingPatient || (isNew && pid ? {
    id: pid,
    name: paramName,
    age: parseInt(paramAge) || 0,
    gender: paramGender,
    medicalHistory: "",
    consultations: [],
  } : null);

  useEffect(() => {
    if (!pid) {
      navigate("/");
    }
  }, [pid, navigate]);

  const handleAnalyze = async (data: {
    patient: PatientRecord | null;
    symptoms: string;
    isNewPatient: boolean;
    imageFile: File | null;
  }) => {
    setIsAnalyzing(true);
    setResults(null);

    try {
      const response = await fetch('/mock/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: data.patient?.id,
          symptoms: data.symptoms,
          hasImage: !!data.imageFile
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze patient case');
      }

      const result = await response.json();
      setResults(result);
    } catch (error) {
      console.error("Analysis failed:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!pid) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header onTalkToDoctor={() => setDialogOpen(true)} />

      <section className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-4 mb-8">
            <button
              onClick={() => navigate("/")}
              className="h-9 px-3 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              Home
            </button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
                <Activity className="h-6 w-6 text-primary" />
                Clinical Dashboard
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Patient: <span className="font-semibold text-foreground">{initialPatient?.name || pid}</span>
                <span className="ml-2 font-mono text-xs text-primary">{pid}</span>
                {isNew && <span className="ml-2 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">New Patient</span>}
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6 items-start">
            <PatientIntake
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
              initialPatient={initialPatient}
              isNewPatient={isNew}
            />
            <div>
              {results ? (
                <ClinicalResults
                  diagnosis={results.diagnosis}
                  prescriptions={results.prescriptions}
                  referrals={results.referrals}
                />
              ) : (
                <div className="glass-card rounded-2xl p-12 flex flex-col items-center justify-center text-center min-h-[300px]">
                  <Activity className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-base font-semibold text-muted-foreground">Results will appear here</h3>
                  <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
                    Describe symptoms and click "Analyze Case" to generate clinical results.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <Footer />
      <ChatInterface isOpen={chatOpen} onClose={() => setChatOpen(false)} />
      <PatientEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
};

export default Dashboard;
