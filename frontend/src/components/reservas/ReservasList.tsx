import type { EstadoReserva, Reserva } from "../../types"

interface ReservasListProps {
  reservas: Reserva[]
  selectedReservaId: string | null
  onSelect: (reservaId: string) => void
}

const ESTADO_DOT: Record<EstadoReserva, string> = {
  pendiente: "bg-amber-400",
  confirmada: "bg-amber-500",
  sentada: "bg-red-500",
  finalizada: "bg-ink-faint",
  cancelada: "bg-ink-faint",
  no_show: "bg-ink-faint",
}

export default function ReservasList({ reservas, selectedReservaId, onSelect }: ReservasListProps) {
  const ordenadas = [...reservas].sort((a, b) => a.hora.localeCompare(b.hora))

  if (ordenadas.length === 0) {
    return <p className="p-6 text-sm text-ink-faint">No hay reservas para este turno todavía.</p>
  }

  return (
    <ul className="mx-auto max-w-3xl divide-y divide-border">
      {ordenadas.map((r) => {
        const iniciales = r.cliente_nombre
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
        return (
          <li key={r.id}>
            <button
              onClick={() => onSelect(r.id)}
              className={`flex w-full items-center gap-4 px-5 py-3.5 text-left transition hover:bg-panel-alt ${
                selectedReservaId === r.id ? "bg-accent-soft" : ""
              }`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-panel-alt text-xs font-semibold text-ink-muted">
                {iniciales}
              </div>
              <span className="w-14 shrink-0 text-sm font-medium text-ink">{r.hora.slice(0, 5)}</span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink">{r.cliente_nombre}</span>
              <span className="shrink-0 text-xs text-ink-faint">
                {r.mesas.map((m) => m.nombre).join(", ")} · {r.num_personas}p
              </span>
              <span className={`h-2 w-2 shrink-0 rounded-full ${ESTADO_DOT[r.estado]}`} />
            </button>
          </li>
        )
      })}
    </ul>
  )
}
