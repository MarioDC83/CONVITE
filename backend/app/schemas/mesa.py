import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.mesa import FormaMesa


class MesaBase(BaseModel):
    zona_id: uuid.UUID
    nombre: str
    capacidad: int = 2
    capacidad_min: int = 1
    capacidad_max: int = 2
    forma: FormaMesa = FormaMesa.CUADRADA
    pos_x: float = 0
    pos_y: float = 0
    ancho: float = 80
    alto: float = 80
    rotacion: float = 0
    activa: bool = True


class MesaCreate(MesaBase):
    pass


class MesaUpdate(BaseModel):
    zona_id: uuid.UUID | None = None
    nombre: str | None = None
    capacidad: int | None = None
    capacidad_min: int | None = None
    capacidad_max: int | None = None
    forma: FormaMesa | None = None
    pos_x: float | None = None
    pos_y: float | None = None
    ancho: float | None = None
    alto: float | None = None
    rotacion: float | None = None
    activa: bool | None = None


class MesaRead(MesaBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    restaurante_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
