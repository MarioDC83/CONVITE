import { useState, type FormEvent } from "react"
import type { Zona } from "../../types"

interface ZonePanelProps {
  zonas: Zona[]
  activeZonaId: string | null
  onSelectActive: (id: string) => void
  onCreate: (nombre: string, color: string) => Promise<void>
  onRename: (id: string, nombre: string) => Promise<void>
  onRecolor: (id: string, color: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const COLOR_PALETTE = ["#4f46e5", "#22c55e", "#f97316", "#0ea5e9", "#e11d48", "#a855f7"]

export default function ZonePanel({
  zonas,
  activeZonaId,
  onSelectActive,
  onCreate,
  onRename,
  onRecolor,
  onDelete,
}: ZonePanelProps) {
  const [nombre, setNombre] = useState("")
  const [color, setColor] = useState(COLOR_PALETTE[0])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingNombre, setEditingNombre] = useState("")
  const [creating, setCreating] = useState(false)

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    setCreating(true)
    try {
      await onCreate(nombre.trim(), color)
      setNombre("")
      setColor(COLOR_PALETTE[(zonas.length + 1) % COLOR_PALETTE.length])
    } finally {
      setCreating(false)
    }
  }

  function startEditing(z: Zona) {
    setEditingId(z.id)
    setEditingNombre(z.nombre)
  }

  function commitEditing() {
    if (editingId && editingNombre.trim()) {
      onRename(editingId, editingNombre.trim())
    }
    setEditingId(null)
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Zonas</h3>
      <div className="flex flex-col gap-1.5">
        {zonas.map((z) => (
          <div
            key={z.id}
            onClick={() => onSelectActive(z.id)}
            className={`group flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm transition ${
              activeZonaId === z.id
                ? "border-accent bg-accent-soft"
                : "border-transparent hover:bg-panel-alt"
            }`}
          >
            <label
              className="relative h-3.5 w-3.5 shrink-0 rounded-full ring-1 ring-black/10"
              style={{ backgroundColor: z.color ?? "#94a3b8" }}
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="color"
                value={z.color ?? "#94a3b8"}
                onChange={(e) => onRecolor(z.id, e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>

            {editingId === z.id ? (
              <input
                autoFocus
                value={editingNombre}
                onChange={(e) => setEditingNombre(e.target.value)}
                onBlur={commitEditing}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur()
                  if (e.key === "Escape") setEditingId(null)
                }}
                onClick={(e) => e.stopPropagation()}
                className="min-w-0 flex-1 rounded border border-accent bg-panel-alt px-1 py-0.5 text-sm text-ink outline-none"
              />
            ) : (
              <span
                className="flex-1 truncate text-ink"
                onDoubleClick={(e) => {
                  e.stopPropagation()
                  startEditing(z)
                }}
                title="Doble clic para renombrar"
              >
                {z.nombre}
              </span>
            )}

            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm(`¿Eliminar la zona "${z.nombre}"? Sus mesas también se eliminarán.`)) {
                  onDelete(z.id)
                }
              }}
              className="hidden shrink-0 text-ink-faint hover:text-red-400 group-hover:block"
            >
              ✕
            </button>
          </div>
        ))}
        {zonas.length === 0 && <p className="text-xs text-ink-faint">No hay zonas todavía.</p>}
      </div>

      <form onSubmit={handleCreate} className="mt-3 flex items-center gap-2">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-8 w-8 shrink-0 cursor-pointer rounded border border-border bg-panel-alt p-0.5"
        />
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nueva zona..."
          className="input min-w-0 flex-1"
        />
        <button
          type="submit"
          disabled={creating || !nombre.trim()}
          className="btn-primary shrink-0 px-2.5 py-1.5"
        >
          +
        </button>
      </form>
    </div>
  )
}
