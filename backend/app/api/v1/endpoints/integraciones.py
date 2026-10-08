import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import get_db, require_admin_del_restaurante
from app.core.security import crear_state_oauth
from app.models.restaurante import Restaurante
from app.schemas.integraciones import (
    ApiKeyCreada,
    ApiKeyInfo,
    GoogleConectarUrl,
    IntegracionesRead,
    N8nWebhookUpdate,
    RecordatorioUpdate,
)
from app.services import google_calendar as google_calendar_service

logger = logging.getLogger(__name__)

router = APIRouter()


def _api_key_info(restaurante: Restaurante) -> ApiKeyInfo:
    return ApiKeyInfo(
        activa=bool(restaurante.api_key_hash),
        prefijo=restaurante.api_key_prefix,
        scopes=restaurante.api_key_scopes or [],
        creada_en=restaurante.api_key_creada_en,
    )


def _integraciones_read(db: Session, restaurante: Restaurante) -> IntegracionesRead:
    conexion = crud.google_calendar.get_by_restaurante(db, restaurante_id=restaurante.id)
    return IntegracionesRead(
        api_key=_api_key_info(restaurante),
        n8n_webhook_notificaciones_url=restaurante.n8n_webhook_notificaciones_url,
        google_calendar_conectado=conexion is not None,
        google_calendar_email=conexion.email_cuenta if conexion else None,
        recordatorio_horas_antes=restaurante.recordatorio_horas_antes,
    )


@router.get("/", response_model=IntegracionesRead)
def obtener_integraciones(
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    return _integraciones_read(db, restaurante)


@router.post("/api-key/regenerar", response_model=ApiKeyCreada)
def regenerar_api_key(
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    """Genera una API key nueva para este restaurante e invalida la anterior.
    El valor en claro solo se devuelve en esta respuesta: guárdalo ahora."""
    valor = crud.restaurante.regenerar_api_key(db, restaurante=restaurante)
    return ApiKeyCreada(valor=valor, info=_api_key_info(restaurante))


@router.put("/n8n-webhook", response_model=IntegracionesRead)
def actualizar_webhook_n8n(
    payload: N8nWebhookUpdate,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    restaurante.n8n_webhook_notificaciones_url = str(payload.url) if payload.url else None
    db.add(restaurante)
    db.commit()
    db.refresh(restaurante)
    return _integraciones_read(db, restaurante)


@router.put("/recordatorio", response_model=IntegracionesRead)
def actualizar_recordatorio(
    payload: RecordatorioUpdate,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    """Antelación del recordatorio automático de WhatsApp antes de la
    reserva. `horas_antes: null` lo desactiva para este restaurante."""
    restaurante.recordatorio_horas_antes = payload.horas_antes
    db.add(restaurante)
    db.commit()
    db.refresh(restaurante)
    return _integraciones_read(db, restaurante)


@router.get("/google/conectar", response_model=GoogleConectarUrl)
def conectar_google_calendar(
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
):
    """Devuelve la URL de consentimiento de Google a la que el navegador del
    admin debe navegar directamente (no es una llamada fetch: Google necesita
    la navegación real del usuario para mostrar la pantalla de permisos)."""
    if not google_calendar_service.credenciales_configuradas():
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail=(
                "Google Calendar no está configurado en este servidor: faltan "
                "GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET. Ver guía de configuración."
            ),
        )
    state = crear_state_oauth(restaurante.id)
    url = google_calendar_service.construir_url_autorizacion(state)
    return GoogleConectarUrl(url=url)


@router.post("/google/desconectar", response_model=IntegracionesRead)
def desconectar_google_calendar(
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    conexion = crud.google_calendar.get_by_restaurante(db, restaurante_id=restaurante.id)
    if conexion:
        if conexion.canal_id and conexion.canal_resource_id:
            try:
                servicio = google_calendar_service.calendar_service(
                    crud.google_calendar.access_token(conexion),
                    crud.google_calendar.refresh_token(conexion),
                    conexion.token_expira_en,
                )
                google_calendar_service.detener_canal_watch(
                    servicio, conexion.canal_id, conexion.canal_resource_id
                )
            except Exception:
                logger.warning("No se pudo detener el canal watch al desconectar", exc_info=True)
        crud.google_calendar.eliminar(db, conexion=conexion)
    return _integraciones_read(db, restaurante)
