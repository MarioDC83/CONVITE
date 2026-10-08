import uuid

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.zona import Zona
from app.schemas.zona import ZonaCreate, ZonaUpdate


class CRUDZona(CRUDBase[Zona, ZonaCreate, ZonaUpdate]):
    def get_multi_by_restaurante(
        self, db: Session, *, restaurante_id: uuid.UUID, skip: int = 0, limit: int = 100
    ) -> list[Zona]:
        return (
            db.query(Zona)
            .filter(Zona.restaurante_id == restaurante_id)
            .order_by(Zona.orden, Zona.nombre)
            .offset(skip)
            .limit(limit)
            .all()
        )


zona = CRUDZona(Zona)
