import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import get_db, require_admin_del_restaurante
from app.models.restaurante import Restaurante
from app.schemas.usuario import UsuarioCreate, UsuarioRead, UsuarioUpdate

router = APIRouter()


@router.get("/", response_model=list[UsuarioRead])
def listar_usuarios(
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    return crud.usuario.get_multi_by_restaurante(db, restaurante_id=restaurante.id)


@router.post("/", response_model=UsuarioRead, status_code=status.HTTP_201_CREATED)
def crear_usuario(
    payload: UsuarioCreate,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    if crud.usuario.get_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Ya existe un usuario con ese email"
        )
    return crud.usuario.create_con_password(db, obj_in=payload, restaurante_id=restaurante.id)


@router.patch("/{usuario_id}", response_model=UsuarioRead)
def actualizar_usuario(
    usuario_id: uuid.UUID,
    payload: UsuarioUpdate,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    obj = crud.usuario.get(db, usuario_id)
    if not obj or obj.restaurante_id != restaurante.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return crud.usuario.update(db, db_obj=obj, obj_in=payload)
