import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Camera, Check, Upload, X } from "lucide-react";

import { guestApi, uploadToPresigned } from "../../lib/api.js";
import { clearGuestSession, loadGuestSession, saveGuestSession } from "../../lib/guestSession.js";
import { iconFor } from "../../lib/icons.js";

function JoinScreen({ joinCode, onJoined }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    if (!name.trim() || !consent) return;
    setBusy(true);
    setError(null);
    try {
      const res = await guestApi(joinCode).join({ name: name.trim(), consent });
      saveGuestSession(joinCode, { token: res.session_token, guestId: res.guest_id, name: name.trim() });
      onJoined(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-md mx-auto p-8 space-y-4">
      <h1 className="text-3xl font-serif">{t("guest.welcome_title")}</h1>
      <p className="text-sm text-[#8b6542]">{t("guest.party_code", { code: joinCode })}</p>
      <label className="block">
        <span className="text-sm">{t("guest.your_name")}</span>
        <input
          className="w-full rounded border border-[#8b6542]/30 bg-white px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          required
        />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1"
        />
        <span>{t("guest.consent")}</span>
      </label>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={busy || !consent || !name.trim()}
        className="rounded bg-[#c4543a] px-4 py-2 text-white disabled:opacity-50"
      >
        {busy ? t("guest.joining") : t("guest.start")}
      </button>
    </form>
  );
}

function QuestBoard({ state, onOpen }) {
  const { t } = useTranslation();
  const { party, quests, my_submissions } = state;
  const done = new Set(my_submissions.map((s) => s.quest_id));
  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-3xl font-serif">{party.name}</h1>
        {party.welcome_message && <p className="mt-2">{party.welcome_message}</p>}
        {party.frozen_at && (
          <p className="mt-2 text-red-700 text-sm">{t("guest.frozen")}</p>
        )}
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {quests.map((q) => {
          const Icon = iconFor(q.icon);
          const completed = done.has(q.id);
          return (
            <li key={q.id}>
              <button
                onClick={() => onOpen(q.id)}
                className="w-full text-left rounded bg-white/60 p-4 hover:bg-white flex items-center gap-3"
              >
                <Icon size={32} className="shrink-0 text-[#c4543a]" />
                <div className="flex-1">
                  <p className="font-serif text-lg">{q.title}</p>
                  {q.description && (
                    <p className="text-sm text-[#8b6542]">{q.description}</p>
                  )}
                </div>
                <div className="text-right text-xs">
                  {completed ? (
                    <span className="inline-flex items-center gap-1 text-green-700">
                      <Check size={14} /> {t("guest.completed")}
                    </span>
                  ) : (
                    <span>{t("guest.xp", { xp: q.xp })}</span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function QuestDetail({ joinCode, sessionToken, quest, existing, onBack, onSubmitted }) {
  const { t } = useTranslation();
  const [message, setMessage] = useState(existing?.message ?? "");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);
  const api = useMemo(() => guestApi(joinCode, sessionToken), [joinCode, sessionToken]);
  const Icon = iconFor(quest.icon);

  function onPick(event) {
    const picked = Array.from(event.target.files || []);
    setFiles((prev) => [...prev, ...picked].slice(0, 10));
  }

  async function submit() {
    if (files.length === 0 && !existing) return;
    setBusy(true);
    setError(null);
    try {
      const keys = [];
      for (const file of files) {
        const presigned = await api.uploadUrl({
          quest_id: quest.id,
          content_type: file.type || "image/jpeg",
        });
        const key = await uploadToPresigned(presigned, file);
        keys.push(key);
      }
      if (keys.length === 0 && existing) {
        // message-only edit — resend existing keys
        existing.photos.forEach((p) => keys.push(p.s3_key));
      }
      const res = await api.submit({
        quest_id: quest.id,
        message: message || null,
        photos: keys.map((k) => ({ s3_key: k })),
      });
      onSubmitted(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-6 space-y-4 max-w-xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1 text-sm underline">
        <ArrowLeft size={16} /> {t("common.back")}
      </button>
      <header className="flex items-center gap-3">
        <Icon size={40} className="text-[#c4543a]" />
        <h2 className="text-2xl font-serif">{quest.title}</h2>
      </header>
      {quest.description && <p>{quest.description}</p>}

      {existing && (
        <div className="rounded bg-white/60 p-3">
          <p className="text-sm text-[#8b6542] mb-2">{t("guest.already_uploaded")}</p>
          <div className="grid grid-cols-3 gap-2">
            {existing.photos.map((p) => (
              <img
                key={p.s3_key}
                src={p.url}
                alt=""
                className="w-full h-24 object-cover rounded"
              />
            ))}
          </div>
        </div>
      )}

      <label className="block">
        <span className="text-sm">{t("guest.message_optional")}</span>
        <textarea
          className="w-full rounded border border-[#8b6542]/30 bg-white px-3 py-2"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={500}
        />
      </label>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={onPick}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full rounded border-2 border-dashed border-[#8b6542] py-6 flex items-center justify-center gap-2 text-[#8b6542]"
      >
        <Camera /> {t("guest.pick_photos")}
      </button>

      {files.length > 0 && (
        <ul className="text-sm space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center justify-between">
              <span>{f.name}</span>
              <button
                onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                className="text-red-700"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        onClick={submit}
        disabled={busy || (!existing && files.length === 0)}
        className="w-full rounded bg-[#c4543a] px-4 py-3 text-white disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <Upload size={18} />{" "}
        {busy ? t("guest.uploading") : existing ? t("guest.update") : t("guest.submit")}
      </button>
    </div>
  );
}

export default function GuestParty() {
  const { joinCode } = useParams();
  const [session, setSession] = useState(() => loadGuestSession(joinCode));
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [activeQuestId, setActiveQuestId] = useState(null);

  const refresh = useCallback(async () => {
    if (!session?.token) return;
    try {
      const res = await guestApi(joinCode, session.token).getState();
      setState(res);
    } catch (e) {
      setError(e.message);
      if (e.status === 403) {
        clearGuestSession(joinCode);
        setSession(null);
      }
    }
  }, [joinCode, session]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!session) {
    return (
      <main className="min-h-screen bg-[#f5ead3] text-[#3a2e1f]">
        <JoinScreen
          joinCode={joinCode}
          onJoined={(res) => {
            setSession({ token: res.session_token, guestId: res.guest_id, name: res.party.name });
            setState(res);
          }}
        />
      </main>
    );
  }

  if (!state) {
    return (
      <main className="min-h-screen bg-[#f5ead3] text-[#3a2e1f] p-8">
        {error ? <p className="text-red-600">{error}</p> : <p>Lädt...</p>}
      </main>
    );
  }

  const activeQuest = state.quests.find((q) => q.id === activeQuestId);
  const existingForQuest = state.my_submissions.find((s) => s.quest_id === activeQuestId);

  return (
    <main className="min-h-screen bg-[#f5ead3] text-[#3a2e1f]">
      {activeQuest ? (
        <QuestDetail
          joinCode={joinCode}
          sessionToken={session.token}
          quest={activeQuest}
          existing={existingForQuest}
          onBack={() => setActiveQuestId(null)}
          onSubmitted={async () => {
            await refresh();
            setActiveQuestId(null);
          }}
        />
      ) : (
        <QuestBoard state={state} onOpen={setActiveQuestId} />
      )}
    </main>
  );
}
