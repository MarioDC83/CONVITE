import { useEffect, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import {
  actualizarRecordatorio,
  actualizarWebhookN8n,
  desconectarGoogle,
  obtenerIntegraciones,
  obtenerUrlConexionGoogle,
  regenerarApiKey,
} from "../api/integraciones"
import UserMenu from "../components/shared/UserMenu"
import type { IntegracionesRead } from "../types"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

const SCOPE_LABELS: Record<string, string> = {
  "disponibilidad:leer": "Consultar disponibilidad",
  "reservas:crear": "Crear reservas",
  "reservas:estado": "Cambiar estado de reservas",
}

export default function IntegracionesAdmin() {
  const { restauranteId } = useParams<{ restauranteId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [datos, setDatos] = useState<IntegracionesRead | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  const [apiKeyNueva, setApiKeyNueva] = useState<string | null>(null)
  const [regenerando, setRegenerando] = useState(false)
  const [copiado, setCopiado] = useState<string | null>(null)

  const [webhookUrl, setWebhookUrl] = useState("")
  const [guardandoWebhook, setGuardandoWebhook] = useState(false)

  const [recordatorioActivo, setRecordatorioActivo] = useState(true)
  const [horasAntes, setHorasAntes] = useState(3)
  const [guardandoRecordatorio, setGuardandoRecordatorio] = useState(false)

  const [conectandoGoogle, setConectandoGoogle] = useState(false)
  const [desconectandoGoogle, setDesconectandoGoogle] = useState(false)

  function cargar() {
    if (!restauranteId) return
    setLoading(true)
    obtenerIntegraciones(restauranteId)
      .then((d) => {
        setDatos(d)
        setWebhookUrl(d.n8n_webhook_notificaciones_url ?? "")
        setRecordatorioActivo(d.recordatorio_horas_antes !== null)
        setHorasAntes(d.recordatorio_horas_antes ?? 3)
      })
      .catch(() => setError("No se pudo cargar la configuración de integraciones."))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restauranteId])

  useEffect(() => {
    const google = searchParams.get("google")
    if (!google) return
    if (google === "conectado") {
      setAviso("Google Calendar conectado correctamente.")
    } else if (google === "error") {
      const motivo = searchParams.get("motivo")
      setError(`No se pudo conectar Google Calendar${motivo ? ` (${motivo})` : ""}.`)
    }
    searchParams.delete("google")
    searchParams.delete("motivo")
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRegenerarApiKey() {
    if (!restauranteId) return
    if (
      datos?.api_key.activa &&
      !window.confirm(
        "Esto invalida la API key actual al instante: cualquier integración (N8N, widget) que la use dejará de funcionar hasta que la actualices. ¿Continuar?",
      )
    ) {
      return
    }
    setRegenerando(true)
    setError(null)
    try {
      const creada = await regenerarApiKey(restauranteId)
      setApiKeyNueva(creada.valor)
      setDatos((prev) => (prev ? { ...prev, api_key: creada.info } : prev))
    } catch {
      setError("No se pudo regenerar la API key.")
    } finally {
      setRegenerando(false)
    }
  }

  async function handleGuardarWebhook() {
    if (!restauranteId) return
    setGuardandoWebhook(true)
    setError(null)
    try {
      const actualizado = await actualizarWebhookN8n(restauranteId, webhookUrl.trim() || null)
      setDatos(actualizado)
      setAviso("Webhook de notificaciones guardado.")
    } catch {
      setError("No se pudo guardar el webhook (¿es una URL válida?).")
    } finally {
      setGuardandoWebhook(false)
    }
  }

  async function handleGuardarRecordatorio() {
    if (!restauranteId) return
    setGuardandoRecordatorio(true)
    setError(null)
    try {
      const actualizado = await actualizarRecordatorio(
        restauranteId,
        recordatorioActivo ? horasAntes : null,
      )
      setDatos(actualizado)
      setAviso(
        recordatorioActivo
          ? `Recordatorio activado: se enviará ${horasAntes}h antes de cada reserva.`
          : "Recordatorio automático desactivado.",
      )
    } catch {
      setError("No se pudo guardar la configuración del recordatorio.")
    } finally {
      setGuardandoRecordatorio(false)
    }
  }

  async function handleConectarGoogle() {
    if (!restauranteId) return
    setConectandoGoogle(true)
    setError(null)
    try {
      const { url } = await obtenerUrlConexionGoogle(restauranteId)
      window.location.href = url
    } catch (err: unknown) {
      const respuesta = (err as { response?: { status?: number; data?: { detail?: string } } })
        .response
      if (respuesta?.status === 501) {
        setError(
          respuesta.data?.detail ??
            "Google Calendar no está configurado en este servidor todavía.",
        )
      } else {
        setError("No se pudo iniciar la conexión con Google Calendar.")
      }
      setConectandoGoogle(false)
    }
  }

  async function handleDesconectarGoogle() {
    if (!restauranteId) return
    if (!window.confirm("Se desconectará el Google Calendar de este restaurante. ¿Continuar?")) return
    setDesconectandoGoogle(true)
    setError(null)
    try {
      const actualizado = await desconectarGoogle(restauranteId)
      setDatos(actualizado)
      setAviso("Google Calendar desconectado.")
    } catch {
      setError("No se pudo desconectar Google Calendar.")
    } finally {
      setDesconectandoGoogle(false)
    }
  }

  function copiar(texto: string, etiqueta: string) {
    navigator.clipboard.writeText(texto).then(() => {
      setCopiado(etiqueta)
      setTimeout(() => setCopiado(null), 2000)
    })
  }

  const snippetWidget = restauranteId
    ? `<script src="${window.location.origin}/widget.js" defer></script>
<convite-reservas
  restaurante-id="${restauranteId}"
  api-key="${apiKeyNueva ?? "TU_API_KEY_AQUI"}"
  api-base="${API_URL}/api/v1"
></convite-reservas>`
    : ""

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-ink-muted">
        Cargando...
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-panel px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/restaurantes/${restauranteId}/reservas`)}
            className="rounded-md p-1.5 text-ink-muted transition hover:bg-panel-alt hover:text-ink"
            title="Volver"
          >
            ←
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              Integraciones
            </p>
            <h1 className="text-sm font-semibold text-ink">N8N, Google Calendar y widget web</h1>
          </div>
        </div>
        <UserMenu />
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-8">
        {error && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
              ✕
            </button>
          </div>
        )}
        {aviso && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-emerald-900/50 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-300">
            {aviso}
            <button onClick={() => setAviso(null)} className="text-emerald-400 hover:text-emerald-200">
              ✕
            </button>
          </div>
        )}

        {/* API key */}
        <section className="card mb-6 p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">API key de integración</h2>
          <p className="mb-4 text-xs text-ink-muted">
            Una única key para este restaurante — la usan N8N (Recepcionista IA / WhatsApp) y el
            widget de reservas web. Se envía en la cabecera <code>X-API-Key</code>.
          </p>

          {apiKeyNueva ? (
            <div className="mb-4 rounded-md border border-amber-900/50 bg-amber-950/30 p-3">
              <p className="mb-2 text-xs font-medium text-amber-300">
                Copia esta key ahora — no se volverá a mostrar completa.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-panel-alt px-2 py-1.5 text-xs text-ink">
                  {apiKeyNueva}
                </code>
                <button
                  onClick={() => copiar(apiKeyNueva, "key")}
                  className="btn-secondary shrink-0 text-xs"
                >
                  {copiado === "key" ? "Copiado" : "Copiar"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-3">
              <code className="rounded bg-panel-alt px-2 py-1.5 text-xs text-ink-muted">
                {datos?.api_key.activa ? `${datos.api_key.prefijo}••••••••••••••••` : "Sin generar"}
              </code>
              {datos?.api_key.creada_en && (
                <span className="text-xs text-ink-faint">
                  Creada el {new Date(datos.api_key.creada_en).toLocaleDateString("es-ES")}
                </span>
              )}
            </div>
          )}

          <div className="mb-4 flex flex-wrap gap-2">
            {(datos?.api_key.scopes ?? []).map((scope) => (
              <span
                key={scope}
                className="rounded-full bg-panel-alt px-2.5 py-1 text-xs font-medium text-ink-muted"
              >
                {SCOPE_LABELS[scope] ?? scope}
              </span>
            ))}
          </div>

          <button onClick={handleRegenerarApiKey} disabled={regenerando} className="btn-primary">
            {regenerando ? "Generando..." : datos?.api_key.activa ? "Regenerar API key" : "Generar API key"}
          </button>
        </section>

        {/* Webhook N8N */}
        <section className="card mb-6 p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">Webhook de notificaciones (N8N)</h2>
          <p className="mb-4 text-xs text-ink-muted">
            Cuando se crea, cambia de estado o se cancela una reserva (venga de donde venga), el
            backend hace un POST aquí para que N8N mande el WhatsApp correspondiente. Ver{" "}
            <code>INTEGRACION_N8N.md</code> para el payload exacto.
          </p>
          <label className="mb-4 flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-muted">URL del webhook</span>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://tu-n8n.dominio.com/webhook/convite-notificaciones"
              className="input"
            />
          </label>
          <button onClick={handleGuardarWebhook} disabled={guardandoWebhook} className="btn-primary">
            {guardandoWebhook ? "Guardando..." : "Guardar"}
          </button>
        </section>

        {/* Recordatorio automático */}
        <section className="card mb-6 p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">Recordatorio automático (WhatsApp)</h2>
          <p className="mb-4 text-xs text-ink-muted">
            Antes de la hora de la reserva, el backend avisa a N8N (mismo webhook de arriba, con{" "}
            <code>type: "recordatorio_previo"</code>) para que mande un WhatsApp recordando la
            reserva y reducir así los no-shows.
          </p>

          <label className="mb-4 flex items-center gap-2">
            <input
              type="checkbox"
              checked={recordatorioActivo}
              onChange={(e) => setRecordatorioActivo(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            <span className="text-sm text-ink">Enviar recordatorio automático</span>
          </label>

          {recordatorioActivo && (
            <label className="mb-4 flex max-w-xs flex-col gap-1">
              <span className="text-xs font-medium text-ink-muted">Horas de antelación</span>
              <input
                type="number"
                min={1}
                max={72}
                value={horasAntes}
                onChange={(e) => setHorasAntes(Number(e.target.value))}
                className="input"
              />
            </label>
          )}

          <button
            onClick={handleGuardarRecordatorio}
            disabled={guardandoRecordatorio}
            className="btn-primary"
          >
            {guardandoRecordatorio ? "Guardando..." : "Guardar"}
          </button>
        </section>

        {/* Google Calendar */}
        <section className="card mb-6 p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">Google Calendar</h2>
          <p className="mb-4 text-xs text-ink-muted">
            Sincronización en ambos sentidos: las reservas de la app crean/actualizan/cancelan un
            evento en el calendario, y los eventos añadidos directamente en Google Calendar (o vía
            "Reserve with Google") crean una reserva aquí automáticamente.
          </p>

          {datos?.google_calendar_conectado ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm text-ink">
                  Conectado{datos.google_calendar_email ? ` — ${datos.google_calendar_email}` : ""}
                </span>
              </div>
              <button
                onClick={handleDesconectarGoogle}
                disabled={desconectandoGoogle}
                className="btn-secondary text-xs"
              >
                {desconectandoGoogle ? "Desconectando..." : "Desconectar"}
              </button>
            </div>
          ) : (
            <button onClick={handleConectarGoogle} disabled={conectandoGoogle} className="btn-primary">
              {conectandoGoogle ? "Redirigiendo a Google..." : "Conectar con Google Calendar"}
            </button>
          )}
        </section>

        {/* Widget embebible */}
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-semibold text-ink">Widget de reservas para la web</h2>
          <p className="mb-4 text-xs text-ink-muted">
            Pega este fragmento en la web del restaurante (o en autocore.es). Es un componente
            aislado (Shadow DOM): no hereda el CSS del sitio ni lo modifica.
            {!apiKeyNueva && (
              <>
                {" "}
                Sustituye <code>TU_API_KEY_AQUI</code> por la API key del restaurante (regenérala
                arriba para obtener una copiable).
              </>
            )}
          </p>
          <div className="flex items-start gap-2">
            <pre className="max-h-56 flex-1 overflow-auto rounded-md bg-panel-alt p-3 text-xs text-ink">
              {snippetWidget}
            </pre>
            <button
              onClick={() => copiar(snippetWidget, "snippet")}
              className="btn-secondary shrink-0 text-xs"
            >
              {copiado === "snippet" ? "Copiado" : "Copiar"}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
