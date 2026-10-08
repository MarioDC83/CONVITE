import logging

import httpx

logger = logging.getLogger("n8n_notify")

TIMEOUT_SEGUNDOS = 5.0


async def _post_webhook(url: str | None, tipo: str, clave: str, payload: dict) -> None:
    """Fire-and-forget: pensado para lanzarse con `asyncio.create_task(...)`
    y nunca lanza — si el webhook falla o N8N está caído, solo se registra el
    error y la operación original no se ve afectada en absoluto."""
    if not url:
        return
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SEGUNDOS) as client:
            respuesta = await client.post(url, json={"type": tipo, clave: payload})
            if respuesta.status_code >= 400:
                logger.warning(
                    "Webhook N8N respondió %s al notificar '%s'", respuesta.status_code, tipo
                )
    except httpx.HTTPError as exc:
        logger.warning("No se pudo notificar a N8N (%s): %s", tipo, exc)


async def notificar_reserva(url: str | None, tipo: str, payload: dict) -> None:
    """Notifica a N8N de un evento de reserva (creada/actualizada/cancelada/
    recordatorio_previo) para que dispare el WhatsApp correspondiente."""
    await _post_webhook(url, tipo, "reserva", payload)


async def notificar_lista_espera(url: str | None, tipo: str, payload: dict) -> None:
    """Notifica a N8N de un evento de la lista de espera (p.ej. se libera
    mesa y se le ofrece a alguien: `oferta_lista_espera`)."""
    await _post_webhook(url, tipo, "lista_espera", payload)
