from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List

class Settings(BaseSettings):
    app_name: str = Field(default="FlightProject API", alias="APP_NAME")
    env: str = Field(default="dev", alias="ENV")
    secret_key: str = Field(default="devsecret", alias="SECRET_KEY")
    algorithm: str = Field(default="HS256", alias="ALGORITHM")
    access_token_expire_minutes: int = Field(default=60, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    database_url: str | None = Field(default=None, alias="DATABASE_URL")
    admin_emails: List[str] = Field(default_factory=list, alias="ADMIN_EMAILS")
    manager_emails: List[str] = Field(default_factory=list, alias="MANAGER_EMAILS")

    class Config:
        env_file = ".env"
        case_sensitive = False

settings = Settings()  # type: ignore
