from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    clientes,
    dias_especiales,
    disponibilidad,
    estadisticas,
    google_oauth,
    integraciones,
    lista_espera,
    mesas,
    plano,
    reservas,
    restaurantes,
    turnos,
    usuarios,
    zonas,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(restaurantes.router, prefix="/restaurantes", tags=["restaurantes"])
api_router.include_router(
    zonas.router, prefix="/restaurantes/{restaurante_id}/zonas", tags=["zonas"]
)
api_router.include_router(
    mesas.router, prefix="/restaurantes/{restaurante_id}/mesas", tags=["mesas"]
)
api_router.include_router(
    plano.router, prefix="/restaurantes/{restaurante_id}/plano", tags=["plano"]
)
api_router.include_router(
    turnos.router, prefix="/restaurantes/{restaurante_id}/turnos", tags=["turnos"]
)
api_router.include_router(
    reservas.router, prefix="/restaurantes/{restaurante_id}/reservas", tags=["reservas"]
)
api_router.include_router(
    disponibilidad.router,
    prefix="/restaurantes/{restaurante_id}/disponibilidad",
    tags=["disponibilidad"],
)
api_router.include_router(
    lista_espera.router,
    prefix="/restaurantes/{restaurante_id}/lista-espera",
    tags=["lista-espera"],
)
api_router.include_router(
    clientes.router, prefix="/restaurantes/{restaurante_id}/clientes", tags=["clientes"]
)
api_router.include_router(
    estadisticas.router, prefix="/restaurantes/{restaurante_id}/estadisticas", tags=["estadisticas"]
)
api_router.include_router(
    dias_especiales.router,
    prefix="/restaurantes/{restaurante_id}/dias-especiales",
    tags=["dias-especiales"],
)
api_router.include_router(
    usuarios.router, prefix="/restaurantes/{restaurante_id}/usuarios", tags=["usuarios"]
)
api_router.include_router(
    integraciones.router,
    prefix="/restaurantes/{restaurante_id}/integraciones",
    tags=["integraciones"],
)
api_router.include_router(
    google_oauth.router,
    prefix="/integraciones/google",
    tags=["integraciones"],
)
