import uuid

from pydantic import BaseModel, Field

from app.schemas.mesa import MesaRead
from app.schemas.restaurante import RestauranteRead
from app.schemas.zona import ZonaRead


class PlanoRead(BaseModel):
    restaurante: RestauranteRead
    zonas: list[ZonaRead]
    mesas: list[MesaRead]


class PlanoMesaUpdate(BaseModel):
    id: uuid.UUID
    pos_x: float
    pos_y: float
    ancho: float
    alto: float
    rotacion: float = 0


class PlanoUpdate(BaseModel):
    mesas: list[PlanoMesaUpdate] = Field(default_factory=list)
