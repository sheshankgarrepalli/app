from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    VITE_CLERK_PUBLISHABLE_KEY: str
    CLERK_SECRET_KEY: str

    # SMTP (Gmail) for sending invoice emails
    SMTP_HOST: str = "smtp.gmail.com"
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    SMTP_FROM_NAME: str = "AMAFAH Electronics"

    class Config:
        env_file = "../.env"
        extra = "ignore"

settings = Settings()
