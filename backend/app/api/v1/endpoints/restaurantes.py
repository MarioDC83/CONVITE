from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import (
    get_current_usuario,
    get_db,
    require_admin_del_restaurante,
    require_superadmin,
    require_usuario_del_restaurante,
)
from app.core.security import hash_password
from app.models.restaurante import Restaurante
from app.models.usuario import RolUsuario, Usuario
from app.schemas.restaurante import RestauranteCreate, RestauranteRead, RestauranteUpdate

router = APIRouter()


@router.post("/", response_model=RestauranteRead, status_code=status.HTTP_201_CREATED)
def crear_restaurante(
    payload: RestauranteCreate,
    db: Session = Depends(get_db),
    _: Usuario = Depends(require_superadmin),
):
    """Da de alta un restaurante junto con su primer usuario administrador.

    Solo AutoCore (superadmin) da de alta restaurantes nuevos — el admin de
    cada restaurante gestiona su propio personal desde /usuarios, pero no
    puede crear más restaurantes.
    """
    if crud.restaurante.get_by_slug(db, payload.slug):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un restaurante con ese slug",
        )
    if crud.usuario.get_by_email(db, payload.admin_email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un usuario con ese email",
        )

    datos_restaurante = payload.model_dump(
        exclude={"admin_nombre", "admin_email", "admin_password"}
    )
    nuevo = Restaurante(**datos_restaurante)
    db.add(nuevo)
    db.flush()

    admin = Usuario(
        restaurante_id=nuevo.id,
        email=payload.admin_email,
        nombre=payload.admin_nombre,
        rol=RolUsuario.ADMIN,
        hashed_password=hash_password(payload.admin_password),
    )
    db.add(admin)
    db.commit()
    db.refresh(nuevo)

    crud.turno.crear_turnos_por_defecto(db, restaurante_id=nuevo.id)
    return nuevo


@router.get("/", response_model=list[RestauranteRead])
def listar_restaurantes(
    skip: int = 0,
    limit: int = 100,
    usuario: Usuario = Depends(get_current_usuario),
    db: Session = Depends(get_db),
):
    """Superadmin ve todos los restaurantes; cualquier otro rol solo ve el
    suyo (nunca los de otros clientes)."""
    if usuario.rol == RolUsuario.SUPERADMIN:
        return crud.restaurante.get_multi(db, skip=skip, limit=limit)
    if not usuario.restaurante_id:
        return []
    obj = crud.restaurante.get(db, usuario.restaurante_id)
    return [obj] if obj else []


@router.get("/{restaurante_id}", response_model=RestauranteRead)
def obtener_restaurante(restaurante: Restaurante = Depends(require_usuario_del_restaurante)):
    return restaurante


@router.patch("/{restaurante_id}", response_model=RestauranteRead)
def actualizar_restaurante(
    payload: RestauranteUpdate,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    if (
        payload.slug
        and payload.slug != restaurante.slug
        and crud.restaurante.get_by_slug(db, payload.slug)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ya existe un restaurante con ese slug",
        )
    return crud.restaurante.update(db, db_obj=restaurante, obj_in=payload)


@router.delete("/{restaurante_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_restaurante(
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    crud.restaurante.remove(db, db_obj=restaurante)
