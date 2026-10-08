"""Tareas periódicas en proceso (APScheduler): recordatorio automático de
WhatsApp antes de la reserva, y expiración de ofertas de la lista de espera.

Corre dentro del propio proceso de FastAPI — limitación deliberada y
documentada, igual que el rate limiter o el ConnectionManager de WebSockets:
con un solo worker (como aquí) no hay duplicados; si algún día se escala a
varios workers habría que mover esto a un proceso aparte o añadir un lock
distribuido para que no lo dispare cada worker a la vez.
"""

import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app import crud
from app.db.session import SessionLocal
from app.models.lista_espera import EstadoListaEspera
from app.schemas.lista_espera import ListaEsperaRead
from app.schemas.reserva import ReservaRead
from app.services.n8n_notify import notificar_lista_espera, notificar_reserva

logger = logging.getLogger(__name__)

TIMEZONE_IANA = "Europe/Madrid"
INTERVALO_RECORDATORIOS_SEGUNDOS = 300  # cada 5 minutos
INTERVALO_LISTA_ESPERA_SEGUNDOS = 60  # cada minuto: la oferta dura poco (15 min)
INTERVALO_ENCUESTAS_SEGUNDOS = 3600  # cada hora: no hay prisa, es "el día después"


def _ahora_local() -> datetime:
    return datetime.now(ZoneInfo(TIMEZONE_IANA)).replace(tzinfo=None)


async def _job_recordatorios() -> None:
    db = SessionLocal()
    try:
        ahora = _ahora_local()
        candidatas = crud.reserva.get_candidatas_recordatorio(db)
        for reserva in candidatas:
            restaurante = reserva.restaurante
            horas_antes = restaurante.recordatorio_horas_antes
            if not horas_antes or not restaurante.n8n_webhook_notificaciones_url:
                continue

            fecha_hora = datetime.combine(reserva.fecha, reserva.hora)
            ventana_inicio = fecha_hora - timedelta(hours=horas_antes)
            if not (ventana_inicio <= ahora < fecha_hora):
                continue

            payload = ReservaRead.model_validate(reserva).model_dump(mode="json")
            await notificar_reserva(
                restaurante.n8n_webhook_notificaciones_url, "recordatorio_previo", payload
            )
            crud.reserva.marcar_recordatorio_enviado(db, reserva=reserva)
    except Exception:
        logger.warning("Fallo en el job de recordatorios de WhatsApp", exc_info=True)
    finally:
        db.close()


async def _job_expirar_ofertas_lista_espera() -> None:
    db = SessionLocal()
    try:
        expiradas = crud.lista_espera.get_ofertas_expiradas(db)
        for entrada in expiradas:
            mesa_id = entrada.mesa_ofrecida_id
            restaurante = crud.restaurante.get(db, entrada.restaurante_id)
            crud.lista_espera.cambiar_estado(db, entrada=entrada, estado=EstadoListaEspera.EXPIRADA)

            if not mesa_id or not restaurante:
                continue
            mesa = crud.mesa.get(db, mesa_id)
            if not mesa:
                continue

            siguiente = crud.lista_espera.siguiente_candidata(
                db,
                restaurante_id=entrada.restaurante_id,
                turno_id=entrada.turno_id,
                fecha=entrada.fecha,
                comensales_max=mesa.capacidad_max,
            )
            if not siguiente:
                continue

            actualizada = crud.lista_espera.marcar_ofrecida(db, entrada=siguiente, mesa_id=mesa.id)
            payload = ListaEsperaRead.model_validate(actualizada).model_dump(mode="json")
            await notificar_lista_espera(
                restaurante.n8n_webhook_notificaciones_url, "oferta_lista_espera", payload
            )
    except Exception:
        logger.warning("Fallo en el job de expiración de la lista de espera", exc_info=True)
    finally:
        db.close()


async def _job_encuestas_satisfaccion() -> None:
    db = SessionLocal()
    try:
        candidatas = crud.reserva.get_candidatas_encuesta(db)
        for reserva in candidatas:
            restaurante = reserva.restaurante
            if not restaurante.n8n_webhook_notificaciones_url:
                continue
            payload = ReservaRead.model_validate(reserva).model_dump(mode="json")
            await notificar_reserva(
                restaurante.n8n_webhook_notificaciones_url, "encuesta_satisfaccion", payload
            )
            crud.reserva.marcar_encuesta_enviada(db, reserva=reserva)
    except Exception:
        logger.warning("Fallo en el job de encuestas de satisfacción", exc_info=True)
    finally:
        db.close()


_scheduler: AsyncIOScheduler | None = None


def iniciar_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler(timezone=TIMEZONE_IANA)
    _scheduler.add_job(
        _job_recordatorios,
        "interval",
        seconds=INTERVALO_RECORDATORIOS_SEGUNDOS,
        id="recordatorios_whatsapp",
        next_run_time=datetime.now(),  # también al arrancar, no solo tras el primer intervalo
    )
    _scheduler.add_job(
        _job_expirar_ofertas_lista_espera,
        "interval",
        seconds=INTERVALO_LISTA_ESPERA_SEGUNDOS,
        id="expirar_lista_espera",
        next_run_time=datetime.now(),
    )
    _scheduler.add_job(
        _job_encuestas_satisfaccion,
        "interval",
        seconds=INTERVALO_ENCUESTAS_SEGUNDOS,
        id="encuestas_satisfaccion",
        next_run_time=datetime.now(),
    )
    _scheduler.start()
    logger.info(
        "Scheduler iniciado (recordatorios cada %ss, lista de espera cada %ss, encuestas cada %ss)",
        INTERVALO_RECORDATORIOS_SEGUNDOS,
        INTERVALO_LISTA_ESPERA_SEGUNDOS,
        INTERVALO_ENCUESTAS_SEGUNDOS,
    )


def detener_scheduler() -> None:
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
