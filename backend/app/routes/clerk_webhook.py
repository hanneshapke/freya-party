"""Clerk webhook.

Clerk sends user events signed with Svix. We upsert the mirrored
`users` row so that `stripe_customer_id`, subscription flags, etc. can
attach to a stable record even before the user's first API call.
"""

from __future__ import annotations

import json
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.security.clerk import ensure_user_row, verify_clerk_webhook

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/clerk", status_code=status.HTTP_204_NO_CONTENT)
async def clerk_webhook(
    request: Request,
    svix_id: Annotated[str, Header(alias="svix-id")],
    svix_timestamp: Annotated[str, Header(alias="svix-timestamp")],
    svix_signature: Annotated[str, Header(alias="svix-signature")],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    body = await request.body()
    verify_clerk_webhook(body, svix_id, svix_timestamp, svix_signature)

    try:
        event = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid JSON") from exc

    event_type = event.get("type")
    data = event.get("data") or {}

    if event_type in {"user.created", "user.updated"}:
        user_id = data.get("id")
        if not user_id:
            raise HTTPException(status_code=400, detail="Missing user id in payload")

        email: str | None = None
        primary_email_id = data.get("primary_email_address_id")
        for entry in data.get("email_addresses") or []:
            if entry.get("id") == primary_email_id or email is None:
                email = entry.get("email_address")

        await ensure_user_row(db, user_id, email)

    # All other event types are acknowledged but ignored for now.
