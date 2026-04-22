"""Stripe billing service.

Hosts subscribe via Stripe Checkout (monthly plan, unlimited parties
while subscribed). We link the Stripe customer to the Clerk user id
both on `client_reference_id` (for the initial Checkout Session) and
on `metadata.clerk_user_id` (which survives onto the subscription so
renewal webhooks can always find the right user). Webhook handlers
are idempotent via the `stripe_events` table and flip `parties.frozen_at`
when the subscription lapses.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

import stripe
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models.party import Party
from app.models.stripe_event import StripeEvent
from app.models.user import User

settings = get_settings()
stripe.api_key = settings.stripe_secret_key

log = logging.getLogger(__name__)

ACTIVE_STATUSES = {"active", "trialing"}
LAPSED_STATUSES = {"canceled", "unpaid", "incomplete_expired"}


async def _run(func, /, *args, **kwargs):
    return await asyncio.to_thread(func, *args, **kwargs)


async def get_or_create_stripe_customer(db: AsyncSession, user: User) -> str:
    if user.stripe_customer_id:
        return user.stripe_customer_id
    customer = await _run(
        stripe.Customer.create,
        email=user.email,
        metadata={"clerk_user_id": user.id},
    )
    user.stripe_customer_id = customer["id"]
    await db.flush()
    return customer["id"]


async def create_checkout_session(db: AsyncSession, user: User) -> str:
    customer_id = await get_or_create_stripe_customer(db, user)
    session = await _run(
        stripe.checkout.Session.create,
        mode="subscription",
        customer=customer_id,
        client_reference_id=user.id,
        line_items=[{"price": settings.stripe_price_id, "quantity": 1}],
        success_url=f"{settings.frontend_origin}{settings.billing_success_path}?session_id={{CHECKOUT_SESSION_ID}}",
        cancel_url=f"{settings.frontend_origin}{settings.billing_cancel_path}",
        metadata={"clerk_user_id": user.id},
        subscription_data={"metadata": {"clerk_user_id": user.id}},
    )
    return session["url"]


async def create_portal_session(db: AsyncSession, user: User) -> str:
    customer_id = await get_or_create_stripe_customer(db, user)
    session = await _run(
        stripe.billing_portal.Session.create,
        customer=customer_id,
        return_url=f"{settings.frontend_origin}{settings.billing_cancel_path}",
    )
    return session["url"]


def verify_webhook(body: bytes, sig_header: str) -> dict[str, Any]:
    return stripe.Webhook.construct_event(body, sig_header, settings.stripe_webhook_secret)


async def record_event_idempotent(db: AsyncSession, event: dict[str, Any]) -> bool:
    """Return True if this is the first time we've seen the event id."""
    row = StripeEvent(
        event_id=event["id"],
        type=event["type"],
        payload=event,
    )
    db.add(row)
    try:
        await db.flush()
        return True
    except Exception:
        await db.rollback()
        return False


async def _user_for_customer(db: AsyncSession, customer_id: str) -> User | None:
    result = await db.execute(select(User).where(User.stripe_customer_id == customer_id))
    return result.scalar_one_or_none()


async def _user_for_event(db: AsyncSession, event_obj: dict[str, Any]) -> User | None:
    clerk_user_id = (event_obj.get("metadata") or {}).get("clerk_user_id")
    if clerk_user_id:
        user = (
            await db.execute(select(User).where(User.id == clerk_user_id))
        ).scalar_one_or_none()
        if user:
            return user
    customer_id = event_obj.get("customer") or event_obj.get("id")
    if isinstance(customer_id, str):
        return await _user_for_customer(db, customer_id)
    return None


async def _apply_frozen_state(db: AsyncSession, user: User) -> None:
    freeze = (
        (user.subscription_status or "") in LAPSED_STATUSES
        and not user.billing_exempt
    )
    now = datetime.now(timezone.utc)
    if freeze:
        await db.execute(
            update(Party)
            .where(Party.owner_user_id == user.id, Party.frozen_at.is_(None))
            .values(frozen_at=now)
        )
    else:
        await db.execute(
            update(Party)
            .where(Party.owner_user_id == user.id, Party.frozen_at.is_not(None))
            .values(frozen_at=None)
        )


async def handle_event(db: AsyncSession, event: dict[str, Any]) -> None:
    event_type = event["type"]
    obj = event["data"]["object"]

    if event_type == "checkout.session.completed":
        # link customer + subscription; actual status arrives via subscription events
        user = await _user_for_event(db, obj)
        if user is None:
            log.warning("checkout.session.completed with no user mapping: %s", obj.get("id"))
            return
        if obj.get("customer") and not user.stripe_customer_id:
            user.stripe_customer_id = obj["customer"]
        if obj.get("subscription"):
            user.stripe_subscription_id = obj["subscription"]
        return

    if event_type.startswith("customer.subscription."):
        user = await _user_for_event(db, obj)
        if user is None:
            log.warning("%s with no user mapping: %s", event_type, obj.get("id"))
            return
        user.subscription_status = obj.get("status")
        user.stripe_subscription_id = obj.get("id") or user.stripe_subscription_id
        period_end = obj.get("current_period_end")
        if isinstance(period_end, int):
            user.current_period_end = datetime.fromtimestamp(period_end, tz=timezone.utc)
        await _apply_frozen_state(db, user)
        return

    if event_type in {"invoice.paid", "invoice.payment_failed"}:
        # informational — subscription status will follow
        log.info("Received %s for invoice %s", event_type, obj.get("id"))
        return

    log.debug("Ignoring Stripe event %s", event_type)
