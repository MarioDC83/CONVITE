import { useEffect, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import {
  crearDiaEspecial,
  eliminarDiaEspecial,
  listarDiasEspeciales,
} from "../api/diasEspeciales"
import { extraerMensajeError } from "../api/reservas"
import UserMenu from "../components/shared/UserMenu"
import type { DiaEspecial } from "../types"

export default function DiasEspecialesAdmin() {
  const { restauranteId } = useParams<{ restauranteId: string }>()
  const navigate = useNavigate()

  const [dias, setDias] = useState<DiaEspecial[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [fecha, setFecha] = useState("")
  const [motivo, setMotivo] = useState("")
  const [guardando, setGuardando] = useState(false)

  function cargar() {
    if (!restauranteId) return
    setLoading(true)
    listarDiasEspeciales(restauranteId)
      .then(setDias)
      .catch(() => setError("No se pudieron cargar los días especiales."))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restauranteId])

  async function handleCrear(e: FormEvent) {
    e.preventDefault()
    if (!restauranteId || !fecha) return
    setGuardando(true)
    setError(null)
    try {
      const nuevo = await crearDiaEspecial(restauranteId, {
        fecha,
        cerrado: true,
        motivo: motivo.trim() || undefined,
      })
      setDias((prev) => [...prev, nuevo].sort((a, b) => a.fecha.localeCompare(b.fecha)))
      setFecha("")
      setMotivo("")
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo guardar (¿ya existe una entrada para esa fecha?)."))
    } finally {
      setGuardando(false)
    }
  }

  async function handleEliminar(id: string) {
    if (!restauranteId) return
    if (!confirm("¿Quitar este cierre? El restaurante volverá a aceptar reservas ese día.")) return
    try {
      await eliminarDiaEspecial(restauranteId, id)
      setDias((prev) => prev.filter((d) => d.id !== id))
    } catch {
      setError("No se pudo eliminar.")
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
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              Días especiales
            </p>
            <h1 className="text-sm font-semibold text-ink">Cierres y festivos</h1>
          </div>
        </div>
        <UserMenu />
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-6 py-8">
        <p className="mb-6 text-sm text-ink-muted">
          Marca fechas en las que el restaurante no acepta reservas (festivos, vacaciones,
          reformas...). Ese día, disponibilidad y crear reserva se rechazan automáticamente sin
          tener que tocar los turnos.
        </p>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
              ✕
            </button>
          </div>
        )}

        <form onSubmit={handleCrear} className="card mb-6 flex flex-wrap items-end gap-3 p-4">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-ink-muted">Fecha</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              required
              className="input"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-ink-muted">Motivo (opcional)</span>
            <input
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Nochevieja, vacaciones, reforma..."
              className="input"
            />
          </label>
          <button type="submit" disabled={guardando} className="btn-primary">
            {guardando ? "Guardando..." : "+ Cerrar este día"}
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-ink-muted">Cargando...</p>
        ) : dias.length === 0 ? (
          <p className="text-sm text-ink-muted">No hay días especiales marcados.</p>
        ) : (
          <div className="card divide-y divide-border overflow-hidden">
            {dias.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">{d.fecha}</p>
                  {d.motivo && <p className="truncate text-xs text-ink-muted">{d.motivo}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-400">
                    Cerrado
                  </span>
                  <button
                    onClick={() => handleEliminar(d.id)}
                    className="text-xs font-medium text-ink-muted hover:text-ink"
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
