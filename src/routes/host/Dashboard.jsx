import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, UserButton } from "@clerk/clerk-react";
import { Camera, Compass, ImageIcon, Plus, Settings } from "lucide-react";

import { hostApi } from "../../lib/api.js";
import JournalShell from "../../components/JournalShell.jsx";

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
    <JournalShell>
      <header className="flex items-center justify-between px-6 py-5 border-b-2 border-dashed border-ink-muted/50">
        <Link to="/" className="flex items-center gap-2">
          <Compass size={20} className="text-terracotta" strokeWidth={1.5} />
          <span className="eyebrow-tight">Foto-Jagd</span>
        </Link>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-serif italic text-terracotta">Dashboard</h1>
          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        <section className="card-stamp p-6 transform -rotate-[0.4deg]">
          <p className="eyebrow-tight mb-2">Abo-Status</p>
          {me ? (
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-2xl font-serif text-ink">
                  {me.subscription_status ?? "kein Abo"}
                  {me.billing_exempt && (
                    <span className="ml-2 text-base italic text-terracotta">
                      · Freigeschaltet
                    </span>
                  )}
                </p>
              </div>
              {active ? (
                <button onClick={onManage} className="btn-stamp-outline">
                  Abo verwalten
                </button>
              ) : (
                <button onClick={onSubscribe} className="btn-stamp">
                  Jetzt abonnieren
                </button>
              )}
            </div>
          ) : (
            <p className="text-ink-muted italic">Lädt...</p>
          )}
        </section>

        <section className="card-stamp-lg p-6 transform rotate-[0.3deg]">
          <p className="eyebrow-tight mb-3">Neue Party</p>
          <form className="flex gap-3 flex-col sm:flex-row" onSubmit={onCreate}>
            <input
              className="input-stamp flex-1 font-serif text-lg"
              placeholder="Partyname"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              disabled={!active || creating}
            />
            <button
              type="submit"
              disabled={!active || creating || !newName.trim()}
              className="btn-stamp flex items-center justify-center gap-2 px-6"
            >
              <Plus size={16} />
              {creating ? "Erstellt..." : "Erstellen"}
            </button>
          </form>
          {!active && (
            <p className="mt-3 text-sm text-ink-muted italic">
              Aktives Abo nötig, um Parties anzulegen.
            </p>
          )}
        </section>

        <section>
          <p className="eyebrow mb-4">Deine Parties</p>
          {loading && <p className="text-ink-muted italic">Lädt...</p>}
          {error && <p className="text-terracotta italic">{error}</p>}
          {!loading && parties.length === 0 && (
            <div className="border-2 border-dashed border-ink-muted bg-parchment-100/50 p-8 text-center">
              <Camera size={36} className="text-ink-muted mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-ink-soft italic font-serif">
                Noch keine Party erstellt.
              </p>
            </div>
          )}
          <ul className="space-y-4">
            {parties.map((p, idx) => {
              const rotate = idx % 2 === 0 ? "-rotate-[0.3deg]" : "rotate-[0.3deg]";
              return (
                <li
                  key={p.id}
                  className={`card-stamp p-5 transform ${rotate} hover:shadow-stamp-orange-lg transition-shadow`}
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/parties/${p.id}/edit`}
                        className="text-2xl font-serif text-ink hover:text-terracotta transition-colors"
                      >
                        {p.name}
                      </Link>
                      <p className="mt-1 text-xs text-ink-muted tracking-widest uppercase font-bold">
                        Code:{" "}
                        <span className="text-terracotta">{p.join_code}</span>
                        {p.frozen_at && (
                          <span className="ml-2 inline-block bg-terracotta text-parchment-100 px-2 py-0.5 transform -rotate-2 border border-ink">
                            pausiert
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        to={`/parties/${p.id}/edit`}
                        className="px-3 py-2 border-2 border-ink bg-parchment-100 hover:bg-parchment-200 text-xs uppercase font-bold tracking-widest flex items-center gap-1.5"
                      >
                        <Settings size={12} /> Bearbeiten
                      </Link>
                      <Link
                        to={`/parties/${p.id}/submissions`}
                        className="px-3 py-2 border-2 border-ink bg-ink text-parchment-100 hover:bg-terracotta text-xs uppercase font-bold tracking-widest flex items-center gap-1.5"
                      >
                        <ImageIcon size={12} /> Fotos
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </JournalShell>
  );
}
