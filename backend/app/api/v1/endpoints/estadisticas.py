from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_admin_del_restaurante
from app.models.restaurante import Restaurante
from app.schemas.estadisticas import ConfigEstadisticasUpdate, EstadisticasRead
from app.services import estadisticas as estadisticas_service

router = APIRouter()


@router.get("/", response_model=EstadisticasRead)
def obtener_estadisticas(
    fecha_desde: date | None = Query(None),
    fecha_hasta: date | None = Query(None),
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    hasta = fecha_hasta or date.today()
    desde = fecha_desde or (hasta - timedelta(days=30))
    datos = estadisticas_service.calcular(
        db, restaurante=restaurante, fecha_desde=desde, fecha_hasta=hasta
    )
    return EstadisticasRead(**datos)


@router.put("/config", response_model=dict)
def actualizar_config(
    payload: ConfigEstadisticasUpdate,
    restaurante: Restaurante = Depends(require_admin_del_restaurante),
    db: Session = Depends(get_db),
):
    restaurante.precio_medio_por_persona = payload.precio_medio_por_persona
    db.add(restaurante)
    db.commit()
    return {"precio_medio_por_persona": restaurante.precio_medio_por_persona}
