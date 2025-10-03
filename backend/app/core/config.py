from pydantic_settings import BaseSettings
from pydantic import Field
from typing import List, Optional
from pathlib import Path

class Settings(BaseSettings):
    app_name: str = Field(default="FlightProject API", alias="APP_NAME")
    env: str = Field(default="dev", alias="ENV")
    secret_key: str = Field(default="devsecret", alias="SECRET_KEY")
    algorithm: str = Field(default="HS256", alias="ALGORITHM")
    access_token_expire_minutes: int = Field(default=60, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    database_url: str | None = Field(default=None, alias="DATABASE_URL")
    # Raw env values (strings), we parse them to lists via properties to avoid JSON decoding errors
    admin_emails_raw: Optional[str] = Field(default=None, alias="ADMIN_EMAILS")
    manager_emails_raw: Optional[str] = Field(default=None, alias="MANAGER_EMAILS")

    class Config:
        # Load env from backend/.env regardless of CWD
        env_file = str(Path(__file__).resolve().parents[2] / ".env")
        case_sensitive = False

    def _parse_list(self, v: Optional[str]) -> List[str]:
        if v is None:
            return []
        s = v.strip()
        if not s:
            return []
        if s.startswith("[") and s.endswith("]"):
            try:
                import json
                loaded = json.loads(s)
                if isinstance(loaded, list):
                    return [str(e).strip() for e in loaded if str(e).strip()]
            except Exception:
                pass
        return [e.strip() for e in s.split(",") if e.strip()]

    @property
    def admin_emails(self) -> List[str]:
        return self._parse_list(self.admin_emails_raw)

    @property
    def manager_emails(self) -> List[str]:
        return self._parse_list(self.manager_emails_raw)

settings = Settings()  # type: ignore
