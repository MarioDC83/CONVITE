import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { actualizarPrecioMedio, obtenerEstadisticas } from "../api/estadisticas"
import { exportarReservasCsv } from "../api/reservas"
import UserMenu from "../components/shared/UserMenu"
import type { Estadisticas } from "../types"

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  sentada: "Sentada",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
  no_show: "No-show",
}

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function haceDiasISO(dias: number): string {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d.toISOString().slice(0, 10)
}

function BarraLista({
  items,
  formatoEtiqueta,
}: {
  items: { etiqueta: string; valor: number }[]
  formatoEtiqueta?: (v: number) => string
}) {
  const max = Math.max(1, ...items.map((i) => i.valor))
  if (items.length === 0) {
    return <p className="text-sm text-ink-muted">Sin datos en este rango.</p>
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => (
        <div key={item.etiqueta} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-xs text-ink-muted">{item.etiqueta}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-panel-alt">
            <div
              className="h-full rounded-full bg-accent"
              style={{ width: `${(item.valor / max) * 100}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-xs font-medium text-ink">
            {formatoEtiqueta ? formatoEtiqueta(item.valor) : item.valor}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function EstadisticasAdmin() {
  const { restauranteId } = useParams<{ restauranteId: string }>()
  const navigate = useNavigate()

  const [fechaDesde, setFechaDesde] = useState(haceDiasISO(30))
  const [fechaHasta, setFechaHasta] = useState(hoyISO())
  const [datos, setDatos] = useState<Estadisticas | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [precioMedio, setPrecioMedio] = useState("")
  const [guardandoPrecio, setGuardandoPrecio] = useState(false)
  const [exportando, setExportando] = useState(false)

  async function handleExportar() {
    if (!restauranteId) return
    setExportando(true)
    try {
      await exportarReservasCsv(restauranteId, { fechaDesde, fechaHasta })
    } catch {
      setError("No se pudo exportar el CSV.")
    } finally {
      setExportando(false)
    }
  }

  function cargar() {
    if (!restauranteId) return
    setLoading(true)
    setError(null)
    obtenerEstadisticas(restauranteId, { fechaDesde, fechaHasta })
      .then(setDatos)
      .catch(() => setError("No se pudieron cargar las estadísticas."))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restauranteId])

  async function guardarPrecioMedio() {
    if (!restauranteId) return
    setGuardandoPrecio(true)
    try {
      const valor = precioMedio.trim() ? Number(precioMedio) : null
      await actualizarPrecioMedio(restauranteId, valor)
      cargar()
    } catch {
      setError("No se pudo guardar el precio medio.")
    } finally {
      setGuardandoPrecio(false)
    }
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
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Estadísticas</p>
            <h1 className="text-sm font-semibold text-ink">Datos para decidir</h1>
          </div>
        </div>
        <UserMenu />
      </header>

      <main className="flex-1 overflow-y-auto bg-page px-6 py-6">
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-muted">Desde</span>
            <input
              type="date"
              value={fechaDesde}
              onChange={(e) => setFechaDesde(e.target.value)}
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-muted">Hasta</span>
            <input
              type="date"
              value={fechaHasta}
              onChange={(e) => setFechaHasta(e.target.value)}
              className="input"
            />
          </label>
          <button onClick={cargar} className="btn-primary">
            Actualizar
          </button>
          <button onClick={handleExportar} disabled={exportando} className="btn-secondary">
            {exportando ? "Exportando..." : "⬇ Exportar CSV"}
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
              ✕
            </button>
          </div>
        )}

        {loading || !datos ? (
          <p className="text-sm text-ink-muted">Cargando...</p>
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="card p-4">
                <p className="text-2xl font-semibold text-ink">{datos.total_reservas}</p>
                <p className="text-xs text-ink-muted">Reservas totales</p>
              </div>
              <div className="card p-4">
                <p className="text-2xl font-semibold text-ink">
                  {(datos.tasa_no_show * 100).toFixed(1)}%
                </p>
                <p className="text-xs text-ink-muted">Tasa de no-show</p>
              </div>
              <div className="card p-4">
                <p className="text-2xl font-semibold text-ink">
                  {datos.encuesta_media != null ? `${datos.encuesta_media} ★` : "—"}
                </p>
                <p className="text-xs text-ink-muted">
                  Satisfacción media {datos.encuesta_respuestas > 0 && `(${datos.encuesta_respuestas})`}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-2xl font-semibold text-ink">
                  {datos.ticket_estimado != null
                    ? `${datos.ticket_estimado.toLocaleString("es-ES", { maximumFractionDigits: 0 })} €`
                    : "—"}
                </p>
                <p className="text-xs text-ink-muted">Ingresos estimados</p>
              </div>
            </div>

            <div className="mb-6 card flex flex-wrap items-end gap-3 p-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-muted">
                  Precio medio por persona (€) — para estimar ingresos
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={precioMedio}
                  onChange={(e) => setPrecioMedio(e.target.value)}
                  placeholder="25.00"
                  className="input max-w-[160px]"
                />
              </label>
              <button onClick={guardarPrecioMedio} disabled={guardandoPrecio} className="btn-secondary text-sm">
                {guardandoPrecio ? "Guardando..." : "Guardar"}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <section className="card p-4">
                <h2 className="mb-3 text-sm font-semibold text-ink">Reservas por estado</h2>
                <BarraLista
                  items={Object.entries(datos.reservas_por_estado).map(([k, v]) => ({
                    etiqueta: ESTADO_LABELS[k] ?? k,
                    valor: v,
                  }))}
                />
              </section>

              <section className="card p-4">
                <h2 className="mb-3 text-sm font-semibold text-ink">Ocupación por turno</h2>
                <BarraLista
                  items={datos.ocupacion_por_turno.map((t) => ({
                    etiqueta: t.turno_nombre,
                    valor: t.total_reservas,
                  }))}
                />
              </section>

              <section className="card p-4">
                <h2 className="mb-3 text-sm font-semibold text-ink">Ocupación por día de la semana</h2>
                <BarraLista
                  items={datos.ocupacion_por_dia_semana.map((d) => ({
                    etiqueta: DIAS_SEMANA[d.dia_semana] ?? String(d.dia_semana),
                    valor: d.total_reservas,
                  }))}
                />
              </section>

              <section className="card p-4">
                <h2 className="mb-3 text-sm font-semibold text-ink">
                  Ocupación por hora <span className="text-xs font-normal text-ink-faint">(horas valle = barras cortas)</span>
                </h2>
                <BarraLista
                  items={datos.ocupacion_por_hora.map((h) => ({
                    etiqueta: `${h.hora}:00`,
                    valor: h.total_reservas,
                  }))}
                />
              </section>

              <section className="card p-4 lg:col-span-2">
                <h2 className="mb-3 text-sm font-semibold text-ink">Mesas más solicitadas</h2>
                <BarraLista
                  items={datos.mesas_mas_solicitadas.map((m) => ({
                    etiqueta: m.mesa_nombre,
                    valor: m.total_reservas,
                  }))}
                />
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
