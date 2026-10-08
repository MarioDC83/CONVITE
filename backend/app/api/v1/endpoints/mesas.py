import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import get_db, require_admin_del_restaurante, require_usuario_del_restaurante
from app.models.restaurante import Restaurante
from app.schemas.mesa import MesaCreate, MesaRead, MesaUpdate

router = APIRouter()


def _validar_zona_del_restaurante(db: Session, zona_id: uuid.UUID, restaurante_id: uuid.UUID) -> None:
    zona = crud.zona.get(db, zona_id)
    if not zona or zona.restaurante_id != restaurante_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La zona indicada no pertenece a este restaurante",
        )


@router.post("/", response_model=MesaRead, status_code=status.HTTP_201_CREATED)
def crear_mesa(
    payload: MesaCreate,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    _validar_zona_del_restaurante(db, payload.zona_id, restaurante.id)
    return crud.mesa.create(db, obj_in=payload, restaurante_id=restaurante.id)


@router.get("/", response_model=list[MesaRead])
def listar_mesas(
    zona_id: uuid.UUID | None = None,
    restaurante: Restaurante = Depends(require_usuario_del_restaurante),
    db: Session = Depends(get_db),
):
    return crud.mesa.get_multi_by_restaurante(db, restaurante_id=restaurante.id, zona_id=zona_id)


@router.get("/{mesa_id}", response_model=MesaRead)
def obtener_mesa(
    mesa_id: uuid.UUID,
    restaurante: Restaurante = Depends(require_usuario_del_restaurante),
    db: Session = Depends(get_db),
):
    obj = crud.mesa.get(db, mesa_id)
    if not obj or obj.restaurante_id != restaurante.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mesa no encontrada")
    return obj


@router.patch("/{mesa_id}", response_model=MesaRead)
def actualizar_mesa(
    mesa_id: uuid.UUID,
    payload: MesaUpdate,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    obj = crud.mesa.get(db, mesa_id)
    if not obj or obj.restaurante_id != restaurante.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mesa no encontrada")
    if payload.zona_id is not None:
        _validar_zona_del_restaurante(db, payload.zona_id, restaurante.id)
    return crud.mesa.update(db, db_obj=obj, obj_in=payload)


@router.delete("/{mesa_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_mesa(
    mesa_id: uuid.UUID,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    obj = crud.mesa.get(db, mesa_id)
    if not obj or obj.restaurante_id != restaurante.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Mesa no encontrada")
    crud.mesa.remove(db, db_obj=obj)
