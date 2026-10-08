import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class DiaEspecialCreate(BaseModel):
    fecha: date
    cerrado: bool = True
    motivo: str | None = None


class DiaEspecialRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    restaurante_id: uuid.UUID
    fecha: date
    cerrado: bool
    motivo: str | None
    created_at: datetime
    updated_at: datetime
