from datetime import datetime
from pydantic import BaseModel, Field, field_validator


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    sender_name: str
    content: str
    message_type: str
    read_at: datetime | None
    created_at: datetime

    class Config:
        from_attributes = True


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    message_type: str = "TEXT"

    @field_validator("content")
    @classmethod
    def content_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Message cannot be blank")
        return value


class ConversationMemberResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    joined_at: datetime
    last_read_at: datetime | None

    class Config:
        from_attributes = True


class ConversationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    conversation_type: str
    farm_id: int | None = None
    member_ids: list[int] = Field(default_factory=list, max_length=100)

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Conversation name cannot be blank")
        return value


class ConversationResponse(BaseModel):
    id: int
    enterprise_id: int
    farm_id: int | None
    name: str
    description: str | None
    conversation_type: str
    created_by: int
    created_at: datetime
    updated_at: datetime
    members: list[ConversationMemberResponse] = []
    last_message: MessageResponse | None = None
    unread_count: int = 0

    class Config:
        from_attributes = True


class ConversationDetailResponse(ConversationResponse):
    messages: list[MessageResponse] = []
