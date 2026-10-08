from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import settings
from app.services.scheduler import detener_scheduler, iniciar_scheduler
from app.ws.router import router as ws_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    iniciar_scheduler()
    yield
    detener_scheduler()


app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    # "*" a propósito: el widget embebible corre en dominios de terceros que
    # no se conocen de antemano (la web de cada restaurante cliente), y toda
    # la autenticación de esta API va por cabecera (Authorization Bearer o
    # X-API-Key), nunca por cookies. CORS solo decide qué origen puede LEER
    # la respuesta desde JS; no permite saltarse la autenticación — una
    # página de un tercero sigue sin poder generar un Bearer/API key válidos.
    # Por eso allow_credentials=False (no se usan cookies) es seguro combinar
    # con origen comodín.
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)
app.include_router(ws_router)


@app.get("/")
def health_check():
    return {"status": "ok", "app": settings.PROJECT_NAME}
