// Downloads every photo from Firebase Storage and exports Firestore
// submission metadata. Run with: `node scripts/download-all.js [outDir]`.
//
// Requires FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY,
// and VITE_FIREBASE_STORAGE_BUCKET in .env.local (or the environment).

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import fs from "node:fs/promises";
import path from "node:path";

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
    // No .env.local, that's fine — rely on process.env.
  }
};

await loadEnvLocal();

const OUT_DIR = path.resolve(process.argv[2] || "./downloads");
const BUCKET =
  process.env.VITE_FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET;

if (!BUCKET) {
  console.error("Missing VITE_FIREBASE_STORAGE_BUCKET env var.");
  process.exit(1);
}
if (!process.env.FIREBASE_PRIVATE_KEY) {
  console.error("Missing FIREBASE_PRIVATE_KEY env var.");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    }),
    storageBucket: BUCKET,
  });
}

const serializeDoc = (doc) => {
  const out = { id: doc.id };
  for (const [k, v] of Object.entries(doc.data())) {
    out[k] = v && typeof v.toDate === "function" ? v.toDate().toISOString() : v;
  }
  return out;
};

const main = async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const bucket = getStorage().bucket();
  const [files] = await bucket.getFiles({ prefix: "submissions/" });
  console.log(`Found ${files.length} file(s) in gs://${BUCKET}/submissions/`);

  let done = 0;
  for (const f of files) {
    const dest = path.join(OUT_DIR, f.name);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await f.download({ destination: dest });
    done += 1;
    console.log(`[${done}/${files.length}] ${f.name}`);
  }

  const db = getFirestore();
  const snap = await db.collection("submissions").orderBy("createdAt", "asc").get();
  const docs = snap.docs.map(serializeDoc);
  await fs.writeFile(
    path.join(OUT_DIR, "submissions.json"),
    JSON.stringify(docs, null, 2)
  );
  console.log(`Wrote ${docs.length} submission(s) to submissions.json`);
};

main().catch((err) => {
  console.error("download-all failed:", err);
  process.exit(1);
});
