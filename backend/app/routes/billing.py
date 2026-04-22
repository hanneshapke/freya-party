from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.models.user import User
from app.security.clerk import get_current_user
from app.services import billing as billing_svc

router = APIRouter(prefix="/api/billing", tags=["billing"])


class CheckoutOut(BaseModel):
    url: str


@router.post("/checkout", response_model=CheckoutOut)
async def checkout(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CheckoutOut:
    url = await billing_svc.create_checkout_session(db, user)
    return CheckoutOut(url=url)


@router.post("/portal", response_model=CheckoutOut)
async def portal(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> CheckoutOut:
    url = await billing_svc.create_portal_session(db, user)
    return CheckoutOut(url=url)


@router.post("/webhook", status_code=status.HTTP_204_NO_CONTENT)
async def webhook(
    request: Request,
    stripe_signature: Annotated[str, Header(alias="Stripe-Signature")],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    body = await request.body()
    try:
        event = billing_svc.verify_webhook(body, stripe_signature)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid signature: {exc}") from exc

    is_new = await billing_svc.record_event_idempotent(db, event)
    if not is_new:
        return

    await billing_svc.handle_event(db, event)
