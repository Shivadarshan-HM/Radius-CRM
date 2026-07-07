from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str
    secret_key: str
    access_token_expire_minutes: int = 1440
    frontend_urls: str = "http://localhost:5173"
    admin_email: str = ""
    admin_password: str = ""
    bank_name: str = ""
    bank_account_name: str = ""
    bank_account_number: str = ""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_urls.split(",") if o.strip()]

    @property
    def sqlalchemy_database_url(self) -> str:
        # Render/Railway/Heroku sometimes hand out "postgres://" which SQLAlchemy 2.x rejects.
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url


settings = Settings()
