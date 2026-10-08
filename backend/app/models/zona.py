from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class Zona(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "zonas"
    __table_args__ = (
        UniqueConstraint("restaurante_id", "nombre", name="uq_zona_restaurante_nombre"),
    )

    restaurante_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurantes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nombre: Mapped[str] = mapped_column(String(100), nullable=False)
    color: Mapped[str | None] = mapped_column(String(20))
    orden: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

    restaurante: Mapped["Restaurante"] = relationship(back_populates="zonas")
    mesas: Mapped[list["Mesa"]] = relationship(
        back_populates="zona", cascade="all, delete-orphan"
    )
