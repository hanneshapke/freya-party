import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";

import { hostApi } from "../../lib/api.js";

export default function HostPartyEditor() {
  const { id } = useParams();
  const { getToken } = useAuth();
  const api = useMemo(() => hostApi(getToken), [getToken]);

  const [party, setParty] = useState(null);
  const [quests, setQuests] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api.getParty(id);
      setParty(data);
      setQuests(
        data.quests.map((q) => ({
          id: q.id,
          title: q.title,
          description: q.description ?? "",
          icon: q.icon ?? "",
          xp: q.xp,
        })),
      );
    } catch (e) {
      setError(e.message);
    }
  }, [api, id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  function patchField(field, value) {
    setParty((p) => ({ ...p, [field]: value }));
  }

  function updateQuest(index, patch) {
    setQuests((arr) => arr.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  function addQuest() {
    setQuests((arr) => [
      ...arr,
      { title: "", description: "", icon: "", xp: 10 },
    ]);
  }

  function removeQuest(index) {
    setQuests((arr) => arr.filter((_, i) => i !== index));
  }

  function move(index, delta) {
    setQuests((arr) => {
      const next = [...arr];
      const j = index + delta;
      if (j < 0 || j >= next.length) return next;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      await api.updateParty(id, {
        name: party.name,
        welcome_message: party.welcome_message ?? null,
        locale: party.locale,
      });
      await api.replaceQuests(
        id,
        quests.map((q) => ({
          title: q.title,
          description: q.description || null,
          icon: q.icon || null,
          xp: Number(q.xp) || 10,
        })),
      );
      setSavedAt(new Date());
      await refresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!party) {
    return (
      <main className="min-h-screen bg-[#f5ead3] p-8">
        {error ? <p className="text-red-600">{error}</p> : <p>Lädt...</p>}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5ead3] text-[#3a2e1f]">
      <header className="flex items-center justify-between p-6 border-b border-[#8b6542]/20">
        <div>
          <Link to="/dashboard" className="text-sm underline">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-serif">{party.name}</h1>
          <p className="text-xs text-[#8b6542]">
            Code: <strong>{party.join_code}</strong> · Link{" "}
            <code>/p/{party.join_code}</code>
          </p>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded bg-[#c4543a] px-4 py-2 text-white disabled:opacity-50"
        >
          {saving ? "Speichert..." : "Speichern"}
        </button>
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-8">
        {error && <p className="text-red-600">{error}</p>}
        {savedAt && <p className="text-green-700 text-sm">Gespeichert.</p>}

        <section className="space-y-3">
          <h2 className="text-lg font-serif">Grunddaten</h2>
          <label className="block">
            <span className="text-sm">Name</span>
            <input
              className="w-full rounded border border-[#8b6542]/30 bg-white px-3 py-2"
              value={party.name}
              onChange={(e) => patchField("name", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm">Willkommenstext</span>
            <textarea
              className="w-full rounded border border-[#8b6542]/30 bg-white px-3 py-2 min-h-[6rem]"
              value={party.welcome_message ?? ""}
              onChange={(e) => patchField("welcome_message", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm">Sprache</span>
            <select
              className="rounded border border-[#8b6542]/30 bg-white px-3 py-2"
              value={party.locale}
              onChange={(e) => patchField("locale", e.target.value)}
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </label>
        </section>

        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-serif">Quests</h2>
            <button
              onClick={addQuest}
              className="rounded bg-[#8b6542] px-3 py-1 text-sm text-white"
            >
              + Neue Quest
            </button>
          </div>

          <ol className="space-y-3">
            {quests.map((q, i) => (
              <li key={q.id ?? `new-${i}`} className="rounded bg-white/60 p-4 space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <span className="font-mono text-sm">{i + 1}.</span>
                  <input
                    className="flex-1 rounded border border-[#8b6542]/30 bg-white px-3 py-2"
                    placeholder="Titel"
                    value={q.title}
                    onChange={(e) => updateQuest(i, { title: e.target.value })}
                  />
                  <div className="flex gap-1 text-sm">
                    <button onClick={() => move(i, -1)} disabled={i === 0}>
                      ↑
                    </button>
                    <button
                      onClick={() => move(i, 1)}
                      disabled={i === quests.length - 1}
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => removeQuest(i)}
                      className="text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <textarea
                  className="w-full rounded border border-[#8b6542]/30 bg-white px-3 py-2"
                  placeholder="Beschreibung"
                  value={q.description}
                  onChange={(e) => updateQuest(i, { description: e.target.value })}
                />
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm">
                    Icon
                    <input
                      className="w-full rounded border border-[#8b6542]/30 bg-white px-3 py-1"
                      placeholder="camera"
                      value={q.icon}
                      onChange={(e) => updateQuest(i, { icon: e.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    XP
                    <input
                      type="number"
                      className="w-full rounded border border-[#8b6542]/30 bg-white px-3 py-1"
                      value={q.xp}
                      onChange={(e) => updateQuest(i, { xp: e.target.value })}
                    />
                  </label>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </main>
  );
}
