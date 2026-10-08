import uuid

from fastapi import WebSocket


class ReservasConnectionManager:
    """Registro en memoria de sockets conectados por restaurante.

    Válido para un único proceso backend (el caso de esta app en desarrollo /
    despliegue de un solo contenedor). Si en el futuro se escala a varios
    workers/procesos, este registro tendría que sustituirse por un pub/sub
    externo (p.ej. Redis) para que el broadcast llegue a todas las instancias.
    """

    def __init__(self) -> None:
        self._conexiones: dict[uuid.UUID, set[WebSocket]] = {}

    async def connect(self, restaurante_id: uuid.UUID, websocket: WebSocket) -> None:
        await websocket.accept()
        self._conexiones.setdefault(restaurante_id, set()).add(websocket)

    def disconnect(self, restaurante_id: uuid.UUID, websocket: WebSocket) -> None:
        conexiones = self._conexiones.get(restaurante_id)
        if not conexiones:
            return
        conexiones.discard(websocket)
        if not conexiones:
            self._conexiones.pop(restaurante_id, None)

    async def broadcast(self, restaurante_id: uuid.UUID, mensaje: dict) -> None:
        conexiones = self._conexiones.get(restaurante_id)
        if not conexiones:
            return
        caidas: list[WebSocket] = []
        for ws in conexiones:
            try:
                await ws.send_json(mensaje)
            except Exception:
                caidas.append(ws)
        for ws in caidas:
            conexiones.discard(ws)


manager = ReservasConnectionManager()
