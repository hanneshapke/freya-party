"""Subscription gating.

Party creation / editing is only allowed when the host has an active
Stripe subscription — or the billing_exempt flag is set (used for the
legacy Freya tenant so her real party can never be bricked by billing).
"""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, status

from app.models.user import User
from app.security.clerk import get_current_user

ACTIVE_STATUSES = {"active", "trialing"}


async def require_active_subscription(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    if user.billing_exempt:
        return user
    if (user.subscription_status or "") in ACTIVE_STATUSES:
        return user
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail="Aktives Abo erforderlich",
    )
