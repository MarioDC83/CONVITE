import { useState, type FormEvent, type ReactNode } from "react"
import type { Mesa } from "../../types"

interface ReservaFormCreateProps {
  mesa: Mesa
  error: string | null
  onSubmit: (payload: {
    cliente_nombre: string
    cliente_telefono: string
    num_personas: number
    hora: string
    notas: string
  }) => Promise<void>
  onClose: () => void
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  )
}

export default function ReservaFormCreate({ mesa, error, onSubmit, onClose }: ReservaFormCreateProps) {
  const [clienteNombre, setClienteNombre] = useState("")
  const [clienteTelefono, setClienteTelefono] = useState("")
  const [numPersonas, setNumPersonas] = useState(mesa.capacidad_min)
  const [hora, setHora] = useState("21:00")
  const [notas, setNotas] = useState("")
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!clienteNombre.trim()) return
    setEnviando(true)
    try {
      await onSubmit({
        cliente_nombre: clienteNombre.trim(),
        cliente_telefono: clienteTelefono.trim(),
        num_personas: numPersonas,
        hora: `${hora}:00`,
        notas: notas.trim(),
      })
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Nueva reserva</h3>
          <p className="text-xs text-ink-faint">
            {mesa.nombre} · hasta {mesa.capacidad_max}p
          </p>
        </div>
        <button onClick={onClose} className="text-ink-faint hover:text-ink">
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        {error && (
          <div className="rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}

        <Field label="Cliente">
          <input
            autoFocus
            value={clienteNombre}
            onChange={(e) => setClienteNombre(e.target.value)}
            placeholder="Nombre y apellidos"
            className="input"
          />
        </Field>
        <Field label="Teléfono">
          <input
            value={clienteTelefono}
            onChange={(e) => setClienteTelefono(e.target.value)}
            placeholder="600 000 000"
            className="input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Comensales">
            <input
              type="number"
              min={1}
              max={mesa.capacidad_max}
              value={numPersonas}
              onChange={(e) => setNumPersonas(Number(e.target.value))}
              className="input"
            />
          </Field>
          <Field label="Hora">
            <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className="input" />
          </Field>
        </div>
        <Field label="Notas">
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            placeholder="Alergias, ocasión especial..."
            className="input resize-none"
          />
        </Field>

        <button
          type="submit"
          disabled={enviando || !clienteNombre.trim()}
          className="btn-primary mt-auto w-full"
        >
          {enviando ? "Creando..." : "Crear reserva"}
        </button>
      </form>
    </div>
  )
}
