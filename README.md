# Freyas Foto-Jagd — Deployment Guide

Vite + React frontend on **Vercel**, photos in **Firebase Storage**, submission metadata in **Firestore**. Expected cost for a single party: **€0**.

---

## 1. Create a Firebase project

1. Go to <https://console.firebase.google.com> and click **Add project**. Name it e.g. `freyas-party`.
2. Disable Google Analytics (not needed).
3. In the left sidebar, open **Build → Storage** and click **Get started**. Pick a region close to your guests (e.g. `europe-west3` for Germany).
4. Open **Build → Firestore Database** and click **Create database** → Production mode, same region.

### Storage rules (tight enough, loose enough for a party)

In **Storage → Rules**, paste and publish:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /submissions/{questId}/{explorer}/{filename} {
      // Anyone can upload a photo up to 10 MB. Read is restricted to you.
      allow read: if false;
      allow write: if request.resource.size < 10 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

Since `read: false`, the download URLs that `getDownloadURL()` returns are long-lived tokenized URLs — they work for anyone with the link (so Freya can view them), but nobody can list the bucket contents.

### Firestore rules

In **Firestore → Rules**, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Writes only happen via our server-side API route using admin credentials.
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

The Vercel serverless function bypasses these rules because it uses the Admin SDK.

### Get the web config

In **Project settings → General → Your apps**, click the web `</>` icon and register an app (name: `party-web`). Copy the `firebaseConfig` object — you'll paste these values into Vercel in step 3.

### Create a service account for the API route

In **Project settings → Service accounts**, click **Generate new private key**. Save the JSON file somewhere safe — you'll need three fields from it (`project_id`, `client_email`, `private_key`) in step 3.

---

## 2. Set up the project locally

Create a fresh Vite + React project and drop the game file in:

```bash
npm create vite@latest freyas-foto-jagd -- --template react
cd freyas-foto-jagd
npm install
npm install firebase firebase-admin lucide-react
npm install -D tailwindcss@3 postcss autoprefixer
npx tailwindcss init -p
```

Configure Tailwind (`tailwind.config.js`):

```js
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

Replace `src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Copy files into place:

- `quest_game.jsx` → `src/QuestGame.jsx`
- `api/submissions.js` → `api/submissions.js` (at the project root, not inside `src/`)

Wire up `src/main.jsx`:

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import QuestGame from "./QuestGame";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(<QuestGame />);
```

Create `.env.local` for local development:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=freyas-party.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=freyas-party
VITE_FIREBASE_STORAGE_BUCKET=freyas-party.appspot.com
VITE_FIREBASE_APP_ID=1:...:web:...
```

Test locally with `npm run dev` (note: the API route only runs on Vercel or via `vercel dev`).

---

## 3. Deploy to Vercel

1. Push the project to a GitHub repo.
2. Go to <https://vercel.com/new>, import the repo. Vercel auto-detects Vite.
3. Before the first deploy, add **Environment Variables** in the Vercel project settings. Add these for **all three environments** (Production, Preview, Development):

   **Public (prefixed with `VITE_`, exposed to browser):**
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_APP_ID`

   **Server-only (for the /api/submissions route):**
   - `FIREBASE_PROJECT_ID` (same as above, without prefix)
   - `FIREBASE_CLIENT_EMAIL` — from the service account JSON
   - `FIREBASE_PRIVATE_KEY` — from the service account JSON. **Paste the whole value including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`.** Vercel handles the newlines if you paste via the dashboard; if via CLI, replace literal newlines with `\n`.

4. Click **Deploy**. You'll get a URL like `freyas-foto-jagd.vercel.app`.

---

## 4. Generate the QR code

Use any QR generator (e.g. <https://qr-code-generator.com>) pointing at your Vercel URL. Print it big, tape it to the wall at the party. Done.

---

## 5. Viewing submissions during & after the party

- **Photos**: go to **Firebase Console → Storage → submissions/** and you'll see them organized by `questId/explorer-name/`.
- **Metadata (who, what, message)**: go to **Firebase Console → Firestore → submissions** collection. Each document has `explorerName`, `questTitle`, `message`, and an array of photo URLs.
- **Quick gallery view**: you can build a `/gallery` page later that reads from Firestore — ask for that if you want it.

---

## 6. After the party: export to Google Photos

See the earlier chat for the architecture. The quick version:

1. Write a small Node script that reads all documents from the `submissions` collection, downloads each photo from Firebase Storage, then uses the Google Photos Library API to push them into a new album titled "Freyas Geburtstag 2026". Caption each with `${explorerName} — ${questTitle} — ${message}`.
2. Run it once from your laptop after the party.

If you'd like that script, ask and I'll write it.

---

## Troubleshooting

- **"Wird hochgeladen…" hangs**: check browser console. Most likely cause: Firebase Storage rules rejected the upload (size or content-type mismatch), or CORS on the storage bucket. Fix via Firebase CLI: `gsutil cors set cors.json gs://YOUR_BUCKET` with a permissive CORS policy.
- **API route returns 500**: check Vercel function logs. Usually the `FIREBASE_PRIVATE_KEY` env var got mangled — re-paste it in the Vercel dashboard.
- **Kids on old phones can't upload**: some older Android browsers struggle with large HEIC photos. The `accept="image/*"` input covers common cases; for safety, add `input capture="environment"` (already present in the component).
