import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";

import { hostApi } from "../../lib/api.js";

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
    <main className="min-h-screen bg-[#f5ead3] text-[#3a2e1f]">
      <header className="flex items-center justify-between p-6 border-b border-[#8b6542]/20">
        <div>
          <Link to="/dashboard" className="text-sm underline">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-serif">Fotos {party ? `· ${party.name}` : ""}</h1>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        {loading && <p>Lädt...</p>}
        {error && <p className="text-red-600">{error}</p>}
        {!loading && submissions.length === 0 && <p>Noch keine Einreichungen.</p>}

        <ul className="space-y-6">
          {submissions.map((s) => (
            <li key={s.id} className="rounded bg-white/60 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-serif">
                  {questTitle(s.quest_id)}{" "}
                  <span className="text-sm text-[#8b6542]">· {s.guest_name}</span>
                </h3>
                <time className="text-xs text-[#8b6542]">
                  {new Date(s.submitted_at).toLocaleString()}
                </time>
              </div>
              {s.message && <p className="mb-3 italic">{s.message}</p>}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {s.photos.map((p) => (
                  <a key={p.s3_key} href={p.url} target="_blank" rel="noreferrer">
                    <img
                      src={p.url}
                      alt=""
                      className="h-40 w-full object-cover rounded"
                      loading="lazy"
                    />
                  </a>
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
