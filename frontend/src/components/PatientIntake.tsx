import { useState, useRef, useEffect } from "react";
import { Search, Mic, MicOff, Upload, User, Calendar, FileText, Loader2 } from "lucide-react";
import type { PatientRecord } from "@/types/medical";

interface PatientIntakeProps {
  onAnalyze: (data: {
    patient: PatientRecord | null;
    symptoms: string;
    isNewPatient: boolean;
    imageFile: File | null;
  }) => void;
  isAnalyzing: boolean;
  initialPatient?: PatientRecord | null;
  isNewPatient?: boolean;
}

const PatientIntake = ({ onAnalyze, isAnalyzing, initialPatient, isNewPatient: propIsNew }: PatientIntakeProps) => {
  const [name, setName] = useState(initialPatient?.name || "");
  const [age, setAge] = useState(initialPatient?.age?.toString() || "");
  const [gender, setGender] = useState(initialPatient?.gender || "");
  const [medicalHistory, setMedicalHistory] = useState(initialPatient?.medicalHistory || "");
  const [symptoms, setSymptoms] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageName, setImageName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isExisting = !!initialPatient && !propIsNew;

  useEffect(() => {
    if (initialPatient) {
      setName(initialPatient.name);
      setAge(initialPatient.age?.toString() || "");
      setGender(initialPatient.gender || "");
      setMedicalHistory(initialPatient.medicalHistory || "");
    }
  }, [initialPatient]);

  const handleRecord = async () => {
    if (!isRecording) {
      setIsRecording(true);
    } else {
      setIsRecording(false);
      try {
        const res = await fetch('/mock/transcribe', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          setSymptoms((prev) => prev + (prev ? " " : "") + data.text);
        }
      } catch (e) {
        console.error("Transcription error:", e);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImageName(file.name);
    }
  };

  const handleSubmit = () => {
    const patient: PatientRecord = {
      id: initialPatient?.id || `PT-${Date.now().toString().slice(-5)}`,
      name,
      age: parseInt(age) || 0,
      gender,
      medicalHistory,
      consultations: initialPatient?.consultations || [],
    };
    onAnalyze({ patient, symptoms, isNewPatient: !!propIsNew, imageFile });
  };

  const canSubmit = symptoms.trim().length > 0 && name.trim().length > 0;

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
        <User className="h-5 w-5 text-primary" />
        Patient Intake
      </h2>

      {/* Patient Details */}
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-1 block">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              readOnly={isExisting}
              className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground read-only:bg-muted read-only:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Age</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                readOnly={isExisting}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground read-only:bg-muted read-only:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Gender</label>
              <input
                type="text"
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                readOnly={isExisting}
                className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground read-only:bg-muted read-only:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Medical History</label>
          <textarea
            value={medicalHistory}
            onChange={(e) => setMedicalHistory(e.target.value)}
            readOnly={isExisting}
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground read-only:bg-muted read-only:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Previous consultations for returning patients */}
        {isExisting && initialPatient && initialPatient.consultations.length > 0 && (
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-primary" />
              Previous Consultations
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {initialPatient.consultations.map((c) => (
                <div key={c.id} className="p-3 rounded-lg bg-muted/50 border border-border/50 text-sm">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-medium text-foreground">{c.diagnosis.condition}</span>
                    <span className="text-xs text-muted-foreground">{c.date}</span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{c.transcript}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Symptoms */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Current Symptoms / Complaint</label>
          <textarea
            value={symptoms}
            onChange={(e) => setSymptoms(e.target.value)}
            placeholder="Describe the patient's symptoms..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={handleRecord}
            className={`mt-2 h-9 px-4 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
              isRecording
                ? "bg-destructive text-destructive-foreground animate-pulse-soft"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isRecording ? "Recording..." : "Record Voice"}
          </button>
        </div>

        {/* Image Upload */}
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block flex items-center gap-1.5">
            <FileText className="h-4 w-4 text-primary" />
            Upload X-Ray / Image
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
          >
            <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
            <p className="text-sm text-muted-foreground">
              {imageName || "Click to upload or drag and drop"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">.png, .jpg, .jpeg</p>
          </div>
          <input ref={fileInputRef} type="file" accept=".png,.jpg,.jpeg" className="hidden" onChange={handleFileChange} />
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || isAnalyzing}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
        >
          {isAnalyzing ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Search className="h-5 w-5" />
              Analyze Case
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default PatientIntake;
