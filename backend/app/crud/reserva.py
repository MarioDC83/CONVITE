import uuid
from datetime import date, datetime, time, timedelta, timezone

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.crud.cliente import cliente as cliente_crud
from app.models.mesa import Mesa
from app.models.reserva import ESTADOS_ACTIVOS, EstadoReserva, OrigenReserva, Reserva, reserva_mesas
from app.models.restaurante import Restaurante
from app.models.turno import Turno
from app.schemas.reserva import ReservaCreate, ReservaEstadoUpdate


class ConflictoDisponibilidad(Exception):
    """Las mesas solicitadas ya están ocupadas en ese horario."""


class MesaInvalida(Exception):
    """Una mesa solicitada no existe en este restaurante o no tiene capacidad suficiente."""


def _rango(fecha: date, hora: time, duracion_minutos: int) -> tuple[datetime, datetime]:
    inicio = datetime.combine(fecha, hora)
    return inicio, inicio + timedelta(minutes=duracion_minutos)


def _se_solapan(a_inicio: datetime, a_fin: datetime, b_inicio: datetime, b_fin: datetime) -> bool:
    return a_inicio < b_fin and b_inicio < a_fin


class CRUDReserva(CRUDBase[Reserva, ReservaCreate, ReservaEstadoUpdate]):
    def get_multi_by_restaurante(
        self,
        db: Session,
        *,
        restaurante_id: uuid.UUID,
        fecha: date | None = None,
        turno_id: uuid.UUID | None = None,
    ) -> list[Reserva]:
        query = db.query(Reserva).filter(Reserva.restaurante_id == restaurante_id)
        if fecha is not None:
            query = query.filter(Reserva.fecha == fecha)
        if turno_id is not None:
            query = query.filter(Reserva.turno_id == turno_id)
        return query.order_by(Reserva.hora).all()

    def get_multi_by_rango(
        self, db: Session, *, restaurante_id: uuid.UUID, fecha_desde: date, fecha_hasta: date
    ) -> list[Reserva]:
        return (
            db.query(Reserva)
            .filter(
                Reserva.restaurante_id == restaurante_id,
                Reserva.fecha >= fecha_desde,
                Reserva.fecha <= fecha_hasta,
            )
            .order_by(Reserva.fecha, Reserva.hora)
            .all()
        )

    def _reservas_activas_para_mesas(
        self,
        db: Session,
        *,
        restaurante_id: uuid.UUID,
        fecha: date,
        mesa_ids: list[uuid.UUID],
        excluir_reserva_id: uuid.UUID | None = None,
    ) -> list[Reserva]:
        query = (
            db.query(Reserva)
            .join(reserva_mesas, reserva_mesas.c.reserva_id == Reserva.id)
            .filter(
                Reserva.restaurante_id == restaurante_id,
                Reserva.fecha == fecha,
                Reserva.estado.in_(ESTADOS_ACTIVOS),
                reserva_mesas.c.mesa_id.in_(mesa_ids),
            )
            .distinct()
        )
        if excluir_reserva_id is not None:
            query = query.filter(Reserva.id != excluir_reserva_id)
        return query.all()

    def mesas_disponibles(
        self,
        db: Session,
        *,
        restaurante_id: uuid.UUID,
        turno: Turno | None,
        fecha: date,
        comensales: int,
        hora: time | None = None,
        duracion_minutos: int | None = None,
    ) -> list[Mesa]:
        """`turno` puede ser None si `hora` y `duracion_minutos` ya vienen
        dados explícitamente (p.ej. al importar un evento de Google Calendar
        que no cae en ningún turno configurado)."""
        hora_efectiva = hora if hora is not None else turno.hora_inicio  # type: ignore[union-attr]
        duracion_efectiva = duracion_minutos or turno.duracion_reserva_minutos  # type: ignore[union-attr]
        nuevo_inicio, nuevo_fin = _rango(fecha, hora_efectiva, duracion_efectiva)

        candidatas = (
            db.query(Mesa)
            .filter(
                Mesa.restaurante_id == restaurante_id,
                Mesa.activa.is_(True),
                Mesa.capacidad_min <= comensales,
                Mesa.capacidad_max >= comensales,
            )
            .all()
        )
        if not candidatas:
            return []

        ocupadas = self._reservas_activas_para_mesas(
            db,
            restaurante_id=restaurante_id,
            fecha=fecha,
            mesa_ids=[m.id for m in candidatas],
        )

        mesa_ids_ocupadas: set[uuid.UUID] = set()
        for reserva in ocupadas:
            r_inicio, r_fin = _rango(reserva.fecha, reserva.hora, reserva.duracion_minutos)
            if _se_solapan(nuevo_inicio, nuevo_fin, r_inicio, r_fin):
                mesa_ids_ocupadas.update(m.id for m in reserva.mesas)

        return [m for m in candidatas if m.id not in mesa_ids_ocupadas]

    def crear_con_bloqueo(
        self, db: Session, *, restaurante_id: uuid.UUID, turno: Turno, payload: ReservaCreate
    ) -> Reserva:
        """Crea una reserva bloqueando las mesas implicadas hasta el commit.

        `SELECT ... FOR UPDATE` sobre las mesas (en orden estable por id, para
        evitar deadlocks) hace que una segunda transacción concurrente que
        pida alguna de las mismas mesas quede esperando aquí mismo hasta que
        esta termine; al reanudarse, su propia comprobación de solape verá
        ya la reserva recién creada y podrá rechazar el overbooking.
        """
        mesa_ids_ordenados = sorted(set(payload.mesa_ids))

        mesas = (
            db.query(Mesa)
            .filter(Mesa.restaurante_id == restaurante_id, Mesa.id.in_(mesa_ids_ordenados))
            .order_by(Mesa.id)
            .with_for_update()
            .all()
        )
        if len(mesas) != len(mesa_ids_ordenados):
            db.rollback()
            raise MesaInvalida("Alguna de las mesas indicadas no existe en este restaurante")

        capacidad_total = sum(m.capacidad_max for m in mesas)
        if capacidad_total < payload.num_personas:
            db.rollback()
            raise MesaInvalida(
                f"Las mesas seleccionadas suman capacidad para {capacidad_total} comensales "
                f"y se solicitaron {payload.num_personas}"
            )

        duracion = turno.duracion_reserva_minutos
        nuevo_inicio, nuevo_fin = _rango(payload.fecha, payload.hora, duracion)

        conflictivas = self._reservas_activas_para_mesas(
            db,
            restaurante_id=restaurante_id,
            fecha=payload.fecha,
            mesa_ids=mesa_ids_ordenados,
        )
        for existente in conflictivas:
            r_inicio, r_fin = _rango(existente.fecha, existente.hora, existente.duracion_minutos)
            if _se_solapan(nuevo_inicio, nuevo_fin, r_inicio, r_fin):
                nombres = {m.nombre for m in existente.mesas if m.id in set(mesa_ids_ordenados)}
                db.rollback()
                raise ConflictoDisponibilidad(
                    f"La mesa {', '.join(nombres) or 'seleccionada'} ya tiene una reserva que se "
                    f"solapa en ese horario ({existente.hora.strftime('%H:%M')})"
                )

        cliente = cliente_crud.get_or_create(
            db,
            restaurante_id=restaurante_id,
            nombre=payload.cliente_nombre,
            telefono=payload.cliente_telefono,
            email=payload.cliente_email,
        )

        nueva = Reserva(
            restaurante_id=restaurante_id,
            turno_id=payload.turno_id,
            fecha=payload.fecha,
            hora=payload.hora,
            duracion_minutos=duracion,
            num_personas=payload.num_personas,
            cliente_nombre=payload.cliente_nombre,
            cliente_telefono=payload.cliente_telefono,
            cliente_email=payload.cliente_email,
            cliente_id=cliente.id if cliente else None,
            notas=payload.notas,
            origen=payload.origen,
            mesas=mesas,
        )
        db.add(nueva)
        db.commit()
        db.refresh(nueva)
        return nueva

    def crear_desde_sync_externo(
        self,
        db: Session,
        *,
        restaurante_id: uuid.UUID,
        turno_id: uuid.UUID | None,
        fecha: date,
        hora: time,
        duracion_minutos: int,
        num_personas: int,
        cliente_nombre: str,
        cliente_email: str | None,
        mesa_ids_candidatas: list[uuid.UUID],
        google_event_id: str,
        notas: str | None,
    ) -> Reserva:
        """Crea una reserva a partir de un evento detectado en Google Calendar
        que no fue creado por esta app (p.ej. "Reserve with Google" o alguien
        añadiendo el evento a mano). A diferencia de `crear_con_bloqueo`, no
        falla si no hay mesa disponible: la reserva se crea igualmente sin
        mesas asignadas (pendiente de asignación manual) porque no hay nadie
        al otro lado a quien devolver un error — es un webhook, no una
        petición de un cliente."""
        mesas: list[Mesa] = []
        if mesa_ids_candidatas:
            candidatas = (
                db.query(Mesa)
                .filter(Mesa.restaurante_id == restaurante_id, Mesa.id.in_(mesa_ids_candidatas))
                .order_by(Mesa.id)
                .with_for_update()
                .all()
            )
            nuevo_inicio, nuevo_fin = _rango(fecha, hora, duracion_minutos)
            conflictivas = self._reservas_activas_para_mesas(
                db,
                restaurante_id=restaurante_id,
                fecha=fecha,
                mesa_ids=[m.id for m in candidatas],
            )
            hay_conflicto = any(
                _se_solapan(nuevo_inicio, nuevo_fin, *_rango(r.fecha, r.hora, r.duracion_minutos))
                for r in conflictivas
            )
            if not hay_conflicto:
                mesas = candidatas

        cliente = cliente_crud.get_or_create(
            db,
            restaurante_id=restaurante_id,
            nombre=cliente_nombre,
            telefono=None,
            email=cliente_email,
        )

        nueva = Reserva(
            restaurante_id=restaurante_id,
            turno_id=turno_id,
            fecha=fecha,
            hora=hora,
            duracion_minutos=duracion_minutos,
            num_personas=num_personas,
            cliente_nombre=cliente_nombre,
            cliente_email=cliente_email,
            cliente_id=cliente.id if cliente else None,
            notas=notas,
            origen=OrigenReserva.GOOGLE_CALENDAR,
            google_event_id=google_event_id,
            mesas=mesas,
        )
        db.add(nueva)
        db.commit()
        db.refresh(nueva)
        return nueva

    def get_by_google_event_id(
        self, db: Session, *, restaurante_id: uuid.UUID, google_event_id: str
    ) -> Reserva | None:
        return (
            db.query(Reserva)
            .filter(
                Reserva.restaurante_id == restaurante_id,
                Reserva.google_event_id == google_event_id,
            )
            .first()
        )

    def cambiar_estado(self, db: Session, *, reserva: Reserva, estado: EstadoReserva) -> Reserva:
        reserva.estado = estado
        db.add(reserva)
        db.commit()
        db.refresh(reserva)
        return reserva

    def get_candidatas_recordatorio(self, db: Session) -> list[Reserva]:
        """Reservas activas, sin recordatorio enviado, en las próximas ~48h,
        de restaurantes con el recordatorio activado. El filtrado fino por la
        antelación exacta configurada (recordatorio_horas_antes) se hace
        después en Python — el volumen por restaurante es pequeño, no hace
        falta aritmética de intervalos en SQL."""
        limite = date.today() + timedelta(days=2)
        return (
            db.query(Reserva)
            .join(Restaurante, Restaurante.id == Reserva.restaurante_id)
            .filter(
                Reserva.estado.in_([EstadoReserva.PENDIENTE, EstadoReserva.CONFIRMADA]),
                Reserva.recordatorio_enviado_en.is_(None),
                Reserva.fecha >= date.today(),
                Reserva.fecha <= limite,
                Restaurante.recordatorio_horas_antes.isnot(None),
            )
            .all()
        )

    def marcar_recordatorio_enviado(self, db: Session, *, reserva: Reserva) -> None:
        reserva.recordatorio_enviado_en = datetime.now(timezone.utc)
        db.add(reserva)
        db.commit()

    def get_candidatas_encuesta(self, db: Session) -> list[Reserva]:
        """Reservas de entre ayer y hace 3 días (ventana amplia por si el
        scheduler estuvo caído) que sí llegaron a servirse — nunca se manda
        encuesta de una reserva cancelada o que no se presentó — y todavía
        sin encuesta enviada."""
        hoy = date.today()
        return (
            db.query(Reserva)
            .filter(
                Reserva.estado.in_(
                    [EstadoReserva.CONFIRMADA, EstadoReserva.SENTADA, EstadoReserva.FINALIZADA]
                ),
                Reserva.encuesta_enviada_en.is_(None),
                Reserva.fecha < hoy,
                Reserva.fecha >= hoy - timedelta(days=3),
            )
            .all()
        )

    def marcar_encuesta_enviada(self, db: Session, *, reserva: Reserva) -> None:
        reserva.encuesta_enviada_en = datetime.now(timezone.utc)
        db.add(reserva)
        db.commit()

    def registrar_respuesta_encuesta(
        self, db: Session, *, reserva: Reserva, puntuacion: int, comentario: str | None
    ) -> Reserva:
        reserva.encuesta_puntuacion = puntuacion
        reserva.encuesta_comentario = comentario
        db.add(reserva)
        db.commit()
        db.refresh(reserva)
        return reserva


reserva = CRUDReserva(Reserva)
