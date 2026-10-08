import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import get_db, require_admin_del_restaurante, require_restaurante_o_api_key
from app.models.restaurante import Restaurante
from app.schemas.turno import TurnoCreate, TurnoRead, TurnoUpdate

router = APIRouter()


@router.post("/", response_model=TurnoRead, status_code=status.HTTP_201_CREATED)
def crear_turno(
    payload: TurnoCreate,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    return crud.turno.create(db, obj_in=payload, restaurante_id=restaurante.id)


@router.get("/", response_model=list[TurnoRead])
def listar_turnos(
    restaurante: Restaurante = Depends(require_restaurante_o_api_key("disponibilidad:leer")),
    db: Session = Depends(get_db),
):
    return crud.turno.get_multi_by_restaurante(db, restaurante_id=restaurante.id)


@router.get("/{turno_id}", response_model=TurnoRead)
def obtener_turno(
    turno_id: uuid.UUID,
    restaurante: Restaurante = Depends(require_restaurante_o_api_key("disponibilidad:leer")),
    db: Session = Depends(get_db),
):
    obj = crud.turno.get(db, turno_id)
    if not obj or obj.restaurante_id != restaurante.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Turno no encontrado")
    return obj


@router.patch("/{turno_id}", response_model=TurnoRead)
def actualizar_turno(
    turno_id: uuid.UUID,
    payload: TurnoUpdate,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    obj = crud.turno.get(db, turno_id)
    if not obj or obj.restaurante_id != restaurante.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Turno no encontrado")
    return crud.turno.update(db, db_obj=obj, obj_in=payload)


@router.delete("/{turno_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_turno(
    turno_id: uuid.UUID,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    obj = crud.turno.get(db, turno_id)
    if not obj or obj.restaurante_id != restaurante.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Turno no encontrado")
    crud.turno.remove(db, db_obj=obj)
