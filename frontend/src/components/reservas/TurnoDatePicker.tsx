import { useState, type FormEvent } from "react"
import type { Turno } from "../../types"

interface TurnoPayload {
  nombre: string
  hora_inicio: string
  hora_fin: string
}

interface TurnoDatePickerProps {
  fecha: string
  onFechaChange: (fecha: string) => void
  turnos: Turno[]
  turnoId: string | null
  onTurnoChange: (turnoId: string) => void
  onCrearTurno: (payload: TurnoPayload) => Promise<void>
  onEditarTurno: (turnoId: string, payload: TurnoPayload) => Promise<void>
  puedeGestionar: boolean
}

export default function TurnoDatePicker({
  fecha,
  onFechaChange,
  turnos,
  turnoId,
  onTurnoChange,
  onCrearTurno,
  onEditarTurno,
  puedeGestionar,
}: TurnoDatePickerProps) {
  const [modoForm, setModoForm] = useState<"crear" | "editar" | null>(
    puedeGestionar && turnos.length === 0 ? "crear" : null,
  )
  const [nombre, setNombre] = useState("")
  const [horaInicio, setHoraInicio] = useState("13:00")
  const [horaFin, setHoraFin] = useState("16:00")
  const [guardando, setGuardando] = useState(false)

  const turnoActivo = turnos.find((t) => t.id === turnoId) ?? null

  function abrirCreacion() {
    setNombre("")
    setHoraInicio("13:00")
    setHoraFin("16:00")
    setModoForm((prev) => (prev === "crear" ? null : "crear"))
  }

  function abrirEdicion() {
    if (!turnoActivo) return
    setNombre(turnoActivo.nombre)
    setHoraInicio(turnoActivo.hora_inicio.slice(0, 5))
    setHoraFin(turnoActivo.hora_fin.slice(0, 5))
    setModoForm((prev) => (prev === "editar" ? null : "editar"))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    setGuardando(true)
    try {
      const payload: TurnoPayload = {
        nombre: nombre.trim(),
        hora_inicio: `${horaInicio}:00`,
        hora_fin: `${horaFin}:00`,
      }
      if (modoForm === "editar" && turnoActivo) {
        await onEditarTurno(turnoActivo.id, payload)
      } else {
        await onCrearTurno(payload)
      }
      setModoForm(null)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-4 border-b border-border bg-panel px-5 py-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink-muted">Fecha</label>
        <input
          type="date"
          value={fecha}
          onChange={(e) => onFechaChange(e.target.value)}
          className="input w-40"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-ink-muted">Turno</label>
        {turnos.length > 0 ? (
          <select
            value={turnoId ?? ""}
            onChange={(e) => onTurnoChange(e.target.value)}
            className="input w-52"
          >
            {turnos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre} ({t.hora_inicio.slice(0, 5)}-{t.hora_fin.slice(0, 5)})
              </option>
            ))}
          </select>
        ) : (
          <span className="py-1.5 text-sm text-ink-faint">Sin turnos configurados</span>
        )}
      </div>

      {puedeGestionar && (
        <button onClick={abrirCreacion} className="btn-secondary py-1.5">
          {modoForm === "crear" ? "Cancelar" : "+ Turno"}
        </button>
      )}

      {puedeGestionar && turnoActivo && (
        <button onClick={abrirEdicion} className="btn-secondary py-1.5">
          {modoForm === "editar" ? "Cancelar" : "✎ Editar turno"}
        </button>
      )}

      {puedeGestionar && modoForm && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-wrap items-end gap-2 rounded-lg border border-border bg-panel-alt px-3 py-2"
        >
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Cena"
            className="input w-28"
          />
          <input
            type="time"
            value={horaInicio}
            onChange={(e) => setHoraInicio(e.target.value)}
            className="input w-28"
          />
          <span className="pb-1.5 text-ink-faint">–</span>
          <input
            type="time"
            value={horaFin}
            onChange={(e) => setHoraFin(e.target.value)}
            className="input w-28"
          />
          <button type="submit" disabled={guardando || !nombre.trim()} className="btn-primary py-1.5">
            {guardando ? "Guardando..." : modoForm === "editar" ? "Guardar" : "Crear"}
          </button>
        </form>
      )}
    </div>
  )
}
