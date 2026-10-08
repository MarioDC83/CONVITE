# Despliegue en un servidor (demo para clientes)

Un único servidor con Docker: Caddy (HTTPS automático + frontend compilado),
backend FastAPI y Postgres. Solo se exponen los puertos 80 y 443.

Recomendado: **DigitalOcean Droplet**, Ubuntu 24.04, 2 GB RAM / 1 vCPU
(~12 US$/mes), región Frankfurt. 1 GB se queda corto al compilar el frontend.

## 1. Preparación (una vez)

1. Crear el Droplet con **clave SSH** (no contraseña) y activar el
   **Cloud Firewall** de DigitalOcean: entrada solo 22, 80 y 443 (TCP) y 443 (UDP).
2. En el DNS del dominio, crear un registro **A**:
   `convite` → IP del Droplet (si el dominio es autocore.es → `convite.autocore.es`).
3. Conectar e instalar Docker:
   ```bash
   ssh root@IP_DEL_DROPLET
   curl -fsSL https://get.docker.com | sh
   ```

## 2. Instalar la app

```bash
git clone https://github.com/MarioDC83/CONVITE.git
cd CONVITE
cp .env.example .env
nano .env
```

Si el repo es privado, `git clone` pedirá usuario y un *token* de GitHub
(Settings → Developer settings → Fine-grained token, solo lectura sobre CONVITE).

En `.env` hay que poner **valores nuevos** (no los del PC):

- `DOMINIO` → p. ej. `convite.autocore.es` (sin `https://`)
- `POSTGRES_PASSWORD` → `openssl rand -base64 24`
- `SECRET_KEY` → `openssl rand -base64 48`  (firma los JWT y cifra los tokens de Google)
- `POSTGRES_USER` / `POSTGRES_DB` → pueden quedarse como están
- `GOOGLE_CLIENT_ID/SECRET` → vacíos por ahora (ver sección 5)

## 3. Arrancar

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml logs -f web    # esperar "certificate obtained"
```

Las migraciones de la base de datos se aplican solas al arrancar el backend.
Si el certificado no se emite, casi siempre es que el DNS aún no apunta al
servidor o que el firewall bloquea el 80/443.

## 4. Crear tu usuario superadmin

La app no tiene registro público; el primer usuario se crea así (pide la
contraseña por teclado, no queda guardada en ningún sitio):

```bash
docker compose -f docker-compose.prod.yml exec backend python -m scripts.crear_superadmin tu@email.com
```

Entra en `https://TU_DOMINIO`, crea un restaurante de demo (el asistente te
lleva al editor de plano) y listo. Los datos del PC **no** se copian: el
servidor arranca con la base de datos vacía.

## 5. Google Calendar (opcional)

En Google Cloud Console, añadir como URI de redirección autorizada
`https://TU_DOMINIO/api/v1/integraciones/google/callback`, rellenar
`GOOGLE_CLIENT_ID/SECRET` en `.env` y `docker compose -f docker-compose.prod.yml up -d`.
En producción el webhook push de Google sí funciona (el dominio es público).

## Operación diaria

```bash
# Actualizar a la última versión
git pull && docker compose -f docker-compose.prod.yml up -d --build

# Logs
docker compose -f docker-compose.prod.yml logs -f backend

# Copia de seguridad de la base de datos
docker compose -f docker-compose.prod.yml exec db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > backup_$(date +%F).sql
```

Activa también los **Backups** del Droplet en DigitalOcean (+20 %) si va a
guardar datos reales de clientes.

## Límites conocidos

- Un solo servidor y un solo worker de backend (scheduler, rate limit y
  WebSockets viven en memoria del proceso). Más que suficiente para demos y
  los primeros clientes; escalar a varios workers exige moverlos antes.
- Las API keys del widget van en el JavaScript público de la web del cliente:
  por eso solo dan acceso a disponibilidad y crear reservas de su restaurante.
