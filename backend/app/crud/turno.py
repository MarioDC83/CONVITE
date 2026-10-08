import uuid
from datetime import time

from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models.turno import Turno
from app.schemas.turno import TurnoCreate, TurnoUpdate

DIAS_TODA_LA_SEMANA = [0, 1, 2, 3, 4, 5, 6]

TURNOS_POR_DEFECTO = [
    {"nombre": "Comidas", "hora_inicio": time(13, 0), "hora_fin": time(16, 0)},
    {"nombre": "Cenas", "hora_inicio": time(20, 0), "hora_fin": time(23, 0)},
]


class CRUDTurno(CRUDBase[Turno, TurnoCreate, TurnoUpdate]):
    def get_multi_by_restaurante(
        self, db: Session, *, restaurante_id: uuid.UUID, skip: int = 0, limit: int = 100
    ) -> list[Turno]:
        return (
            db.query(Turno)
            .filter(Turno.restaurante_id == restaurante_id)
            .order_by(Turno.hora_inicio)
            .offset(skip)
            .limit(limit)
            .all()
        )

    def encontrar_para_hora(
        self, db: Session, *, restaurante_id: uuid.UUID, hora: time
    ) -> Turno | None:
        """Busca (best-effort) el turno cuyo rango horario contiene `hora`,
        usado al importar eventos externos de Google Calendar que no traen
        un turno_id explícito. Si varios encajan, se queda con el primero
        por hora de inicio; si ninguno, devuelve None (turno_id nulo)."""
        candidatos = (
            db.query(Turno)
            .filter(
                Turno.restaurante_id == restaurante_id,
                Turno.activo.is_(True),
                Turno.hora_inicio <= hora,
                Turno.hora_fin > hora,
            )
            .order_by(Turno.hora_inicio)
            .all()
        )
        return candidatos[0] if candidatos else None

    def crear_turnos_por_defecto(self, db: Session, *, restaurante_id: uuid.UUID) -> list[Turno]:
        """Comidas 13-16 y Cenas 20-23, activos los 7 días, para que todo
        restaurante nuevo arranque con turnos ya configurados."""
        creados = []
        for defecto in TURNOS_POR_DEFECTO:
            payload = TurnoCreate(
                nombre=defecto["nombre"],
                hora_inicio=defecto["hora_inicio"],
                hora_fin=defecto["hora_fin"],
                dias_semana=DIAS_TODA_LA_SEMANA,
            )
            creados.append(self.create(db, obj_in=payload, restaurante_id=restaurante_id))
        return creados


turno = CRUDTurno(Turno)
