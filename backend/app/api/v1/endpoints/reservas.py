import asyncio
import csv
import io
import uuid
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import (
    get_db,
    require_admin_del_restaurante,
    require_restaurante_o_api_key,
    require_usuario_del_restaurante,
)
from app.crud.reserva import ConflictoDisponibilidad, MesaInvalida
from app.models.reserva import ESTADOS_ACTIVOS, EstadoReserva, Reserva
from app.models.restaurante import Restaurante
from app.schemas.reserva import EncuestaRespuesta, ReservaCreate, ReservaEstadoUpdate, ReservaRead
from app.services.lista_espera_ofertas import intentar_ofrecer_a_lista_espera
from app.services.reserva_events import emitir_evento_reserva as _emitir

router = APIRouter()


def _get_reserva_or_404(db: Session, restaurante_id: uuid.UUID, reserva_id: uuid.UUID) -> Reserva:
    obj = crud.reserva.get(db, reserva_id)
    if not obj or obj.restaurante_id != restaurante_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reserva no encontrada")
    return obj


def _liberar_a_lista_espera_si_aplica(restaurante_id: uuid.UUID, reserva: Reserva) -> None:
    """Si la reserva quedó en un estado que libera mesa (cancelada / no-show),
    intenta ofrecérsela a quien esté esperando (fire-and-forget)."""
    if reserva.estado not in ESTADOS_ACTIVOS:
        asyncio.create_task(intentar_ofrecer_a_lista_espera(restaurante_id, reserva.id))


@router.get("/", response_model=list[ReservaRead])
def listar_reservas(
    fecha: date | None = Query(None),
    turno_id: uuid.UUID | None = Query(None),
    restaurante: Restaurante = Depends(require_usuario_del_restaurante),
    db: Session = Depends(get_db),
):
    return crud.reserva.get_multi_by_restaurante(
        db, restaurante_id=restaurante.id, fecha=fecha, turno_id=turno_id
    )


@router.get("/exportar")
def exportar_reservas_csv(
    fecha_desde: date = Query(...),
    fecha_hasta: date = Query(...),
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    """CSV de las reservas del rango, para llevarlas a contabilidad/Excel.
    Va antes de /{reserva_id} en el router a propósito: si no, FastAPI
    intentaría interpretar "exportar" como un reserva_id."""
    reservas = crud.reserva.get_multi_by_rango(
        db, restaurante_id=restaurante.id, fecha_desde=fecha_desde, fecha_hasta=fecha_hasta
    )
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["Fecha", "Hora", "Cliente", "Teléfono", "Email", "Comensales", "Mesas", "Estado", "Origen", "Notas"]
    )
    for r in reservas:
        writer.writerow(
            [
                r.fecha.isoformat(),
                r.hora.strftime("%H:%M"),
                r.cliente_nombre,
                r.cliente_telefono or "",
                r.cliente_email or "",
                r.num_personas,
                ", ".join(m.nombre for m in r.mesas),
                r.estado.value,
                r.origen.value,
                r.notas or "",
            ]
        )
    buffer.seek(0)
    nombre_archivo = f"reservas_{restaurante.slug}_{fecha_desde}_{fecha_hasta}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )


@router.get("/{reserva_id}", response_model=ReservaRead)
def obtener_reserva(
    reserva_id: uuid.UUID,
    restaurante: Restaurante = Depends(require_usuario_del_restaurante),
    db: Session = Depends(get_db),
):
    return _get_reserva_or_404(db, restaurante.id, reserva_id)


@router.post("/", response_model=ReservaRead, status_code=status.HTTP_201_CREATED)
async def crear_reserva(
    payload: ReservaCreate,
    restaurante: Restaurante = Depends(require_restaurante_o_api_key("reservas:crear")),
    db: Session = Depends(get_db),
):
    """Crea una reserva validando disponibilidad de mesa de forma atómica.

    Si dos peticiones piden la misma mesa a una hora que se solapa, la
    segunda transacción queda bloqueada por `FOR UPDATE` hasta que la primera
    confirma, y entonces detecta el solape y responde 409 en vez de crear un
    doble booking.

    Acepta autenticación de personal (JWT) o de integración (cabecera
    `X-API-Key` con scope `reservas:crear`) — así lo puede llamar tanto la
    propia app como N8N (Recepcionista IA) o el widget de reservas web.
    """
    turno = crud.turno.get(db, payload.turno_id)
    if not turno or turno.restaurante_id != restaurante.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Turno no válido para este restaurante")

    cierre = crud.dia_especial.get_by_fecha(db, restaurante_id=restaurante.id, fecha=payload.fecha)
    if cierre and cierre.cerrado:
        detalle = f"El restaurante está cerrado ese día{f': {cierre.motivo}' if cierre.motivo else ''}"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detalle)

    try:
        nueva = crud.reserva.crear_con_bloqueo(
            db, restaurante_id=restaurante.id, turno=turno, payload=payload
        )
    except ConflictoDisponibilidad as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except MesaInvalida as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await _emitir(restaurante, "reserva_creada", nueva)
    return nueva


@router.patch("/{reserva_id}/estado", response_model=ReservaRead)
async def cambiar_estado_reserva(
    reserva_id: uuid.UUID,
    payload: ReservaEstadoUpdate,
    restaurante: Restaurante = Depends(require_restaurante_o_api_key("reservas:estado")),
    db: Session = Depends(get_db),
):
    """Cambia el estado de una reserva. Es el webhook que N8N llama desde el
    workflow de respuestas de WhatsApp para reflejar que el cliente confirmó
    o canceló (cabecera `X-API-Key` con scope `reservas:estado`)."""
    obj = _get_reserva_or_404(db, restaurante.id, reserva_id)
    actualizada = crud.reserva.cambiar_estado(db, reserva=obj, estado=payload.estado)
    await _emitir(restaurante, "reserva_actualizada", actualizada)
    _liberar_a_lista_espera_si_aplica(restaurante.id, actualizada)
    return actualizada


@router.post("/{reserva_id}/cancelar", response_model=ReservaRead)
async def cancelar_reserva(
    reserva_id: uuid.UUID,
    restaurante: Restaurante = Depends(require_restaurante_o_api_key("reservas:estado")),
    db: Session = Depends(get_db),
):
    obj = _get_reserva_or_404(db, restaurante.id, reserva_id)
    cancelada = crud.reserva.cambiar_estado(db, reserva=obj, estado=EstadoReserva.CANCELADA)
    await _emitir(restaurante, "reserva_cancelada", cancelada)
    _liberar_a_lista_espera_si_aplica(restaurante.id, cancelada)
    return cancelada


@router.patch("/{reserva_id}/encuesta", response_model=ReservaRead)
def registrar_encuesta(
    reserva_id: uuid.UUID,
    payload: EncuestaRespuesta,
    restaurante: Restaurante = Depends(require_restaurante_o_api_key("reservas:estado")),
    db: Session = Depends(get_db),
):
    """N8N llama aquí cuando el cliente responde a la encuesta de
    satisfacción post-visita (1-5 y comentario libre opcional)."""
    obj = _get_reserva_or_404(db, restaurante.id, reserva_id)
    return crud.reserva.registrar_respuesta_encuesta(
        db, reserva=obj, puntuacion=payload.puntuacion, comentario=payload.comentario
    )
