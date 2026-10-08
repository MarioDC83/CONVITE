from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Convite"
    API_V1_STR: str = "/api/v1"

    DATABASE_URL: str
    SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 12

    # URL pública del propio backend (para construir el redirect_uri de OAuth)
    # y del frontend (para volver aquí tras el flujo de Google). En local con
    # docker compose no hace falta tocarlas; en producción, las URLs reales.
    BACKEND_PUBLIC_URL: str = "http://localhost:8000"
    FRONTEND_URL: str = "http://localhost:5173"

    # Credenciales de un proyecto en Google Cloud Console (OAuth 2.0 Client ID
    # de tipo "Web application"). Vacías por defecto: sin ellas, conectar
    # Google Calendar da un 501 explicando qué falta — el resto de la app
    # funciona igual. Ver INTEGRACION_N8N.md / guía de Google en el resumen.
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
