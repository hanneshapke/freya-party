"""Object storage (Cloudflare R2, S3-compatible).

Guests upload directly from the browser via a presigned POST. The
policy enforces a max file size and requires an `image/` content-type
prefix — this is a server-authoritative version of the `image/*` rule
the old Firebase Storage config used. After submission we HEAD the
object and re-verify size and content-type before committing.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any
from uuid import UUID

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from fastapi import HTTPException
from ulid import ULID

from app.config import get_settings

settings = get_settings()


@lru_cache
def _s3_client():
    if not settings.r2_account_id:
        raise HTTPException(status_code=500, detail="R2 not configured")
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def _ext_for(content_type: str) -> str:
    mapping = {
        "image/jpeg": "jpg",
        "image/jpg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
        "image/heic": "heic",
        "image/heif": "heif",
    }
    return mapping.get(content_type, "bin")


def build_photo_key(party_id: UUID, quest_id: UUID, guest_id: UUID, content_type: str) -> str:
    ulid = str(ULID())
    ext = _ext_for(content_type)
    return f"parties/{party_id}/quests/{quest_id}/guests/{guest_id}/{ulid}.{ext}"


def create_presigned_upload(
    *,
    party_id: UUID,
    quest_id: UUID,
    guest_id: UUID,
    content_type: str,
    expires_in: int = 300,
) -> dict[str, Any]:
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="content_type must start with image/")
    key = build_photo_key(party_id, quest_id, guest_id, content_type)
    conditions = [
        {"bucket": settings.r2_bucket},
        ["content-length-range", 1, settings.max_upload_bytes],
        ["starts-with", "$Content-Type", "image/"],
        {"key": key},
    ]
    fields = {"Content-Type": content_type}
    try:
        presigned = _s3_client().generate_presigned_post(
            Bucket=settings.r2_bucket,
            Key=key,
            Fields=fields,
            Conditions=conditions,
            ExpiresIn=expires_in,
        )
    except ClientError as exc:
        raise HTTPException(status_code=502, detail="Storage error") from exc
    return {"url": presigned["url"], "fields": presigned["fields"], "key": key}


def head_object(key: str) -> dict[str, Any]:
    """Return content_type + size_bytes for a committed object, or 404."""
    try:
        resp = _s3_client().head_object(Bucket=settings.r2_bucket, Key=key)
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        if code in {"404", "NoSuchKey", "NotFound"}:
            raise HTTPException(status_code=404, detail=f"Object {key} not found") from exc
        raise HTTPException(status_code=502, detail="Storage error") from exc
    content_type = resp.get("ContentType", "")
    size = int(resp.get("ContentLength", 0))
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail="Object is not an image")
    if size <= 0 or size > settings.max_upload_bytes:
        raise HTTPException(status_code=422, detail="Object size out of bounds")
    return {"content_type": content_type, "size_bytes": size}


def signed_get_url(key: str, expires_in: int = 900) -> str:
    try:
        return _s3_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.r2_bucket, "Key": key},
            ExpiresIn=expires_in,
        )
    except ClientError as exc:
        raise HTTPException(status_code=502, detail="Storage error") from exc
