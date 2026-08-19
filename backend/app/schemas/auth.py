from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RegisterRequest(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=150,
    )

    email: EmailStr

    password: str = Field(
        min_length=8,
        max_length=128,
    )

    enterprise_name: str | None = Field(
        default=None,
        min_length=2,
        max_length=150,
    )

    invitation_token: str | None = Field(
        default=None,
        min_length=20,
        max_length=200,
    )


class UserResponse(BaseModel):
    id: int
    name: str
    email: EmailStr
    role: str
    is_active: bool

    model_config = ConfigDict(
        from_attributes=True
    )


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse