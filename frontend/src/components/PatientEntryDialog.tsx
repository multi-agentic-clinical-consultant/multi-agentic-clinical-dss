import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserPlus, Loader2 } from "lucide-react";
import { findPatientById } from "@/data/mockPatients";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface PatientEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PatientEntryDialog = ({ open, onOpenChange }: PatientEntryDialogProps) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"choose" | "existing" | "new">("choose");
  const [patientId, setPatientId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // New patient fields
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");

  const handleLookup = () => {
    if (!patientId.trim()) return;
    setLoading(true);
    setError("");
    setTimeout(() => {
      const patient = findPatientById(patientId.trim());
      if (patient) {
        onOpenChange(false);
        navigate(`/dashboard?pid=${patient.id}`);
      } else {
        setError("Patient not found. Please check the ID or register as a new patient.");
      }
      setLoading(false);
    }, 500);
  };

  const handleNewPatient = () => {
    if (!name.trim()) return;
    const newId = `PT-${Date.now().toString().slice(-5)}`;
    onOpenChange(false);
    navigate(`/dashboard?pid=${newId}&name=${encodeURIComponent(name.trim())}&age=${age}&gender=${encodeURIComponent(gender)}&new=true`);
  };

  const reset = () => {
    setMode("choose");
    setPatientId("");
    setError("");
    setName("");
    setAge("");
    setGender("");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md glass-card-strong border-border/50">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-foreground">
            Welcome to MedBuddy
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {mode === "choose" && "How would you like to proceed?"}
            {mode === "existing" && "Enter your Patient ID to access your records."}
            {mode === "new" && "Register as a new patient to get started."}
          </DialogDescription>
        </DialogHeader>

        {mode === "choose" && (
          <div className="grid grid-cols-2 gap-3 pt-2">
            <button
              onClick={() => setMode("existing")}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <Search className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
              <div className="text-center">
                <p className="font-semibold text-foreground text-sm">Existing Patient</p>
                <p className="text-xs text-muted-foreground mt-1">I have a Patient ID</p>
              </div>
            </button>
            <button
              onClick={() => setMode("new")}
              className="flex flex-col items-center gap-3 p-6 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all group"
            >
              <UserPlus className="h-8 w-8 text-primary group-hover:scale-110 transition-transform" />
              <div className="text-center">
                <p className="font-semibold text-foreground text-sm">New Patient</p>
                <p className="text-xs text-muted-foreground mt-1">First time here</p>
              </div>
            </button>
          </div>
        )}

        {mode === "existing" && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Patient ID</label>
              <input
                type="text"
                placeholder="e.g. PT-10492"
                value={patientId}
                onChange={(e) => { setPatientId(e.target.value); setError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              {error && (
                <p className="text-xs text-destructive mt-1.5">{error}</p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { reset(); }}
                className="h-10 px-4 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleLookup}
                disabled={!patientId.trim() || loading}
                className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Find My Records
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Try: <span className="font-mono font-semibold text-primary cursor-pointer" onClick={() => setPatientId("PT-10492")}>PT-10492</span> or <span className="font-mono font-semibold text-primary cursor-pointer" onClick={() => setPatientId("PT-20831")}>PT-20831</span>
            </p>
          </div>
        )}

        {mode === "new" && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Full Name</label>
              <input
                type="text"
                placeholder="Enter your full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Age</label>
                <input
                  type="number"
                  placeholder="Age"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Gender</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full h-11 px-3 rounded-lg border border-input bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { reset(); }}
                className="h-10 px-4 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleNewPatient}
                disabled={!name.trim()}
                className="flex-1 h-10 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Start Consultation
              </button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              A unique Patient ID will be assigned to you automatically.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PatientEntryDialog;
