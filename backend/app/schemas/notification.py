from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FarmNotificationCreate(BaseModel):
    farm_id: int
    title: str
    message: str


class NotificationResponse(BaseModel):
    id: int
    title: str
    message: str
    scheduled_at: datetime | None
    read_at: datetime | None
    sent_at: datetime | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)