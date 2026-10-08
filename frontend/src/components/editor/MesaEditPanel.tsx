import { useEffect, useState, type ReactNode } from "react"
import type { FormaMesa, Mesa, Zona } from "../../types"

interface MesaEditPanelProps {
  mesa: Mesa
  zonas: Zona[]
  onUpdate: (id: string, attrs: Partial<Mesa>) => void
  onDelete: (id: string) => void
  onClose: () => void
}

const FORMA_LABELS: Record<FormaMesa, string> = {
  circular: "Redonda",
  cuadrada: "Cuadrada",
  rectangular: "Rectangular",
  ovalada: "Ovalada",
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-ink-muted">{label}</span>
      {children}
    </label>
  )
}

export default function MesaEditPanel({ mesa, zonas, onUpdate, onDelete, onClose }: MesaEditPanelProps) {
  const [nombre, setNombre] = useState(mesa.nombre)
  const [capMin, setCapMin] = useState(mesa.capacidad_min)
  const [capMax, setCapMax] = useState(mesa.capacidad_max)

  useEffect(() => {
    setNombre(mesa.nombre)
    setCapMin(mesa.capacidad_min)
    setCapMax(mesa.capacidad_max)
  }, [mesa.id, mesa.nombre, mesa.capacidad_min, mesa.capacidad_max])

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">Editar mesa</h3>
        <button onClick={onClose} className="text-ink-faint hover:text-ink">
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
        <Field label="Nombre / número">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onBlur={() => {
              if (nombre.trim() && nombre !== mesa.nombre) onUpdate(mesa.id, { nombre: nombre.trim() })
            }}
            className="input"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cap. mínima">
            <input
              type="number"
              min={1}
              value={capMin}
              onChange={(e) => setCapMin(Number(e.target.value))}
              onBlur={() => {
                if (capMin !== mesa.capacidad_min) onUpdate(mesa.id, { capacidad_min: capMin })
              }}
              className="input"
            />
          </Field>
          <Field label="Cap. máxima">
            <input
              type="number"
              min={1}
              value={capMax}
              onChange={(e) => setCapMax(Number(e.target.value))}
              onBlur={() => {
                if (capMax !== mesa.capacidad_max) onUpdate(mesa.id, { capacidad_max: capMax })
              }}
              className="input"
            />
          </Field>
        </div>

        <Field label="Zona">
          <select
            value={mesa.zona_id}
            onChange={(e) => onUpdate(mesa.id, { zona_id: e.target.value })}
            className="input"
          >
            {zonas.map((z) => (
              <option key={z.id} value={z.id}>
                {z.nombre}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Forma">
          <select
            value={mesa.forma}
            onChange={(e) => onUpdate(mesa.id, { forma: e.target.value as FormaMesa })}
            className="input"
          >
            {Object.entries(FORMA_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="mt-auto border-t border-border px-4 py-3">
        <button
          onClick={() => {
            if (confirm(`¿Eliminar "${mesa.nombre}"?`)) onDelete(mesa.id)
          }}
          className="w-full rounded-md border border-red-900/50 py-2 text-sm font-medium text-red-400 hover:bg-red-950/40"
        >
          Eliminar mesa
        </button>
      </div>
    </div>
  )
}
