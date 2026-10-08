"""Emisión centralizada de eventos de reserva: WebSocket en vivo a la app,
notificación fire-and-forget a N8N, y sincronización fire-and-forget con
Google Calendar. La usan tanto el router de reservas como la confirmación de
ofertas de la lista de espera (que también termina creando una reserva)."""

import asyncio

from app.models.reserva import Reserva
from app.models.restaurante import Restaurante
from app.schemas.reserva import ReservaRead
from app.services.google_sync import sincronizar_reserva
from app.services.n8n_notify import notificar_reserva
from app.ws.manager import manager


async def emitir_evento_reserva(restaurante: Restaurante, tipo: str, reserva: Reserva) -> None:
    payload = ReservaRead.model_validate(reserva).model_dump(mode="json")
    await manager.broadcast(restaurante.id, {"type": tipo, "reserva": payload})
    # Fire-and-forget: nunca bloquea ni puede romper la respuesta al llamante.
    asyncio.create_task(
        notificar_reserva(restaurante.n8n_webhook_notificaciones_url, tipo, payload)
    )
    asyncio.create_task(sincronizar_reserva(restaurante.id, reserva.id, tipo))
