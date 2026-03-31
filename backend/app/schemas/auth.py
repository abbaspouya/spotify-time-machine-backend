from pydantic import BaseModel


class AuthStatusResponse(BaseModel):
    authenticated: bool
    expires_at: int | None = None
    scope: str | None = None
    token_type: str | None = None


class WhoAmIResponse(BaseModel):
    id: str | None = None
    display_name: str | None = None
    email: str | None = None
    country: str | None = None
    product: str | None = None
    image_url: str | None = None
    profile_url: str | None = None
