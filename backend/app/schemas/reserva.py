import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.reserva import EstadoReserva, OrigenReserva
from app.schemas.mesa import MesaRead


class ReservaBase(BaseModel):
    cliente_nombre: str
    cliente_telefono: str | None = None
    cliente_email: EmailStr | None = None
    fecha: date
    turno_id: uuid.UUID
    hora: time
    num_personas: int = Field(gt=0)
    notas: str | None = None
    origen: OrigenReserva = OrigenReserva.MANUAL


class ReservaCreate(ReservaBase):
    mesa_ids: list[uuid.UUID] = Field(min_length=1)


class ReservaEstadoUpdate(BaseModel):
    estado: EstadoReserva


class EncuestaRespuesta(BaseModel):
    puntuacion: int = Field(ge=1, le=5)
    comentario: str | None = None


class ReservaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    restaurante_id: uuid.UUID
    turno_id: uuid.UUID | None
    fecha: date
    hora: time
    duracion_minutos: int
    num_personas: int
    cliente_nombre: str
    cliente_telefono: str | None
    cliente_email: str | None
    cliente_id: uuid.UUID | None
    estado: EstadoReserva
    origen: OrigenReserva
    notas: str | None
    mesas: list[MesaRead]
    encuesta_puntuacion: int | None
    encuesta_comentario: str | None
    created_at: datetime
    updated_at: datetime
