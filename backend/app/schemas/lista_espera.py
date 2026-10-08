import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.lista_espera import EstadoListaEspera
from app.schemas.mesa import MesaRead


class ListaEsperaCreate(BaseModel):
    turno_id: uuid.UUID
    fecha: date
    comensales: int = Field(gt=0)
    cliente_nombre: str
    cliente_telefono: str | None = None
    cliente_email: EmailStr | None = None
    notas: str | None = None


class ListaEsperaRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    restaurante_id: uuid.UUID
    turno_id: uuid.UUID
    fecha: date
    comensales: int
    cliente_nombre: str
    cliente_telefono: str | None
    cliente_email: str | None
    notas: str | None
    estado: EstadoListaEspera
    mesa_ofrecida: MesaRead | None
    oferta_expira_en: datetime | None
    reserva_id: uuid.UUID | None
    created_at: datetime
    updated_at: datetime
