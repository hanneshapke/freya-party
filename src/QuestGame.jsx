import { useState, useEffect, useRef } from "react";
import {
  Camera,
  Compass,
  Heart,
  Users,
  Flower2,
  PartyPopper,
  Home,
  Smile,
  Gift,
  Sparkles,
  Upload,
  Check,
  ArrowLeft,
  Trophy,
  X,
  RotateCcw,
  Star,
  Award,
  Clock,
  Laugh,
  ScrollText,
  MessageCircleHeart,
} from "lucide-react";
import { initializeApp, getApps } from "firebase/app";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";

// ---------- FIREBASE ----------
// Values come from VITE_FIREBASE_* environment variables (see .env).
const firebaseConfig = {
  apiKey: import.meta.env?.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env?.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env?.VITE_FIREBASE_APP_ID,
};

const firebaseApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const storage = getStorage(firebaseApp);

// Create a URL-safe slug from a name for use in storage paths.
const slugify = (str) =>
  String(str || "anon")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "anon";

// Upload a single File to Firebase Storage under a structured path.
// Returns the download URL.
const uploadToFirebase = async (file, { questId, explorerName, index }) => {
  const ts = Date.now();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `submissions/${questId}/${slugify(explorerName)}/${ts}-${index}.${ext}`;
  const fileRef = storageRef(storage, path);
  const snapshot = await uploadBytes(fileRef, file, {
    contentType: file.type || "image/jpeg",
    customMetadata: {
      questId,
      explorerName: explorerName || "",
    },
  });
  const url = await getDownloadURL(snapshot.ref);
  return { url, path };
};

// POST the final submission metadata to our Vercel API route.
const recordSubmission = async (payload) => {
  const res = await fetch("/api/submissions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Submission failed (${res.status})`);
  }
  return res.json();
};

// ---------- QUEST DATA ----------
const QUESTS = [
  {
    id: "q1",
    icon: Heart,
    title: "Finde Freya",
    tagline: "Mach ein Foto zusammen mit Freya",
    xp: 15,
    difficulty: 1,
    clue: "Die Königin des Tages! Schnapp dir Freya für ein Foto — ein Selfie zusammen, ein Umarmungsfoto oder ein lustiges Gesicht.",
    color: "#d4538a",
  },
  {
    id: "q2",
    icon: Users,
    title: "Freunde",
    tagline: "Mach Fotos mit einem oder mehreren Gästen",
    xp: 15,
    difficulty: 1,
    clue: "Schau dich um — all diese tollen Menschen sind heute hier für Freya. Sammle ein paar von ihnen auf deinen Fotos!",
    color: "#7a93b5",
  },
  {
    id: "q3",
    icon: Flower2,
    title: "Frühling",
    tagline: "Fotografiere etwas, das den Frühling zeigt",
    xp: 15,
    difficulty: 2,
    clue: "Der Frühling ist überall — Blüten, junges Grün, warmes Licht. Finde ein Stück davon und halte es fest.",
    color: "#5a7a3d",
  },
  {
    id: "q4",
    icon: PartyPopper,
    title: "Party",
    tagline: "Fotografiere Momente von der Party",
    xp: 20,
    difficulty: 2,
    clue: "Luftballons, Deko, Kuchen, Tanz — was macht diese Party zur Party? Zeig es mit deiner Kamera.",
    color: "#c4543a",
  },
  {
    id: "q5",
    icon: Home,
    title: "Erinnerungen",
    tagline: "Fotografiere etwas im Haus, das dich an Freya erinnert",
    xp: 20,
    difficulty: 3,
    clue: "Irgendwo im Haus versteckt sich etwas, das typisch für Freya ist — ein Lieblingsspielzeug, ein Foto, ein Gegenstand. Finde es!",
    color: "#9b5fc2",
  },
  {
    id: "q6",
    icon: Smile,
    title: "Lustiges",
    tagline: "Fotografiere etwas zum Lachen",
    xp: 15,
    difficulty: 2,
    clue: "Etwas Albernes, ein komisches Gesicht, ein lustiger Moment — was bringt dich heute zum Kichern?",
    color: "#d49134",
  },
  {
    id: "q7",
    icon: Gift,
    title: "Andenken",
    tagline: "Fotografiere etwas, das dich an heute erinnert",
    xp: 20,
    difficulty: 2,
    clue: "Ein kleines Stück dieses Tages zum Mitnehmen. Ein Geschenk, ein Zettel, eine Kerze — was soll dich an heute erinnern?",
    color: "#8b6542",
  },
  {
    id: "q8",
    icon: Sparkles,
    title: "Winzige Wunder",
    tagline: "Fotografiere etwas, das kleiner ist als dein Daumen",
    xp: 10,
    difficulty: 1,
    clue: "Die kleinsten Dinge verbergen die größte Magie. Ein Käfer, ein Samen, ein Kieselstein — komm ganz nah heran!",
    color: "#5a9b9b",
  },
];

// ---------- UTILITIES ----------
const STORAGE_KEY = "quest_progress_v1";
const NAME_KEY = "quest_explorer_name_v1";

const loadProgress = () => {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const saveProgress = (progress) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage unavailable; ignore.
  }
};

const loadName = () => {
  try {
    return localStorage.getItem(NAME_KEY) || "";
  } catch {
    return "";
  }
};

const saveName = (name) => {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Storage unavailable; ignore.
  }
};

const clearName = () => {
  try {
    localStorage.removeItem(NAME_KEY);
  } catch {
    // Storage unavailable; ignore.
  }
};

// Decorative SVG compass rose
const CompassRose = ({ size = 40, className = "" }) => (
  <svg viewBox="0 0 100 100" width={size} height={size} className={className}>
    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="50" cy="50" r="35" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 3" />
    <path d="M50 10 L55 50 L50 55 L45 50 Z" fill="currentColor" />
    <path d="M50 90 L45 50 L50 45 L55 50 Z" fill="currentColor" opacity="0.4" />
    <path d="M10 50 L50 45 L55 50 L50 55 Z" fill="currentColor" opacity="0.6" />
    <path d="M90 50 L50 55 L45 50 L50 45 Z" fill="currentColor" opacity="0.6" />
    <circle cx="50" cy="50" r="3" fill="currentColor" />
    <text x="50" y="8" textAnchor="middle" fontSize="8" fill="currentColor" fontFamily="serif">N</text>
  </svg>
);

// ---------- WELCOME SCREEN ----------
const WelcomeScreen = ({ onStart, onShowRules }) => (
  <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
    {/* Decorative corner elements */}
    <div className="absolute top-6 left-6 text-[#8b6542] opacity-40">
      <CompassRose size={60} />
    </div>
    <div className="absolute bottom-6 right-6 text-[#8b6542] opacity-30 rotate-45">
      <Compass size={50} strokeWidth={1} />
    </div>

    <div className="max-w-md text-center relative z-10">
      {/* Stamp-like badge */}
      <div className="inline-block mb-8 relative">
        <div className="absolute inset-0 bg-[#c4543a] rounded-full blur-xl opacity-30" />
        <div className="relative w-32 h-32 rounded-full border-4 border-[#3a2e1f] bg-[#f5ead3] flex items-center justify-center transform -rotate-6 shadow-lg">
          <div className="absolute inset-2 rounded-full border-2 border-dashed border-[#3a2e1f] opacity-40" />
          <Compass size={56} className="text-[#3a2e1f]" strokeWidth={1.5} />
        </div>
      </div>

      <p className="text-xs tracking-[0.4em] text-[#8b6542] uppercase mb-3 font-semibold">
        Freyas Foto-Jagd
      </p>

      <h1 className="text-6xl font-serif text-[#3a2e1f] leading-[0.9] mb-4" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        Freyas
        <br />
        <span className="italic text-[#c4543a]">großes</span>
        <br />
        Abenteuer
      </h1>

      <div className="flex items-center justify-center gap-3 my-6">
        <div className="h-px bg-[#8b6542] w-12 opacity-50" />
        <Star size={14} className="text-[#c4543a]" fill="currentColor" />
        <div className="h-px bg-[#8b6542] w-12 opacity-50" />
      </div>

      <p className="text-[#5a4530] text-lg leading-relaxed mb-10 font-serif italic">
        Acht kleine Missionen warten auf dich. Löse jede mit deiner Kamera und sammle Erinnerungen an diesen besonderen Tag.
      </p>

      <button
        onClick={onStart}
        className="group relative px-10 py-4 bg-[#3a2e1f] text-[#f5ead3] font-bold tracking-widest text-sm uppercase hover:bg-[#c4543a] transition-all duration-300 shadow-[4px_4px_0_0_#c4543a] hover:shadow-[2px_2px_0_0_#3a2e1f] hover:translate-x-[2px] hover:translate-y-[2px]"
      >
        Los geht's!
      </button>

      <button
        onClick={onShowRules}
        className="mt-5 inline-flex items-center gap-2 text-xs tracking-widest uppercase text-[#8b6542] hover:text-[#c4543a] transition-colors font-semibold"
      >
        <ScrollText size={14} /> Spielregeln lesen
      </button>

      <p className="mt-8 text-xs text-[#8b6542] tracking-wider">
        📸 Viel Spaß beim Fotografieren!
      </p>
    </div>
  </div>
);

// ---------- RULES SCREEN ----------
const RULES = [
  {
    icon: Award,
    title: "Bestes Foto gewinnt",
    body: "Für jede Mission wählt Freya am Ende ihr Lieblingsfoto aus. Mühe dich also richtig an — ein schöner, kreativer oder besonderer Moment zählt mehr als viele schnelle Schnappschüsse.",
    color: "#c4543a",
  },
  {
    icon: Clock,
    title: "Letzte Einsendung zählt",
    body: "Du kannst Fotos nachträglich hinzufügen oder austauschen. Am Ende der Party gilt das, was du zuletzt abgeschickt hast. Nimm dir also ruhig Zeit!",
    color: "#7a93b5",
  },
  {
    icon: Laugh,
    title: "Lustigstes Foto gewinnt",
    body: "Für die Mission „Lustiges“ gibt es einen extra Preis: Das Foto, das am meisten zum Lachen bringt, gewinnt. Trau dich albern zu sein!",
    color: "#d49134",
  },
];

const RulesScreen = ({ onBack }) => (
  <div className="min-h-screen px-5 py-6 max-w-xl mx-auto">
    <button
      onClick={onBack}
      className="mb-6 flex items-center gap-2 text-sm tracking-widest uppercase text-[#8b6542] hover:text-[#c4543a] transition-colors font-semibold"
    >
      <ArrowLeft size={16} /> Zurück
    </button>

    <div className="mb-8 text-center">
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full border-4 border-[#3a2e1f] bg-[#f5ead3] transform -rotate-3 shadow-[4px_4px_0_0_#c4543a] mb-5">
        <ScrollText size={36} className="text-[#3a2e1f]" strokeWidth={1.5} />
      </div>
      <p className="text-xs tracking-[0.4em] text-[#8b6542] uppercase mb-2 font-semibold">
        Das Kleingedruckte
      </p>
      <h1 className="text-5xl font-serif text-[#3a2e1f] leading-[0.95]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        Spiel<span className="italic text-[#c4543a]">regeln</span>
      </h1>
    </div>

    <div className="space-y-5">
      {RULES.map((rule, idx) => {
        const Icon = rule.icon;
        const rotation = idx % 2 === 0 ? "-rotate-1" : "rotate-1";
        return (
          <div
            key={idx}
            className={`relative p-5 bg-[#faf3e0] border-2 border-[#3a2e1f] shadow-[4px_4px_0_0_#3a2e1f] transform ${rotation}`}
          >
            <div
              className="absolute -top-4 -left-4 w-12 h-12 rounded-full border-2 border-[#3a2e1f] flex items-center justify-center font-serif font-bold text-xl text-[#f5ead3]"
              style={{ backgroundColor: rule.color, fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              {idx + 1}
            </div>
            <div className="flex items-start gap-4 pl-6">
              <div
                className="w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center border-2 border-[#3a2e1f]"
                style={{ backgroundColor: rule.color + "30" }}
              >
                <Icon size={22} style={{ color: rule.color }} strokeWidth={2} />
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  className="text-xl font-serif font-bold text-[#3a2e1f] leading-tight mb-2"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  {rule.title}
                </h3>
                <p className="text-sm text-[#5a4530] leading-relaxed">{rule.body}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>

    <div className="mt-8 p-5 border-2 border-dashed border-[#8b6542] bg-[#f5ead3]/50 text-center">
      <p className="text-sm text-[#5a4530] italic leading-relaxed">
        Und das Wichtigste: <span className="font-bold not-italic text-[#3a2e1f]">Hab Spaß!</span> 🎉
      </p>
    </div>

    <div className="mt-10 text-center">
      <button
        onClick={onBack}
        className="px-8 py-3 bg-[#3a2e1f] text-[#f5ead3] font-bold tracking-widest text-xs uppercase hover:bg-[#c4543a] transition-colors shadow-[4px_4px_0_0_#c4543a] hover:shadow-[2px_2px_0_0_#3a2e1f] hover:translate-x-[2px] hover:translate-y-[2px]"
      >
        Alles klar!
      </button>
    </div>
  </div>
);

// ---------- NAME CAPTURE ----------
const NameCapture = ({ onSubmit }) => {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const trimmed = name.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (trimmed.length < 2) {
      setError("Dein Name braucht mindestens 2 Buchstaben");
      return;
    }
    if (trimmed.length > 20) {
      setError("Bitte unter 20 Buchstaben bleiben");
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="absolute top-6 right-6 text-[#8b6542] opacity-30">
        <CompassRose size={50} />
      </div>

      <div className="max-w-md w-full text-center relative z-10">
        {/* Stamp */}
        <div className="inline-block mb-6 relative">
          <div className="w-24 h-24 rounded-full border-4 border-[#3a2e1f] bg-[#f5ead3] flex items-center justify-center transform rotate-3 shadow-[4px_4px_0_0_#c4543a]">
            <div className="absolute inset-1.5 rounded-full border-2 border-dashed border-[#3a2e1f] opacity-40" />
            <Star size={36} className="text-[#c4543a]" fill="currentColor" />
          </div>
        </div>

        <p className="text-xs tracking-[0.4em] text-[#8b6542] uppercase mb-3 font-semibold">
          Bevor du beginnst
        </p>

        <h1
          className="text-5xl font-serif text-[#3a2e1f] leading-[0.95] mb-4"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Wie heißt
          <br />
          <span className="italic text-[#c4543a]">du denn,</span>
          <br />
          lieber Gast?
        </h1>

        <p className="text-[#5a4530] text-base leading-relaxed mb-8 font-serif italic">
          Dein Name kommt auf deine Foto-Jagd — damit Freya später weiß, wer welches Foto gemacht hat.
        </p>

        <form onSubmit={handleSubmit} className="text-left">
          <label className="block text-xs tracking-[0.3em] uppercase text-[#8b6542] font-bold mb-2">
            Dein Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError("");
            }}
            placeholder="z. B. Mia"
            autoFocus
            maxLength={25}
            className="w-full px-4 py-4 bg-[#faf3e0] border-2 border-[#3a2e1f] text-[#3a2e1f] text-xl font-serif placeholder:text-[#8b6542] placeholder:italic focus:outline-none focus:shadow-[4px_4px_0_0_#c4543a] transition-shadow"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          />
          {error && (
            <p className="mt-2 text-sm text-[#c4543a] italic">{error}</p>
          )}

          <button
            type="submit"
            disabled={trimmed.length < 2}
            className="mt-6 w-full py-4 bg-[#3a2e1f] text-[#f5ead3] font-bold tracking-widest text-sm uppercase hover:bg-[#c4543a] transition-all duration-300 shadow-[4px_4px_0_0_#c4543a] hover:shadow-[2px_2px_0_0_#3a2e1f] hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
          >
            Auf geht's! →
          </button>
        </form>

        <p className="mt-6 text-xs text-[#8b6542] tracking-wider italic">
          Nur auf diesem Gerät gespeichert. Sicher und privat.
        </p>
      </div>
    </div>
  );
};

// ---------- QUEST BOARD ----------
const QuestBoard = ({ progress, onSelectQuest, onReset, explorerName, onChangeName, onShowRules }) => {
  const completedCount = Object.values(progress).filter((p) => p.completed).length;
  const totalXP = QUESTS.reduce(
    (sum, q) => sum + (progress[q.id]?.completed ? q.xp : 0),
    0
  );
  const allDone = completedCount === QUESTS.length;

  return (
    <div className="min-h-screen px-5 py-8 max-w-xl mx-auto">
      {/* Header */}
      <div className="mb-8 relative">
        <p className="text-xs tracking-[0.4em] text-[#8b6542] uppercase mb-2 font-semibold">
          {explorerName ? `Willkommen, ${explorerName}` : "Dein Missionsbuch"}
        </p>
        <h1 className="text-4xl font-serif text-[#3a2e1f] leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          Acht Missionen
          <br />
          <span className="italic text-[#c4543a]">warten auf dich</span>
        </h1>
      </div>

      {/* Progress card */}
      <div className="mb-8 p-5 bg-[#f5ead3] border-2 border-[#3a2e1f] relative shadow-[4px_4px_0_0_#3a2e1f]">
        <div className="absolute -top-3 -right-3 bg-[#c4543a] text-[#f5ead3] w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg border-2 border-[#3a2e1f] transform rotate-12">
          {completedCount}/{QUESTS.length}
        </div>
        <p className="text-xs tracking-widest uppercase text-[#8b6542] font-semibold mb-2">
          Dein Fortschritt
        </p>
        <div className="flex items-end gap-2 mb-3">
          <span className="text-4xl font-serif font-bold text-[#3a2e1f]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            {totalXP}
          </span>
          <span className="text-sm text-[#8b6542] mb-1.5">XP gesammelt</span>
        </div>
        <div className="h-2 bg-[#e8dcc0] border border-[#3a2e1f] overflow-hidden">
          <div
            className="h-full bg-[#c4543a] transition-all duration-700"
            style={{ width: `${(completedCount / QUESTS.length) * 100}%` }}
          />
        </div>
        {allDone && (
          <p className="mt-3 text-sm text-[#c4543a] font-bold tracking-wide flex items-center gap-2">
            <Trophy size={16} /> ALLE MISSIONEN GESCHAFFT — DU BIST SPITZE!
          </p>
        )}
      </div>

      {/* Quest list */}
      <div className="space-y-4">
        {QUESTS.map((quest, idx) => {
          const isDone = progress[quest.id]?.completed;
          const Icon = quest.icon;
          return (
            <button
              key={quest.id}
              onClick={() => onSelectQuest(quest)}
              className={`w-full text-left p-5 border-2 border-[#3a2e1f] transition-all duration-200 relative group ${
                isDone
                  ? "bg-[#e8dcc0] shadow-[2px_2px_0_0_#3a2e1f]"
                  : "bg-[#faf3e0] shadow-[4px_4px_0_0_#3a2e1f] hover:shadow-[6px_6px_0_0_#c4543a] hover:-translate-y-0.5"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 flex-shrink-0 rounded-full flex items-center justify-center border-2 border-[#3a2e1f]"
                  style={{ backgroundColor: isDone ? "#e8dcc0" : quest.color + "30" }}
                >
                  {isDone ? (
                    <Check size={26} className="text-[#3a2e1f]" strokeWidth={3} />
                  ) : (
                    <Icon size={26} style={{ color: quest.color }} strokeWidth={2} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] tracking-widest uppercase text-[#8b6542] font-bold">
                      Mission №{String(idx + 1).padStart(2, "0")}
                    </span>
                    <div className="flex gap-0.5">
                      {[...Array(3)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-1 h-1 rounded-full ${
                            i < quest.difficulty ? "bg-[#c4543a]" : "bg-[#e8dcc0]"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <h3
                    className={`text-xl font-serif font-bold leading-tight mb-1 ${
                      isDone ? "text-[#8b6542] line-through decoration-2" : "text-[#3a2e1f]"
                    }`}
                    style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                  >
                    {quest.title}
                  </h3>
                  <p className="text-sm text-[#5a4530] italic leading-snug">
                    {quest.tagline}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-[10px] tracking-widest text-[#8b6542] font-bold">XP</div>
                  <div className="text-2xl font-serif font-bold text-[#c4543a]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    {quest.xp}
                  </div>
                </div>
              </div>
              {isDone && (
                <div className="absolute top-3 right-3 transform rotate-12 border-2 border-[#c4543a] text-[#c4543a] text-[10px] tracking-widest font-bold px-2 py-0.5 bg-[#f5ead3]">
                  GESCHAFFT
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer actions */}
      <div className="mt-10 flex items-center justify-center gap-6 flex-wrap">
        <button
          onClick={onShowRules}
          className="flex items-center gap-2 text-xs tracking-widest uppercase text-[#8b6542] hover:text-[#c4543a] transition-colors"
        >
          <ScrollText size={12} /> Spielregeln
        </button>
        {completedCount > 0 && (
          <button
            onClick={onReset}
            className="flex items-center gap-2 text-xs tracking-widest uppercase text-[#8b6542] hover:text-[#c4543a] transition-colors"
          >
            <RotateCcw size={12} /> Fortschritt zurücksetzen
          </button>
        )}
        {explorerName && (
          <button
            onClick={onChangeName}
            className="flex items-center gap-2 text-xs tracking-widest uppercase text-[#8b6542] hover:text-[#c4543a] transition-colors"
          >
            ✎ Name ändern
          </button>
        )}
      </div>

      <div className="mt-12 text-center text-[#8b6542] text-xs tracking-[0.3em] uppercase opacity-60">
        · Ende des Tagebuchs ·
      </div>
    </div>
  );
};

// ---------- QUEST DETAIL ----------
// Photos in local state are one of two shapes:
//   { file, previewUrl }           — chosen but not yet uploaded
//   { url, path }                  — already uploaded to Firebase
const QuestDetail = ({ quest, onBack, onComplete, progress, explorerName }) => {
  const existingPhotos = progress[quest.id]?.photos || [];
  const existingMessage = progress[quest.id]?.message || "";
  const alreadyCompleted = !!progress[quest.id]?.completed;

  const [photos, setPhotos] = useState(existingPhotos);
  const [message, setMessage] = useState(existingMessage);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(alreadyCompleted);
  const fileInputRef = useRef(null);
  const Icon = quest.icon;

  // Revoke any preview URLs when the component unmounts so we don't leak memory.
  useEffect(() => {
    return () => {
      photos.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFiles = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);

    const newPhotos = files.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPhotos((prev) => [...prev, ...newPhotos]);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removePhoto = (index) => {
    setPhotos((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  // Upload any File objects to Firebase and return photos in normalized { url, path } form.
  const uploadPendingPhotos = async () => {
    const uploaded = [];
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (p.file) {
        const result = await uploadToFirebase(p.file, {
          questId: quest.id,
          explorerName,
          index: i,
        });
        uploaded.push(result);
      } else if (p.url) {
        uploaded.push({ url: p.url, path: p.path });
      }
    }
    return uploaded;
  };

  const submitQuest = async () => {
    if (photos.length === 0 || submitting) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      const uploaded = await uploadPendingPhotos();
      await recordSubmission({
        questId: quest.id,
        questTitle: quest.title,
        explorerName,
        message: message.trim(),
        photos: uploaded,
        submittedAt: new Date().toISOString(),
      });
      // Replace local state with uploaded refs (drops File/previewUrl)
      photos.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
      setPhotos(uploaded);
      onComplete(quest.id, uploaded, message.trim());
      setSubmitted(true);
    } catch (err) {
      console.error(err);
      setSubmitError(
        "Hmm, das hat nicht geklappt. Bitte prüfe die Internetverbindung und versuche es nochmal."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const saveUpdates = async () => {
    if (submitting) return;
    setSubmitError("");
    setSubmitting(true);
    try {
      const uploaded = await uploadPendingPhotos();
      await recordSubmission({
        questId: quest.id,
        questTitle: quest.title,
        explorerName,
        message: message.trim(),
        photos: uploaded,
        submittedAt: new Date().toISOString(),
        isUpdate: true,
      });
      photos.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl));
      setPhotos(uploaded);
      onComplete(quest.id, uploaded, message.trim());
    } catch (err) {
      console.error(err);
      setSubmitError(
        "Änderungen konnten nicht gespeichert werden. Bitte versuche es nochmal."
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Has the user added/removed photos or changed the message since submission?
  const hasUnsavedChanges =
    submitted &&
    (photos.some((p) => p.file) ||
      photos.length !== (progress[quest.id]?.photos || []).length ||
      message.trim() !== (progress[quest.id]?.message || ""));

  const rotations = ["rotate-1", "-rotate-1", "rotate-2", "-rotate-2", "rotate-0"];

  return (
    <div className="min-h-screen px-5 py-6 max-w-xl mx-auto">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm tracking-widest uppercase text-[#8b6542] hover:text-[#c4543a] transition-colors font-semibold"
      >
        <ArrowLeft size={16} /> Zurück zu den Missionen
      </button>

      {/* Quest card */}
      <div className="bg-[#faf3e0] border-2 border-[#3a2e1f] shadow-[6px_6px_0_0_#3a2e1f] p-6 relative">
        {/* Icon stamp */}
        <div className="flex items-start justify-between mb-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-[#3a2e1f] transform -rotate-6"
            style={{ backgroundColor: quest.color + "30" }}
          >
            <Icon size={32} style={{ color: quest.color }} strokeWidth={2} />
          </div>
          <div className="text-right">
            <div className="text-[10px] tracking-widest text-[#8b6542] font-bold">XP-BELOHNUNG</div>
            <div className="text-3xl font-serif font-bold text-[#c4543a]" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              {quest.xp}
            </div>
          </div>
        </div>

        <p className="text-xs tracking-[0.3em] uppercase text-[#8b6542] font-bold mb-2">
          Die Mission
        </p>
        <h2 className="text-3xl font-serif font-bold text-[#3a2e1f] leading-tight mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          {quest.title}
        </h2>
        <p className="text-lg text-[#5a4530] italic mb-5 leading-relaxed">
          {quest.tagline}
        </p>

        {/* Clue box */}
        <div className="border-t-2 border-dashed border-[#8b6542] pt-5 mb-6">
          <p className="text-xs tracking-[0.3em] uppercase text-[#8b6542] font-bold mb-2">
            🗝️ Der Hinweis
          </p>
          <p className="text-[#3a2e1f] leading-relaxed">{quest.clue}</p>
        </div>

        {/* Hidden file input (supports multiple) */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={handleFiles}
          className="hidden"
        />

        {/* Photo gallery */}
        {photos.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs tracking-[0.3em] uppercase text-[#8b6542] font-bold">
                📸 Beweisfotos
              </p>
              <span className="text-xs text-[#8b6542] italic">
                {photos.length} {photos.length === 1 ? "Foto" : "Fotos"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo, idx) => (
                <div
                  key={idx}
                  className={`relative border-4 border-[#3a2e1f] bg-[#f5ead3] p-1.5 transform ${rotations[idx % rotations.length]} shadow-[3px_3px_0_0_#8b6542]`}
                >
                  <img
                    src={photo.previewUrl || photo.url}
                    alt={`Beweisfoto ${idx + 1}`}
                    className="w-full h-32 object-cover block"
                  />
                  <div className="mt-1.5 pb-0.5 px-1 flex items-center justify-between gap-1">
                    <span className="text-[9px] tracking-widest uppercase text-[#8b6542] font-bold">
                      № {String(idx + 1).padStart(2, "0")}
                    </span>
                    {explorerName && (
                      <span
                        className="text-[11px] italic text-[#c4543a] truncate max-w-[75%]"
                        style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                        title={explorerName}
                      >
                        — {explorerName}
                      </span>
                    )}
                  </div>
                  {photo.file && (
                    <div className="absolute top-1 left-1 bg-[#d49134] text-[#3a2e1f] text-[8px] tracking-widest uppercase font-bold px-1.5 py-0.5 border border-[#3a2e1f]">
                      Neu
                    </div>
                  )}
                  <button
                    onClick={() => removePhoto(idx)}
                    disabled={submitting}
                    aria-label="Foto entfernen"
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[#c4543a] text-[#f5ead3] border-2 border-[#3a2e1f] flex items-center justify-center hover:bg-[#3a2e1f] transition-colors shadow-md disabled:opacity-50"
                  >
                    <X size={14} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Nachricht an Freya (shown once there's at least one photo) */}
        {photos.length > 0 && (
          <div className="mb-6">
            <label className="flex items-center gap-2 text-xs tracking-[0.3em] uppercase text-[#8b6542] font-bold mb-2">
              <MessageCircleHeart size={14} className="text-[#c4543a]" />
              Nachricht an Freya
              <span className="text-[#8b6542] font-normal normal-case tracking-normal italic opacity-70">
                (freiwillig)
              </span>
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 200))}
              placeholder="Schreib Freya ein paar nette Worte zu deinen Fotos..."
              rows={3}
              className="w-full px-3 py-3 bg-[#f5ead3] border-2 border-[#3a2e1f] text-[#3a2e1f] placeholder:text-[#8b6542] placeholder:italic focus:outline-none focus:shadow-[3px_3px_0_0_#c4543a] transition-shadow resize-none font-serif text-base leading-relaxed"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            />
            <div className="flex justify-end mt-1">
              <span className="text-[10px] text-[#8b6542] tracking-wider">
                {message.length}/200
              </span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!submitted && (
          <>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full py-5 bg-[#3a2e1f] text-[#f5ead3] font-bold tracking-widest text-sm uppercase hover:bg-[#c4543a] transition-colors flex items-center justify-center gap-3 shadow-[4px_4px_0_0_#c4543a] hover:shadow-[2px_2px_0_0_#3a2e1f] hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-60"
            >
              <Camera size={20} />
              {uploading
                ? "Lädt..."
                : photos.length === 0
                ? "Foto aufnehmen"
                : "Weiteres Foto hinzufügen"}
            </button>
            <p className="text-center text-xs text-[#8b6542] mt-3 italic">
              {photos.length === 0
                ? "oder aus der Galerie hochladen — du darfst so viele machen, wie du willst"
                : "mach gern mehr Fotos oder schick deine Beweise ab"}
            </p>

            {photos.length > 0 && (
              <button
                onClick={submitQuest}
                disabled={submitting}
                className="mt-4 w-full py-4 bg-[#faf3e0] border-2 border-[#3a2e1f] text-[#3a2e1f] font-bold tracking-widest text-sm uppercase hover:bg-[#c4543a] hover:text-[#f5ead3] transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
              >
                <Upload size={16} />
                {submitting
                  ? "Wird hochgeladen..."
                  : `Mission abschicken (${photos.length})`}
              </button>
            )}
            {submitError && (
              <p className="mt-3 text-sm text-[#c4543a] text-center italic">
                {submitError}
              </p>
            )}
          </>
        )}

        {submitted && (
          <div className="border-t-2 border-dashed border-[#8b6542] pt-5">
            {photos.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-[#c4543a] font-serif text-xl italic mb-2" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                  Alle Fotos entfernt.
                </p>
                <p className="text-[#8b6542] text-sm mb-4">
                  Füge mindestens ein Foto hinzu, damit die Mission geschafft bleibt.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-[#3a2e1f] text-[#f5ead3] font-bold tracking-widest text-xs uppercase hover:bg-[#c4543a] transition-colors flex items-center justify-center gap-2 mx-auto"
                >
                  <Camera size={16} /> Foto hinzufügen
                </button>
              </div>
            ) : (
              <>
                <div className="text-center mb-4">
                  <div className="inline-block bg-[#c4543a] text-[#f5ead3] px-4 py-1.5 transform -rotate-2 border-2 border-[#3a2e1f] text-xs tracking-widest font-bold mb-3">
                    ✓ MISSION GESCHAFFT
                  </div>
                  <p className="text-[#c4543a] font-serif text-2xl italic mb-1" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                    Super gemacht!
                  </p>
                  <p className="text-[#8b6542] text-sm">
                    +{quest.xp} XP für dein Tagebuch
                  </p>
                </div>

                <div className="flex gap-3 mb-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 py-3 bg-[#faf3e0] border-2 border-[#3a2e1f] text-[#3a2e1f] font-bold tracking-widest text-xs uppercase hover:bg-[#e8dcc0] transition-colors flex items-center justify-center gap-2"
                  >
                    <Camera size={14} /> Mehr hinzufügen
                  </button>
                  <button
                    onClick={onBack}
                    className="flex-1 py-3 bg-[#3a2e1f] text-[#f5ead3] font-bold tracking-widest text-xs uppercase hover:bg-[#c4543a] transition-colors"
                  >
                    Nächste Mission →
                  </button>
                </div>

                {hasUnsavedChanges && (
                  <button
                    onClick={saveUpdates}
                    disabled={submitting}
                    className="w-full py-3 bg-[#c4543a] text-[#f5ead3] font-bold tracking-widest text-xs uppercase hover:bg-[#3a2e1f] transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
                  >
                    <Check size={14} />
                    {submitting ? "Wird gespeichert..." : "Änderungen speichern"}
                  </button>
                )}
                {submitError && (
                  <p className="mt-3 text-sm text-[#c4543a] text-center italic">
                    {submitError}
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------- CELEBRATION ----------
const Celebration = ({ onClose }) => (
  <div className="fixed inset-0 bg-[#3a2e1f]/90 z-50 flex items-center justify-center px-6">
    <div className="bg-[#faf3e0] border-4 border-[#3a2e1f] p-8 max-w-sm text-center relative shadow-[8px_8px_0_0_#c4543a]">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 text-[#8b6542] hover:text-[#c4543a]"
      >
        <X size={20} />
      </button>
      <div className="relative inline-block mb-4">
        <Trophy size={64} className="text-[#c4543a]" strokeWidth={1.5} />
        <Sparkles size={20} className="absolute -top-2 -right-2 text-[#d49134]" fill="currentColor" />
        <Sparkles size={16} className="absolute -bottom-1 -left-2 text-[#d49134]" fill="currentColor" />
      </div>
      <p className="text-xs tracking-[0.4em] uppercase text-[#8b6542] font-bold mb-2">
        Legendär
      </p>
      <h2 className="text-4xl font-serif text-[#3a2e1f] mb-3 leading-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
        Alles <span className="italic text-[#c4543a]">geschafft!</span>
      </h2>
      <p className="text-[#5a4530] italic mb-6 leading-relaxed">
        Du hast alle Missionen geschafft und so viele schöne Momente festgehalten. Danke, dass du dabei warst!
      </p>
      <button
        onClick={onClose}
        className="px-8 py-3 bg-[#3a2e1f] text-[#f5ead3] font-bold tracking-widest text-xs uppercase hover:bg-[#c4543a] transition-colors"
      >
        Weiter
      </button>
    </div>
  </div>
);

// ---------- MAIN APP ----------
export default function QuestGame() {
  const [screen, setScreen] = useState("welcome"); // welcome | name | rules | board | quest
  const [rulesReturnScreen, setRulesReturnScreen] = useState("welcome");
  const [activeQuest, setActiveQuest] = useState(null);
  const [progress, setProgress] = useState({});
  const [explorerName, setExplorerName] = useState("");
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    setProgress(loadProgress());
    setExplorerName(loadName());
  }, []);

  const handleStart = () => {
    // If we already know the explorer, skip the name screen
    if (loadName()) {
      setScreen("board");
    } else {
      setScreen("name");
    }
  };

  const handleNameSubmit = (name) => {
    saveName(name);
    setExplorerName(name);
    setScreen("board");
  };

  const handleShowRules = (from) => {
    setRulesReturnScreen(from);
    setScreen("rules");
  };

  const handleComplete = (questId, photos, message = "") => {
    const wasAlreadyDone = progress[questId]?.completed;
    const updated = {
      ...progress,
      [questId]: {
        completed: true,
        photos,
        message,
        submittedBy: explorerName,
        completedAt: progress[questId]?.completedAt || Date.now(),
      },
    };
    setProgress(updated);
    saveProgress(updated);

    // Celebration when all quests done (only trigger the first time)
    if (!wasAlreadyDone) {
      const doneCount = Object.values(updated).filter((p) => p.completed).length;
      if (doneCount === QUESTS.length) {
        setTimeout(() => setShowCelebration(true), 800);
      }
    }
  };

  const handleReset = () => {
    if (window.confirm("Allen Fortschritt zurücksetzen? (Dein Name bleibt erhalten.)")) {
      setProgress({});
      saveProgress({});
    }
  };

  const handleChangeName = () => {
    if (window.confirm("Namen ändern? Dein Fortschritt bleibt erhalten.")) {
      clearName();
      setExplorerName("");
      setScreen("name");
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "#faf3e0",
        backgroundImage: `
          radial-gradient(circle at 20% 10%, rgba(139, 101, 66, 0.08) 0%, transparent 40%),
          radial-gradient(circle at 80% 80%, rgba(196, 84, 58, 0.06) 0%, transparent 40%),
          radial-gradient(circle at 50% 50%, rgba(139, 101, 66, 0.03) 0%, transparent 60%)
        `,
      }}
    >
      {/* Google Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&display=swap');
        body { font-family: 'Inter', -apple-system, sans-serif; }
      `}</style>

      {/* Paper texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.15] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='200' height='200' filter='url(%23n)' opacity='0.5'/></svg>\")",
        }}
      />

      <div className="relative z-10">
        {screen === "welcome" && (
          <WelcomeScreen
            onStart={handleStart}
            onShowRules={() => handleShowRules("welcome")}
          />
        )}
        {screen === "name" && (
          <NameCapture onSubmit={handleNameSubmit} />
        )}
        {screen === "rules" && (
          <RulesScreen onBack={() => setScreen(rulesReturnScreen)} />
        )}
        {screen === "board" && (
          <QuestBoard
            progress={progress}
            explorerName={explorerName}
            onSelectQuest={(q) => {
              setActiveQuest(q);
              setScreen("quest");
            }}
            onReset={handleReset}
            onChangeName={handleChangeName}
            onShowRules={() => handleShowRules("board")}
          />
        )}
        {screen === "quest" && activeQuest && (
          <QuestDetail
            quest={activeQuest}
            progress={progress}
            explorerName={explorerName}
            onBack={() => setScreen("board")}
            onComplete={handleComplete}
          />
        )}
      </div>

      {showCelebration && <Celebration onClose={() => setShowCelebration(false)} />}
    </div>
  );
}
