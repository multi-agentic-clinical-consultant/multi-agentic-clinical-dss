import { Stethoscope, Menu, X } from "lucide-react";
import { useState } from "react";

interface HeaderProps {
  onTalkToDoctor: () => void;
}

const Header = ({ onTalkToDoctor }: HeaderProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 glass-card-strong">
      <div className="container mx-auto flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
            <Stethoscope className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold text-foreground tracking-tight">
            Med<span className="text-primary">Buddy</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
          <a href="#dashboard" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Dashboard</a>
          <button
            onClick={onTalkToDoctor}
            className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Talk to Doctor
          </button>
        </nav>

        <button className="md:hidden text-foreground" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-card/95 backdrop-blur-xl px-4 py-4 flex flex-col gap-3">
          <a href="#features" className="text-sm font-medium text-muted-foreground" onClick={() => setMobileOpen(false)}>Features</a>
          <a href="#dashboard" className="text-sm font-medium text-muted-foreground" onClick={() => setMobileOpen(false)}>Dashboard</a>
          <button
            onClick={() => { onTalkToDoctor(); setMobileOpen(false); }}
            className="h-9 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold"
          >
            Talk to Doctor
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;
