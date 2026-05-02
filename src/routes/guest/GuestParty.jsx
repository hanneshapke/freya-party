import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  Camera,
  Check,
  Compass,
  MessageCircleHeart,
  Star,
  Trophy,
  Upload,
  X,
} from "lucide-react";

import { guestApi, uploadToPresigned } from "../../lib/api.js";
import {
  clearGuestSession,
  loadGuestSession,
  saveGuestSession,
} from "../../lib/guestSession.js";
import { iconFor } from "../../lib/icons.js";
import JournalShell from "../../components/JournalShell.jsx";
import CompassRose from "../../components/CompassRose.jsx";
import Stamp from "../../components/Stamp.jsx";

const PHOTO_ROTATIONS = ["rotate-1", "-rotate-1", "rotate-2", "-rotate-2", "rotate-0"];

function JoinScreen({ joinCode, partyName, onJoined }) {
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
      saveGuestSession(joinCode, {
        token: res.session_token,
        guestId: res.guest_id,
        name: name.trim(),
      });
      onJoined(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 relative overflow-hidden">
      <div className="absolute top-6 right-6 text-ink-muted opacity-30">
        <CompassRose size={50} />
      </div>

      <div className="max-w-md w-full text-center relative z-10">
        <div className="mb-6 flex justify-center">
          <Stamp rotate="rotate-3" size="md">
            <Star size={36} className="text-terracotta" fill="currentColor" />
          </Stamp>
        </div>

        <p className="eyebrow mb-3">{t("guest.welcome_title")}</p>

        <h1 className="text-5xl font-serif text-ink leading-[0.95] mb-3">
          {partyName ? (
            <>
              <span className="italic text-terracotta">{partyName}</span>
            </>
          ) : (
            <>
              Wie heißt
              <br />
              <span className="italic text-terracotta">du denn,</span>
              <br />
              lieber Gast?
            </>
          )}
        </h1>

        <p className="text-ink-soft text-base leading-relaxed mb-8 font-serif italic">
          {t("guest.party_code", { code: joinCode })}
        </p>

        <form onSubmit={submit} className="text-left space-y-5">
          <div>
            <label className="eyebrow-tight block mb-2">{t("guest.your_name")}</label>
            <input
              className="input-stamp text-xl font-serif"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Mia"
              maxLength={80}
              autoFocus
              required
            />
          </div>

          <label className="flex items-start gap-3 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 w-4 h-4 accent-terracotta"
            />
            <span className="leading-snug">{t("guest.consent")}</span>
          </label>

          {error && (
            <p className="text-sm text-terracotta italic">{error}</p>
          )}

          <button
            type="submit"
            disabled={busy || !consent || !name.trim()}
            className="btn-stamp w-full py-4"
          >
            {busy ? t("guest.joining") : `${t("guest.start")} →`}
          </button>
        </form>

        <p className="mt-6 text-xs text-ink-muted tracking-wider italic">
          Nur auf diesem Gerät gespeichert. Sicher und privat.
        </p>
      </div>
    </div>
  );
}

function QuestBoard({ state, onOpen }) {
  const { t } = useTranslation();
  const { party, quests, my_submissions } = state;
  const done = new Set(my_submissions.map((s) => s.quest_id));
  const completedCount = my_submissions.length;
  const totalXP = quests.reduce(
    (sum, q) => sum + (done.has(q.id) ? q.xp || 0 : 0),
    0,
  );
  const allDone = quests.length > 0 && completedCount === quests.length;

  return (
    <div className="min-h-screen px-5 py-8 max-w-xl mx-auto">
      <div className="mb-8 relative">
        <p className="eyebrow mb-2">Dein Missionsbuch</p>
        <h1 className="text-4xl font-serif text-ink leading-tight">
          {party.name}
        </h1>
        {party.welcome_message && (
          <p className="mt-3 text-ink-soft italic font-serif leading-relaxed">
            {party.welcome_message}
          </p>
        )}
        {party.frozen_at && (
          <div className="mt-4 inline-block bg-terracotta text-parchment-100 px-3 py-1 transform -rotate-2 border-2 border-ink text-xs uppercase font-bold tracking-widest">
            {t("guest.frozen")}
          </div>
        )}
      </div>

      {quests.length > 0 && (
        <div className="mb-8 p-5 card-stamp relative">
          <div className="absolute -top-3 -right-3 bg-terracotta text-parchment-100 w-14 h-14 rounded-full flex items-center justify-center font-bold text-lg border-2 border-ink transform rotate-12">
            {completedCount}/{quests.length}
          </div>
          <p className="eyebrow-tight mb-2">Dein Fortschritt</p>
          <div className="flex items-end gap-2 mb-3">
            <span className="text-4xl font-serif font-bold text-ink">{totalXP}</span>
            <span className="text-sm text-ink-muted mb-1.5">XP gesammelt</span>
          </div>
          <div className="h-2 bg-parchment-200 border border-ink overflow-hidden">
            <div
              className="h-full bg-terracotta transition-all duration-700"
              style={{
                width: `${(completedCount / Math.max(quests.length, 1)) * 100}%`,
              }}
            />
          </div>
          {allDone && (
            <p className="mt-3 text-sm text-terracotta font-bold tracking-wide flex items-center gap-2 uppercase">
              <Trophy size={16} /> Alle Missionen geschafft!
            </p>
          )}
        </div>
      )}

      <div className="space-y-4">
        {quests.map((quest, idx) => {
          const Icon = iconFor(quest.icon);
          const isDone = done.has(quest.id);
          return (
            <button
              key={quest.id}
              onClick={() => onOpen(quest.id)}
              className={`w-full text-left p-5 border-2 border-ink transition-all duration-200 relative group ${
                isDone
                  ? "bg-parchment-200 shadow-stamp-sm"
                  : "bg-parchment-50 shadow-stamp hover:shadow-stamp-orange-lg hover:-translate-y-0.5"
              }`}
            >
              <div className="flex items-start gap-4">
                <div
                  className="w-14 h-14 flex-shrink-0 rounded-full flex items-center justify-center border-2 border-ink"
                  style={{
                    backgroundColor: isDone ? "#e8dcc0" : "rgba(196, 84, 58, 0.18)",
                  }}
                >
                  {isDone ? (
                    <Check size={26} className="text-ink" strokeWidth={3} />
                  ) : (
                    <Icon size={26} className="text-terracotta" strokeWidth={2} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] tracking-widest uppercase text-ink-muted font-bold">
                      Mission №{String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3
                    className={`text-xl font-serif font-bold leading-tight mb-1 ${
                      isDone ? "text-ink-muted line-through decoration-2" : "text-ink"
                    }`}
                  >
                    {quest.title}
                  </h3>
                  {quest.description && (
                    <p className="text-sm text-ink-soft italic leading-snug">
                      {quest.description}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-[10px] tracking-widest text-ink-muted font-bold">
                    XP
                  </div>
                  <div className="text-2xl font-serif font-bold text-terracotta">
                    {quest.xp}
                  </div>
                </div>
              </div>
              {isDone && (
                <div className="absolute top-3 right-3 transform rotate-12 border-2 border-terracotta text-terracotta text-[10px] tracking-widest font-bold px-2 py-0.5 bg-parchment-100 uppercase">
                  Geschafft
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-12 text-center text-ink-muted text-xs tracking-[0.3em] uppercase opacity-60">
        · Ende des Tagebuchs ·
      </div>
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
  const api = useMemo(
    () => guestApi(joinCode, sessionToken),
    [joinCode, sessionToken],
  );
  const Icon = iconFor(quest.icon);
  const filePreviews = useMemo(
    () => files.map((f) => ({ file: f, previewUrl: URL.createObjectURL(f) })),
    [files],
  );

  useEffect(() => {
    return () => {
      filePreviews.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, [filePreviews]);

  function onPick(event) {
    const picked = Array.from(event.target.files || []);
    setFiles((prev) => [...prev, ...picked].slice(0, 10));
    if (inputRef.current) inputRef.current.value = "";
  }

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
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

  const totalPhotos = (existing?.photos.length ?? 0) + files.length;

  return (
    <div className="min-h-screen px-5 py-6 max-w-xl mx-auto">
      <button
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm tracking-widest uppercase text-ink-muted hover:text-terracotta transition-colors font-semibold"
      >
        <ArrowLeft size={16} /> {t("common.back")}
      </button>

      <div className="bg-parchment-50 border-2 border-ink shadow-stamp-lg p-6 relative">
        <div className="flex items-start justify-between mb-5">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-ink transform -rotate-6"
            style={{ backgroundColor: "rgba(196, 84, 58, 0.18)" }}
          >
            <Icon size={32} className="text-terracotta" strokeWidth={2} />
          </div>
          {quest.xp ? (
            <div className="text-right">
              <div className="eyebrow-tight">XP-Belohnung</div>
              <div className="text-3xl font-serif font-bold text-terracotta">
                {quest.xp}
              </div>
            </div>
          ) : null}
        </div>

        <p className="eyebrow-tight mb-2">Die Mission</p>
        <h2 className="text-3xl font-serif font-bold text-ink leading-tight mb-3">
          {quest.title}
        </h2>
        {quest.description && (
          <p className="text-lg text-ink-soft italic mb-5 leading-relaxed">
            {quest.description}
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          className="hidden"
          onChange={onPick}
        />

        {existing && existing.photos.length > 0 && (
          <div className="mb-6 border-t-2 border-dashed border-ink-muted pt-5">
            <p className="eyebrow-tight mb-3">📸 {t("guest.already_uploaded")}</p>
            <div className="grid grid-cols-2 gap-3">
              {existing.photos.map((p, idx) => (
                <div
                  key={p.s3_key}
                  className={`border-4 border-ink bg-parchment-100 p-1.5 transform ${PHOTO_ROTATIONS[idx % PHOTO_ROTATIONS.length]} shadow-[3px_3px_0_0_#8b6542]`}
                >
                  <img
                    src={p.url}
                    alt=""
                    className="w-full h-32 object-cover block"
                  />
                  <div className="mt-1.5 px-1 flex items-center justify-between">
                    <span className="text-[9px] tracking-widest uppercase text-ink-muted font-bold">
                      № {String(idx + 1).padStart(2, "0")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {filePreviews.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="eyebrow-tight">📸 Beweisfotos</p>
              <span className="text-xs text-ink-muted italic">
                {filePreviews.length} {filePreviews.length === 1 ? "Foto" : "Fotos"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {filePreviews.map((p, idx) => (
                <div
                  key={idx}
                  className={`relative border-4 border-ink bg-parchment-100 p-1.5 transform ${PHOTO_ROTATIONS[idx % PHOTO_ROTATIONS.length]} shadow-[3px_3px_0_0_#8b6542]`}
                >
                  <img
                    src={p.previewUrl}
                    alt={`Beweisfoto ${idx + 1}`}
                    className="w-full h-32 object-cover block"
                  />
                  <div className="absolute top-1 left-1 bg-ochre text-ink text-[8px] tracking-widest uppercase font-bold px-1.5 py-0.5 border border-ink">
                    Neu
                  </div>
                  <button
                    onClick={() => removeFile(idx)}
                    disabled={busy}
                    aria-label="Foto entfernen"
                    className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-terracotta text-parchment-100 border-2 border-ink flex items-center justify-center hover:bg-ink transition-colors shadow-md disabled:opacity-50"
                  >
                    <X size={14} strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {totalPhotos > 0 && (
          <div className="mb-6">
            <label className="flex items-center gap-2 eyebrow-tight mb-2">
              <MessageCircleHeart size={14} className="text-terracotta" />
              {t("guest.message_optional")}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              placeholder="Schreib ein paar nette Worte zu deinen Fotos..."
              rows={3}
              className="input-stamp font-serif text-base leading-relaxed resize-none"
            />
            <div className="flex justify-end mt-1">
              <span className="text-[10px] text-ink-muted tracking-wider">
                {message.length}/500
              </span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="w-full py-5 bg-ink text-parchment-100 font-bold tracking-widest text-sm uppercase hover:bg-terracotta transition-colors flex items-center justify-center gap-3 shadow-stamp-orange hover:shadow-stamp-sm hover:translate-x-[2px] hover:translate-y-[2px] disabled:opacity-60"
        >
          <Camera size={20} />
          {filePreviews.length === 0
            ? t("guest.pick_photos")
            : "Weiteres Foto hinzufügen"}
        </button>

        {(filePreviews.length > 0 || existing) && (
          <button
            onClick={submit}
            disabled={busy || (!existing && filePreviews.length === 0)}
            className="mt-4 w-full py-4 bg-parchment-50 border-2 border-ink text-ink font-bold tracking-widest text-sm uppercase hover:bg-terracotta hover:text-parchment-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-wait"
          >
            <Upload size={16} />
            {busy
              ? t("guest.uploading")
              : existing
              ? t("guest.update")
              : `${t("guest.submit")}${filePreviews.length ? ` (${filePreviews.length})` : ""}`}
          </button>
        )}

        {error && (
          <p className="mt-3 text-sm text-terracotta text-center italic">{error}</p>
        )}
      </div>
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
      <JournalShell>
        <JoinScreen
          joinCode={joinCode}
          onJoined={(res) => {
            setSession({
              token: res.session_token,
              guestId: res.guest_id,
              name: res.party.name,
            });
            setState(res);
          }}
        />
      </JournalShell>
    );
  }

  if (!state) {
    return (
      <JournalShell>
        <div className="min-h-screen flex items-center justify-center px-6">
          {error ? (
            <p className="text-terracotta italic">{error}</p>
          ) : (
            <div className="text-center">
              <Compass
                size={48}
                className="text-ink-muted mx-auto mb-4 animate-spin"
                style={{ animationDuration: "3s" }}
                strokeWidth={1.5}
              />
              <p className="eyebrow">Lädt...</p>
            </div>
          )}
        </div>
      </JournalShell>
    );
  }

  const activeQuest = state.quests.find((q) => q.id === activeQuestId);
  const existingForQuest = state.my_submissions.find(
    (s) => s.quest_id === activeQuestId,
  );

  return (
    <JournalShell>
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
    </JournalShell>
  );
}
