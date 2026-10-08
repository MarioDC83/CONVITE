import { useEffect, useState, type FormEvent } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { actualizarCliente, obtenerCliente, historialCliente, listarClientes } from "../api/clientes"
import UserMenu from "../components/shared/UserMenu"
import type { Cliente, Reserva } from "../types"

const ESTADO_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  sentada: "Sentada",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
  no_show: "No-show",
}

export default function ClientesAdmin() {
  const { restauranteId } = useParams<{ restauranteId: string }>()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busqueda, setBusqueda] = useState("")
  const [soloVip, setSoloVip] = useState(false)

  const [seleccionado, setSeleccionado] = useState<Cliente | null>(null)
  const [historial, setHistorial] = useState<Reserva[]>([])
  const [cargandoHistorial, setCargandoHistorial] = useState(false)
  const [alergenos, setAlergenos] = useState("")
  const [notas, setNotas] = useState("")
  const [guardando, setGuardando] = useState(false)

  function cargar() {
    if (!restauranteId) return
    setLoading(true)
    listarClientes(restauranteId, { busqueda, soloVip })
      .then(setClientes)
      .catch(() => setError("No se pudieron cargar los clientes."))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restauranteId])

  useEffect(() => {
    const clienteId = searchParams.get("cliente_id")
    if (!clienteId || !restauranteId) return
    obtenerCliente(restauranteId, clienteId).then(seleccionar).catch(() => {})
    searchParams.delete("cliente_id")
    setSearchParams(searchParams, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restauranteId])

  function handleBuscar(e: FormEvent) {
    e.preventDefault()
    cargar()
  }

  function seleccionar(c: Cliente) {
    setSeleccionado(c)
    setAlergenos(c.alergenos_notas ?? "")
    setNotas(c.notas ?? "")
    if (!restauranteId) return
    setCargandoHistorial(true)
    historialCliente(restauranteId, c.id)
      .then(setHistorial)
      .catch(() => setHistorial([]))
      .finally(() => setCargandoHistorial(false))
  }

  async function toggleVip() {
    if (!restauranteId || !seleccionado) return
    try {
      const actualizado = await actualizarCliente(restauranteId, seleccionado.id, {
        vip: !seleccionado.vip,
      })
      setSeleccionado(actualizado)
      setClientes((prev) => prev.map((c) => (c.id === actualizado.id ? actualizado : c)))
    } catch {
      setError("No se pudo actualizar el cliente.")
    }
  }

  async function guardarNotas() {
    if (!restauranteId || !seleccionado) return
    setGuardando(true)
    try {
      const actualizado = await actualizarCliente(restauranteId, seleccionado.id, {
        alergenos_notas: alergenos || null,
        notas: notas || null,
      })
      setSeleccionado(actualizado)
      setClientes((prev) => prev.map((c) => (c.id === actualizado.id ? actualizado : c)))
    } catch {
      setError("No se pudieron guardar los cambios.")
    } finally {
      setGuardando(false)
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
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Clientes</p>
            <h1 className="text-sm font-semibold text-ink">Fichas y visitas</h1>
          </div>
        </div>
        <UserMenu />
      </header>

      {error && (
        <div className="flex items-center justify-between border-b border-red-900/50 bg-red-950/40 px-5 py-2 text-sm text-red-300">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-page px-6 py-6">
          <form onSubmit={handleBuscar} className="mb-4 flex items-center gap-3">
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por nombre, teléfono o email..."
              className="input max-w-sm"
            />
            <label className="flex items-center gap-2 text-sm text-ink-muted">
              <input
                type="checkbox"
                checked={soloVip}
                onChange={(e) => {
                  setSoloVip(e.target.checked)
                }}
                className="h-4 w-4 accent-accent"
              />
              Solo VIP
            </label>
            <button type="submit" className="btn-secondary text-sm">
              Buscar
            </button>
          </form>

          {loading ? (
            <p className="text-sm text-ink-muted">Cargando...</p>
          ) : clientes.length === 0 ? (
            <p className="text-sm text-ink-muted">No hay clientes que coincidan.</p>
          ) : (
            <div className="card divide-y divide-border overflow-hidden">
              {clientes.map((c) => (
                <button
                  key={c.id}
                  onClick={() => seleccionar(c)}
                  className={`flex w-full items-center justify-between gap-4 px-5 py-3 text-left transition hover:bg-panel-alt ${
                    seleccionado?.id === c.id ? "bg-panel-alt" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 truncate text-sm font-medium text-ink">
                      {c.nombre}
                      {c.vip && <span className="text-xs text-accent">★ VIP</span>}
                      {c.es_problematico && (
                        <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400">
                          {c.no_shows} no-shows
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {c.telefono ?? "Sin teléfono"} {c.email ? `· ${c.email}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-xs text-ink-faint">
                    <p>{c.total_reservas} reservas</p>
                    {c.ultima_visita && <p>Última: {c.ultima_visita}</p>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>

        {seleccionado && (
          <aside className="w-96 shrink-0 overflow-y-auto border-l border-border bg-panel p-5">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h2 className="text-sm font-semibold text-ink">{seleccionado.nombre}</h2>
                <p className="text-xs text-ink-muted">
                  {seleccionado.telefono ?? "Sin teléfono"}
                  {seleccionado.email ? ` · ${seleccionado.email}` : ""}
                </p>
              </div>
              <button
                onClick={() => setSeleccionado(null)}
                className="text-ink-muted hover:text-ink"
              >
                ✕
              </button>
            </div>

            <div className="mb-4 flex gap-2">
              <button
                onClick={toggleVip}
                className={seleccionado.vip ? "btn-primary text-xs" : "btn-secondary text-xs"}
              >
                {seleccionado.vip ? "★ Quitar VIP" : "★ Marcar VIP"}
              </button>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <div className="card p-2">
                <p className="text-lg font-semibold text-ink">{seleccionado.total_reservas}</p>
                <p className="text-xs text-ink-muted">Reservas</p>
              </div>
              <div className="card p-2">
                <p className={`text-lg font-semibold ${seleccionado.es_problematico ? "text-red-400" : "text-ink"}`}>
                  {seleccionado.no_shows}
                </p>
                <p className="text-xs text-ink-muted">No-shows</p>
              </div>
              <div className="card p-2">
                <p className="text-xs font-medium text-ink">{seleccionado.ultima_visita ?? "—"}</p>
                <p className="text-xs text-ink-muted">Última visita</p>
              </div>
            </div>

            <label className="mb-3 flex flex-col gap-1">
              <span className="text-xs font-medium text-ink-muted">Alérgenos / preferencias</span>
              <textarea
                value={alergenos}
                onChange={(e) => setAlergenos(e.target.value)}
                rows={2}
                className="input resize-none"
                placeholder="Alergia a marisco, prefiere terraza..."
              />
            </label>
            <label className="mb-3 flex flex-col gap-1">
              <span className="text-xs font-medium text-ink-muted">Notas internas</span>
              <textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                className="input resize-none"
              />
            </label>
            <button onClick={guardarNotas} disabled={guardando} className="btn-primary mb-6 w-full text-xs">
              {guardando ? "Guardando..." : "Guardar notas"}
            </button>

            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Historial de reservas
            </h3>
            {cargandoHistorial ? (
              <p className="text-xs text-ink-muted">Cargando...</p>
            ) : historial.length === 0 ? (
              <p className="text-xs text-ink-muted">Sin reservas todavía.</p>
            ) : (
              <div className="space-y-2">
                {historial.map((r) => (
                  <div key={r.id} className="rounded-md border border-border px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-ink">
                        {r.fecha} · {r.hora.slice(0, 5)}
                      </span>
                      <span className="text-ink-muted">{ESTADO_LABELS[r.estado] ?? r.estado}</span>
                    </div>
                    <p className="mt-0.5 text-ink-faint">{r.num_personas}p</p>
                  </div>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
