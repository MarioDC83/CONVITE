from __future__ import annotations

import enum
import uuid

from sqlalchemy import Boolean, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class FormaMesa(str, enum.Enum):
    CUADRADA = "cuadrada"
    RECTANGULAR = "rectangular"
    CIRCULAR = "circular"
    OVALADA = "ovalada"


class Mesa(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "mesas"
    __table_args__ = (
        UniqueConstraint("restaurante_id", "nombre", name="uq_mesa_restaurante_nombre"),
    )

    # Denormalizado desde zona.restaurante_id para poder aislar por tenant
    # con un único índice, sin depender de un join a zonas.
    restaurante_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurantes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    zona_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("zonas.id", ondelete="CASCADE"), nullable=False, index=True
    )
    nombre: Mapped[str] = mapped_column(String(50), nullable=False)
    capacidad: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    capacidad_min: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    capacidad_max: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    forma: Mapped[FormaMesa] = mapped_column(
        SAEnum(FormaMesa, name="forma_mesa"), default=FormaMesa.CUADRADA, nullable=False
    )

    # Posición y tamaño en el editor visual del plano (píxeles/unidades de lienzo).
    pos_x: Mapped[float] = mapped_column(Float, default=0, server_default="0")
    pos_y: Mapped[float] = mapped_column(Float, default=0, server_default="0")
    ancho: Mapped[float] = mapped_column(Float, default=80, server_default="80")
    alto: Mapped[float] = mapped_column(Float, default=80, server_default="80")
    rotacion: Mapped[float] = mapped_column(Float, default=0, server_default="0")

    activa: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    restaurante: Mapped["Restaurante"] = relationship(back_populates="mesas")
    zona: Mapped["Zona"] = relationship(back_populates="mesas")
    reservas: Mapped[list["Reserva"]] = relationship(secondary="reserva_mesas", back_populates="mesas")
