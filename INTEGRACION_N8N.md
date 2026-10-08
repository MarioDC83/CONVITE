# Integración N8N — Recepcionista IA (Retell AI) y WhatsApp

Este documento describe **qué debe llamar N8N**, con qué cabeceras y payloads
exactos. No se ha tocado ningún workflow existente — esto es solo la
documentación de los endpoints que ya están construidos y probados en el
backend, listos para sustituir las llamadas actuales a Google Sheets /
Google Calendar.

## 1. Autenticación

Todas las llamadas van con una cabecera `X-API-Key` — **una key por
restaurante**, no por usuario. Se genera y se copia desde el panel de
configuración de cada restaurante (`Integraciones → API key`).

```
X-API-Key: cvt_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

La key tiene exactamente tres permisos (nunca acceso a otros restaurantes ni
a borrar/editar el restaurante en sí):

| Scope | Para qué |
|---|---|
| `disponibilidad:leer` | Consultar mesas libres |
| `reservas:crear` | Crear una reserva |
| `reservas:estado` | Cambiar el estado de una reserva ya creada (confirmar, cancelar, etc.) |

Si falta la cabecera → `401`. Si la key no tiene el scope que pide el
endpoint → `403`. Límite: **60 peticiones/minuto por key** (`429` si se
supera — más que de sobra para una recepcionista IA o un flujo de WhatsApp).

Base URL en local: `http://localhost:8000/api/v1`. En producción, la que
corresponda al despliegue.

---

## 2. Workflow "Recepcionista IA" (Retell AI)

### 2.1 Consultar disponibilidad

Sustituye la lectura de Google Sheets para ver huecos.

```
GET /restaurantes/{restaurante_id}/disponibilidad/
    ?fecha=2026-08-20
    &turno_id={turno_id}
    &comensales=4
    &hora=21:00:00          (opcional; si se omite usa el inicio del turno)
    &duracion_minutos=90    (opcional; si se omite usa la del turno)
```

`turno_id` se obtiene una vez de `GET /restaurantes/{id}/turnos/` (con el
mismo API key) y se puede guardar como constante en el workflow por
restaurante, ya que los turnos no cambian a diario.

**Respuesta 200** — lista de mesas libres que encajan en capacidad y no
solapan con ninguna reserva activa (no solo "si la mesa tiene algo ese día"):

```json
[
  {
    "id": "9f16e754-05cf-49b4-8e03-90263288a968",
    "nombre": "Mesa 3",
    "capacidad_min": 2,
    "capacidad_max": 4,
    "forma": "circular",
    "zona_id": "...",
    "restaurante_id": "...",
    "pos_x": 150.0, "pos_y": 200.0, "ancho": 80.0, "alto": 80.0, "rotacion": 0.0,
    "activa": true,
    "created_at": "...", "updated_at": "..."
  }
]
```

Si la lista viene vacía, no hay mesa disponible para esos comensales/hora —
la recepcionista IA debe ofrecer otra franja.

```bash
curl -G "http://localhost:8000/api/v1/restaurantes/$REST_ID/disponibilidad/" \
  -H "X-API-Key: $API_KEY" \
  --data-urlencode "fecha=2026-08-20" \
  --data-urlencode "turno_id=$TURNO_ID" \
  --data-urlencode "comensales=4" \
  --data-urlencode "hora=21:00:00"
```

### 2.2 Crear la reserva

Sustituye la escritura en Google Sheets y la creación manual del evento de
Calendar (el evento de Calendar ahora lo crea el backend automáticamente si
el restaurante tiene Google Calendar conectado — ver `INTEGRACION_N8N.md`
sección 4, no hace falta que N8N lo haga).

```
POST /restaurantes/{restaurante_id}/reservas/
Content-Type: application/json
X-API-Key: cvt_live_...
```

```json
{
  "cliente_nombre": "Ana García",
  "cliente_telefono": "+34600111222",
  "cliente_email": "ana@example.com",
  "fecha": "2026-08-20",
  "turno_id": "460adeee-d113-4c0e-862b-c6db952fd9a7",
  "hora": "21:00:00",
  "num_personas": 4,
  "mesa_ids": ["9f16e754-05cf-49b4-8e03-90263288a968"],
  "notas": "Alergia a marisco",
  "origen": "ia_n8n"
}
```

Campos obligatorios: `cliente_nombre`, `fecha`, `turno_id`, `hora`,
`num_personas`, `mesa_ids` (al menos uno — usa el `id` que devolvió
disponibilidad). `cliente_telefono`, `cliente_email` y `notas` son
opcionales. Pon siempre `"origen": "ia_n8n"` para poder distinguir en la app
qué reservas vinieron de la recepcionista IA.

**201** → reserva creada, el JSON de respuesta trae el `id` de la reserva
— **guárdalo** en el estado del workflow/conversación, lo necesitarás en el
segundo workflow para actualizar el estado.

**409** → la mesa ya no está libre (alguien la reservó justo antes). La
recepcionista IA debe volver a pedir disponibilidad y ofrecer otra opción,
nunca reintentar ciegamente con la misma mesa/hora.

**400** → turno inválido o las mesas no tienen capacidad suficiente para
`num_personas`.

```bash
curl -X POST "http://localhost:8000/api/v1/restaurantes/$REST_ID/reservas/" \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{
    "cliente_nombre": "Ana García",
    "cliente_telefono": "+34600111222",
    "fecha": "2026-08-20",
    "turno_id": "'"$TURNO_ID"'",
    "hora": "21:00:00",
    "num_personas": 4,
    "mesa_ids": ["'"$MESA_ID"'"],
    "origen": "ia_n8n"
  }'
```

---

## 3. Workflow "Respuestas de WhatsApp"

Cuando el cliente responde por WhatsApp confirmando o cancelando, este
workflow llama al mismo backend para reflejar el cambio.

### 3.1 Cambiar estado (confirmar, marcar no-show, etc.)

```
PATCH /restaurantes/{restaurante_id}/reservas/{reserva_id}/estado
Content-Type: application/json
X-API-Key: cvt_live_...
```

```json
{ "estado": "confirmada" }
```

Valores válidos de `estado`: `pendiente`, `confirmada`, `sentada`,
`finalizada`, `cancelada`, `no_show`.

```bash
curl -X PATCH "http://localhost:8000/api/v1/restaurantes/$REST_ID/reservas/$RESERVA_ID/estado" \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"estado": "confirmada"}'
```

### 3.2 Cancelar (atajo equivalente a estado=cancelada)

```
POST /restaurantes/{restaurante_id}/reservas/{reserva_id}/cancelar
X-API-Key: cvt_live_...
```

```bash
curl -X POST "http://localhost:8000/api/v1/restaurantes/$REST_ID/reservas/$RESERVA_ID/cancelar" \
  -H "X-API-Key: $API_KEY"
```

Ambos devuelven `200` con la reserva actualizada, o `404` si el
`reserva_id` no existe en ese restaurante.

---

## 4. Notificación saliente: backend → N8N (WhatsApp)

Esto es al revés de todo lo anterior: **el backend llama a N8N**, no N8N al
backend. Cada vez que se crea, cambia de estado o se cancela una reserva
(sin importar si lo hizo un camarero desde la app, la recepcionista IA, o
el propio workflow de WhatsApp), el backend hace un `POST` fire-and-forget
a la URL configurada en `Integraciones → Webhook de notificaciones` del
restaurante:

```
POST {tu_webhook_url}
Content-Type: application/json
```

```json
{
  "type": "reserva_creada",
  "reserva": { "...": "mismo objeto ReservaRead descrito arriba" }
}
```

`type` es uno de `reserva_creada`, `reserva_actualizada`,
`reserva_cancelada`, `recordatorio_previo` (ver sección 6). Monta en N8N un
nodo Webhook con esa URL como entrada del workflow de WhatsApp, y decide
desde ahí qué plantilla mandar según `type` y `reserva.estado`.

Si tu webhook no responde en 5 segundos o devuelve error, el backend solo lo
registra en su log — **nunca** bloquea ni revierte la reserva. Si el campo
está vacío (por defecto), no se manda nada.

---

## 6. Recordatorio automático antes de la reserva

Reduce no-shows sin que N8N tenga que llevar la cuenta del tiempo: el
backend vigila las reservas activas y, cuando falta exactamente la
antelación configurada (`Integraciones → Recordatorio automático`, por
defecto 3h, desactivable), manda el mismo webhook de la sección 4 con:

```json
{
  "type": "recordatorio_previo",
  "reserva": { "...": "mismo objeto ReservaRead" }
}
```

Se manda **una sola vez** por reserva (se marca internamente para no
duplicar), y solo si la reserva sigue `pendiente` o `confirmada` en ese
momento — si se canceló antes, no llega recordatorio. Monta en N8N una rama
en el mismo nodo Webhook que, para `type == "recordatorio_previo"`, mande la
plantilla de WhatsApp de recordatorio en vez de la de confirmación.

---

## 7. Lista de espera

Cuando `disponibilidad` devuelve vacío, en vez de perder al cliente se le
puede apuntar a la lista de espera. Si luego se libera una mesa compatible
(alguien cancela, no se presenta, o termina y se marca `finalizada`), el
backend se la ofrece automáticamente a la entrada más antigua — sin
esperar a que N8N pregunte nada.

### 7.1 Apuntarse (mismo scope que crear reserva)

```
POST /restaurantes/{restaurante_id}/lista-espera/
X-API-Key: cvt_live_...
```

```json
{
  "turno_id": "460adeee-d113-4c0e-862b-c6db952fd9a7",
  "fecha": "2026-08-20",
  "comensales": 4,
  "cliente_nombre": "Ana García",
  "cliente_telefono": "+34600111222",
  "notas": "Prefiere terraza si puede ser"
}
```

**201** → devuelve la entrada con `estado: "esperando"`.

### 7.2 Notificación saliente: se libera mesa → oferta

Igual que la sección 4/6 pero con clave `lista_espera` en vez de `reserva`,
y al mismo webhook configurado:

```json
{
  "type": "oferta_lista_espera",
  "lista_espera": {
    "id": "...",
    "cliente_nombre": "Ana García",
    "cliente_telefono": "+34600111222",
    "comensales": 4,
    "fecha": "2026-08-20",
    "mesa_ofrecida": { "nombre": "Mesa 3", "...": "..." },
    "oferta_expira_en": "2026-08-20T20:15:00Z",
    "...": "resto de campos de ListaEsperaRead"
  }
}
```

N8N debe mandar el WhatsApp "hay mesa libre, ¿la quieres? Responde antes de
las X" usando `oferta_expira_en` (son **15 minutos** desde que se genera la
oferta). Si no se confirma a tiempo, el backend la expira solo y se la
ofrece automáticamente a la siguiente persona de la lista — no hace falta
que N8N avise de la expiración, solo de la nueva oferta si le llega otra.

### 7.3 El cliente confirma → crear la reserva de verdad

```
POST /restaurantes/{restaurante_id}/lista-espera/{entrada_id}/confirmar
X-API-Key: cvt_live_...
```

Sin cuerpo. **200** → crea la reserva real con la mesa ofrecida y devuelve
la entrada con `estado: "confirmada"` y `reserva_id` relleno (a partir de
aquí ya es una reserva normal: dispara `reserva_creada` por el canal de
siempre). **409** si la oferta ya caducó (ya se le habrá ofrecido a otro).

### 7.4 El cliente no la quiere / se le quita de la lista

```
POST /restaurantes/{restaurante_id}/lista-espera/{entrada_id}/cancelar
X-API-Key: cvt_live_...
```

---

## 9. Encuesta de satisfacción post-visita

El día después de la reserva (si no se canceló ni fue no-show), el backend
avisa por el mismo webhook de la sección 4:

```json
{
  "type": "encuesta_satisfaccion",
  "reserva": { "...": "mismo objeto ReservaRead" }
}
```

N8N debe mandar el WhatsApp pidiendo una puntuación 1-5 (y opcionalmente un
comentario). Cuando el cliente responde, N8N llama:

```
PATCH /restaurantes/{restaurante_id}/reservas/{reserva_id}/encuesta
X-API-Key: cvt_live_...
```

```json
{ "puntuacion": 5, "comentario": "Todo genial, repetiremos" }
```

`puntuacion` es obligatoria (1-5), `comentario` opcional. Se manda **una
sola vez** por reserva (igual que el recordatorio), así que si el cliente no
responde nunca no pasa nada — no hay reintentos.

---

## 10. Resumen de endpoints

| Método | Ruta | Scope requerido | Uso |
|---|---|---|---|
| GET | `/restaurantes/{id}/disponibilidad/` | `disponibilidad:leer` | Buscar mesa libre |
| GET | `/restaurantes/{id}/turnos/` | `disponibilidad:leer` | Listar turnos (Comidas/Cenas) |
| POST | `/restaurantes/{id}/reservas/` | `reservas:crear` | Crear reserva |
| PATCH | `/restaurantes/{id}/reservas/{reserva_id}/estado` | `reservas:estado` | Confirmar/cancelar/etc. |
| POST | `/restaurantes/{id}/reservas/{reserva_id}/cancelar` | `reservas:estado` | Cancelar (atajo) |
| PATCH | `/restaurantes/{id}/reservas/{reserva_id}/encuesta` | `reservas:estado` | Registrar respuesta de la encuesta |
| POST | `/restaurantes/{id}/lista-espera/` | `reservas:crear` | Apuntarse a la lista de espera |
| POST | `/restaurantes/{id}/lista-espera/{entrada_id}/confirmar` | `reservas:crear` | Aceptar la mesa ofrecida |
| POST | `/restaurantes/{id}/lista-espera/{entrada_id}/cancelar` | `reservas:estado` | Quitarse de la lista |

Eventos salientes (`type` en el webhook de notificaciones): `reserva_creada`,
`reserva_actualizada`, `reserva_cancelada`, `recordatorio_previo`,
`oferta_lista_espera`, `encuesta_satisfaccion`.

La documentación interactiva completa (Swagger) sigue disponible en
`/docs` con todos los esquemas exactos.
