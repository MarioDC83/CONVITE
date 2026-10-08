import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.lista_espera import EstadoListaEspera, ListaEspera
from app.schemas.lista_espera import ListaEsperaCreate

MINUTOS_OFERTA = 15


class CRUDListaEspera(CRUDBase[ListaEspera, ListaEsperaCreate, ListaEsperaCreate]):
    def get_multi_by_restaurante(
        self, db: Session, *, restaurante_id: uuid.UUID, fecha: date | None = None
    ) -> list[ListaEspera]:
        query = db.query(ListaEspera).filter(ListaEspera.restaurante_id == restaurante_id)
        if fecha is not None:
            query = query.filter(ListaEspera.fecha == fecha)
        return query.order_by(ListaEspera.created_at).all()

    def siguiente_candidata(
        self,
        db: Session,
        *,
        restaurante_id: uuid.UUID,
        turno_id: uuid.UUID,
        fecha: date,
        comensales_max: int,
    ) -> ListaEspera | None:
        """La entrada más antigua en espera (aún sin oferta) para ese
        turno/fecha cuyo grupo cabe en la capacidad que se acaba de liberar."""
        return (
            db.query(ListaEspera)
            .filter(
                ListaEspera.restaurante_id == restaurante_id,
                ListaEspera.turno_id == turno_id,
                ListaEspera.fecha == fecha,
                ListaEspera.estado == EstadoListaEspera.ESPERANDO,
                ListaEspera.comensales <= comensales_max,
            )
            .order_by(ListaEspera.created_at)
            .first()
        )

    def marcar_ofrecida(self, db: Session, *, entrada: ListaEspera, mesa_id: uuid.UUID) -> ListaEspera:
        entrada.estado = EstadoListaEspera.OFRECIDA
        entrada.mesa_ofrecida_id = mesa_id
        entrada.oferta_expira_en = datetime.now(timezone.utc) + timedelta(minutes=MINUTOS_OFERTA)
        db.add(entrada)
        db.commit()
        db.refresh(entrada)
        return entrada

    def marcar_confirmada(self, db: Session, *, entrada: ListaEspera, reserva_id: uuid.UUID) -> ListaEspera:
        entrada.estado = EstadoListaEspera.CONFIRMADA
        entrada.reserva_id = reserva_id
        db.add(entrada)
        db.commit()
        db.refresh(entrada)
        return entrada

    def cambiar_estado(self, db: Session, *, entrada: ListaEspera, estado: EstadoListaEspera) -> ListaEspera:
        entrada.estado = estado
        db.add(entrada)
        db.commit()
        db.refresh(entrada)
        return entrada

    def get_ofertas_expiradas(self, db: Session) -> list[ListaEspera]:
        ahora = datetime.now(timezone.utc)
        return (
            db.query(ListaEspera)
            .filter(
                ListaEspera.estado == EstadoListaEspera.OFRECIDA,
                ListaEspera.oferta_expira_en < ahora,
            )
            .all()
        )


lista_espera = CRUDListaEspera(ListaEspera)
