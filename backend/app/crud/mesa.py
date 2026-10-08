import uuid

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.mesa import Mesa
from app.schemas.mesa import MesaCreate, MesaUpdate
from app.schemas.plano import PlanoMesaUpdate


class CRUDMesa(CRUDBase[Mesa, MesaCreate, MesaUpdate]):
    def get_multi_by_restaurante(
        self,
        db: Session,
        *,
        restaurante_id: uuid.UUID,
        zona_id: uuid.UUID | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Mesa]:
        query = db.query(Mesa).filter(Mesa.restaurante_id == restaurante_id)
        if zona_id is not None:
            query = query.filter(Mesa.zona_id == zona_id)
        return query.order_by(Mesa.nombre).offset(skip).limit(limit).all()

    def update_posiciones(
        self, db: Session, *, restaurante_id: uuid.UUID, updates: list[PlanoMesaUpdate]
    ) -> list[Mesa]:
        """Aplica pos_x/pos_y/ancho/alto/rotacion a varias mesas en una sola transacción.

        Lanza ValueError con los ids que no pertenecen al restaurante, para que el
        endpoint decida cómo reportarlo (evita persistir cambios parciales).
        """
        ids = [u.id for u in updates]
        mesas = (
            db.query(Mesa)
            .filter(Mesa.restaurante_id == restaurante_id, Mesa.id.in_(ids))
            .all()
        )
        mesas_by_id = {m.id: m for m in mesas}

        faltantes = [str(u.id) for u in updates if u.id not in mesas_by_id]
        if faltantes:
            raise ValueError(f"Mesas no encontradas en este restaurante: {', '.join(faltantes)}")

        for update in updates:
            m = mesas_by_id[update.id]
            m.pos_x = update.pos_x
            m.pos_y = update.pos_y
            m.ancho = update.ancho
            m.alto = update.alto
            m.rotacion = update.rotacion
            db.add(m)

        db.commit()
        return self.get_multi_by_restaurante(db, restaurante_id=restaurante_id)


mesa = CRUDMesa(Mesa)
