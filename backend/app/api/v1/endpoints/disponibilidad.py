import uuid
from datetime import date, time

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import get_db, require_restaurante_o_api_key
from app.models.restaurante import Restaurante
from app.schemas.mesa import MesaRead

router = APIRouter()


@router.get("/", response_model=list[MesaRead])
def consultar_disponibilidad(
    fecha: date = Query(...),
    turno_id: uuid.UUID = Query(...),
    comensales: int = Query(..., gt=0),
    hora: time | None = Query(
        None, description="Hora de llegada. Si se omite, se usa el inicio del turno."
    ),
    duracion_minutos: int | None = Query(
        None, description="Duración de la ocupación. Si se omite, se usa la del turno."
    ),
    restaurante: Restaurante = Depends(require_restaurante_o_api_key("disponibilidad:leer")),
    db: Session = Depends(get_db),
):
    """Mesas libres para una fecha/turno/nº de comensales dados.

    Comprueba solapes de horario contra las reservas activas (pendiente,
    confirmada, sentada), no solo si la mesa tiene alguna reserva ese día.
    Pensado para ser consumido por N8N (Recepcionista IA) además de por el
    propio frontend.
    """
    turno = crud.turno.get(db, turno_id)
    if not turno or turno.restaurante_id != restaurante.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Turno no válido para este restaurante")

    cierre = crud.dia_especial.get_by_fecha(db, restaurante_id=restaurante.id, fecha=fecha)
    if cierre and cierre.cerrado:
        detalle = f"El restaurante está cerrado ese día{f': {cierre.motivo}' if cierre.motivo else ''}"
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=detalle)

    return crud.reserva.mesas_disponibles(
        db,
        restaurante_id=restaurante.id,
        turno=turno,
        fecha=fecha,
        comensales=comensales,
        hora=hora,
        duracion_minutos=duracion_minutos,
    )
