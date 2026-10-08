import type { Reserva } from "../types"

export type EstadoVisualMesa = "libre" | "reservada" | "ocupada"

const PRIORIDAD: Record<string, number> = { sentada: 2, confirmada: 1, pendiente: 1 }

/** Reserva "activa" (no cancelada/no-show/finalizada) que ocupa esta mesa, si la hay. */
export function reservaActivaParaMesa(mesaId: string, reservas: Reserva[]): Reserva | null {
  const activas = reservas.filter(
    (r) =>
      (r.estado === "sentada" || r.estado === "confirmada" || r.estado === "pendiente") &&
      r.mesas.some((m) => m.id === mesaId),
  )
  if (activas.length === 0) return null
  activas.sort((a, b) => (PRIORIDAD[b.estado] ?? 0) - (PRIORIDAD[a.estado] ?? 0))
  return activas[0]
}

export function estadoVisualMesa(mesaId: string, reservas: Reserva[]): EstadoVisualMesa {
  const reserva = reservaActivaParaMesa(mesaId, reservas)
  if (!reserva) return "libre"
  return reserva.estado === "sentada" ? "ocupada" : "reservada"
}
