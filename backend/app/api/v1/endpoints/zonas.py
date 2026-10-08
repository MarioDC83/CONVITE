import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import get_db, require_admin_del_restaurante, require_usuario_del_restaurante
from app.models.restaurante import Restaurante
from app.schemas.zona import ZonaCreate, ZonaRead, ZonaUpdate

router = APIRouter()


@router.post("/", response_model=ZonaRead, status_code=status.HTTP_201_CREATED)
def crear_zona(
    payload: ZonaCreate,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    return crud.zona.create(db, obj_in=payload, restaurante_id=restaurante.id)


@router.get("/", response_model=list[ZonaRead])
def listar_zonas(
    restaurante: Restaurante = Depends(require_usuario_del_restaurante),
    db: Session = Depends(get_db),
):
    return crud.zona.get_multi_by_restaurante(db, restaurante_id=restaurante.id)


@router.get("/{zona_id}", response_model=ZonaRead)
def obtener_zona(
    zona_id: uuid.UUID,
    restaurante: Restaurante = Depends(require_usuario_del_restaurante),
    db: Session = Depends(get_db),
):
    obj = crud.zona.get(db, zona_id)
    if not obj or obj.restaurante_id != restaurante.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zona no encontrada")
    return obj


@router.patch("/{zona_id}", response_model=ZonaRead)
def actualizar_zona(
    zona_id: uuid.UUID,
    payload: ZonaUpdate,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    obj = crud.zona.get(db, zona_id)
    if not obj or obj.restaurante_id != restaurante.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zona no encontrada")
    return crud.zona.update(db, db_obj=obj, obj_in=payload)


@router.delete("/{zona_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_zona(
    zona_id: uuid.UUID,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    obj = crud.zona.get(db, zona_id)
    if not obj or obj.restaurante_id != restaurante.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zona no encontrada")
    crud.zona.remove(db, db_obj=obj)
