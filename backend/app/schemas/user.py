from datetime import datetime

from pydantic import BaseModel, ConfigDict


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    subscription_status: str | None
    current_period_end: datetime | None
    billing_exempt: bool
