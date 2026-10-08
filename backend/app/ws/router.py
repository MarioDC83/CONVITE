import uuid

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app import crud
from app.core.security import decodificar_access_token
from app.db.session import get_db
from app.models.usuario import RolUsuario
from app.ws.manager import manager

router = APIRouter()


@router.websocket("/ws/restaurantes/{restaurante_id}")
async def websocket_restaurante(
    websocket: WebSocket,
    restaurante_id: uuid.UUID,
    token: str | None = Query(None),
    db: Session = Depends(get_db),
) -> None:
    usuario_id = decodificar_access_token(token) if token else None
    usuario_actual = crud.usuario.get(db, usuario_id) if usuario_id else None
    autorizado = (
        usuario_actual is not None
        and usuario_actual.activo
        and (
            usuario_actual.rol == RolUsuario.SUPERADMIN
            or usuario_actual.restaurante_id == restaurante_id
        )
    )
    if not autorizado:
        await websocket.close(code=4401)
        return

    await manager.connect(restaurante_id, websocket)
    try:
        while True:
            # No esperamos nada del cliente; solo mantenemos la conexión viva
            # y detectamos la desconexión.
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(restaurante_id, websocket)
