import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.security import generar_api_key, verificar_api_key
from app.crud.base import CRUDBase
from app.models.restaurante import API_KEY_SCOPES_DISPONIBLES, Restaurante
from app.schemas.restaurante import RestauranteCreate, RestauranteUpdate


class CRUDRestaurante(CRUDBase[Restaurante, RestauranteCreate, RestauranteUpdate]):
    def get_by_slug(self, db: Session, slug: str) -> Restaurante | None:
        return db.query(Restaurante).filter(Restaurante.slug == slug).first()

    def regenerar_api_key(self, db: Session, *, restaurante: Restaurante) -> str:
        """Genera una API key nueva (invalidando la anterior) y devuelve el
        valor en claro — es la única vez que se puede ver."""
        valor, hashed, prefijo = generar_api_key()
        restaurante.api_key_hash = hashed
        restaurante.api_key_prefix = prefijo
        restaurante.api_key_scopes = list(API_KEY_SCOPES_DISPONIBLES)
        restaurante.api_key_creada_en = datetime.now(timezone.utc)
        db.add(restaurante)
        db.commit()
        db.refresh(restaurante)
        return valor

    def get_by_api_key(self, db: Session, *, restaurante_id: uuid.UUID, valor: str) -> Restaurante | None:
        obj = self.get(db, restaurante_id)
        if not obj or not obj.api_key_hash or not obj.activo:
            return None
        if not verificar_api_key(valor, obj.api_key_hash):
            return None
        return obj


restaurante = CRUDRestaurante(Restaurante)
