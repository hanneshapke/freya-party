import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { ArrowLeft, ChevronDown, ChevronUp, Plus, Save, X } from "lucide-react";

import { hostApi } from "../../lib/api.js";
import JournalShell from "../../components/JournalShell.jsx";

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
    setQuests((arr) => [...arr, { title: "", description: "", icon: "", xp: 10 }]);
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
      <JournalShell>
        <div className="min-h-screen flex items-center justify-center px-6">
          {error ? (
            <p className="text-terracotta italic">{error}</p>
          ) : (
            <p className="eyebrow">Lädt...</p>
          )}
        </div>
      </JournalShell>
    );
  }

  return (
    <JournalShell>
      <header className="px-6 py-5 border-b-2 border-dashed border-ink-muted/50 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold text-ink-muted hover:text-terracotta transition-colors mb-2"
          >
            <ArrowLeft size={12} /> Dashboard
          </Link>
          <h1 className="text-3xl font-serif text-ink leading-tight">{party.name}</h1>
          <p className="mt-1 text-xs text-ink-muted tracking-widest uppercase font-bold">
            Code: <span className="text-terracotta">{party.join_code}</span> · Link{" "}
            <code className="font-mono">/p/{party.join_code}</code>
          </p>
        </div>
        <button
          onClick={onSave}
          disabled={saving}
          className="btn-stamp flex items-center gap-2"
        >
          <Save size={14} /> {saving ? "Speichert..." : "Speichern"}
        </button>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-8">
        {error && (
          <p className="text-terracotta italic border-2 border-dashed border-terracotta px-4 py-3 bg-parchment-100/50">
            {error}
          </p>
        )}
        {savedAt && (
          <div className="inline-block bg-sage text-parchment-100 px-3 py-1 transform -rotate-1 border-2 border-ink text-xs uppercase font-bold tracking-widest">
            ✓ Gespeichert
          </div>
        )}

        <section className="card-stamp p-6">
          <p className="eyebrow-tight mb-4">Grunddaten</p>
          <div className="space-y-4">
            <label className="block">
              <span className="eyebrow-tight block mb-2">Name</span>
              <input
                className="input-stamp font-serif text-lg"
                value={party.name}
                onChange={(e) => patchField("name", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="eyebrow-tight block mb-2">Willkommenstext</span>
              <textarea
                className="input-stamp font-serif text-base min-h-[6rem] resize-y"
                value={party.welcome_message ?? ""}
                onChange={(e) => patchField("welcome_message", e.target.value)}
              />
            </label>
            <label className="block">
              <span className="eyebrow-tight block mb-2">Sprache</span>
              <select
                className="input-stamp font-serif"
                value={party.locale}
                onChange={(e) => patchField("locale", e.target.value)}
              >
                <option value="de">Deutsch</option>
                <option value="en">English</option>
              </select>
            </label>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="eyebrow">Missionen</p>
            <button
              onClick={addQuest}
              className="btn-stamp-outline flex items-center gap-1.5"
            >
              <Plus size={12} /> Neue Mission
            </button>
          </div>

          <ol className="space-y-4">
            {quests.map((q, i) => {
              const rotate = i % 2 === 0 ? "-rotate-[0.2deg]" : "rotate-[0.2deg]";
              return (
                <li
                  key={q.id ?? `new-${i}`}
                  className={`card-stamp p-5 transform ${rotate} relative`}
                >
                  <div className="absolute -top-3 -left-3 bg-terracotta text-parchment-100 w-10 h-10 rounded-full flex items-center justify-center font-serif font-bold border-2 border-ink transform -rotate-6">
                    {i + 1}
                  </div>

                  <div className="flex items-start gap-3 mb-3 ml-6">
                    <input
                      className="flex-1 px-3 py-2 bg-parchment-100 border-2 border-ink text-ink font-serif text-lg focus:outline-none focus:shadow-stamp-orange transition-shadow"
                      placeholder="Titel"
                      value={q.title}
                      onChange={(e) => updateQuest(i, { title: e.target.value })}
                    />
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        className="w-7 h-7 border-2 border-ink bg-parchment-100 hover:bg-parchment-200 disabled:opacity-30 flex items-center justify-center"
                      >
                        <ChevronUp size={14} />
                      </button>
                      <button
                        onClick={() => move(i, 1)}
                        disabled={i === quests.length - 1}
                        className="w-7 h-7 border-2 border-ink bg-parchment-100 hover:bg-parchment-200 disabled:opacity-30 flex items-center justify-center"
                      >
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <button
                      onClick={() => removeQuest(i)}
                      className="w-7 h-7 border-2 border-ink bg-terracotta text-parchment-100 hover:bg-ink flex items-center justify-center"
                      aria-label="Mission entfernen"
                    >
                      <X size={14} strokeWidth={3} />
                    </button>
                  </div>

                  <textarea
                    className="w-full px-3 py-2 bg-parchment-100 border-2 border-ink text-ink placeholder:text-ink-muted placeholder:italic focus:outline-none focus:shadow-stamp-orange transition-shadow resize-y mb-3"
                    placeholder="Beschreibung"
                    rows={2}
                    value={q.description}
                    onChange={(e) => updateQuest(i, { description: e.target.value })}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="eyebrow-tight block mb-1">Icon</span>
                      <input
                        className="w-full px-3 py-2 bg-parchment-100 border-2 border-ink text-ink placeholder:text-ink-muted placeholder:italic focus:outline-none focus:shadow-stamp-orange transition-shadow font-mono text-sm"
                        placeholder="camera"
                        value={q.icon}
                        onChange={(e) => updateQuest(i, { icon: e.target.value })}
                      />
                    </label>
                    <label className="block">
                      <span className="eyebrow-tight block mb-1">XP</span>
                      <input
                        type="number"
                        className="w-full px-3 py-2 bg-parchment-100 border-2 border-ink text-ink focus:outline-none focus:shadow-stamp-orange transition-shadow font-serif text-lg"
                        value={q.xp}
                        onChange={(e) => updateQuest(i, { xp: e.target.value })}
                      />
                    </label>
                  </div>
                </li>
              );
            })}
          </ol>

          {quests.length === 0 && (
            <div className="border-2 border-dashed border-ink-muted bg-parchment-100/50 p-8 text-center">
              <p className="text-ink-soft italic font-serif">
                Noch keine Missionen. Füge die erste hinzu!
              </p>
            </div>
          )}
        </section>
      </div>
    </JournalShell>
  );
}
