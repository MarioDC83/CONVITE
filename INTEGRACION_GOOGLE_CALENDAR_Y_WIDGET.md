# Google Calendar y widget de reservas web

Complementa a `INTEGRACION_N8N.md` (que cubre la Recepcionista IA y WhatsApp).
Aquí: sincronización bidireccional con Google Calendar y el widget embebible.

## 1. Cómo configurar el OAuth de Google Calendar (paso a paso)

### 1.1 Crear las credenciales en Google Cloud Console

1. Entra en [Google Cloud Console](https://console.cloud.google.com/) y crea
   un proyecto (o usa uno existente).
2. **APIs y servicios → Biblioteca** → busca "Google Calendar API" → **Habilitar**.
3. **APIs y servicios → Pantalla de consentimiento OAuth**:
   - Tipo: Externo (o Interno si usas Google Workspace propio).
   - Añade el scope `https://www.googleapis.com/auth/calendar` y
     `https://www.googleapis.com/auth/userinfo.email`.
   - Mientras esté en modo "Prueba", añade como usuario de prueba el email de
     cada restaurante que vaya a conectar su calendario (Google no deja
     autorizar cuentas fuera de esa lista hasta que la app se publique/verifique).
4. **APIs y servicios → Credenciales → Crear credenciales → ID de cliente OAuth**:
   - Tipo de aplicación: **Aplicación web**.
   - **URIs de redirección autorizados** — añade exactamente:
     - Local: `http://localhost:8000/api/v1/integraciones/google/callback`
     - Producción: `https://TU-DOMINIO-BACKEND/api/v1/integraciones/google/callback`
   - Guarda el **Client ID** y el **Client secret**.

### 1.2 Configurar el backend

En `.env` (y en el entorno real de producción):

```
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxx
BACKEND_PUBLIC_URL=http://localhost:8000        # en prod: https://tu-backend.dominio.com
FRONTEND_URL=http://localhost:5173               # en prod: https://tu-frontend.dominio.com
```

`BACKEND_PUBLIC_URL` se usa para construir el `redirect_uri` que se manda a
Google — **tiene que coincidir carácter a carácter** con lo registrado en el
paso 1.1, o Google devuelve `redirect_uri_mismatch`.

Reinicia el backend (`docker compose restart backend` o `up -d --build`) para
que recoja las variables nuevas.

### 1.3 Conectar un restaurante

1. Entra en la app como admin de ese restaurante → **Integraciones**.
2. Sección "Google Calendar" → **Conectar con Google Calendar**.
3. Te lleva a la pantalla de consentimiento de Google → aceptas → Google
   redirige a `.../integraciones/google/callback` → el backend intercambia el
   código por tokens, los guarda cifrados, registra automáticamente el canal
   de notificaciones push, y te devuelve a `Integraciones` en el frontend con
   `?google=conectado`.

### 1.4 Notificaciones push (webhook de Google) — importante para producción

Google Calendar avisa de cambios llamando a:

```
POST {BACKEND_PUBLIC_URL}/api/v1/integraciones/google/webhook
```

Esta URL **tiene que ser alcanzable públicamente por HTTPS** — Google no
llama a `localhost`. Para probar la sincronización entrante (Calendar → app)
en local hace falta un túnel (ngrok, Cloudflare Tunnel, etc.):

```bash
ngrok http 8000
# usa la URL https que te da ngrok como BACKEND_PUBLIC_URL antes de conectar
```

Sin túnel, todo lo demás funciona igual (conectar/desconectar, y la
sincronización saliente app→Calendar), simplemente Google no podrá avisar de
eventos creados directamente en Calendar.

El canal de notificaciones **expira** (Google lo limita a ~1 mes máx.) — de
momento no hay renovación automática; si deja de sincronizar pasado ese
tiempo, desconecta y vuelve a conectar el calendario desde el panel para
registrar un canal nuevo. (Renovación automática vía tarea programada sería
la siguiente mejora natural si esto pasa a producción.)

---

## 2. Qué pasa exactamente en cada dirección

**App → Calendar** (automático, sin acción de N8N): al crear, cambiar de
estado o cancelar una reserva desde cualquier origen (app, N8N, widget), el
backend crea/actualiza/cancela el evento correspondiente en el Calendar del
restaurante (si tiene uno conectado). Fire-and-forget: si Calendar falla o
está lento, la reserva se crea igual, solo se registra un warning en el log.

**Calendar → App**: si alguien añade un evento directamente en Google
Calendar (o reserva vía "Reserve with Google"), el backend lo detecta por el
webhook push, y:
- Busca una mesa libre para esa fecha/hora/nº de comensales (comensales se
  estima por nº de invitados del evento, o 2 por defecto) y la asigna.
- Si no hay mesa libre, crea la reserva igualmente **sin mesa asignada**
  (aparece en el listado con `mesas: []` y una nota indicándolo) para que el
  restaurante la asigne a mano.
- Si cancelas/borras ese evento en Calendar, la reserva se cancela en la app.
- Si cancelas la reserva desde la app, el evento se cancela en Calendar.

Los eventos creados por la propia app llevan un marcador interno
(`extendedProperties.private.convite_reserva_id`) para distinguir "esto lo
creamos nosotros" de "esto lo metieron a mano en Calendar", y así no se
duplican reservas ni se reimporta lo que ya es nuestro.

---

## 3. Endpoints nuevos (Google Calendar)

| Método | Ruta | Auth | Uso |
|---|---|---|---|
| GET | `/restaurantes/{id}/integraciones/google/conectar` | JWT admin | Devuelve `{"url": "..."}`, la URL de consentimiento de Google |
| GET | `/integraciones/google/callback` | Ninguna (la llama Google) | Intercambia el `code`, guarda tokens, registra el canal push |
| POST | `/restaurantes/{id}/integraciones/google/desconectar` | JWT admin | Detiene el canal push y borra la conexión |
| POST | `/integraciones/google/webhook` | Ninguna (la llama Google) | Recibe el aviso de cambios y dispara la sincronización incremental |

```bash
# Ejemplo: pedir la URL de conexión (con tu JWT de admin)
curl -H "Authorization: Bearer $JWT" \
  "http://localhost:8000/api/v1/restaurantes/$REST_ID/integraciones/google/conectar"
# → {"url": "https://accounts.google.com/o/oauth2/auth?..."}
```

---

## 4. Widget de reservas embebible

Un Web Component (`<convite-reservas>`) en Shadow DOM — CSS totalmente
aislado del sitio anfitrión, cero dependencias, un solo archivo JS.

**Snippet a pegar** (lo genera también el panel de Integraciones, con la API
key ya rellena):

```html
<script src="https://TU-DOMINIO-FRONTEND/widget.js" defer></script>
<convite-reservas
  restaurante-id="18c8d63d-b867-45fc-89a4-3bb356327911"
  api-key="cvt_live_..."
  api-base="https://TU-DOMINIO-BACKEND/api/v1"
></convite-reservas>
```

Flujo: fecha + turno + comensales → `GET disponibilidad` (coge automáticamente
la mesa más ajustada, el cliente no elige mesa) → datos de contacto →
`POST reservas` con `origen: "web"`. Usa el mismo API key que N8N pero solo
necesita los scopes `disponibilidad:leer` y `reservas:crear`.

Archivo: [`frontend/public/widget.js`](frontend/public/widget.js). Ejemplo
funcional embebido en una página con estilos deliberadamente distintos (para
comprobar el aislamiento): [`frontend/public/ejemplo-widget.html`](frontend/public/ejemplo-widget.html)
— con el servidor de desarrollo levantado, ábrelo en
`http://localhost:5173/ejemplo-widget.html`.

**CORS**: como el widget corre en dominios de terceros que no se conocen de
antemano, el backend permite cualquier origen (`allow_origins=["*"]`). Es
seguro porque toda la autenticación va por cabecera (`X-API-Key` /
`Authorization: Bearer`), nunca por cookies — un origen no autorizado puede
hacer la petición, pero no puede fabricar una API key o un JWT válidos.

---

## 5. Probar todo el flujo en local (curl)

```bash
# 1) Conseguir el restaurante y una API key (desde el panel de Integraciones,
#    o regenerando una con el endpoint de la sección 3 de INTEGRACION_N8N.md)
REST_ID=18c8d63d-b867-45fc-89a4-3bb356327911
API_KEY=cvt_live_...

# 2) Turnos disponibles
curl -s "http://localhost:8000/api/v1/restaurantes/$REST_ID/turnos/" -H "X-API-Key: $API_KEY"

# 3) Disponibilidad (simula lo que llamaría N8N o el widget)
TURNO_ID=...   # de la respuesta anterior
curl -s -G "http://localhost:8000/api/v1/restaurantes/$REST_ID/disponibilidad/" \
  -H "X-API-Key: $API_KEY" \
  --data-urlencode "fecha=2026-08-20" \
  --data-urlencode "turno_id=$TURNO_ID" \
  --data-urlencode "comensales=2"

# 4) Crear la reserva con una mesa de la respuesta anterior
MESA_ID=...
curl -s -X POST "http://localhost:8000/api/v1/restaurantes/$REST_ID/reservas/" \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{
    "cliente_nombre": "Prueba Local",
    "fecha": "2026-08-20",
    "turno_id": "'"$TURNO_ID"'",
    "hora": "21:00:00",
    "num_personas": 2,
    "mesa_ids": ["'"$MESA_ID"'"],
    "origen": "ia_n8n"
  }'
# → 201, incluye "id" — guárdalo como $RESERVA_ID

# 5) Simular el segundo workflow de N8N (WhatsApp) confirmando la reserva
curl -s -X PATCH "http://localhost:8000/api/v1/restaurantes/$REST_ID/reservas/$RESERVA_ID/estado" \
  -H "X-API-Key: $API_KEY" -H "Content-Type: application/json" \
  -d '{"estado": "confirmada"}'

# 6) Si tienes Google Calendar conectado, comprueba que el evento se creó/
#    actualizó mirando el calendario del restaurante directamente.
```

En Postman: mismo esquema — cabecera `X-API-Key`, `Content-Type: application/json`
en los POST/PATCH, cuerpo JSON tal cual los ejemplos de arriba.
