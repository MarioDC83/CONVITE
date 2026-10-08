import uuid
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import get_db, require_restaurante_o_api_key, require_usuario_del_restaurante
from app.crud.reserva import ConflictoDisponibilidad, MesaInvalida
from app.models.lista_espera import EstadoListaEspera
from app.models.restaurante import Restaurante
from app.schemas.reserva import ReservaCreate
from app.schemas.lista_espera import ListaEsperaCreate, ListaEsperaRead
from app.services.reserva_events import emitir_evento_reserva

router = APIRouter()


def _get_entrada_or_404(db: Session, restaurante_id: uuid.UUID, entrada_id: uuid.UUID):
    obj = crud.lista_espera.get(db, entrada_id)
    if not obj or obj.restaurante_id != restaurante_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Entrada no encontrada")
    return obj


@router.get("/", response_model=list[ListaEsperaRead])
def listar_lista_espera(
    fecha: date | None = Query(None),
    restaurante: Restaurante = Depends(require_usuario_del_restaurante),
    db: Session = Depends(get_db),
):
    return crud.lista_espera.get_multi_by_restaurante(db, restaurante_id=restaurante.id, fecha=fecha)


@router.post("/", response_model=ListaEsperaRead, status_code=status.HTTP_201_CREATED)
def crear_entrada(
    payload: ListaEsperaCreate,
    restaurante: Restaurante = Depends(require_restaurante_o_api_key("reservas:crear")),
    db: Session = Depends(get_db),
):
    """Apuntarse a la lista de espera cuando no hay disponibilidad. Mismo
    scope que crear reservas: lo puede llamar tanto el widget/N8N como el
    propio personal desde la app."""
    turno = crud.turno.get(db, payload.turno_id)
    if not turno or turno.restaurante_id != restaurante.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Turno no válido para este restaurante"
        )
    return crud.lista_espera.create(db, obj_in=payload, restaurante_id=restaurante.id)


@router.post("/{entrada_id}/confirmar", response_model=ListaEsperaRead)
async def confirmar_entrada(
    entrada_id: uuid.UUID,
    restaurante: Restaurante = Depends(require_restaurante_o_api_key("reservas:crear")),
    db: Session = Depends(get_db),
):
    """El cliente aceptó la mesa ofrecida (o el personal la asigna a mano):
    convierte la entrada en una reserva real. Llamado por N8N cuando el
    cliente responde "sí" al WhatsApp de oferta, o desde la app."""
    entrada = _get_entrada_or_404(db, restaurante.id, entrada_id)
    if entrada.estado != EstadoListaEspera.OFRECIDA or not entrada.mesa_ofrecida_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Esta entrada no tiene ninguna mesa ofrecida pendiente de confirmar",
        )
    if entrada.oferta_expira_en and entrada.oferta_expira_en < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La oferta ha caducado; se ofrecerá al siguiente de la lista",
        )

    turno = crud.turno.get(db, entrada.turno_id)
    payload = ReservaCreate(
        cliente_nombre=entrada.cliente_nombre,
        cliente_telefono=entrada.cliente_telefono,
        cliente_email=entrada.cliente_email,
        fecha=entrada.fecha,
        turno_id=entrada.turno_id,
        hora=turno.hora_inicio,
        num_personas=entrada.comensales,
        mesa_ids=[entrada.mesa_ofrecida_id],
        notas=entrada.notas,
        origen="web",
    )
    try:
        nueva_reserva = crud.reserva.crear_con_bloqueo(
            db, restaurante_id=restaurante.id, turno=turno, payload=payload
        )
    except ConflictoDisponibilidad as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except MesaInvalida as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await emitir_evento_reserva(restaurante, "reserva_creada", nueva_reserva)
    return crud.lista_espera.marcar_confirmada(db, entrada=entrada, reserva_id=nueva_reserva.id)


@router.post("/{entrada_id}/cancelar", response_model=ListaEsperaRead)
def cancelar_entrada(
    entrada_id: uuid.UUID,
    restaurante: Restaurante = Depends(require_restaurante_o_api_key("reservas:estado")),
    db: Session = Depends(get_db),
):
    entrada = _get_entrada_or_404(db, restaurante.id, entrada_id)
    return crud.lista_espera.cambiar_estado(db, entrada=entrada, estado=EstadoListaEspera.CANCELADA)
