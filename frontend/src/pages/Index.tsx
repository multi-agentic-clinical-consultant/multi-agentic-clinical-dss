import { useState } from "react";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import Footer from "@/components/Footer";
import PatientEntryDialog from "@/components/PatientEntryDialog";
import { Activity, Mic, Brain, ClipboardList, FileImage } from "lucide-react";

const Index = () => {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Header onTalkToDoctor={() => setDialogOpen(true)} />

      <HeroSection
        onTalkToDoctor={() => setDialogOpen(true)}
        onGetStarted={() => setDialogOpen(true)}
      />

      {/* Features Strip */}
      <section id="features" className="py-16 border-t border-border/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "Voice-First Input", desc: "Speak naturally — MedBuddy transcribes and understands your symptoms in real time.", icon: Mic },
              { title: "Intelligent Analysis", desc: "AI-powered differential diagnosis with confidence scoring and clinical decision support.", icon: Brain },
              { title: "Complete Documentation", desc: "Automated SOAP notes, prescriptions, and referral letters generated instantly.", icon: ClipboardList },
            ].map((f) => (
              <div key={f.title} className="glass-card rounded-2xl p-6 text-center">
                <f.icon className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="text-base font-bold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 border-t border-border/30">
        <div className="container mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground text-center mb-10">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "1", title: "Enter Patient Info", desc: "New or returning — we auto-load your history." },
              { step: "2", title: "Describe Symptoms", desc: "Type or use voice input to describe your complaint." },
              { step: "3", title: "Upload Imaging", desc: "Optionally attach X-rays for AI analysis." },
              { step: "4", title: "Get Results", desc: "Receive diagnosis, SOAP notes, prescriptions & referrals." },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold mx-auto mb-3">
                  {s.step}
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">{s.title}</h3>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-10">
            <button
              onClick={() => setDialogOpen(true)}
              className="h-12 px-8 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-all shadow-lg shadow-primary/20"
            >
              Start Consultation
            </button>
          </div>
        </div>
      </section>

      <Footer />

      <PatientEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
};

export default Index;
