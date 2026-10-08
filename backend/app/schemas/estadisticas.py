from datetime import date

from pydantic import BaseModel


class OcupacionTurno(BaseModel):
    turno_id: str
    turno_nombre: str
    total_reservas: int


class OcupacionDiaSemana(BaseModel):
    dia_semana: int  # 0 = lunes ... 6 = domingo
    total_reservas: int


class OcupacionHora(BaseModel):
    hora: int
    total_reservas: int


class MesaSolicitada(BaseModel):
    mesa_id: str
    mesa_nombre: str
    total_reservas: int


class EstadisticasRead(BaseModel):
    fecha_desde: date
    fecha_hasta: date
    total_reservas: int
    reservas_por_estado: dict[str, int]
    tasa_no_show: float
    ocupacion_por_turno: list[OcupacionTurno]
    ocupacion_por_dia_semana: list[OcupacionDiaSemana]
    ocupacion_por_hora: list[OcupacionHora]
    mesas_mas_solicitadas: list[MesaSolicitada]
    ticket_estimado: float | None
    encuesta_media: float | None
    encuesta_respuestas: int


class ConfigEstadisticasUpdate(BaseModel):
    precio_medio_por_persona: float | None = None
