import type { Zona } from "../../types"

interface ZonaFilterBarProps {
  zonas: Zona[]
  filtroZonaId: string | null
  onChange: (zonaId: string | null) => void
  /** Opcional: mesas del restaurante, para mostrar cuántas tiene cada zona. */
  mesas?: { zona_id: string }[]
}

export default function ZonaFilterBar({ zonas, filtroZonaId, onChange, mesas }: ZonaFilterBarProps) {
  const contarPorZona = (zonaId: string) => mesas?.filter((m) => m.zona_id === zonaId).length ?? null

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-border bg-panel px-5">
      <Tab activo={filtroZonaId === null} onClick={() => onChange(null)}>
        Todas las zonas
      </Tab>
      {zonas.map((z) => {
        const n = contarPorZona(z.id)
        return (
          <Tab key={z.id} activo={filtroZonaId === z.id} onClick={() => onChange(z.id)}>
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: z.color ?? "#94a3b8" }}
            />
            {z.nombre}
            {n !== null && <span className="text-ink-faint">({n})</span>}
          </Tab>
        )
      })}
    </div>
  )
}

function Tab({
  activo,
  onClick,
  children,
}: {
  activo: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition ${
        activo
          ? "border-accent text-accent"
          : "border-transparent text-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  )
}
