"""Sincronización saliente: reserva creada/actualizada/cancelada en la app
-> evento creado/actualizado/cancelado en el Google Calendar del restaurante.

Se dispara fire-and-forget (`asyncio.create_task`) desde los endpoints de
reservas, igual que la notificación a N8N — un fallo aquí nunca debe romper
la respuesta al cliente que creó la reserva. Como las llamadas a la API de
Google son bloqueantes (googleapiclient no es asíncrono), el trabajo se
ejecuta en un hilo aparte (`asyncio.to_thread`) para no bloquear el event
loop, y abre su propia sesión de BD porque la de la petición original ya
se habrá cerrado para cuando esta tarea corra.
"""

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app import crud
from app.db.session import SessionLocal
from app.models.google_calendar import GoogleCalendarConexion
from app.models.reserva import EstadoReserva
from app.services import google_calendar as google_calendar_service

logger = logging.getLogger(__name__)

TIMEZONE_IANA = "Europe/Madrid"


def _servicio_con_refresh(db, conexion: GoogleCalendarConexion):
    """Construye el cliente de la API y, si de paso Google refrescó el
    access_token (porque había caducado), persiste el nuevo valor cifrado
    para no tener que refrescar de nuevo en la próxima llamada."""
    access_token_previo = crud.google_calendar.access_token(conexion)
    creds = google_calendar_service.credenciales_desde_conexion(
        access_token_previo,
        crud.google_calendar.refresh_token(conexion),
        conexion.token_expira_en,
    )
    servicio = google_calendar_service.calendar_service_desde_credenciales(creds)

    def persistir_si_refresco() -> None:
        if creds.token and creds.token != access_token_previo:
            expira_en = (
                creds.expiry.replace(tzinfo=timezone.utc) if creds.expiry else conexion.token_expira_en
            )
            crud.google_calendar.guardar_tokens(
                db,
                restaurante_id=conexion.restaurante_id,
                access_token=creds.token,
                refresh_token=creds.refresh_token or "",
                expira_en=expira_en,
                email_cuenta=conexion.email_cuenta,
                calendar_id=conexion.calendar_id,
            )

    return servicio, persistir_si_refresco


def _sync_saliente_sync(restaurante_id: uuid.UUID, reserva_id: uuid.UUID, tipo: str) -> None:
    db = SessionLocal()
    try:
        conexion = crud.google_calendar.get_by_restaurante(db, restaurante_id=restaurante_id)
        if not conexion:
            return

        reserva = crud.reserva.get(db, reserva_id)
        if not reserva:
            return

        servicio, persistir_si_refresco = _servicio_con_refresh(db, conexion)

        try:
            if tipo == "reserva_cancelada" or reserva.estado.value == "cancelada":
                if reserva.google_event_id:
                    google_calendar_service.cancelar_evento(
                        servicio, conexion.calendar_id, reserva.google_event_id
                    )
                    reserva.google_event_id = None
                    db.add(reserva)
                    db.commit()
                return

            if reserva.google_event_id:
                actualizado = google_calendar_service.actualizar_evento(
                    servicio, conexion.calendar_id, reserva.google_event_id, reserva, TIMEZONE_IANA
                )
                if actualizado is None:
                    # El evento ya no existe en Calendar (lo borraron a mano):
                    # lo recreamos para no perder la sincronización.
                    creado = google_calendar_service.crear_evento(
                        servicio, conexion.calendar_id, reserva, TIMEZONE_IANA
                    )
                    reserva.google_event_id = creado["id"]
                    db.add(reserva)
                    db.commit()
            else:
                creado = google_calendar_service.crear_evento(
                    servicio, conexion.calendar_id, reserva, TIMEZONE_IANA
                )
                reserva.google_event_id = creado["id"]
                db.add(reserva)
                db.commit()
        finally:
            persistir_si_refresco()
    except Exception:
        logger.warning(
            "No se pudo sincronizar la reserva %s con Google Calendar (%s)",
            reserva_id,
            tipo,
            exc_info=True,
        )
    finally:
        db.close()


async def sincronizar_reserva(restaurante_id: uuid.UUID, reserva_id: uuid.UUID, tipo: str) -> None:
    await asyncio.to_thread(_sync_saliente_sync, restaurante_id, reserva_id, tipo)


# --- Sincronización entrante: Calendar -> app -------------------------------


def _procesar_evento_propio(db, restaurante_id: uuid.UUID, reserva_id_marcador: str, cancelado: bool) -> None:
    """El evento lleva nuestro marcador (`convite_reserva_id`): lo creó esta
    app. Solo nos interesa si lo borraron/cancelaron directamente en Google
    Calendar — el resto de cambios (horario, etc.) no se sincronizan de
    vuelta, para no pisar lo que el propio restaurante gestiona en la app."""
    if not cancelado:
        return
    try:
        reserva_id = uuid.UUID(reserva_id_marcador)
    except ValueError:
        return
    reserva = crud.reserva.get(db, reserva_id)
    if not reserva or reserva.restaurante_id != restaurante_id:
        return
    if reserva.estado != EstadoReserva.CANCELADA:
        crud.reserva.cambiar_estado(db, reserva=reserva, estado=EstadoReserva.CANCELADA)


def _procesar_evento_externo(db, restaurante_id: uuid.UUID, evento: dict, cancelado: bool) -> None:
    """Evento sin nuestro marcador: no lo creó la app (alguien lo metió a
    mano en Calendar, o vino de "Reserve with Google"). Si ya lo habíamos
    importado antes, solo reflejamos la cancelación; si es nuevo, se crea
    la reserva correspondiente, asignando mesa si hay una libre."""
    google_event_id = evento["id"]
    existente = crud.reserva.get_by_google_event_id(
        db, restaurante_id=restaurante_id, google_event_id=google_event_id
    )

    if cancelado:
        if existente and existente.estado != EstadoReserva.CANCELADA:
            crud.reserva.cambiar_estado(db, reserva=existente, estado=EstadoReserva.CANCELADA)
        return

    if existente:
        # Ya importado; no soportamos re-sincronizar ediciones de horario
        # hechas después en Calendar, solo la creación y la cancelación.
        return

    inicio_raw = evento.get("start", {})
    fin_raw = evento.get("end", {})
    if "dateTime" not in inicio_raw or "dateTime" not in fin_raw:
        return  # evento "todo el día" o sin hora: no es una reserva de mesa

    try:
        zona = ZoneInfo(TIMEZONE_IANA)
        inicio_local = datetime.fromisoformat(inicio_raw["dateTime"]).astimezone(zona).replace(tzinfo=None)
        fin_local = datetime.fromisoformat(fin_raw["dateTime"]).astimezone(zona).replace(tzinfo=None)
    except ValueError:
        return

    duracion_minutos = max(int((fin_local - inicio_local).total_seconds() // 60), 15)
    fecha = inicio_local.date()
    hora = inicio_local.time()

    turno = crud.turno.encontrar_para_hora(db, restaurante_id=restaurante_id, hora=hora)

    attendees = [a for a in (evento.get("attendees") or []) if not a.get("organizer")]
    num_personas = len(attendees) or 2

    cliente_nombre = evento.get("summary") or "Reserva desde Google Calendar"
    cliente_email = (evento.get("creator") or {}).get("email")

    disponibles = crud.reserva.mesas_disponibles(
        db,
        restaurante_id=restaurante_id,
        turno=turno,
        fecha=fecha,
        comensales=num_personas,
        hora=hora,
        duracion_minutos=duracion_minutos,
    )
    mesa_ids_candidatas: list[uuid.UUID] = []
    notas = None
    if disponibles:
        mejor = min(disponibles, key=lambda m: m.capacidad_max)
        mesa_ids_candidatas = [mejor.id]
    else:
        notas = "Importado desde Google Calendar: no había mesa libre automática, asignar a mano."

    crud.reserva.crear_desde_sync_externo(
        db,
        restaurante_id=restaurante_id,
        turno_id=turno.id if turno else None,
        fecha=fecha,
        hora=hora,
        duracion_minutos=duracion_minutos,
        num_personas=num_personas,
        cliente_nombre=cliente_nombre,
        cliente_email=cliente_email,
        mesa_ids_candidatas=mesa_ids_candidatas,
        google_event_id=google_event_id,
        notas=notas,
    )


def _procesar_webhook_sync(canal_id: str) -> None:
    db = SessionLocal()
    try:
        conexion = crud.google_calendar.get_by_canal_id(db, canal_id=canal_id)
        if not conexion:
            logger.info("Webhook de Google para un canal ya no registrado: %s", canal_id)
            return

        servicio, persistir_si_refresco = _servicio_con_refresh(db, conexion)
        try:
            eventos, nuevo_sync_token = google_calendar_service.listar_cambios(
                servicio, conexion.calendar_id, conexion.sync_token
            )
            for evento in eventos:
                marcador = (
                    (evento.get("extendedProperties") or {}).get("private") or {}
                ).get(google_calendar_service.EXT_PROP_RESERVA_ID)
                cancelado = evento.get("status") == "cancelled"
                if marcador:
                    _procesar_evento_propio(db, conexion.restaurante_id, marcador, cancelado)
                else:
                    _procesar_evento_externo(db, conexion.restaurante_id, evento, cancelado)

            crud.google_calendar.guardar_sync_token(db, conexion=conexion, sync_token=nuevo_sync_token)
        finally:
            persistir_si_refresco()
    except Exception:
        logger.warning(
            "Fallo procesando el webhook de Google Calendar (canal=%s)", canal_id, exc_info=True
        )
    finally:
        db.close()


async def procesar_webhook(canal_id: str) -> None:
    await asyncio.to_thread(_procesar_webhook_sync, canal_id)
