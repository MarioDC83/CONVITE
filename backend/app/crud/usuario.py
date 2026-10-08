import uuid

from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.crud.base import CRUDBase
from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioCreate, UsuarioUpdate


class CRUDUsuario(CRUDBase[Usuario, UsuarioCreate, UsuarioUpdate]):
    def get_by_email(self, db: Session, email: str) -> Usuario | None:
        return db.query(Usuario).filter(Usuario.email == email).first()

    def get_multi_by_restaurante(self, db: Session, *, restaurante_id: uuid.UUID) -> list[Usuario]:
        return (
            db.query(Usuario)
            .filter(Usuario.restaurante_id == restaurante_id)
            .order_by(Usuario.nombre)
            .all()
        )

    def create_con_password(
        self, db: Session, *, obj_in: UsuarioCreate, restaurante_id: uuid.UUID
    ) -> Usuario:
        data = obj_in.model_dump(exclude={"password"})
        db_obj = Usuario(
            **data, restaurante_id=restaurante_id, hashed_password=hash_password(obj_in.password)
        )
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, *, db_obj: Usuario, obj_in: UsuarioUpdate) -> Usuario:
        data = obj_in.model_dump(exclude_unset=True, exclude={"password"})
        for field, value in data.items():
            setattr(db_obj, field, value)
        if obj_in.password:
            db_obj.hashed_password = hash_password(obj_in.password)
        db.add(db_obj)
        db.commit()
        db.refresh(db_obj)
        return db_obj

    def cambiar_password_propia(
        self, db: Session, *, usuario: Usuario, password_nueva: str
    ) -> Usuario:
        usuario.hashed_password = hash_password(password_nueva)
        db.add(usuario)
        db.commit()
        db.refresh(usuario)
        return usuario

    def authenticate(self, db: Session, *, email: str, password: str) -> Usuario | None:
        usuario = self.get_by_email(db, email)
        if not usuario or not usuario.activo:
            return None
        if not verify_password(password, usuario.hashed_password):
            return None
        return usuario


usuario = CRUDUsuario(Usuario)
