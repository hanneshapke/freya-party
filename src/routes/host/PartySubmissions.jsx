import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { ArrowLeft, Camera } from "lucide-react";

import { hostApi } from "../../lib/api.js";
import JournalShell from "../../components/JournalShell.jsx";

const PHOTO_ROTATIONS = ["rotate-1", "-rotate-1", "rotate-2", "-rotate-2", "rotate-0"];

export default function HostPartySubmissions() {
  const { id } = useParams();
  const { getToken } = useAuth();
  const api = useMemo(() => hostApi(getToken), [getToken]);

  const [party, setParty] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, s] = await Promise.all([api.getParty(id), api.listSubmissions(id)]);
        if (cancelled) return;
        setParty(p);
        setSubmissions(s);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, id]);

  const questTitle = useMemo(() => {
    const map = new Map((party?.quests ?? []).map((q) => [q.id, q.title]));
    return (qid) => map.get(qid) ?? qid;
  }, [party]);

  return (
    <JournalShell>
      <header className="px-6 py-5 border-b-2 border-dashed border-ink-muted/50">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold text-ink-muted hover:text-terracotta transition-colors mb-2"
        >
          <ArrowLeft size={12} /> Dashboard
        </Link>
        <p className="eyebrow mb-1">Beweisfotos</p>
        <h1 className="text-3xl font-serif text-ink leading-tight">
          {party ? party.name : "Fotos"}
        </h1>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {loading && <p className="text-ink-muted italic">Lädt...</p>}
        {error && <p className="text-terracotta italic">{error}</p>}
        {!loading && submissions.length === 0 && (
          <div className="border-2 border-dashed border-ink-muted bg-parchment-100/50 p-12 text-center">
            <Camera size={48} className="text-ink-muted mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-ink-soft italic font-serif text-lg">
              Noch keine Einreichungen.
            </p>
          </div>
        )}

        <ul className="space-y-8">
          {submissions.map((s, idx) => {
            const rotate = idx % 2 === 0 ? "-rotate-[0.3deg]" : "rotate-[0.3deg]";
            return (
              <li key={s.id} className={`card-stamp p-6 transform ${rotate}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <p className="eyebrow-tight mb-1">
                      Mission · von {s.guest_name}
                    </p>
                    <h3 className="text-2xl font-serif text-ink leading-tight">
                      {questTitle(s.quest_id)}
                    </h3>
                  </div>
                  <time className="text-xs text-ink-muted tracking-widest uppercase font-bold">
                    {new Date(s.submitted_at).toLocaleString()}
                  </time>
                </div>
                {s.message && (
                  <p className="mb-5 italic font-serif text-ink-soft text-lg leading-relaxed border-l-4 border-terracotta pl-4">
                    “{s.message}”
                  </p>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {s.photos.map((p, pIdx) => (
                    <a
                      key={p.s3_key}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className={`block border-4 border-ink bg-parchment-100 p-1.5 transform ${PHOTO_ROTATIONS[pIdx % PHOTO_ROTATIONS.length]} shadow-[3px_3px_0_0_#8b6542] hover:shadow-stamp-orange transition-shadow`}
                    >
                      <img
                        src={p.url}
                        alt=""
                        className="h-40 w-full object-cover block"
                        loading="lazy"
                      />
                      <div className="mt-1.5 px-1 flex items-center justify-between">
                        <span className="text-[9px] tracking-widest uppercase text-ink-muted font-bold">
                          № {String(pIdx + 1).padStart(2, "0")}
                        </span>
                        <span
                          className="text-[11px] italic text-terracotta truncate max-w-[70%] font-serif"
                          title={s.guest_name}
                        >
                          — {s.guest_name}
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </JournalShell>
  );
}
