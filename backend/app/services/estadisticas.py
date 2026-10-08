"""Agregaciones para el panel de estadísticas. Se calculan en Python sobre
las reservas del rango (no con SQL de fechas/horas por dialecto) porque el
volumen por restaurante es pequeño y así el cálculo es fácil de leer y de
verificar — no hace falta optimizar prematuramente."""

from collections import Counter
from datetime import date

from sqlalchemy.orm import Session, joinedload

from app.models.reserva import EstadoReserva, Reserva
from app.models.restaurante import Restaurante


def calcular(db: Session, *, restaurante: Restaurante, fecha_desde: date, fecha_hasta: date) -> dict:
    reservas = (
        db.query(Reserva)
        .options(joinedload(Reserva.mesas), joinedload(Reserva.turno))
        .filter(
            Reserva.restaurante_id == restaurante.id,
            Reserva.fecha >= fecha_desde,
            Reserva.fecha <= fecha_hasta,
        )
        .all()
    )

    por_estado = Counter(r.estado.value for r in reservas)
    total = len(reservas)
    no_canceladas = total - por_estado.get("cancelada", 0)
    tasa_no_show = (por_estado.get("no_show", 0) / no_canceladas) if no_canceladas else 0.0

    por_turno: Counter = Counter()
    nombre_turno: dict = {}
    por_dia_semana: Counter = Counter()
    por_hora: Counter = Counter()
    por_mesa: Counter = Counter()
    nombre_mesa: dict = {}
    comensales_totales = 0
    puntuaciones: list[int] = []

    for r in reservas:
        if r.estado == EstadoReserva.CANCELADA:
            continue
        if r.turno:
            por_turno[r.turno_id] += 1
            nombre_turno[r.turno_id] = r.turno.nombre
        por_dia_semana[r.fecha.weekday()] += 1
        por_hora[r.hora.hour] += 1
        for m in r.mesas:
            por_mesa[m.id] += 1
            nombre_mesa[m.id] = m.nombre
        comensales_totales += r.num_personas
        if r.encuesta_puntuacion is not None:
            puntuaciones.append(r.encuesta_puntuacion)

    mesas_top = sorted(por_mesa.items(), key=lambda kv: kv[1], reverse=True)[:10]

    ticket_estimado = (
        comensales_totales * float(restaurante.precio_medio_por_persona)
        if restaurante.precio_medio_por_persona
        else None
    )

    return {
        "fecha_desde": fecha_desde,
        "fecha_hasta": fecha_hasta,
        "total_reservas": total,
        "reservas_por_estado": dict(por_estado),
        "tasa_no_show": round(tasa_no_show, 4),
        "ocupacion_por_turno": [
            {"turno_id": str(tid), "turno_nombre": nombre_turno[tid], "total_reservas": c}
            for tid, c in por_turno.items()
        ],
        "ocupacion_por_dia_semana": [
            {"dia_semana": d, "total_reservas": c} for d, c in sorted(por_dia_semana.items())
        ],
        "ocupacion_por_hora": [{"hora": h, "total_reservas": c} for h, c in sorted(por_hora.items())],
        "mesas_mas_solicitadas": [
            {"mesa_id": str(mid), "mesa_nombre": nombre_mesa[mid], "total_reservas": c}
            for mid, c in mesas_top
        ],
        "ticket_estimado": ticket_estimado,
        "encuesta_media": round(sum(puntuaciones) / len(puntuaciones), 2) if puntuaciones else None,
        "encuesta_respuestas": len(puntuaciones),
    }
