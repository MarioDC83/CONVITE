from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import crud
from app.api.deps import get_current_usuario, get_db
from app.core.security import crear_access_token, verify_password
from app.models.usuario import Usuario
from app.schemas.usuario import CambiarPasswordRequest, LoginRequest, TokenResponse, UsuarioRead

router = APIRouter()


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    usuario_autenticado = crud.usuario.authenticate(db, email=payload.email, password=payload.password)
    if not usuario_autenticado:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Email o contraseña incorrectos"
        )
    token = crear_access_token(usuario_autenticado.id)
    return TokenResponse(access_token=token, usuario=usuario_autenticado)


@router.get("/me", response_model=UsuarioRead)
def leer_usuario_actual(usuario_actual: Usuario = Depends(get_current_usuario)):
    return usuario_actual


@router.patch("/me/password", response_model=UsuarioRead)
def cambiar_mi_password(
    payload: CambiarPasswordRequest,
    usuario_actual: Usuario = Depends(get_current_usuario),
    db: Session = Depends(get_db),
):
    """Cambiar la contraseña de la cuenta propia (cualquier rol, incluido
    superadmin, que no pertenece a ningún restaurante y por eso no puede
    pasar por /usuarios). Exige la contraseña actual para evitar que una
    sesión abierta en un ordenador compartido baste para tomar la cuenta."""
    if not verify_password(payload.password_actual, usuario_actual.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="La contraseña actual no es correcta"
        )
    return crud.usuario.cambiar_password_propia(
        db, usuario=usuario_actual, password_nueva=payload.password_nueva
    )
