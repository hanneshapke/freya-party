#!/usr/bin/env python3
"""Count all documents in the Firestore `submissions` collection.

Uses the Firebase Admin SDK with a service account. Reads the same three
env vars as the Vercel API route:

    FIREBASE_PROJECT_ID
    FIREBASE_CLIENT_EMAIL
    FIREBASE_PRIVATE_KEY       (full key including BEGIN/END lines; \\n escapes
                                are expanded to real newlines)

Alternatively, set GOOGLE_APPLICATION_CREDENTIALS to the path of the service
account JSON downloaded from the Firebase console.

Install once:
    pip install firebase-admin

Run:
    python scripts/count_submissions.py
"""

import os
import sys

import firebase_admin
from firebase_admin import credentials, firestore


def build_credentials() -> credentials.Base:
    key_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if key_path:
        return credentials.Certificate(key_path)

    project_id = os.environ.get("FIREBASE_PROJECT_ID")
    client_email = os.environ.get("FIREBASE_CLIENT_EMAIL")
    private_key = os.environ.get("FIREBASE_PRIVATE_KEY")
    if not (project_id and client_email and private_key):
        sys.exit(
            "Missing credentials. Set GOOGLE_APPLICATION_CREDENTIALS, or all of "
            "FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY."
        )

    return credentials.Certificate({
        "type": "service_account",
        "project_id": project_id,
        "client_email": client_email,
        "private_key": private_key.replace("\\n", "\n"),
        "token_uri": "https://oauth2.googleapis.com/token",
    })


def main() -> int:
    if not firebase_admin._apps:
        firebase_admin.initialize_app(build_credentials())

    db = firestore.client()
    count_result = db.collection("submissions").count().get()
    total = count_result[0][0].value

    print(f"Total submissions: {total}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
