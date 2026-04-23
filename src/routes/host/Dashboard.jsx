import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, UserButton } from "@clerk/clerk-react";

import { hostApi } from "../../lib/api.js";

const ACTIVE_STATUSES = new Set(["active", "trialing"]);

export default function HostDashboard() {
  const { getToken } = useAuth();
  const api = useMemo(() => hostApi(getToken), [getToken]);
  const navigate = useNavigate();

  const [me, setMe] = useState(null);
  const [parties, setParties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [user, list] = await Promise.all([api.me(), api.listParties()]);
      setMe(user);
      setParties(list);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const active = me && (me.billing_exempt || ACTIVE_STATUSES.has(me.subscription_status));

  async function onSubscribe() {
    const { url } = await api.checkout();
    window.location.href = url;
  }

  async function onManage() {
    const { url } = await api.portal();
    window.location.href = url;
  }

  async function onCreate(event) {
    event.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const party = await api.createParty({ name: newName.trim() });
      navigate(`/parties/${party.id}/edit`);
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f5ead3] text-[#3a2e1f]">
      <header className="flex items-center justify-between p-6 border-b border-[#8b6542]/20">
        <h1 className="text-2xl font-serif">Dashboard</h1>
        <UserButton afterSignOutUrl="/" />
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-8">
        <section className="rounded bg-white/60 p-4">
          <h2 className="text-lg font-serif mb-2">Abo</h2>
          {me ? (
            <div className="flex items-center justify-between">
              <p>
                Status: <strong>{me.subscription_status ?? "kein Abo"}</strong>
                {me.billing_exempt && " · Freigeschaltet"}
              </p>
              {active ? (
                <button
                  onClick={onManage}
                  className="rounded bg-[#8b6542] px-3 py-2 text-sm text-white"
                >
                  Abo verwalten
                </button>
              ) : (
                <button
                  onClick={onSubscribe}
                  className="rounded bg-[#c4543a] px-3 py-2 text-sm text-white"
                >
                  Jetzt abonnieren
                </button>
              )}
            </div>
          ) : (
            <p>...</p>
          )}
        </section>

        <section className="rounded bg-white/60 p-4">
          <h2 className="text-lg font-serif mb-2">Neue Party</h2>
          <form className="flex gap-2" onSubmit={onCreate}>
            <input
              className="flex-1 rounded border border-[#8b6542]/30 bg-white px-3 py-2"
              placeholder="Partyname"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={!active || creating}
            />
            <button
              type="submit"
              disabled={!active || creating || !newName.trim()}
              className="rounded bg-[#c4543a] px-4 py-2 text-white disabled:opacity-50"
            >
              Erstellen
            </button>
          </form>
          {!active && (
            <p className="mt-2 text-sm text-[#8b6542]">
              Aktives Abo nötig, um Parties anzulegen.
            </p>
          )}
        </section>

        <section>
          <h2 className="text-lg font-serif mb-2">Deine Parties</h2>
          {loading && <p>Lädt...</p>}
          {error && <p className="text-red-600">{error}</p>}
          {!loading && parties.length === 0 && <p>Noch keine Party erstellt.</p>}
          <ul className="space-y-2">
            {parties.map((p) => (
              <li
                key={p.id}
                className="rounded bg-white/60 p-4 flex items-center justify-between"
              >
                <div>
                  <Link to={`/parties/${p.id}/edit`} className="font-serif text-lg">
                    {p.name}
                  </Link>
                  <p className="text-xs text-[#8b6542]">
                    Code: <strong>{p.join_code}</strong>
                    {p.frozen_at && " · pausiert"}
                  </p>
                </div>
                <div className="flex gap-4 text-sm">
                  <Link to={`/parties/${p.id}/edit`} className="underline">
                    Bearbeiten
                  </Link>
                  <Link to={`/parties/${p.id}/submissions`} className="underline">
                    Fotos
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
