import { Link } from "react-router-dom";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";

export default function Landing() {
  return (
    <main className="min-h-screen bg-[#f5ead3] text-[#3a2e1f] flex flex-col">
      <header className="flex items-center justify-between p-6">
        <h1 className="text-2xl font-serif">Foto-Jagd</h1>
        <nav className="flex items-center gap-4">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="rounded bg-[#c4543a] px-4 py-2 text-white">Anmelden</button>
            </SignInButton>
          </SignedOut>
          <SignedIn>
            <Link to="/dashboard" className="underline">
              Dashboard
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </nav>
      </header>

      <section className="mx-auto max-w-2xl flex-1 px-6 py-12 text-center">
        <h2 className="text-4xl font-serif mb-4">Deine eigene Foto-Jagd</h2>
        <p className="mb-8">
          Erstelle eine Party, teile einen Code, lass die Gäste Bilder hochladen. Alle Fotos
          landen in deinem privaten Album.
        </p>
        <p className="text-sm text-[#8b6542]">Platzhalter — Landing &amp; Pricing folgen.</p>
      </section>
    </main>
  );
}
