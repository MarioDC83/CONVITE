import { useNavigate, useParams } from "react-router-dom"
import type { EstadoReserva, Reserva } from "../../types"

interface ReservaDetailPanelProps {
  reserva: Reserva
  onCambiarEstado: (estado: EstadoReserva) => void
  onCancelar: () => void
  onClose: () => void
}

const ESTADO_LABELS: Record<EstadoReserva, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  sentada: "Sentada",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
  no_show: "No-show",
}

const ESTADO_BADGE: Record<EstadoReserva, string> = {
  pendiente: "bg-amber-500/15 text-amber-400",
  confirmada: "bg-amber-500/15 text-amber-400",
  sentada: "bg-red-500/15 text-red-400",
  finalizada: "bg-panel-alt text-ink-muted",
  cancelada: "bg-panel-alt text-ink-faint",
  no_show: "bg-panel-alt text-ink-faint",
}

export default function ReservaDetailPanel({
  reserva,
  onCambiarEstado,
  onCancelar,
  onClose,
}: ReservaDetailPanelProps) {
  const cerrada = ["finalizada", "cancelada", "no_show"].includes(reserva.estado)
  const navigate = useNavigate()
  const { restauranteId } = useParams<{ restauranteId: string }>()

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-ink">Reserva</h3>
        <button onClick={onClose} className="text-ink-faint hover:text-ink">
          ✕
        </button>
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto px-4 py-4">
        <span
          className={`inline-block w-fit rounded-full px-2.5 py-1 text-xs font-medium ${ESTADO_BADGE[reserva.estado]}`}
        >
          {ESTADO_LABELS[reserva.estado]}
        </span>

        <div>
          <p className="text-base font-semibold text-ink">{reserva.cliente_nombre}</p>
          {reserva.cliente_telefono && <p className="text-sm text-ink-muted">{reserva.cliente_telefono}</p>}
          {reserva.cliente_email && <p className="text-sm text-ink-muted">{reserva.cliente_email}</p>}
          {reserva.cliente_id && (
            <button
              onClick={() =>
                navigate(`/restaurantes/${restauranteId}/clientes?cliente_id=${reserva.cliente_id}`)
              }
              className="mt-1 text-xs font-medium text-accent hover:text-accent-hover"
            >
              Ver ficha del cliente →
            </button>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
          <dt className="text-ink-faint">Hora</dt>
          <dd className="text-ink">{reserva.hora.slice(0, 5)}</dd>
          <dt className="text-ink-faint">Comensales</dt>
          <dd className="text-ink">{reserva.num_personas}</dd>
          <dt className="text-ink-faint">Mesa(s)</dt>
          <dd className="text-ink">{reserva.mesas.map((m) => m.nombre).join(", ")}</dd>
          <dt className="text-ink-faint">Origen</dt>
          <dd className="text-ink capitalize">{reserva.origen.replace("_", " ")}</dd>
        </dl>

        {reserva.notas && (
          <div>
            <p className="text-xs font-medium text-ink-faint">Notas</p>
            <p className="text-sm text-ink">{reserva.notas}</p>
          </div>
        )}

        {reserva.encuesta_puntuacion != null && (
          <div>
            <p className="text-xs font-medium text-ink-faint">Encuesta de satisfacción</p>
            <p className="text-sm text-ink">
              {"★".repeat(reserva.encuesta_puntuacion)}
              {"☆".repeat(5 - reserva.encuesta_puntuacion)}
            </p>
            {reserva.encuesta_comentario && (
              <p className="mt-0.5 text-sm text-ink-muted">"{reserva.encuesta_comentario}"</p>
            )}
          </div>
        )}
      </div>

      {!cerrada && (
        <div className="mt-auto flex flex-col gap-2 border-t border-border px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onCambiarEstado("confirmada")}
              disabled={reserva.estado === "confirmada"}
              className="rounded-md border border-emerald-800 py-1.5 text-sm font-medium text-emerald-400 transition hover:bg-emerald-950/40 disabled:opacity-40"
            >
              Confirmar
            </button>
            <button
              onClick={() => onCambiarEstado("sentada")}
              disabled={reserva.estado === "sentada"}
              className="rounded-md border border-red-800 py-1.5 text-sm font-medium text-red-400 transition hover:bg-red-950/40 disabled:opacity-40"
            >
              Sentar
            </button>
            <button
              onClick={() => onCambiarEstado("finalizada")}
              className="btn-secondary py-1.5"
            >
              Finalizar
            </button>
            <button
              onClick={() => onCambiarEstado("no_show")}
              className="btn-secondary py-1.5"
            >
              No-show
            </button>
          </div>
          <button
            onClick={onCancelar}
            className="rounded-md border border-red-900/60 py-1.5 text-sm font-medium text-red-400 transition hover:bg-red-950/40"
          >
            Cancelar reserva
          </button>
        </div>
      )}
    </div>
  )
}
