from __future__ import annotations

import enum
import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class RolUsuario(str, enum.Enum):
    SUPERADMIN = "superadmin"
    ADMIN = "admin"
    MANAGER = "manager"
    STAFF = "staff"


class Usuario(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "usuarios"

    # Nulo para superadmins de AutoCore que no pertenecen a un restaurante concreto.
    restaurante_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurantes.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    rol: Mapped[RolUsuario] = mapped_column(
        SAEnum(RolUsuario, name="rol_usuario"), default=RolUsuario.STAFF, nullable=False
    )
    activo: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    restaurante: Mapped["Restaurante | None"] = relationship(back_populates="usuarios")
