# AutoCore Reservas

App de gestión de reservas (tipo Cover Manager) para restaurantes clientes de AutoCore.

## Estructura

```
autocore-reservas/
├── docker-compose.yml
├── .env.example
├── backend/          → FastAPI + PostgreSQL
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── alembic/       → migraciones de base de datos
│   └── app/
│       ├── models/    → restaurantes, usuarios, zonas, mesas, turnos, reservas
│       ├── schemas/    → esquemas Pydantic
│       ├── crud/       → capa de acceso a datos (incl. lógica anti-overbooking)
│       ├── api/v1/     → endpoints REST
│       └── ws/         → WebSocket en tiempo real por restaurante
└── frontend/          → React + Vite + TypeScript
    ├── Dockerfile
    └── src/
        ├── api/                 → cliente HTTP hacia el backend
        ├── hooks/useReservasSocket.ts → cliente WebSocket con reconexión
        ├── pages/               → Selector, Editor de plano, Reservas del día
        └── components/
            ├── editor/          → canvas drag-and-drop del plano (fase 2)
            └── reservas/        → plano coloreado por estado, formularios, lista
```

## Primeros pasos en local

1. Copia el archivo de entorno y ajusta las contraseñas:
   ```
   cp .env.example .env
   ```

2. Levanta todo el stack (base de datos, backend y frontend):
   ```
   docker compose up
   ```

3. Comprueba que el backend responde:
   - http://localhost:8000 → `{"status": "ok", "app": "AutoCore Reservas"}`
   - http://localhost:8000/docs → documentación interactiva de la API (Swagger),
     incluidos los endpoints de reservas/disponibilidad pensados para N8N
   - http://localhost:8080 → Adminer, para ver la base de datos (sistema:
     PostgreSQL, servidor: `db`, usuario/contraseña: los del `.env`)

4. Abre el frontend en http://localhost:5173
   - Crea un restaurante desde "+ Nuevo restaurante" — esto crea también su
     primer usuario **administrador** (nombre/email/contraseña del formulario)
   - Inicia sesión con ese admin, entra a su editor de plano, crea una zona y
     añade mesas. El restaurante ya nace con los turnos "Comidas" (13:00-16:00)
     y "Cenas" (20:00-23:00) — puedes editarlos o crear otros nuevos
   - Desde "Reservas del día": haz clic en una mesa libre para reservarla, y
     usa el panel de la mesa reservada para confirmar/sentar/cancelar
   - Desde "Usuarios" (solo admin): da de alta personal con rol **Personal**,
     que solo puede ver/crear/modificar reservas (no editar el plano ni
     gestionar usuarios)

> **Nota (Windows/Docker Desktop):** el proyecto vive dentro de una carpeta
> sincronizada por OneDrive, y en ese combo el watcher de archivos por eventos
> de Vite a veces no detecta cambios a través del bind mount. Por eso
> `vite.config.ts` fuerza `usePolling`. Si algún día notas que el frontend no
> refleja un cambio, `docker compose restart frontend` lo soluciona al vuelo.

## Migraciones de base de datos

Tras cambiar un modelo en `backend/app/models/`, genera y aplica la migración:
```
docker compose run --rm backend alembic revision --autogenerate -m "descripcion"
docker compose run --rm backend alembic upgrade head
```

## Reservas: anti-overbooking y tiempo real

- **Sin overbooking bajo concurrencia**: `POST /restaurantes/{id}/reservas/` bloquea
  las filas de las mesas implicadas (`SELECT ... FOR UPDATE`) antes de comprobar
  solapes de horario. Si dos peticiones piden la misma mesa a la vez, la segunda
  queda esperando el commit de la primera y entonces sí ve la reserva recién
  creada, devolviendo `409 Conflict` en vez de crear un doble booking.
- **Tiempo real**: cada creación/cambio de estado/cancelación emite un evento por
  `ws://localhost:8000/ws/restaurantes/{restaurante_id}` a todos los clientes
  conectados a ese restaurante. Es un registro en memoria de un solo proceso;
  si algún día se despliega con varios workers, habría que sustituirlo por un
  pub/sub externo (Redis) para que el broadcast llegue a todas las instancias.

## Autenticación y roles

JWT (`pyjwt` + `bcrypt`), sin sesiones en servidor. Dos roles operativos:

- **Admin**: todos los permisos de su restaurante — editar plano (zonas/mesas),
  turnos, restaurante, y gestión de usuarios.
- **Personal (staff)**: ver, crear y modificar reservas (incluidos sus estados).
  No puede entrar al editor de plano ni a "Usuarios" (ni por UI ni por API:
  las rutas están protegidas en el frontend y los endpoints devuelven 403
  en el backend independientemente de la UI).

Cada usuario pertenece a un único restaurante (`restaurante_id`); intentar
acceder a los datos de otro restaurante devuelve 403, incluso con un token
válido. El WebSocket también exige token (`?token=...` en la URL).

Existe además un rol `superadmin` (sin restaurante asignado, para uso interno
de AutoCore multi-tenant) que no tiene UI propia todavía.

## Despliegue en la nube (más adelante)

Mismo `docker-compose.yml`, en un Droplet de DigitalOcean con Docker
preinstalado. Solo cambia el `.env` (contraseñas reales) y se añade un
proxy inverso (Nginx o Caddy) delante para servir todo bajo un dominio
con HTTPS.
