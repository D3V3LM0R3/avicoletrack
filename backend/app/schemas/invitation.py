from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class InvitationCreate(BaseModel):
    enterprise_id: int
    farm_id: int
    email: EmailStr
    role: str = Field(
        pattern="^(MANAGER|WORKER)$"
    )
    expires_in_hours: int = Field(
        default=48,
        ge=1,
        le=168,
    )


class InvitationResponse(BaseModel):
    id: int
    enterprise_id: int
    farm_id: int
    invited_email: EmailStr
    role: str
    expires_at: datetime
    used_at: datetime | None
    is_active: bool
    created_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class InvitationCreatedResponse(InvitationResponse):
    invitation_token: str


class InvitationCancelResponse(BaseModel):
    message: str
    invitation_id: int