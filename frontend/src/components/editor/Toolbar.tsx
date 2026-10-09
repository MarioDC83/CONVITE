import { useNavigate } from "react-router-dom"
import UserMenu from "../shared/UserMenu"
import type { Restaurante } from "../../types"

interface ToolbarProps {
  restaurante: Restaurante
  dirty: boolean
  saving: boolean
  savedAt: Date | null
  onSave: () => void
}

export default function Toolbar({ restaurante, dirty, saving, savedAt, onSave }: ToolbarProps) {
  const navigate = useNavigate()

  let status = ""
  if (saving) status = "Guardando..."
  else if (dirty) status = "Cambios sin guardar"
  else if (savedAt) status = `Guardado ${savedAt.toLocaleTimeString()}`

  return (
    <header className="flex items-center justify-between gap-2 border-b border-border bg-panel px-3 py-3 sm:px-5">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <button
          onClick={() => navigate("/")}
          className="shrink-0 rounded-md p-1.5 text-ink-muted transition hover:bg-panel-alt hover:text-ink"
          title="Volver a restaurantes"
        >
          ←
        </button>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-accent">
            Editor de plano
          </p>
          <h1 className="truncate text-sm font-semibold text-ink">{restaurante.nombre}</h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-5">
        <button
          onClick={() => navigate(`/restaurantes/${restaurante.id}/reservas`)}
          className="text-sm font-medium text-ink-muted transition hover:text-accent"
        >
          <span className="sm:hidden">Reservas</span>
          <span className="hidden sm:inline">Reservas del día</span>
        </button>
        <span className="hidden text-xs text-ink-faint md:inline">{status}</span>
        {dirty && (
          <span
            className="h-2 w-2 shrink-0 rounded-full bg-amber-400 md:hidden"
            title="Cambios sin guardar"
          />
        )}
        <button onClick={onSave} disabled={!dirty || saving} className="btn-primary px-3 sm:px-4">
          Guardar<span className="hidden sm:inline"> plano</span>
        </button>
        <UserMenu />
      </div>
    </header>
  )
}
