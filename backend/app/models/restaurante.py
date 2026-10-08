from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, Numeric, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base_class import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin

# Los tres únicos permisos que puede tener una API key de integración: nunca
# borrar restaurantes, editar plano, ni acceder a otros tenants.
API_KEY_SCOPES_DISPONIBLES = ["disponibilidad:leer", "reservas:crear", "reservas:estado"]


class Restaurante(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "restaurantes"

    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    slug: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    direccion: Mapped[str | None] = mapped_column(String(255))
    ciudad: Mapped[str | None] = mapped_column(String(100))
    telefono: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(255))
    timezone: Mapped[str] = mapped_column(
        String(50), default="Europe/Madrid", server_default="Europe/Madrid"
    )
    activo: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")

    # --- API key de integración (N8N, WhatsApp, widget web) ---
    # Se guarda solo el hash (igual que una contraseña); el valor en claro se
    # muestra una única vez al generarla/regenerarla. `api_key_prefix` es lo
    # único que queda visible después, para poder identificarla en la UI.
    api_key_hash: Mapped[str | None] = mapped_column(String(64))
    api_key_prefix: Mapped[str | None] = mapped_column(String(20))
    api_key_scopes: Mapped[list[str]] = mapped_column(
        ARRAY(String), default=list, server_default="{}"
    )
    api_key_creada_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # URL del webhook de N8N al que se notifica cuando se crea/actualiza/cancela
    # una reserva (para que dispare el mensaje de WhatsApp). Vacío = desactivado.
    n8n_webhook_notificaciones_url: Mapped[str | None] = mapped_column(String(500))

    # Antelación del recordatorio automático de WhatsApp antes de la reserva.
    # Null = desactivado para este restaurante.
    recordatorio_horas_antes: Mapped[int | None] = mapped_column(
        Integer, default=3, server_default="3"
    )

    # Estimación opcional de ingresos en el panel de estadísticas (comensales
    # totales × este precio). Null = no se muestra el ticket estimado.
    precio_medio_por_persona: Mapped[float | None] = mapped_column(Numeric(8, 2))

    zonas: Mapped[list["Zona"]] = relationship(
        back_populates="restaurante", cascade="all, delete-orphan"
    )
    mesas: Mapped[list["Mesa"]] = relationship(
        back_populates="restaurante", cascade="all, delete-orphan"
    )
    usuarios: Mapped[list["Usuario"]] = relationship(
        back_populates="restaurante", cascade="all, delete-orphan"
    )
    turnos: Mapped[list["Turno"]] = relationship(
        back_populates="restaurante", cascade="all, delete-orphan"
    )
    reservas: Mapped[list["Reserva"]] = relationship(
        back_populates="restaurante", cascade="all, delete-orphan"
    )
