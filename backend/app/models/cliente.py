from __future__ import annotations

import uuid

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class Cliente(UUIDPKMixin, TimestampMixin, Base):
    """Perfil de cliente por restaurante, identificado por teléfono (o email
    si no hay teléfono). Se crea/reutiliza automáticamente al hacer una
    reserva — nadie lo da de alta a mano, solo se edita después (VIP,
    alérgenos, notas)."""

    __tablename__ = "clientes"
    __table_args__ = (
        UniqueConstraint("restaurante_id", "telefono", name="uq_cliente_restaurante_telefono"),
    )

    restaurante_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurantes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    telefono: Mapped[str | None] = mapped_column(String(30), index=True)
    email: Mapped[str | None] = mapped_column(String(255))

    vip: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    alergenos_notas: Mapped[str | None] = mapped_column(Text)
    notas: Mapped[str | None] = mapped_column(Text)

    reservas: Mapped[list["Reserva"]] = relationship(back_populates="cliente")
