import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { obtenerPlano } from "../api/plano"
import {
  cambiarEstadoReserva,
  cancelarReserva,
  crearReserva,
  extraerMensajeError,
  listarReservas,
} from "../api/reservas"
import { listarTurnos } from "../api/turnos"
import { useReservasSocket } from "../hooks/useReservasSocket"
import { estadoVisualMesa, reservaActivaParaMesa, type EstadoVisualMesa } from "../lib/estadoMesa"
import type { Mesa, Reserva, Restaurante, Turno, Zona } from "../types"

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const COLOR_ESTADO: Record<EstadoVisualMesa, string> = {
  libre: "border-emerald-700 bg-emerald-950/40",
  reservada: "border-amber-700 bg-amber-950/40",
  ocupada: "border-red-700 bg-red-950/40",
}

const TEXTO_ESTADO: Record<EstadoVisualMesa, string> = {
  libre: "Libre",
  reservada: "Reservada",
  ocupada: "Sentada",
}

export default function CamareroView() {
  const { restauranteId } = useParams<{ restauranteId: string }>()
  const navigate = useNavigate()

  const [restaurante, setRestaurante] = useState<Restaurante | null>(null)
  const [zonas, setZonas] = useState<Zona[]>([])
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [turnoId, setTurnoId] = useState<string | null>(null)
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mesaSeleccionada, setMesaSeleccionada] = useState<Mesa | null>(null)
  const [nombreWalkIn, setNombreWalkIn] = useState("")
  const [comensalesWalkIn, setComensalesWalkIn] = useState(2)
  const [guardando, setGuardando] = useState(false)

  const fecha = hoyISO()

  useEffect(() => {
    if (!restauranteId) return
    Promise.all([obtenerPlano(restauranteId), listarTurnos(restauranteId)])
      .then(([plano, turnosData]) => {
        setRestaurante(plano.restaurante)
        setZonas(plano.zonas)
        setMesas(plano.mesas)
        setTurnos(turnosData)
        setTurnoId((prev) => prev ?? turnosData[0]?.id ?? null)
      })
      .catch(() => setError("No se pudo cargar el restaurante."))
      .finally(() => setLoading(false))
  }, [restauranteId])

  useEffect(() => {
    if (!restauranteId || !turnoId) return
    listarReservas(restauranteId, { fecha, turnoId }).then(setReservas).catch(() => {})
  }, [restauranteId, turnoId, fecha])

  const mergeReserva = useCallback(
    (incoming: Reserva) => {
      if (incoming.fecha !== fecha || incoming.turno_id !== turnoId) return
      setReservas((prev) => {
        const idx = prev.findIndex((r) => r.id === incoming.id)
        if (idx === -1) return [...prev, incoming]
        const copia = [...prev]
        copia[idx] = incoming
        return copia
      })
    },
    [fecha, turnoId],
  )

  useReservasSocket(restauranteId, (event) => mergeReserva(event.reserva))

  function abrirMesa(mesa: Mesa) {
    setMesaSeleccionada(mesa)
    setNombreWalkIn("")
    setComensalesWalkIn(2)
    setError(null)
  }

  const reservaSeleccionada = mesaSeleccionada
    ? reservaActivaParaMesa(mesaSeleccionada.id, reservas)
    : null

  async function handleSentarWalkIn() {
    if (!restauranteId || !turnoId || !mesaSeleccionada) return
    setGuardando(true)
    setError(null)
    try {
      const ahora = new Date()
      const hora = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}:00`
      const nueva = await crearReserva(restauranteId, {
        cliente_nombre: nombreWalkIn.trim() || "Walk-in",
        num_personas: comensalesWalkIn,
        hora,
        fecha,
        turno_id: turnoId,
        mesa_ids: [mesaSeleccionada.id],
      })
      const sentada = await cambiarEstadoReserva(restauranteId, nueva.id, "sentada")
      mergeReserva(sentada)
      setMesaSeleccionada(null)
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo sentar la mesa."))
    } finally {
      setGuardando(false)
    }
  }

  async function handleCambiarEstado(estado: "sentada" | "finalizada" | "no_show") {
    if (!restauranteId || !reservaSeleccionada) return
    setGuardando(true)
    setError(null)
    try {
      const actualizada = await cambiarEstadoReserva(restauranteId, reservaSeleccionada.id, estado)
      mergeReserva(actualizada)
      setMesaSeleccionada(null)
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo actualizar."))
    } finally {
      setGuardando(false)
    }
  }

  async function handleCancelar() {
    if (!restauranteId || !reservaSeleccionada) return
    if (!confirm("¿Cancelar esta reserva?")) return
    setGuardando(true)
    setError(null)
    try {
      const cancelada = await cancelarReserva(restauranteId, reservaSeleccionada.id)
      mergeReserva(cancelada)
      setMesaSeleccionada(null)
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo cancelar."))
    } finally {
      setGuardando(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-lg text-ink-muted">
        Cargando...
      </div>
    )
  }

  if (!restaurante) {
    return (
      <div className="flex h-screen items-center justify-center text-lg text-red-400">
        {error ?? "Restaurante no encontrado."}
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-page">
      <header className="flex items-center justify-between border-b border-border bg-panel px-4 py-3">
        <button
          onClick={() => navigate(`/restaurantes/${restauranteId}/reservas`)}
          className="rounded-md p-2 text-base text-ink-muted transition hover:bg-panel-alt hover:text-ink"
        >
          ← Volver
        </button>
        <h1 className="text-base font-semibold text-ink">{restaurante.nombre} · Sala</h1>
        <select
          value={turnoId ?? ""}
          onChange={(e) => setTurnoId(e.target.value)}
          className="input w-40 text-base"
        >
          {turnos.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nombre}
            </option>
          ))}
        </select>
      </header>

      {error && (
        <div className="flex items-center justify-between border-b border-red-900/50 bg-red-950/40 px-4 py-2 text-base text-red-300">
          {error}
          <button onClick={() => setError(null)} className="text-red-400">
            ✕
          </button>
        </div>
      )}

      <main className="flex-1 overflow-y-auto p-4">
        {zonas.map((zona) => {
          const mesasZona = mesas.filter((m) => m.zona_id === zona.id)
          if (mesasZona.length === 0) return null
          return (
            <section key={zona.id} className="mb-6">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                {zona.nombre}
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {mesasZona.map((mesa) => {
                  const estado = estadoVisualMesa(mesa.id, reservas)
                  const reserva = reservaActivaParaMesa(mesa.id, reservas)
                  return (
                    <button
                      key={mesa.id}
                      onClick={() => abrirMesa(mesa)}
                      className={`flex min-h-[96px] flex-col items-center justify-center gap-1 rounded-xl border-2 p-3 text-center transition active:scale-95 ${COLOR_ESTADO[estado]}`}
                    >
                      <span className="text-lg font-semibold text-ink">{mesa.nombre}</span>
                      <span className="text-xs text-ink-muted">{TEXTO_ESTADO[estado]}</span>
                      {reserva && (
                        <span className="truncate text-xs text-ink-faint">
                          {reserva.cliente_nombre} · {reserva.num_personas}p
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </main>

      {mesaSeleccionada && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-t-2xl border-t border-border bg-panel p-5 pb-8">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-ink">{mesaSeleccionada.nombre}</h3>
              <button
                onClick={() => setMesaSeleccionada(null)}
                className="rounded-full p-2 text-ink-muted hover:bg-panel-alt hover:text-ink"
              >
                ✕
              </button>
            </div>

            {reservaSeleccionada ? (
              <>
                <p className="mb-1 text-base font-medium text-ink">
                  {reservaSeleccionada.cliente_nombre}
                </p>
                <p className="mb-4 text-sm text-ink-muted">
                  {reservaSeleccionada.hora.slice(0, 5)} · {reservaSeleccionada.num_personas} personas
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleCambiarEstado("sentada")}
                    disabled={guardando || reservaSeleccionada.estado === "sentada"}
                    className="rounded-xl border-2 border-red-800 py-4 text-base font-semibold text-red-400 disabled:opacity-30"
                  >
                    Sentar
                  </button>
                  <button
                    onClick={() => handleCambiarEstado("finalizada")}
                    disabled={guardando}
                    className="rounded-xl border-2 border-emerald-800 py-4 text-base font-semibold text-emerald-400"
                  >
                    Liberar mesa
                  </button>
                  <button
                    onClick={() => handleCambiarEstado("no_show")}
                    disabled={guardando}
                    className="rounded-xl border-2 border-border-strong py-4 text-base font-semibold text-ink"
                  >
                    No-show
                  </button>
                  <button
                    onClick={handleCancelar}
                    disabled={guardando}
                    className="rounded-xl border-2 border-border-strong py-4 text-base font-semibold text-ink-muted"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm text-ink-muted">Mesa libre — sentar directamente (walk-in):</p>
                <label className="mb-3 flex flex-col gap-1">
                  <span className="text-xs font-medium text-ink-muted">Nombre (opcional)</span>
                  <input
                    value={nombreWalkIn}
                    onChange={(e) => setNombreWalkIn(e.target.value)}
                    placeholder="Walk-in"
                    className="input text-base"
                  />
                </label>
                <label className="mb-4 flex flex-col gap-1">
                  <span className="text-xs font-medium text-ink-muted">Comensales</span>
                  <input
                    type="number"
                    min={1}
                    value={comensalesWalkIn}
                    onChange={(e) => setComensalesWalkIn(Number(e.target.value))}
                    className="input text-base"
                  />
                </label>
                <button
                  onClick={handleSentarWalkIn}
                  disabled={guardando}
                  className="btn-primary w-full py-4 text-base"
                >
                  {guardando ? "Sentando..." : "Sentar mesa"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
