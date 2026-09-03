from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.core.roles import FarmRole


class FarmMembershipCreate(BaseModel):
    user_id: int
    farm_id: int
    role: FarmRole


class FarmMembershipUpdate(BaseModel):
    farm_id: int
    role: FarmRole


class FarmMembershipResponse(BaseModel):
    id: int
    user_id: int
    farm_id: int
    role: FarmRole
    created_at: datetime
    updated_at: datetime
    is_active: bool

    model_config = ConfigDict(
        from_attributes=True
    )