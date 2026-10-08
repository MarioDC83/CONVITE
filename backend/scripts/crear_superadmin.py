"""Crea (o promociona) un usuario superadmin de AutoCore.

La app no tiene registro público, así que el primer superadmin de un servidor
nuevo se crea con este script. La contraseña se pide por teclado: no queda en
el historial de la shell ni en ningún archivo.

Uso (desde la carpeta del proyecto en el servidor):
  docker compose -f docker-compose.prod.yml exec backend \
      python -m scripts.crear_superadmin tu@email.com
"""

import getpass
import sys

import app.db.base  # noqa: F401  (registra todos los modelos antes de consultar)
from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.usuario import RolUsuario, Usuario


def main() -> int:
    if len(sys.argv) != 2 or "@" not in sys.argv[1]:
        print("Uso: python -m scripts.crear_superadmin tu@email.com")
        return 1
    email = sys.argv[1].strip().lower()

    password = getpass.getpass("Contraseña (mín. 8 caracteres): ")
    if len(password) < 8:
        print("La contraseña debe tener al menos 8 caracteres.")
        return 1
    if getpass.getpass("Repite la contraseña: ") != password:
        print("Las contraseñas no coinciden.")
        return 1

    db = SessionLocal()
    try:
        usuario = db.query(Usuario).filter(Usuario.email == email).first()
        if usuario:
            usuario.rol = RolUsuario.SUPERADMIN
            usuario.restaurante_id = None
            usuario.activo = True
            usuario.hashed_password = hash_password(password)
            accion = "actualizado a superadmin"
        else:
            usuario = Usuario(
                restaurante_id=None,
                email=email,
                nombre="AutoCore Admin",
                rol=RolUsuario.SUPERADMIN,
                hashed_password=hash_password(password),
            )
            db.add(usuario)
            accion = "creado"
        db.commit()
        print(f"Superadmin {email} {accion}.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
