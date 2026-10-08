"""Envoltorio fino sobre la API de Google Calendar: OAuth, CRUD de eventos,
registro del canal de notificaciones push y sincronización incremental.

Todo lo que toca red/SDK de Google vive aquí para que el resto del backend
(endpoints, crud de reservas) no dependa directamente de googleapiclient.
"""

import uuid as uuid_lib
from datetime import datetime, timedelta, timezone

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import Resource, build
from googleapiclient.errors import HttpError

from app.core.config import settings
from app.models.reserva import Reserva

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/userinfo.email",
]


def credenciales_configuradas() -> bool:
    return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)


def redirect_uri() -> str:
    return f"{settings.BACKEND_PUBLIC_URL}{settings.API_V1_STR}/integraciones/google/callback"


def _client_config() -> dict:
    return {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [redirect_uri()],
        }
    }


def construir_url_autorizacion(state: str) -> str:
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=redirect_uri())
    url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",  # fuerza que Google reenvíe refresh_token siempre
        state=state,
    )
    return url


def intercambiar_codigo(code: str) -> Credentials:
    flow = Flow.from_client_config(_client_config(), scopes=SCOPES, redirect_uri=redirect_uri())
    flow.fetch_token(code=code)
    return flow.credentials


def obtener_email_cuenta(creds: Credentials) -> str | None:
    try:
        servicio = build("oauth2", "v2", credentials=creds, cache_discovery=False)
        info = servicio.userinfo().get().execute()
        return info.get("email")
    except HttpError:
        return None


def credenciales_desde_conexion(
    access_token: str, refresh_token: str, expira_en: datetime
) -> Credentials:
    expiry_naive = expira_en.astimezone(timezone.utc).replace(tzinfo=None)
    return Credentials(
        token=access_token,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.GOOGLE_CLIENT_ID,
        client_secret=settings.GOOGLE_CLIENT_SECRET,
        scopes=SCOPES,
        expiry=expiry_naive,
    )


def calendar_service_desde_credenciales(creds: Credentials) -> Resource:
    return build("calendar", "v3", credentials=creds, cache_discovery=False)


def calendar_service(access_token: str, refresh_token: str, expira_en: datetime) -> Resource:
    """Atajo para llamadas puntuales donde no hace falta inspeccionar las
    credenciales después (p.ej. desconectar). Si la llamada puede refrescar
    el access_token, usa `credenciales_desde_conexion` +
    `calendar_service_desde_credenciales` para poder persistir el token
    nuevo (ver app/services/google_sync.py)."""
    creds = credenciales_desde_conexion(access_token, refresh_token, expira_en)
    return calendar_service_desde_credenciales(creds)


# --- Eventos --------------------------------------------------------------

EXT_PROP_RESERVA_ID = "convite_reserva_id"


def _cuerpo_evento(reserva: Reserva, timezone_iana: str) -> dict:
    inicio = datetime.combine(reserva.fecha, reserva.hora)
    fin = inicio + timedelta(minutes=reserva.duracion_minutos)
    mesas = ", ".join(m.nombre for m in reserva.mesas) or "sin asignar"
    descripcion_partes = [
        f"Mesa(s): {mesas}",
        f"Comensales: {reserva.num_personas}",
        f"Teléfono: {reserva.cliente_telefono or '-'}",
    ]
    if reserva.notas:
        descripcion_partes.append(f"Notas: {reserva.notas}")
    return {
        "summary": f"Reserva — {reserva.cliente_nombre} ({reserva.num_personas}p)",
        "description": "\n".join(descripcion_partes),
        "start": {"dateTime": inicio.isoformat(), "timeZone": timezone_iana},
        "end": {"dateTime": fin.isoformat(), "timeZone": timezone_iana},
        "extendedProperties": {"private": {EXT_PROP_RESERVA_ID: str(reserva.id)}},
        "status": "cancelled" if reserva.estado == "cancelada" else "confirmed",
    }


def crear_evento(service: Resource, calendar_id: str, reserva: Reserva, timezone_iana: str) -> dict:
    return (
        service.events()
        .insert(calendarId=calendar_id, body=_cuerpo_evento(reserva, timezone_iana))
        .execute()
    )


def actualizar_evento(
    service: Resource, calendar_id: str, event_id: str, reserva: Reserva, timezone_iana: str
) -> dict | None:
    try:
        return (
            service.events()
            .update(calendarId=calendar_id, eventId=event_id, body=_cuerpo_evento(reserva, timezone_iana))
            .execute()
        )
    except HttpError as exc:
        if exc.resp.status in (404, 410):
            return None
        raise


def cancelar_evento(service: Resource, calendar_id: str, event_id: str) -> None:
    try:
        service.events().delete(calendarId=calendar_id, eventId=event_id).execute()
    except HttpError as exc:
        if exc.resp.status not in (404, 410):
            raise


# --- Canal de notificaciones push (watch) ----------------------------------


def registrar_canal_watch(service: Resource, calendar_id: str, webhook_url: str) -> dict:
    """Pide a Google que empiece a avisar (push) de cambios en el calendario.
    Devuelve {"id", "resourceId", "expiration"} — expiration en epoch ms."""
    canal_id = str(uuid_lib.uuid4())
    body = {"id": canal_id, "type": "web_hook", "address": webhook_url}
    return service.events().watch(calendarId=calendar_id, body=body).execute()


def detener_canal_watch(service: Resource, canal_id: str, resource_id: str) -> None:
    try:
        service.channels().stop(body={"id": canal_id, "resourceId": resource_id}).execute()
    except HttpError:
        pass  # el canal ya podría haber expirado por su cuenta


# --- Sincronización incremental --------------------------------------------


def listar_cambios(
    service: Resource, calendar_id: str, sync_token: str | None
) -> tuple[list[dict], str | None]:
    """Devuelve (eventos_cambiados, nuevo_sync_token) usando el syncToken de
    Google (patrón oficial de sync incremental: la notificación push no trae
    los datos, solo avisa de que hay que volver a preguntar esto).

    Si el syncToken ha caducado (410 Gone), reintenta con una sincronización
    completa (sin syncToken) automáticamente.
    """
    eventos: list[dict] = []
    page_token: str | None = None
    usar_sync_token = sync_token

    while True:
        kwargs: dict = {"calendarId": calendar_id, "singleEvents": True}
        if usar_sync_token:
            kwargs["syncToken"] = usar_sync_token
        if page_token:
            kwargs["pageToken"] = page_token
        try:
            resp = service.events().list(**kwargs).execute()
        except HttpError as exc:
            if exc.resp.status == 410 and usar_sync_token:
                usar_sync_token = None
                page_token = None
                eventos = []
                continue
            raise

        eventos.extend(resp.get("items", []))
        page_token = resp.get("nextPageToken")
        if not page_token:
            return eventos, resp.get("nextSyncToken")
