from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base_class import Base
from app.models.mixins import TimestampMixin, UUIDPKMixin


class GoogleCalendarConexion(UUIDPKMixin, TimestampMixin, Base):
    """Conexión OAuth 1:1 de un restaurante con una cuenta de Google Calendar.

    Los tokens se guardan cifrados (Fernet, ver app/core/crypto.py) porque un
    refresh_token filtrado da acceso indefinido al calendario de la cuenta,
    a diferencia de una contraseña no se puede simplemente "hashear" (hace
    falta poder recuperar el valor real para llamar a la API de Google).
    """

    __tablename__ = "google_calendar_conexiones"

    restaurante_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("restaurantes.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
        index=True,
    )

    access_token_cifrado: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token_cifrado: Mapped[str] = mapped_column(Text, nullable=False)
    token_expira_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    calendar_id: Mapped[str] = mapped_column(String(255), default="primary", server_default="primary")
    email_cuenta: Mapped[str | None] = mapped_column(String(255))

    # Canal de notificaciones push (Google Calendar "watch"). Sin canal_id no
    # hay push activo; se registra al conectar y hay que renovarlo antes de
    # canal_expira_en (Google los expira, máx. ~1 mes para eventos).
    canal_id: Mapped[str | None] = mapped_column(String(255))
    canal_resource_id: Mapped[str | None] = mapped_column(String(255))
    canal_expira_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # Token de sincronización incremental de la Calendar API: al recibir un
    # push, se listan los cambios "desde sync_token" en vez de repasar todo
    # el calendario. Se actualiza en cada sync.
    sync_token: Mapped[str | None] = mapped_column(Text)
