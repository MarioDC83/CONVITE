from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class EstadoListaEspera(str, enum.Enum):
    ESPERANDO = "esperando"
    OFRECIDA = "ofrecida"
    CONFIRMADA = "confirmada"
    EXPIRADA = "expirada"
    CANCELADA = "cancelada"


# Estados en los que la entrada sigue "viva" (cuenta como candidata cuando se
# libera una mesa, u ocupa el turno de espera).
ESTADOS_ACTIVOS_ESPERA = (EstadoListaEspera.ESPERANDO, EstadoListaEspera.OFRECIDA)


class ListaEspera(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "lista_espera"

    restaurante_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurantes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    turno_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("turnos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    comensales: Mapped[int] = mapped_column(Integer, nullable=False)

    cliente_nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    cliente_telefono: Mapped[str | None] = mapped_column(String(30))
    cliente_email: Mapped[str | None] = mapped_column(String(255))
    notas: Mapped[str | None] = mapped_column(String(500))

    estado: Mapped[EstadoListaEspera] = mapped_column(
        SAEnum(EstadoListaEspera, name="estado_lista_espera"),
        default=EstadoListaEspera.ESPERANDO,
        nullable=False,
    )

    # Cuando se libera una mesa compatible, se le "ofrece" a la entrada más
    # antigua en espera: se anota qué mesa y hasta cuándo tiene para
    # confirmar antes de pasar al siguiente de la lista.
    mesa_ofrecida_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("mesas.id", ondelete="SET NULL")
    )
    oferta_expira_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Una vez confirmada, referencia a la reserva real creada a partir de esta
    # entrada (para poder navegar de una a otra desde la UI).
    reserva_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("reservas.id", ondelete="SET NULL")
    )

    turno: Mapped["Turno"] = relationship()
    mesa_ofrecida: Mapped["Mesa | None"] = relationship()
