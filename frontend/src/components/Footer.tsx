import { Stethoscope, Heart, Shield } from "lucide-react";

const Footer = () => (
  <footer className="border-t border-border/50 bg-muted/30 py-10 mt-16">
    <div className="container mx-auto px-4">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Stethoscope className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold text-foreground">Med<span className="text-primary">Buddy</span></span>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <span className="flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> HIPAA Compliant</span>
          <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" /> Built with Care</span>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 MedBuddy. For informational purposes only.</p>
      </div>
    </div>
  </footer>
);

export default Footer;
