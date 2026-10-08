import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ZonaBase(BaseModel):
    nombre: str
    color: str | None = None
    orden: int = 0


class ZonaCreate(ZonaBase):
    pass


class ZonaUpdate(BaseModel):
    nombre: str | None = None
    color: str | None = None
    orden: int | None = None


class ZonaRead(ZonaBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    restaurante_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
