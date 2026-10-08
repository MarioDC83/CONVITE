"""Callback OAuth de Google Calendar y receptor del webhook de notificaciones
push. Ambos viven en una URL FIJA (no bajo /restaurantes/{id}/...) porque:
- El callback lo registra Google Cloud Console como redirect_uri exacta; no
  puede llevar un restaurante_id variable en el path. El restaurante se
  identifica a través del parámetro `state` firmado (ver crear_state_oauth).
- El webhook de notificaciones identifica la conexión por el header
  `X-Goog-Channel-Id` que Google reenvía, no por la URL.
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Header, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import get_db
from app.core.config import settings
from app.core.security import verificar_state_oauth
from app.services import google_calendar as google_calendar_service
from app.services.google_sync import procesar_webhook

logger = logging.getLogger(__name__)

router = APIRouter()


def _webhook_url() -> str:
    return f"{settings.BACKEND_PUBLIC_URL}{settings.API_V1_STR}/integraciones/google/webhook"


@router.get("/callback")
def callback_google(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    # Google reenvía el `state` tal cual también cuando el usuario cancela el
    # consentimiento (error=access_denied), así que se puede decodificar ya
    # para volver siempre a la página de integraciones DE ESE restaurante en
    # vez de a la raíz del frontend.
    restaurante_id_state = verificar_state_oauth(state) if state else None

    def volver_frontend(estado: str, motivo: str | None = None) -> RedirectResponse:
        destino = (
            f"{settings.FRONTEND_URL}/restaurantes/{restaurante_id_state}/integraciones"
            if restaurante_id_state
            else settings.FRONTEND_URL
        )
        url = f"{destino}?google={estado}"
        if motivo:
            url += f"&motivo={motivo}"
        return RedirectResponse(url, status_code=status.HTTP_302_FOUND)

    if error:
        logger.info("Google OAuth cancelado/erróneo: %s", error)
        return volver_frontend("error", "consentimiento_denegado")

    if not code or not state:
        return volver_frontend("error", "parametros_faltantes")

    restaurante_id = restaurante_id_state
    if not restaurante_id:
        return volver_frontend("error", "state_invalido")

    restaurante = crud.restaurante.get(db, restaurante_id)
    if not restaurante:
        return volver_frontend("error", "restaurante_no_encontrado")

    try:
        creds = google_calendar_service.intercambiar_codigo(code)
    except Exception:
        logger.warning("Fallo al intercambiar el code de Google OAuth", exc_info=True)
        return volver_frontend("error", "intercambio_fallido")

    if not creds.refresh_token:
        # No debería pasar con prompt=consent+access_type=offline, pero sin
        # refresh_token no podríamos renovar el acceso más adelante.
        return volver_frontend("error", "sin_refresh_token")

    email = google_calendar_service.obtener_email_cuenta(creds)

    # creds.expiry es un datetime naive en UTC (así lo devuelve google-auth);
    # lo pasamos a aware para guardarlo en una columna DateTime(timezone=True).
    expira_en = creds.expiry.replace(tzinfo=timezone.utc) if creds.expiry else (
        datetime.now(timezone.utc) + timedelta(hours=1)
    )

    conexion = crud.google_calendar.guardar_tokens(
        db,
        restaurante_id=restaurante.id,
        access_token=creds.token,
        refresh_token=creds.refresh_token,
        expira_en=expira_en,
        email_cuenta=email,
    )

    try:
        servicio = google_calendar_service.calendar_service(
            crud.google_calendar.access_token(conexion),
            crud.google_calendar.refresh_token(conexion),
            conexion.token_expira_en,
        )
        canal = google_calendar_service.registrar_canal_watch(
            servicio, conexion.calendar_id, _webhook_url()
        )
        expiracion_ms = int(canal["expiration"])
        crud.google_calendar.guardar_canal_watch(
            db,
            conexion=conexion,
            canal_id=canal["id"],
            resource_id=canal["resourceId"],
            expira_en=datetime.fromtimestamp(expiracion_ms / 1000, tz=timezone.utc),
        )
    except Exception:
        # La conexión (tokens) ya quedó guardada; el canal push se puede
        # reintentar más adelante. No rompemos el flujo de conexión por esto.
        logger.warning("No se pudo registrar el canal watch de Google Calendar", exc_info=True)

    return volver_frontend("conectado")


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def webhook_google(
    db: Session = Depends(get_db),
    x_goog_channel_id: str | None = Header(None, alias="X-Goog-Channel-Id"),
    x_goog_resource_state: str | None = Header(None, alias="X-Goog-Resource-State"),
):
    """Google llama aquí (POST vacío, sin cuerpo útil) cada vez que hay
    cambios en el calendario — es solo la señal de "ve a mirar"; los datos
    reales se piden aparte con `listar_cambios` (syncToken). Respondemos 200
    de inmediato (Google espera una respuesta rápida y puede desactivar el
    canal si no la hay) y la sincronización real corre en segundo plano."""
    if not x_goog_channel_id:
        return {"ok": True}

    conexion = crud.google_calendar.get_by_canal_id(db, canal_id=x_goog_channel_id)
    if not conexion:
        logger.info("Webhook de Google para un canal desconocido: %s", x_goog_channel_id)
        return {"ok": True}

    if x_goog_resource_state == "sync":
        # Primer mensaje al crear el canal, confirmando que quedó activo.
        return {"ok": True}

    asyncio.create_task(procesar_webhook(x_goog_channel_id))
    return {"ok": True}
