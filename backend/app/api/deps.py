import uuid
from typing import Callable

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import crud
from app.core.ratelimit import permitir
from app.core.security import decodificar_access_token
from app.db.session import get_db
from app.models.restaurante import Restaurante
from app.models.usuario import RolUsuario, Usuario

__all__ = [
    "get_db",
    "get_restaurante_or_404",
    "get_current_usuario",
    "require_usuario_del_restaurante",
    "require_admin_del_restaurante",
    "require_superadmin",
    "require_restaurante_o_api_key",
]

_bearer_scheme = HTTPBearer(auto_error=False)

# Límite para las llamadas autenticadas por API key (N8N, widget web, etc.):
# 60 peticiones por minuto por API key. Es deliberadamente generoso para una
# recepcionista IA o un widget de reservas, pero corta abuso/errores en bucle.
API_KEY_RATE_LIMIT = 60
API_KEY_RATE_WINDOW_SEGUNDOS = 60.0


def get_restaurante_or_404(
    restaurante_id: uuid.UUID, db: Session = Depends(get_db)
) -> Restaurante:
    obj = crud.restaurante.get(db, restaurante_id)
    if not obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Restaurante no encontrado"
        )
    return obj


def get_current_usuario(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No autenticado",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise error
    usuario_id = decodificar_access_token(credentials.credentials)
    if not usuario_id:
        raise error
    usuario = crud.usuario.get(db, usuario_id)
    if not usuario or not usuario.activo:
        raise error
    return usuario


def _verificar_pertenencia(usuario: Usuario, restaurante: Restaurante) -> None:
    if usuario.rol == RolUsuario.SUPERADMIN:
        return
    if usuario.restaurante_id != restaurante.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes acceso a este restaurante",
        )


def require_usuario_del_restaurante(
    usuario_actual: Usuario = Depends(get_current_usuario),
    restaurante: Restaurante = Depends(get_restaurante_or_404),
) -> Restaurante:
    """Deja pasar a cualquier usuario autenticado y activo del restaurante del path
    (admin o staff). Devuelve el restaurante, no el usuario, para que los endpoints
    existentes sigan usando `restaurante.id` tal cual sin cambiar su cuerpo."""
    _verificar_pertenencia(usuario_actual, restaurante)
    return restaurante


def require_superadmin(usuario_actual: Usuario = Depends(get_current_usuario)) -> Usuario:
    """Solo para AutoCore: dar de alta restaurantes nuevos y ver el listado
    completo. Un admin de restaurante (el cliente) no debe poder crear más
    restaurantes ni ver los de los demás."""
    if usuario_actual.rol != RolUsuario.SUPERADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de superadministrador",
        )
    return usuario_actual


def require_admin_del_restaurante(
    usuario_actual: Usuario = Depends(get_current_usuario),
    restaurante: Restaurante = Depends(get_restaurante_or_404),
) -> Restaurante:
    """Solo administradores del restaurante del path (o superadmin de AutoCore)."""
    _verificar_pertenencia(usuario_actual, restaurante)
    if usuario_actual.rol not in (RolUsuario.ADMIN, RolUsuario.SUPERADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Se requieren permisos de administrador",
        )
    return restaurante


def require_restaurante_o_api_key(scope: str) -> Callable[..., Restaurante]:
    """Fábrica de dependencia para endpoints que consumen tanto el personal
    del restaurante (JWT, sin límite de peticiones) como integraciones
    externas — N8N, el widget web (API key en la cabecera `X-API-Key`, con
    rate limit y comprobación de scope).

    Se usa así: `Depends(require_restaurante_o_api_key("reservas:crear"))`.
    """

    def dependencia(
        restaurante: Restaurante = Depends(get_restaurante_or_404),
        x_api_key: str | None = Header(None, alias="X-API-Key"),
        credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
        db: Session = Depends(get_db),
    ) -> Restaurante:
        if x_api_key:
            obj = crud.restaurante.get_by_api_key(db, restaurante_id=restaurante.id, valor=x_api_key)
            if not obj:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED, detail="API key inválida"
                )
            if scope not in obj.api_key_scopes:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"La API key no tiene el permiso '{scope}'",
                )
            if not permitir(
                f"apikey:{obj.id}",
                max_peticiones=API_KEY_RATE_LIMIT,
                ventana_segundos=API_KEY_RATE_WINDOW_SEGUNDOS,
            ):
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Límite de peticiones excedido, inténtalo de nuevo en un minuto",
                )
            return obj

        if not credentials:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")
        usuario_id = decodificar_access_token(credentials.credentials)
        usuario = crud.usuario.get(db, usuario_id) if usuario_id else None
        if not usuario or not usuario.activo:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No autenticado")
        _verificar_pertenencia(usuario, restaurante)
        return restaurante

    return dependencia
