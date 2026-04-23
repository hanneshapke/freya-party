// Uploads every photo from Firebase Storage into a Google Photos album,
// captioning each with "<explorer> — <quest title> — <message>".
//
// Usage:  node scripts/export-to-google-photos.js [--album="Album name"]
//
// First-time setup (one-time in Google Cloud Console):
//   1. Enable the Photos Library API for any GCP project.
//   2. APIs & Services → OAuth consent screen → External → fill in basics.
//      Add your own Google account under "Test users" so the unverified
//      app can issue tokens. (In Testing mode refresh tokens expire after
//      7 days — fine for a one-shot export.)
//   3. APIs & Services → Credentials → Create credentials → OAuth client ID
//      → Application type: "Desktop app". Copy the client ID + secret.
//   4. Append to .env.local:
//        GOOGLE_OAUTH_CLIENT_ID="..."
//        GOOGLE_OAUTH_CLIENT_SECRET="..."
//
// On the first run the script opens a browser for consent and appends the
// refresh token to .env.local. State (album ID + uploaded paths) lives in
// scripts/.gphotos-state.json so reruns are idempotent.
//
// Also requires the same Firebase service-account env vars as download-all.js
// (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY,
// VITE_FIREBASE_STORAGE_BUCKET).

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { OAuth2Client } from "google-auth-library";
import fs from "node:fs/promises";
import path from "node:path";
import http from "node:http";
import { spawn } from "node:child_process";

const STATE_FILE = "scripts/.gphotos-state.json";
const REDIRECT_PORT = 53521;
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`;
const SCOPE = "https://www.googleapis.com/auth/photoslibrary.appendonly";

const ALBUM_NAME =
  process.argv.find((a) => a.startsWith("--album="))?.split("=")[1] ||
  "Freyas Geburtstag 2026";

const loadEnvLocal = async () => {
  try {
    const txt = await fs.readFile(".env.local", "utf8");
    for (const raw of txt.split("\n")) {
      const line = raw.trim();
      if (!line || line.startsWith("#")) continue;
      const eq = line.indexOf("=");
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let val = line.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    /* optional */
  }
};

const loadState = async () => {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, "utf8"));
  } catch {
    return { albumId: null, uploaded: {} };
  }
};

const saveState = (state) =>
  fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));

const openBrowser = (url) => {
  const cmd =
    process.platform === "darwin" ? "open" :
    process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  spawn(cmd, args, { detached: true, stdio: "ignore" }).unref();
};

const interactiveAuth = async (clientId, clientSecret) => {
  const client = new OAuth2Client(clientId, clientSecret, REDIRECT_URI);
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPE,
  });

  const code = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const u = new URL(req.url, REDIRECT_URI);
      const c = u.searchParams.get("code");
      res.statusCode = c ? 200 : 400;
      res.setHeader("content-type", "text/html");
      res.end(
        c
          ? "<h1>All set. You can close this tab.</h1>"
          : "<h1>Missing code — check the terminal.</h1>"
      );
      server.close();
      c ? resolve(c) : reject(new Error("No OAuth code returned"));
    });
    server.listen(REDIRECT_PORT, () => {
      console.log("Opening browser for Google sign-in...");
      openBrowser(url);
      console.log(`If the browser doesn't open, visit:\n  ${url}`);
    });
  });

  const { tokens } = await client.getToken(code);
  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh_token in response. Revoke the app at https://myaccount.google.com/permissions and retry."
    );
  }
  await fs.appendFile(".env.local", `GOOGLE_OAUTH_REFRESH_TOKEN="${tokens.refresh_token}"\n`);
  process.env.GOOGLE_OAUTH_REFRESH_TOKEN = tokens.refresh_token;
  client.setCredentials(tokens);
  return client;
};

const getAuthedClient = async () => {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in .env.local");
  }
  const refresh = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
  if (refresh) {
    const client = new OAuth2Client(clientId, clientSecret);
    client.setCredentials({ refresh_token: refresh });
    return client;
  }
  return interactiveAuth(clientId, clientSecret);
};

const photosFetch = async (client, url, init = {}) => {
  const { token } = await client.getAccessToken();
  const res = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${token}`,
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${init.method || "GET"} ${url} → ${res.status}: ${body}`);
  }
  return res;
};

const createAlbum = async (client, title) => {
  const res = await photosFetch(client, "https://photoslibrary.googleapis.com/v1/albums", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ album: { title } }),
  });
  const j = await res.json();
  return j.id;
};

const uploadBytes = async (client, bytes, filename, mimeType) => {
  const res = await photosFetch(client, "https://photoslibrary.googleapis.com/v1/uploads", {
    method: "POST",
    headers: {
      "content-type": "application/octet-stream",
      "x-goog-upload-content-type": mimeType,
      "x-goog-upload-protocol": "raw",
      "x-goog-upload-file-name": filename,
    },
    body: bytes,
  });
  return res.text();
};

const batchCreate = async (client, albumId, uploadToken, description) => {
  const res = await photosFetch(client, "https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      albumId,
      newMediaItems: [{ description, simpleMediaItem: { uploadToken } }],
    }),
  });
  return res.json();
};

const main = async () => {
  await loadEnvLocal();

  const bucketName = process.env.VITE_FIREBASE_STORAGE_BUCKET;
  if (!bucketName) throw new Error("Missing VITE_FIREBASE_STORAGE_BUCKET");
  if (!process.env.FIREBASE_PRIVATE_KEY) throw new Error("Missing FIREBASE_PRIVATE_KEY");

  if (!getApps().length) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      storageBucket: bucketName,
    });
  }

  const state = await loadState();
  const client = await getAuthedClient();

  if (!state.albumId) {
    state.albumId = await createAlbum(client, ALBUM_NAME);
    await saveState(state);
    console.log(`Created album "${ALBUM_NAME}" (${state.albumId})`);
  } else {
    console.log(`Reusing album ${state.albumId}`);
  }

  const db = getFirestore();
  const bucket = getStorage().bucket();

  const snap = await db.collection("submissions").orderBy("createdAt", "asc").get();
  const submissions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const totalPhotos = submissions.reduce((n, s) => n + (s.photos || []).length, 0);
  console.log(`Found ${submissions.length} submissions / ${totalPhotos} photos.`);

  let uploaded = 0, skipped = 0, failed = 0;
  for (const sub of submissions) {
    const caption = [sub.explorerName, sub.questTitle, sub.message]
      .filter((x) => x && String(x).trim())
      .join(" — ");
    for (const p of sub.photos || []) {
      if (!p?.path) { skipped++; continue; }
      if (state.uploaded[p.path]) { skipped++; continue; }

      try {
        const [buf] = await bucket.file(p.path).download();
        const [meta] = await bucket.file(p.path).getMetadata();
        const mime = meta.contentType || "image/jpeg";
        const uploadToken = await uploadBytes(client, buf, path.basename(p.path), mime);
        await batchCreate(client, state.albumId, uploadToken, caption);
        state.uploaded[p.path] = true;
        await saveState(state);
        uploaded++;
        console.log(`[${uploaded}] ${p.path}`);
      } catch (err) {
        failed++;
        console.error(`  ! ${p.path}: ${err.message}`);
      }
    }
  }

  console.log(`\nDone. uploaded=${uploaded}  skipped=${skipped}  failed=${failed}`);
  if (failed > 0) process.exit(1);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
