from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class DiaEspecial(UUIDPKMixin, TimestampMixin, Base):
    """Fecha marcada como cerrada (festivo, vacaciones, reforma...) — la
    disponibilidad y la creación de reservas la rechazan sin tener que tocar
    los turnos. No cubre "horario especial" (turnos distintos ese día), solo
    abierto/cerrado; un horario especial se puede simular más adelante como
    una extensión de este mismo modelo si hace falta."""

    __tablename__ = "dias_especiales"
    __table_args__ = (
        UniqueConstraint("restaurante_id", "fecha", name="uq_dia_especial_restaurante_fecha"),
    )

    restaurante_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurantes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    cerrado: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    motivo: Mapped[str | None] = mapped_column(String(255))
