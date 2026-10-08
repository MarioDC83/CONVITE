from datetime import datetime

from pydantic import BaseModel, Field, HttpUrl


class ApiKeyInfo(BaseModel):
    activa: bool
    prefijo: str | None
    scopes: list[str]
    creada_en: datetime | None


class ApiKeyCreada(BaseModel):
    valor: str
    info: ApiKeyInfo


class N8nWebhookUpdate(BaseModel):
    url: HttpUrl | None = None


class RecordatorioUpdate(BaseModel):
    # Null = desactivado. 1-72h de margen razonable (más de 3 días no tiene
    # sentido como "recordatorio antes de la reserva").
    horas_antes: int | None = Field(default=None, ge=1, le=72)


class IntegracionesRead(BaseModel):
    api_key: ApiKeyInfo
    n8n_webhook_notificaciones_url: str | None
    google_calendar_conectado: bool = False
    google_calendar_email: str | None = None
    recordatorio_horas_antes: int | None = None


class GoogleConectarUrl(BaseModel):
    url: str
