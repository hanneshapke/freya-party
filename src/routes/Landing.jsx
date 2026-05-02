import { Link } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { Camera, Compass, Star } from "lucide-react";

import JournalShell from "../components/JournalShell.jsx";
import CompassRose from "../components/CompassRose.jsx";
import Stamp from "../components/Stamp.jsx";

export default function Landing() {
  return (
    <JournalShell>
      <header className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Compass size={20} className="text-terracotta" strokeWidth={1.5} />
          <span className="eyebrow-tight">Foto-Jagd</span>
        </div>
        <nav className="flex items-center gap-4">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn-stamp">Anmelden</button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link
              to="/dashboard"
              className="text-xs uppercase tracking-widest font-bold text-ink-muted hover:text-terracotta transition-colors"
            >
              Dashboard
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </nav>
      </header>

      <section className="min-h-[80vh] flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden">
        <div className="absolute top-12 left-6 text-ink-muted opacity-40">
          <CompassRose size={60} />
        </div>
        <div className="absolute bottom-12 right-6 text-ink-muted opacity-30 rotate-45">
          <Compass size={50} strokeWidth={1} />
        </div>

        <div className="max-w-xl text-center relative z-10">
          <div className="mb-8 flex justify-center">
            <Stamp rotate="-rotate-6">
              <Compass size={56} className="text-ink" strokeWidth={1.5} />
            </Stamp>
          </div>

          <p className="eyebrow mb-3">Foto-Jagd für deine Party</p>

          <h1 className="font-serif text-6xl md:text-7xl text-ink leading-[0.9] mb-4">
            Deine eigene
            <br />
            <span className="italic text-terracotta">Foto-Jagd</span>
          </h1>

          <div className="flex items-center justify-center gap-3 my-6">
            <div className="h-px bg-ink-muted w-12 opacity-50" />
            <Star size={14} className="text-terracotta" fill="currentColor" />
            <div className="h-px bg-ink-muted w-12 opacity-50" />
          </div>

          <p className="text-ink-soft text-lg leading-relaxed mb-10 font-serif italic">
            Erstelle eine Party, teile einen Code, lass die Gäste Bilder hochladen — alle
            Fotos landen in deinem privaten Album.
          </p>

          <SignedOut>
            <SignInButton mode="modal">
              <button className="btn-stamp px-10 py-4 text-sm">Los geht's!</button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link to="/dashboard" className="btn-stamp inline-block px-10 py-4 text-sm">
              Zum Dashboard →
            </Link>
          </SignedIn>

          <p className="mt-10 text-xs text-ink-muted tracking-wider flex items-center justify-center gap-2">
            <Camera size={14} /> Viel Spaß beim Fotografieren!
          </p>
        </div>
      </section>
    </JournalShell>
  );
}
