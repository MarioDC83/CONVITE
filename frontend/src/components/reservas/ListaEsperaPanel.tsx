import { useEffect, useState, type FormEvent } from "react"
import {
  cancelarEntradaListaEspera,
  confirmarEntradaListaEspera,
  crearEntradaListaEspera,
  listarListaEspera,
} from "../../api/listaEspera"
import { extraerMensajeError } from "../../api/reservas"
import type { ListaEspera, Turno } from "../../types"

const ESTADO_LABELS: Record<string, string> = {
  esperando: "Esperando",
  ofrecida: "Mesa ofrecida",
  confirmada: "Confirmada",
  expirada: "Expirada",
  cancelada: "Cancelada",
}

const ESTADO_COLORS: Record<string, string> = {
  esperando: "bg-panel-alt text-ink-muted",
  ofrecida: "bg-accent-soft text-accent",
  confirmada: "bg-emerald-500/15 text-emerald-400",
  expirada: "bg-ink-faint/20 text-ink-faint",
  cancelada: "bg-red-500/15 text-red-400",
}

interface Props {
  restauranteId: string
  fecha: string
  turnos: Turno[]
}

export default function ListaEsperaPanel({ restauranteId, fecha, turnos }: Props) {
  const [entradas, setEntradas] = useState<ListaEspera[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)

  const [turnoId, setTurnoId] = useState(turnos[0]?.id ?? "")
  const [comensales, setComensales] = useState(2)
  const [nombre, setNombre] = useState("")
  const [telefono, setTelefono] = useState("")
  const [guardando, setGuardando] = useState(false)

  function cargar() {
    setLoading(true)
    listarListaEspera(restauranteId, fecha)
      .then(setEntradas)
      .catch(() => setError("No se pudo cargar la lista de espera."))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restauranteId, fecha])

  async function handleCrear(e: FormEvent) {
    e.preventDefault()
    if (!turnoId || !nombre.trim()) return
    setGuardando(true)
    setError(null)
    try {
      const nueva = await crearEntradaListaEspera(restauranteId, {
        turno_id: turnoId,
        fecha,
        comensales,
        cliente_nombre: nombre.trim(),
        cliente_telefono: telefono.trim() || undefined,
      })
      setEntradas((prev) => [...prev, nueva])
      setNombre("")
      setTelefono("")
      setComensales(2)
      setMostrarForm(false)
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo añadir a la lista de espera."))
    } finally {
      setGuardando(false)
    }
  }

  async function handleConfirmar(id: string) {
    setError(null)
    try {
      const actualizada = await confirmarEntradaListaEspera(restauranteId, id)
      setEntradas((prev) => prev.map((e) => (e.id === id ? actualizada : e)))
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo confirmar la mesa (puede que la oferta haya caducado)."))
      cargar()
    }
  }

  async function handleCancelar(id: string) {
    if (!confirm("¿Quitar de la lista de espera?")) return
    setError(null)
    try {
      const actualizada = await cancelarEntradaListaEspera(restauranteId, id)
      setEntradas((prev) => prev.map((e) => (e.id === id ? actualizada : e)))
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo quitar la entrada."))
    }
  }

  function nombreTurno(id: string): string {
    return turnos.find((t) => t.id === id)?.nombre ?? "Turno"
  }

  const activas = entradas.filter((e) => e.estado === "esperando" || e.estado === "ofrecida")
  const historicas = entradas.filter((e) => e.estado !== "esperando" && e.estado !== "ofrecida")

  return (
    <div className="mx-auto h-full max-w-2xl overflow-y-auto bg-page px-6 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Lista de espera</h2>
        <button onClick={() => setMostrarForm((v) => !v)} className="btn-primary text-xs">
          + Añadir
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

      {mostrarForm && (
        <form onSubmit={handleCrear} className="card mb-6 flex flex-col gap-3 p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ink-muted">Turno</span>
              <select value={turnoId} onChange={(e) => setTurnoId(e.target.value)} className="input">
                {turnos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-medium text-ink-muted">Comensales</span>
              <input
                type="number"
                min={1}
                value={comensales}
                onChange={(e) => setComensales(Number(e.target.value))}
                className="input"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-muted">Nombre</span>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              required
              autoFocus
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-muted">Teléfono</span>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} className="input" />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMostrarForm(false)} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn-primary">
              {guardando ? "Guardando..." : "Añadir"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-ink-muted">Cargando...</p>
      ) : (
        <>
          <div className="mb-6 space-y-2">
            {activas.length === 0 && (
              <p className="text-sm text-ink-muted">Nadie en espera para este día.</p>
            )}
            {activas.map((entrada) => (
              <div key={entrada.id} className="card flex items-center justify-between gap-4 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink">{entrada.cliente_nombre}</p>
                  <p className="text-xs text-ink-muted">
                    {nombreTurno(entrada.turno_id)} · {entrada.comensales}p
                    {entrada.cliente_telefono ? ` · ${entrada.cliente_telefono}` : ""}
                  </p>
                  {entrada.estado === "ofrecida" && entrada.mesa_ofrecida && (
                    <p className="mt-1 text-xs text-accent">
                      Mesa ofrecida: {entrada.mesa_ofrecida.nombre}
                      {entrada.oferta_expira_en &&
                        ` · expira ${new Date(entrada.oferta_expira_en).toLocaleTimeString("es-ES", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}`}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_COLORS[entrada.estado]}`}
                  >
                    {ESTADO_LABELS[entrada.estado]}
                  </span>
                  {entrada.estado === "ofrecida" && (
                    <button
                      onClick={() => handleConfirmar(entrada.id)}
                      className="text-xs font-medium text-accent hover:text-accent-hover"
                    >
                      Confirmar
                    </button>
                  )}
                  <button
                    onClick={() => handleCancelar(entrada.id)}
                    className="text-xs font-medium text-ink-muted hover:text-ink"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>

          {historicas.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-ink-muted">Historial ({historicas.length})</summary>
              <div className="mt-2 space-y-2">
                {historicas.map((entrada) => (
                  <div
                    key={entrada.id}
                    className="flex items-center justify-between gap-4 rounded-md px-2 py-1.5 text-xs text-ink-faint"
                  >
                    <span>
                      {entrada.cliente_nombre} · {nombreTurno(entrada.turno_id)} · {entrada.comensales}p
                    </span>
                    <span className={`rounded-full px-2 py-0.5 ${ESTADO_COLORS[entrada.estado]}`}>
                      {ESTADO_LABELS[entrada.estado]}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}
    </div>
  )
}
