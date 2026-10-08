import uuid
from datetime import datetime, time

from pydantic import BaseModel, ConfigDict, Field


class TurnoBase(BaseModel):
    nombre: str
    hora_inicio: time
    hora_fin: time
    # 0=lunes ... 6=domingo
    dias_semana: list[int] = Field(default_factory=list)
    duracion_reserva_minutos: int = 90
    activo: bool = True


class TurnoCreate(TurnoBase):
    pass


class TurnoUpdate(BaseModel):
    nombre: str | None = None
    hora_inicio: time | None = None
    hora_fin: time | None = None
    dias_semana: list[int] | None = None
    duracion_reserva_minutos: int | None = None
    activo: bool | None = None


class TurnoRead(TurnoBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    restaurante_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
