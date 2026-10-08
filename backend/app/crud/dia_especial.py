import uuid
from datetime import date

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.dia_especial import DiaEspecial
from app.schemas.dia_especial import DiaEspecialCreate


class CRUDDiaEspecial(CRUDBase[DiaEspecial, DiaEspecialCreate, DiaEspecialCreate]):
    def get_by_fecha(
        self, db: Session, *, restaurante_id: uuid.UUID, fecha: date
    ) -> DiaEspecial | None:
        return (
            db.query(DiaEspecial)
            .filter(DiaEspecial.restaurante_id == restaurante_id, DiaEspecial.fecha == fecha)
            .first()
        )

    def get_multi_by_restaurante(
        self, db: Session, *, restaurante_id: uuid.UUID
    ) -> list[DiaEspecial]:
        return (
            db.query(DiaEspecial)
            .filter(DiaEspecial.restaurante_id == restaurante_id)
            .order_by(DiaEspecial.fecha)
            .all()
        )


dia_especial = CRUDDiaEspecial(DiaEspecial)
