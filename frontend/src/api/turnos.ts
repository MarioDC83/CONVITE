import { apiClient } from "./client"
import type { Turno, TurnoCreate, TurnoUpdate } from "../types"

export async function listarTurnos(restauranteId: string): Promise<Turno[]> {
  const { data } = await apiClient.get<Turno[]>(`/restaurantes/${restauranteId}/turnos/`)
  return data
}

export async function crearTurno(restauranteId: string, payload: TurnoCreate): Promise<Turno> {
  const { data } = await apiClient.post<Turno>(`/restaurantes/${restauranteId}/turnos/`, payload)
  return data
}

export async function actualizarTurno(
  restauranteId: string,
  turnoId: string,
  payload: TurnoUpdate,
): Promise<Turno> {
  const { data } = await apiClient.patch<Turno>(
    `/restaurantes/${restauranteId}/turnos/${turnoId}`,
    payload,
  )
  return data
}
