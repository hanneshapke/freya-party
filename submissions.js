// Vercel Serverless Function: POST /api/submissions
//
// Writes a submission record to Firestore. Photos are already uploaded to
// Firebase Storage by the browser at this point — this route only records
// the metadata (URLs, guest name, message, etc.).
//
// Environment variables required on Vercel:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY      (paste the full key including the BEGIN/END lines;
//                              Vercel will preserve the newlines if you use \n)

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Initialize Firebase Admin once per cold start.
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: (process.env.FIREBASE_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
    }),
  });
}

const db = getFirestore();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      questId,
      questTitle,
      explorerName,
      message,
      photos,
      submittedAt,
      isUpdate,
    } = req.body || {};

    // Basic validation — be forgiving since this is a kids' party, not a bank.
    if (!questId || !Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({ error: "questId and at least one photo are required" });
    }

    const doc = {
      questId: String(questId).slice(0, 50),
      questTitle: String(questTitle || "").slice(0, 100),
      explorerName: String(explorerName || "Anonymous").slice(0, 40),
      message: String(message || "").slice(0, 500),
      photos: photos
        .filter((p) => p && typeof p.url === "string")
        .slice(0, 20)
        .map((p) => ({ url: p.url, path: p.path || null })),
      submittedAt: submittedAt || new Date().toISOString(),
      isUpdate: !!isUpdate,
      createdAt: FieldValue.serverTimestamp(),
      // Capture a bit of request context for light abuse auditing.
      userAgent: (req.headers["user-agent"] || "").slice(0, 200),
    };

    const ref = await db.collection("submissions").add(doc);
    return res.status(200).json({ id: ref.id, ok: true });
  } catch (err) {
    console.error("submissions error", err);
    return res.status(500).json({ error: "Internal error" });
  }
}
