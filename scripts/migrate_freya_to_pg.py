"""Migrate Freya's original party from Firestore + Firebase Storage to the
new Postgres + R2 stack.

One-off cutover script. Run this *after* the backend Alembic migration
has been applied and before flipping DNS. It:

1. Creates a billing_exempt user row mirroring Freya's Clerk id.
2. Creates a party with the 16 hardcoded quests (title + description
   + icon name) that were baked into the old QuestGame.jsx.
3. For every `submissions` doc in Firestore, creates/merges a guest
   row (by name) and writes a submission row + one submission_photo
   per original photo. Photos are streamed from Firebase Storage to
   R2 under the new key scheme.

The script is idempotent for the party/quest row (skips if the party
already exists) and for submissions (existing (quest_id, guest_id)
pairs are updated in place).

Usage:

    cd backend && source .venv/bin/activate
    PYTHONPATH=. python ../scripts/migrate_freya_to_pg.py \\
        --clerk-user-id user_abcdef \\
        --email freya@example.com \\
        --join-code FREYA2025 \\
        [--dry-run]
"""

from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from pathlib import Path

import boto3
import firebase_admin
from botocore.client import Config
from firebase_admin import credentials, firestore, storage
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.config import get_settings
from app.db import SessionLocal
from app.models.guest import Guest
from app.models.party import Party
from app.models.quest import Quest
from app.models.submission import Submission, SubmissionPhoto
from app.models.user import User
from app.services.storage import _ext_for

log = logging.getLogger("migrate_freya")

# Icon names must match app/lib/icons.js whitelist on the frontend.
FREYA_QUESTS = [
    ("q1", "Finde Freya", "Die Königin des Tages! Schnapp dir Freya für ein Foto — ein Selfie, ein Umarmungsfoto oder ein lustiges Gesicht.", "heart", 15),
    ("q2", "Freunde", "Schau dich um — all diese tollen Menschen sind heute hier für Freya. Sammle ein paar von ihnen auf deinen Fotos!", "users", 15),
    ("q3", "Frühling", "Der Frühling ist überall — Blüten, junges Grün, warmes Licht. Finde ein Stück davon und halte es fest.", "flower", 15),
    ("q4", "Party", "Luftballons, Deko, Kuchen, Tanz — was macht diese Party zur Party?", "party", 20),
    ("q5", "Erinnerungen", "Irgendwo im Haus versteckt sich etwas, das typisch für Freya ist — ein Lieblingsspielzeug, ein Foto, ein Gegenstand.", "home", 20),
    ("q6", "Lustiges", "Etwas Albernes, ein komisches Gesicht, ein lustiger Moment — was bringt dich heute zum Kichern?", "smile", 15),
    ("q7", "Andenken", "Ein kleines Stück dieses Tages zum Mitnehmen. Ein Geschenk, ein Zettel, eine Kerze.", "gift", 20),
    ("q8", "Winzige Wunder", "Die kleinsten Dinge verbergen die größte Magie. Ein Käfer, ein Samen, ein Kieselstein — komm ganz nah heran!", "sparkles", 10),
    ("q9", "Farbe", "Rot leuchtet überall, wenn man genau hinsieht — ein Kissen, ein Apfel, ein Spielzeug.", "palette", 15),
    ("q10", "Herzen", "Formt mit euren Händen gemeinsam ein Herz und fotografiert es von oben.", "handheart", 15),
    ("q11", "Geschenk", "Welches Päckchen ist heute am schönsten verpackt?", "package", 15),
    ("q12", "Geräusche", "Eine Uhr, ein Instrument, eine quietschende Tür — hör gut hin und fang das laute Ding mit der Kamera ein.", "volume", 15),
    ("q13", "Formen", "Rund wie ein Ball, ein Teller, ein Luftballon, ein Knopf.", "circle", 10),
    ("q14", "Tischdeko", "Blumen, Servietten, Kerzen, kleine Figuren — welches Detail auf dem Tisch zaubert dir ein Lächeln ins Gesicht?", "utensils", 15),
    ("q15", "Gäste", "Irgendwo unter den Gästen versteckt sich der oder die Jüngste. Frag nett nach einem Foto!", "baby", 20),
    ("q16", "Winken", "Wenn die Party vorbei ist: winkt alle zusammen in die Kamera!", "hand", 15),
]


def init_firebase() -> None:
    if firebase_admin._apps:
        return
    cred_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
    if cred_path and Path(cred_path).exists():
        cred = credentials.Certificate(cred_path)
    else:
        cred = credentials.Certificate(
            {
                "type": "service_account",
                "project_id": os.environ["FIREBASE_PROJECT_ID"],
                "client_email": os.environ["FIREBASE_CLIENT_EMAIL"],
                "private_key": os.environ["FIREBASE_PRIVATE_KEY"].replace("\\n", "\n"),
                "token_uri": "https://oauth2.googleapis.com/token",
            }
        )
    firebase_admin.initialize_app(
        cred,
        {"storageBucket": os.environ["FIREBASE_STORAGE_BUCKET"]},
    )


def r2_client():
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


async def ensure_user(db, *, clerk_user_id: str, email: str) -> User:
    stmt = pg_insert(User).values(id=clerk_user_id, email=email, billing_exempt=True)
    stmt = stmt.on_conflict_do_update(
        index_elements=["id"], set_={"email": email, "billing_exempt": True}
    )
    await db.execute(stmt)
    return (await db.execute(select(User).where(User.id == clerk_user_id))).scalar_one()


async def ensure_party(db, *, owner_id: str, join_code: str) -> tuple[Party, dict[str, str]]:
    """Return (party, legacy_quest_id -> uuid mapping)."""
    existing = (
        await db.execute(select(Party).where(Party.join_code == join_code))
    ).scalar_one_or_none()
    if existing is None:
        party = Party(
            owner_user_id=owner_id,
            name="Freyas Foto-Jagd",
            welcome_message="Willkommen zur Foto-Jagd auf Freyas Geburtstag!",
            join_code=join_code,
            locale="de",
        )
        db.add(party)
        await db.flush()
    else:
        party = existing

    # Ensure quests
    quests_by_legacy: dict[str, str] = {}
    existing_quests = (
        await db.execute(select(Quest).where(Quest.party_id == party.id).order_by(Quest.position))
    ).scalars().all()
    if existing_quests:
        # Trust existing order == FREYA_QUESTS order (script is idempotent).
        for q, (legacy_id, *_rest) in zip(existing_quests, FREYA_QUESTS):
            quests_by_legacy[legacy_id] = str(q.id)
        return party, quests_by_legacy

    for i, (legacy_id, title, desc, icon, xp) in enumerate(FREYA_QUESTS):
        quest = Quest(
            party_id=party.id,
            position=i,
            title=title,
            description=desc,
            icon=icon,
            xp=xp,
        )
        db.add(quest)
        await db.flush()
        quests_by_legacy[legacy_id] = str(quest.id)

    return party, quests_by_legacy


async def ensure_guest(db, *, party_id, name: str) -> Guest:
    result = await db.execute(
        select(Guest).where(Guest.party_id == party_id, Guest.name == name)
    )
    guest = result.scalar_one_or_none()
    if guest:
        return guest
    # Synthetic session token hash: guests don't re-authenticate after migration.
    import hashlib
    import secrets

    digest = hashlib.sha256(f"migrated:{party_id}:{name}:{secrets.token_hex(8)}".encode()).hexdigest()
    guest = Guest(
        party_id=party_id,
        name=name,
        session_token_hash=digest,
        consent_recorded_at=datetime.now(timezone.utc),
    )
    db.add(guest)
    await db.flush()
    return guest


def copy_blob_to_r2(*, source_path: str, dest_key: str, r2, bucket: str, dry_run: bool) -> dict:
    src_bucket = storage.bucket()
    blob = src_bucket.blob(source_path)
    if not blob.exists():
        raise FileNotFoundError(f"Storage blob missing: {source_path}")
    blob.reload()
    content_type = blob.content_type or "image/jpeg"
    size_bytes = int(blob.size or 0)

    if dry_run:
        log.info("DRY: would copy %s -> r2://%s/%s (%s, %d bytes)",
                 source_path, bucket, dest_key, content_type, size_bytes)
    else:
        data = blob.download_as_bytes()
        r2.put_object(
            Bucket=bucket, Key=dest_key, Body=data, ContentType=content_type
        )

    return {"content_type": content_type, "size_bytes": size_bytes}


async def migrate_submissions(
    db,
    *,
    party: Party,
    quests_by_legacy: dict[str, str],
    r2,
    r2_bucket: str,
    dry_run: bool,
) -> None:
    fs = firestore.client()
    docs = fs.collection("submissions").stream()

    count = 0
    for doc in docs:
        data = doc.to_dict()
        legacy_id = data.get("questId")
        quest_uuid = quests_by_legacy.get(legacy_id)
        if quest_uuid is None:
            log.warning("Skipping doc %s: unknown questId %s", doc.id, legacy_id)
            continue

        name = (data.get("explorerName") or "anon").strip()[:80] or "anon"
        guest = await ensure_guest(db, party_id=party.id, name=name)

        # Upsert submission by (quest_id, guest_id)
        existing_sub = (
            await db.execute(
                select(Submission).where(
                    Submission.quest_id == quest_uuid, Submission.guest_id == guest.id
                )
            )
        ).scalar_one_or_none()
        if existing_sub is None:
            submission = Submission(
                party_id=party.id,
                quest_id=quest_uuid,
                guest_id=guest.id,
                message=data.get("message"),
            )
            db.add(submission)
            await db.flush()
        else:
            submission = existing_sub
            submission.message = data.get("message")
            # Clear old photos so we can re-insert (idempotent re-run).
            from sqlalchemy import delete

            await db.execute(
                delete(SubmissionPhoto).where(SubmissionPhoto.submission_id == submission.id)
            )

        for photo in data.get("photos") or []:
            src_path = photo.get("path")
            if not src_path:
                continue
            ext = Path(src_path).suffix.lstrip(".") or "jpg"
            from ulid import ULID

            dest_key = (
                f"parties/{party.id}/quests/{quest_uuid}/guests/{guest.id}/{ULID()}.{ext}"
            )
            meta = copy_blob_to_r2(
                source_path=src_path,
                dest_key=dest_key,
                r2=r2,
                bucket=r2_bucket,
                dry_run=dry_run,
            )
            if not dry_run:
                db.add(
                    SubmissionPhoto(
                        submission_id=submission.id,
                        s3_key=dest_key,
                        content_type=meta["content_type"],
                        size_bytes=meta["size_bytes"],
                    )
                )

        count += 1

    log.info("Processed %d submission documents", count)


async def run(args: argparse.Namespace) -> None:
    settings = get_settings()
    init_firebase()
    r2 = r2_client()

    async with SessionLocal() as db:
        user = await ensure_user(db, clerk_user_id=args.clerk_user_id, email=args.email)
        party, quests_by_legacy = await ensure_party(
            db, owner_id=user.id, join_code=args.join_code
        )
        log.info(
            "Party id=%s join_code=%s quests=%d",
            party.id,
            party.join_code,
            len(quests_by_legacy),
        )
        log.info("Quest id mapping: %s", json.dumps(quests_by_legacy, indent=2))

        await migrate_submissions(
            db,
            party=party,
            quests_by_legacy=quests_by_legacy,
            r2=r2,
            r2_bucket=settings.r2_bucket,
            dry_run=args.dry_run,
        )

        if args.dry_run:
            log.info("DRY RUN — rolling back")
            await db.rollback()
        else:
            await db.commit()
            log.info("Committed.")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--clerk-user-id", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--join-code", default="FREYA2025")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--log-level", default="INFO")
    args = parser.parse_args()

    logging.basicConfig(
        level=args.log_level,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
