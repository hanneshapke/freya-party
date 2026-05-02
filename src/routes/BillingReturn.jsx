import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { ArrowRight, Sparkles, Trophy } from "lucide-react";

import { hostApi } from "../lib/api.js";
import JournalShell from "../components/JournalShell.jsx";
import Stamp from "../components/Stamp.jsx";

export default function BillingReturn() {
  const { getToken } = useAuth();
  const [me, setMe] = useState(null);

  useEffect(() => {
    let cancelled = false;
    hostApi(getToken)
      .me()
      .then((user) => !cancelled && setMe(user))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [getToken]);

  return (
    <JournalShell>
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="max-w-md text-center">
          <div className="mb-6 flex justify-center">
            <Stamp rotate="-rotate-3" size="md">
              <Trophy size={42} className="text-terracotta" strokeWidth={1.5} />
              <Sparkles
                size={16}
                className="absolute -top-1 -right-2 text-ochre"
                fill="currentColor"
              />
            </Stamp>
          </div>

          <p className="eyebrow mb-3">Willkommen an Bord</p>

          <h1 className="text-5xl font-serif text-ink leading-[0.95] mb-5">
            Danke für dein
            <br />
            <span className="italic text-terracotta">Abo!</span>
          </h1>

          <p className="text-ink-soft text-lg leading-relaxed mb-8 font-serif italic">
            Status:{" "}
            <strong className="not-italic text-ink">
              {me?.subscription_status ?? "wird aktualisiert..."}
            </strong>
          </p>

          <Link to="/dashboard" className="btn-stamp inline-flex items-center gap-2">
            Zum Dashboard <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </JournalShell>
  );
}
