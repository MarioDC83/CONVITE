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
    <header className="flex items-center justify-between border-b border-border bg-panel px-5 py-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/")}
          className="rounded-md p-1.5 text-ink-muted transition hover:bg-panel-alt hover:text-ink"
          title="Volver a restaurantes"
        >
          ←
        </button>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Editor de plano
          </p>
          <h1 className="text-sm font-semibold text-ink">{restaurante.nombre}</h1>
        </div>
      </div>

      <div className="flex items-center gap-5">
        <button
          onClick={() => navigate(`/restaurantes/${restaurante.id}/reservas`)}
          className="text-sm font-medium text-ink-muted transition hover:text-accent"
        >
          Reservas del día
        </button>
        <span className="text-xs text-ink-faint">{status}</span>
        <button onClick={onSave} disabled={!dirty || saving} className="btn-primary">
          Guardar plano
        </button>
        <UserMenu />
      </div>
    </header>
  )
}
