from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

#env root directory of the project
BASE_DIR = Path(__file__).resolve().parents[3]

class Settings(BaseSettings):
    app_name: str = "AvicoleTrack"
    app_env: str = "development"

    # safe default for local development: a SQLite file in the project
    database_url: str

    frontend_url: str = "http://localhost:5173"

    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    ) 


settings = Settings()