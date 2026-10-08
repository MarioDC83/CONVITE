"""Cuando una reserva se cancela o se marca no-show, sus mesas quedan
libres: esto intenta ofrecérselas a la entrada más antigua compatible de la
lista de espera (fire-and-forget, con su propia sesión de BD, igual que la
sincronización con Google Calendar — nunca puede romper la operación que lo
disparó).
"""

import asyncio
import logging
import uuid

from app import crud
from app.db.session import SessionLocal
from app.schemas.lista_espera import ListaEsperaRead
from app.services.n8n_notify import notificar_lista_espera

logger = logging.getLogger(__name__)


def _intentar_ofrecer_sync(restaurante_id: uuid.UUID, reserva_id: uuid.UUID) -> None:
    db = SessionLocal()
    try:
        reserva = crud.reserva.get(db, reserva_id)
        if not reserva or not reserva.mesas:
            return
        restaurante = crud.restaurante.get(db, restaurante_id)
        if not restaurante:
            return

        for mesa in reserva.mesas:
            candidata = crud.lista_espera.siguiente_candidata(
                db,
                restaurante_id=restaurante.id,
                turno_id=reserva.turno_id,
                fecha=reserva.fecha,
                comensales_max=mesa.capacidad_max,
            )
            if not candidata:
                continue

            # Puede que la mesa la haya ocupado ya otra reserva entre medias;
            # se reconfirma disponibilidad real antes de ofrecerla.
            disponibles = crud.reserva.mesas_disponibles(
                db,
                restaurante_id=restaurante.id,
                turno=None,
                fecha=reserva.fecha,
                comensales=candidata.comensales,
                hora=reserva.hora,
                duracion_minutos=reserva.duracion_minutos,
            )
            if mesa.id not in {m.id for m in disponibles}:
                continue

            actualizada = crud.lista_espera.marcar_ofrecida(db, entrada=candidata, mesa_id=mesa.id)
            payload = ListaEsperaRead.model_validate(actualizada).model_dump(mode="json")
            asyncio.run(
                notificar_lista_espera(
                    restaurante.n8n_webhook_notificaciones_url, "oferta_lista_espera", payload
                )
            )
    except Exception:
        logger.warning(
            "Fallo intentando ofrecer mesa liberada a la lista de espera (reserva=%s)",
            reserva_id,
            exc_info=True,
        )
    finally:
        db.close()


async def intentar_ofrecer_a_lista_espera(restaurante_id: uuid.UUID, reserva_id: uuid.UUID) -> None:
    await asyncio.to_thread(_intentar_ofrecer_sync, restaurante_id, reserva_id)
