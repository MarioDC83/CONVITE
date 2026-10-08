import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RestauranteBase(BaseModel):
    nombre: str
    slug: str
    direccion: str | None = None
    ciudad: str | None = None
    telefono: str | None = None
    email: EmailStr | None = None
    timezone: str = "Europe/Madrid"
    activo: bool = True


class RestauranteCreate(RestauranteBase):
    # Al dar de alta un restaurante se crea también su primer usuario admin,
    # porque sin él nadie podría luego entrar a gestionarlo (huevo y gallina:
    # crear usuarios ya requiere ser admin de ESE restaurante).
    admin_nombre: str
    admin_email: EmailStr
    admin_password: str = Field(min_length=8)


class RestauranteUpdate(BaseModel):
    nombre: str | None = None
    slug: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    telefono: str | None = None
    email: EmailStr | None = None
    timezone: str | None = None
    activo: bool | None = None


class RestauranteRead(RestauranteBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    created_at: datetime
    updated_at: datetime
