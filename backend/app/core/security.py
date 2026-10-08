import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.core.config import settings


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def crear_access_token(usuario_id: uuid.UUID) -> str:
    expira = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(usuario_id), "exp": expira}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decodificar_access_token(token: str) -> uuid.UUID | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    sub = payload.get("sub")
    if not sub:
        return None
    try:
        return uuid.UUID(sub)
    except ValueError:
        return None


def crear_state_oauth(restaurante_id: uuid.UUID) -> str:
    """Firma el restaurante_id que inicia el flujo OAuth de Google en el
    parámetro `state`. Google nos lo devuelve tal cual en el callback, así
    sabemos a qué restaurante pertenece esa autorización sin depender de
    sesión/cookies (el callback es una URL fija, sin JWT ni restaurante_id
    en el path)."""
    expira = datetime.now(timezone.utc) + timedelta(minutes=10)
    payload = {"restaurante_id": str(restaurante_id), "typ": "google_oauth_state", "exp": expira}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def verificar_state_oauth(token: str) -> uuid.UUID | None:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
    except jwt.PyJWTError:
        return None
    if payload.get("typ") != "google_oauth_state":
        return None
    try:
        return uuid.UUID(payload["restaurante_id"])
    except (KeyError, ValueError):
        return None


def generar_api_key() -> tuple[str, str, str]:
    """Devuelve (valor_en_claro, hash, prefijo). El valor en claro solo se
    muestra una vez; a partir de ahí solo se guarda y compara el hash."""
    valor = f"cvt_live_{secrets.token_urlsafe(32)}"
    return valor, hash_api_key(valor), valor[:16]


def hash_api_key(valor: str) -> str:
    return hashlib.sha256(valor.encode("utf-8")).hexdigest()


def verificar_api_key(valor: str, hashed: str) -> bool:
    return secrets.compare_digest(hash_api_key(valor), hashed)
