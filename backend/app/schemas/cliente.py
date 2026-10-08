import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class ClienteUpdate(BaseModel):
    nombre: str | None = None
    vip: bool | None = None
    alergenos_notas: str | None = None
    notas: str | None = None


class ClienteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    restaurante_id: uuid.UUID
    nombre: str
    telefono: str | None
    email: str | None
    vip: bool
    alergenos_notas: str | None
    notas: str | None
    created_at: datetime
    updated_at: datetime


class ClienteConEstadisticas(ClienteRead):
    total_reservas: int
    no_shows: int
    ultima_visita: date | None
    es_problematico: bool
