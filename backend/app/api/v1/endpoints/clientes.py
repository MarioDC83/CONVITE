import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import get_db, require_admin_del_restaurante, require_usuario_del_restaurante
from app.models.restaurante import Restaurante
from app.schemas.cliente import ClienteConEstadisticas, ClienteRead, ClienteUpdate
from app.schemas.reserva import ReservaRead

router = APIRouter()


def _con_estadisticas(db: Session, obj) -> ClienteConEstadisticas:
    base = ClienteRead.model_validate(obj).model_dump()
    stats = crud.cliente.estadisticas(db, cliente_id=obj.id)
    return ClienteConEstadisticas(**base, **stats)


@router.get("/", response_model=list[ClienteConEstadisticas])
def listar_clientes(
    busqueda: str | None = Query(None),
    solo_vip: bool = Query(False),
    restaurante: Restaurante = Depends(require_usuario_del_restaurante),
    db: Session = Depends(get_db),
):
    clientes = crud.cliente.get_multi_by_restaurante(
        db, restaurante_id=restaurante.id, busqueda=busqueda, solo_vip=solo_vip
    )
    return [_con_estadisticas(db, c) for c in clientes]


@router.get("/{cliente_id}", response_model=ClienteConEstadisticas)
def obtener_cliente(
    cliente_id: uuid.UUID,
    restaurante: Restaurante = Depends(require_usuario_del_restaurante),
    db: Session = Depends(get_db),
):
    obj = crud.cliente.get(db, cliente_id)
    if not obj or obj.restaurante_id != restaurante.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    return _con_estadisticas(db, obj)


@router.get("/{cliente_id}/reservas", response_model=list[ReservaRead])
def historial_cliente(
    cliente_id: uuid.UUID,
    restaurante: Restaurante = Depends(require_usuario_del_restaurante),
    db: Session = Depends(get_db),
):
    obj = crud.cliente.get(db, cliente_id)
    if not obj or obj.restaurante_id != restaurante.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    return crud.cliente.get_reservas(db, cliente_id=cliente_id)


@router.patch("/{cliente_id}", response_model=ClienteConEstadisticas)
def actualizar_cliente(
    cliente_id: uuid.UUID,
    payload: ClienteUpdate,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    obj = crud.cliente.get(db, cliente_id)
    if not obj or obj.restaurante_id != restaurante.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")
    actualizado = crud.cliente.update(db, db_obj=obj, obj_in=payload)
    return _con_estadisticas(db, actualizado)
