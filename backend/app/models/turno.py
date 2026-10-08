from __future__ import annotations

import uuid
from datetime import time

from sqlalchemy import Boolean, ForeignKey, Integer, String, Time
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class Turno(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "turnos"

    restaurante_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurantes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nombre: Mapped[str] = mapped_column(String(50), nullable=False)
    hora_inicio: Mapped[time] = mapped_column(Time, nullable=False)
    hora_fin: Mapped[time] = mapped_column(Time, nullable=False)
    # 0=lunes ... 6=domingo
    dias_semana: Mapped[list[int]] = mapped_column(ARRAY(Integer), default=list, server_default="{}")
    duracion_reserva_minutos: Mapped[int] = mapped_column(Integer, default=90, server_default="90")
    activo: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    restaurante: Mapped["Restaurante"] = relationship(back_populates="turnos")
    reservas: Mapped[list["Reserva"]] = relationship(back_populates="turno")
