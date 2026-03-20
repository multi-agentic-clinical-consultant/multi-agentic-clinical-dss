import { Mic, Brain, FileImage, ClipboardList, ArrowDown } from "lucide-react";
import heroImage from "@/assets/hero-medical.png";

interface HeroSectionProps {
  onTalkToDoctor: () => void;
  onGetStarted: () => void;
}

const HeroSection = ({ onTalkToDoctor, onGetStarted }: HeroSectionProps) => {
  return (
    <section className="relative min-h-[90vh] flex items-center gradient-hero pt-16">
      <div className="container mx-auto px-4 py-16">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6">
              <Brain className="h-3.5 w-3.5" />
              AI-Powered Clinical Assistant
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight text-balance">
              MedBuddy
              <span className="block text-primary mt-1">Your AI Doctor Assistant</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-lg leading-relaxed">
              Voice-enabled symptom analysis, X-ray interpretation, and instant clinical documentation — all in one intelligent platform.
            </p>

            <div className="flex flex-wrap gap-4 mt-8">
              <button
                onClick={onTalkToDoctor}
                className="h-12 px-8 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:opacity-90 transition-all shadow-lg shadow-primary/20"
              >
                Talk to Doctor
              </button>
              <button
                onClick={onGetStarted}
                className="h-12 px-8 rounded-xl bg-secondary text-secondary-foreground font-semibold text-base hover:bg-secondary/80 transition-all"
              >
                Start Consultation
              </button>
            </div>

            <div className="flex flex-wrap gap-6 mt-10">
              {[
                { icon: Mic, label: "Voice Input" },
                { icon: FileImage, label: "X-Ray Analysis" },
                { icon: ClipboardList, label: "SOAP Notes" },
                { icon: Brain, label: "AI Diagnosis" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="h-4 w-4 text-primary" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="hidden lg:flex justify-center animate-fade-in" style={{ animationDelay: "0.2s" }}>
            <img
              src={heroImage}
              alt="MedBuddy AI Doctor Assistant"
              className="w-full max-w-md drop-shadow-2xl"
            />
          </div>
        </div>
      </div>

      <button
        onClick={onGetStarted}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce text-muted-foreground hover:text-primary transition-colors"
        aria-label="Scroll to dashboard"
      >
        <ArrowDown className="h-6 w-6" />
      </button>
    </section>
  );
};

export default HeroSection;
