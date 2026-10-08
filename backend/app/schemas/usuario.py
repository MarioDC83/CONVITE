import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models.usuario import RolUsuario


class UsuarioBase(BaseModel):
    email: EmailStr
    nombre: str
    rol: RolUsuario = RolUsuario.STAFF


class UsuarioCreate(UsuarioBase):
    password: str = Field(min_length=8)


class UsuarioUpdate(BaseModel):
    nombre: str | None = None
    rol: RolUsuario | None = None
    activo: bool | None = None
    password: str | None = Field(default=None, min_length=8)


class UsuarioRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    restaurante_id: uuid.UUID | None
    email: str
    nombre: str
    rol: RolUsuario
    activo: bool
    created_at: datetime
    updated_at: datetime


class CambiarPasswordRequest(BaseModel):
    password_actual: str
    password_nueva: str = Field(min_length=8)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    usuario: UsuarioRead
