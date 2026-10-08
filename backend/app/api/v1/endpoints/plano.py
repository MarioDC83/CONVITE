from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import get_db, require_admin_del_restaurante, require_usuario_del_restaurante
from app.models.restaurante import Restaurante
from app.schemas.plano import PlanoRead, PlanoUpdate

router = APIRouter()


@router.get("/", response_model=PlanoRead)
def obtener_plano(
    restaurante: Restaurante = Depends(require_usuario_del_restaurante),
    db: Session = Depends(get_db),
):
    zonas = crud.zona.get_multi_by_restaurante(db, restaurante_id=restaurante.id)
    mesas = crud.mesa.get_multi_by_restaurante(db, restaurante_id=restaurante.id)
    return PlanoRead(restaurante=restaurante, zonas=zonas, mesas=mesas)


@router.put("/", response_model=PlanoRead)
def guardar_plano(
    payload: PlanoUpdate,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    try:
        crud.mesa.update_posiciones(db, restaurante_id=restaurante.id, updates=payload.mesas)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    zonas = crud.zona.get_multi_by_restaurante(db, restaurante_id=restaurante.id)
    mesas = crud.mesa.get_multi_by_restaurante(db, restaurante_id=restaurante.id)
    return PlanoRead(restaurante=restaurante, zonas=zonas, mesas=mesas)
