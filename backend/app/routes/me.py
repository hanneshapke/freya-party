from typing import Annotated

from fastapi import APIRouter, Depends

from app.models.user import User
from app.schemas.user import UserRead
from app.security.clerk import get_current_user

router = APIRouter(prefix="/api", tags=["me"])


@router.get("/me", response_model=UserRead)
async def me(user: Annotated[User, Depends(get_current_user)]) -> User:
    return user
