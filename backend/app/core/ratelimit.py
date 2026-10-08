import time
from collections import defaultdict, deque

_ventanas: dict[str, deque[float]] = defaultdict(deque)


def permitir(clave: str, *, max_peticiones: int, ventana_segundos: float) -> bool:
    """Rate limit en memoria (ventana deslizante) por clave (p.ej. id de la
    API key). Válido para un único proceso backend; si algún día se despliega
    con varios workers habría que pasar a un almacén compartido (Redis) para
    que el límite sea global entre todos ellos."""
    ahora = time.monotonic()
    cola = _ventanas[clave]
    limite = ahora - ventana_segundos
    while cola and cola[0] < limite:
        cola.popleft()
    if len(cola) >= max_peticiones:
        return False
    cola.append(ahora)
    return True
