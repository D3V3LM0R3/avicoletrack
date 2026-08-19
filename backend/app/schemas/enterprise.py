from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EnterpriseBase(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=150,
    )


class EnterpriseCreate(EnterpriseBase):
    pass


class EnterpriseResponse(EnterpriseBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime
    is_active: bool

    model_config = ConfigDict(
        from_attributes=True
    )