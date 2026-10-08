import uuid

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.cliente import Cliente
from app.models.reserva import EstadoReserva, Reserva
from app.schemas.cliente import ClienteUpdate

# A partir de cuántos no-shows se marca a un cliente como "problemático" en
# el listado. No bloquea nada por sí solo — es solo una señal visual para
# que el restaurante decida (pedir confirmación extra, no fiarse, etc.).
UMBRAL_NO_SHOWS_PROBLEMATICO = 2


class CRUDCliente(CRUDBase[Cliente, ClienteUpdate, ClienteUpdate]):
    def get_or_create(
        self,
        db: Session,
        *,
        restaurante_id: uuid.UUID,
        nombre: str,
        telefono: str | None,
        email: str | None,
    ) -> Cliente | None:
        """Busca por teléfono (o por email si no hay teléfono) dentro del
        restaurante; si no existe, lo crea. Sin ninguno de los dos no hay
        forma fiable de identificar al cliente entre visitas, así que la
        reserva se queda sin cliente_id (como pasaba antes de esto)."""
        if not telefono and not email:
            return None

        query = db.query(Cliente).filter(Cliente.restaurante_id == restaurante_id)
        existente = (
            query.filter(Cliente.telefono == telefono).first()
            if telefono
            else query.filter(Cliente.email == email).first()
        )
        if existente:
            return existente

        nuevo = Cliente(restaurante_id=restaurante_id, nombre=nombre, telefono=telefono, email=email)
        db.add(nuevo)
        db.commit()
        db.refresh(nuevo)
        return nuevo

    def get_multi_by_restaurante(
        self,
        db: Session,
        *,
        restaurante_id: uuid.UUID,
        busqueda: str | None = None,
        solo_vip: bool = False,
    ) -> list[Cliente]:
        query = db.query(Cliente).filter(Cliente.restaurante_id == restaurante_id)
        if solo_vip:
            query = query.filter(Cliente.vip.is_(True))
        if busqueda:
            like = f"%{busqueda}%"
            query = query.filter(
                or_(
                    Cliente.nombre.ilike(like),
                    Cliente.telefono.ilike(like),
                    Cliente.email.ilike(like),
                )
            )
        return query.order_by(Cliente.nombre).all()

    def estadisticas(self, db: Session, *, cliente_id: uuid.UUID) -> dict:
        total = (
            db.query(func.count(Reserva.id))
            .filter(Reserva.cliente_id == cliente_id, Reserva.estado != EstadoReserva.CANCELADA)
            .scalar()
            or 0
        )
        no_shows = (
            db.query(func.count(Reserva.id))
            .filter(Reserva.cliente_id == cliente_id, Reserva.estado == EstadoReserva.NO_SHOW)
            .scalar()
            or 0
        )
        ultima_visita = db.query(func.max(Reserva.fecha)).filter(Reserva.cliente_id == cliente_id).scalar()
        return {
            "total_reservas": total,
            "no_shows": no_shows,
            "ultima_visita": ultima_visita,
            "es_problematico": no_shows >= UMBRAL_NO_SHOWS_PROBLEMATICO,
        }

    def get_reservas(self, db: Session, *, cliente_id: uuid.UUID) -> list[Reserva]:
        return (
            db.query(Reserva)
            .filter(Reserva.cliente_id == cliente_id)
            .order_by(Reserva.fecha.desc(), Reserva.hora.desc())
            .all()
        )


cliente = CRUDCliente(Cliente)
