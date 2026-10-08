import axios from "axios"
import { apiClient } from "./client"
import type { EstadoReserva, Mesa, Reserva, ReservaCreate } from "../types"

export async function listarReservas(
  restauranteId: string,
  params: { fecha: string; turnoId?: string | null },
): Promise<Reserva[]> {
  const { data } = await apiClient.get<Reserva[]>(`/restaurantes/${restauranteId}/reservas/`, {
    params: { fecha: params.fecha, turno_id: params.turnoId ?? undefined },
  })
  return data
}

export async function crearReserva(
  restauranteId: string,
  payload: ReservaCreate,
): Promise<Reserva> {
  const { data } = await apiClient.post<Reserva>(
    `/restaurantes/${restauranteId}/reservas/`,
    payload,
  )
  return data
}

export async function cambiarEstadoReserva(
  restauranteId: string,
  reservaId: string,
  estado: EstadoReserva,
): Promise<Reserva> {
  const { data } = await apiClient.patch<Reserva>(
    `/restaurantes/${restauranteId}/reservas/${reservaId}/estado`,
    { estado },
  )
  return data
}

export async function cancelarReserva(restauranteId: string, reservaId: string): Promise<Reserva> {
  const { data } = await apiClient.post<Reserva>(
    `/restaurantes/${restauranteId}/reservas/${reservaId}/cancelar`,
  )
  return data
}

export async function obtenerDisponibilidad(
  restauranteId: string,
  params: { fecha: string; turnoId: string; comensales: number; hora?: string },
): Promise<Mesa[]> {
  const { data } = await apiClient.get<Mesa[]>(`/restaurantes/${restauranteId}/disponibilidad/`, {
    params: {
      fecha: params.fecha,
      turno_id: params.turnoId,
      comensales: params.comensales,
      hora: params.hora,
    },
  })
  return data
}

export async function exportarReservasCsv(
  restauranteId: string,
  params: { fechaDesde: string; fechaHasta: string },
): Promise<void> {
  const { data } = await apiClient.get<Blob>(`/restaurantes/${restauranteId}/reservas/exportar`, {
    params: { fecha_desde: params.fechaDesde, fecha_hasta: params.fechaHasta },
    responseType: "blob",
  })
  const url = URL.createObjectURL(data)
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = `reservas_${params.fechaDesde}_${params.fechaHasta}.csv`
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}

export function extraerMensajeError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === "string") return detail
  }
  return fallback
}
