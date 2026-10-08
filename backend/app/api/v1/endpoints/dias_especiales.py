import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import get_db, require_admin_del_restaurante
from app.models.restaurante import Restaurante
from app.schemas.dia_especial import DiaEspecialCreate, DiaEspecialRead

router = APIRouter()


@router.get("/", response_model=list[DiaEspecialRead])
def listar_dias_especiales(
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    return crud.dia_especial.get_multi_by_restaurante(db, restaurante_id=restaurante.id)


@router.post("/", response_model=DiaEspecialRead, status_code=status.HTTP_201_CREATED)
def crear_dia_especial(
    payload: DiaEspecialCreate,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    existente = crud.dia_especial.get_by_fecha(db, restaurante_id=restaurante.id, fecha=payload.fecha)
    if existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Ya hay una entrada para esa fecha"
        )
    return crud.dia_especial.create(db, obj_in=payload, restaurante_id=restaurante.id)


@router.delete("/{dia_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_dia_especial(
    dia_id: uuid.UUID,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    obj = crud.dia_especial.get(db, dia_id)
    if not obj or obj.restaurante_id != restaurante.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No encontrado")
    crud.dia_especial.remove(db, db_obj=obj)
