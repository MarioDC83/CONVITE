import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import settings


def _fernet() -> Fernet:
    # Deriva una clave Fernet válida (32 bytes url-safe base64) a partir de
    # SECRET_KEY, para no tener que gestionar un secreto más en el .env.
    clave = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(clave))


def cifrar(valor: str) -> str:
    return _fernet().encrypt(valor.encode("utf-8")).decode("utf-8")


def descifrar(valor: str) -> str:
    return _fernet().decrypt(valor.encode("utf-8")).decode("utf-8")
