from __future__ import annotations

import enum
import uuid
from datetime import date, datetime, time

from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Table, Text, Time
from sqlalchemy import Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class EstadoReserva(str, enum.Enum):
    PENDIENTE = "pendiente"
    CONFIRMADA = "confirmada"
    SENTADA = "sentada"
    FINALIZADA = "finalizada"
    CANCELADA = "cancelada"
    NO_SHOW = "no_show"


# Estados que "ocupan" una mesa a efectos de comprobar solapes de horario.
ESTADOS_ACTIVOS = (EstadoReserva.PENDIENTE, EstadoReserva.CONFIRMADA, EstadoReserva.SENTADA)


class OrigenReserva(str, enum.Enum):
    MANUAL = "manual"
    IA_N8N = "ia_n8n"
    GOOGLE_CALENDAR = "google_calendar"
    WEB = "web"


# Una reserva puede ocupar varias mesas (grupos grandes que unen mesas).
reserva_mesas = Table(
    "reserva_mesas",
    Base.metadata,
    Column(
        "reserva_id",
        UUID(as_uuid=True),
        ForeignKey("reservas.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "mesa_id", UUID(as_uuid=True), ForeignKey("mesas.id", ondelete="CASCADE"), primary_key=True
    ),
)


class Reserva(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "reservas"

    restaurante_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurantes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    turno_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("turnos.id", ondelete="SET NULL"), nullable=True, index=True
    )

    fecha: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    hora: Mapped[time] = mapped_column(Time, nullable=False)
    # Ventana de ocupación de mesa = [hora, hora + duracion_minutos). Se copia del
    # turno al crear la reserva para que el cálculo de solapes no dependa de que
    # el turno no cambie después.
    duracion_minutos: Mapped[int] = mapped_column(Integer, nullable=False, default=90, server_default="90")
    num_personas: Mapped[int] = mapped_column(Integer, nullable=False)

    cliente_nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    cliente_telefono: Mapped[str | None] = mapped_column(String(30))
    cliente_email: Mapped[str | None] = mapped_column(String(255))
    # Perfil de cliente (find-or-create automático por teléfono al crear la
    # reserva). Null si no hay teléfono con el que enlazarlo.
    cliente_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id", ondelete="SET NULL"), index=True
    )

    estado: Mapped[EstadoReserva] = mapped_column(
        SAEnum(EstadoReserva, name="estado_reserva"), default=EstadoReserva.PENDIENTE, nullable=False
    )
    origen: Mapped[OrigenReserva] = mapped_column(
        SAEnum(OrigenReserva, name="origen_reserva"), default=OrigenReserva.MANUAL, nullable=False
    )
    notas: Mapped[str | None] = mapped_column(Text)
    google_event_id: Mapped[str | None] = mapped_column(String(255), index=True)
    # Cuándo se mandó el recordatorio automático de WhatsApp (null = aún no
    # enviado). Evita que el job periódico lo mande dos veces.
    recordatorio_enviado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Encuesta de satisfacción post-visita (WhatsApp, el día después).
    encuesta_enviada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    encuesta_puntuacion: Mapped[int | None] = mapped_column(Integer)
    encuesta_comentario: Mapped[str | None] = mapped_column(Text)

    restaurante: Mapped["Restaurante"] = relationship(back_populates="reservas")
    turno: Mapped["Turno | None"] = relationship(back_populates="reservas")
    mesas: Mapped[list["Mesa"]] = relationship(secondary=reserva_mesas, back_populates="reservas")
    cliente: Mapped["Cliente | None"] = relationship(back_populates="reservas")
