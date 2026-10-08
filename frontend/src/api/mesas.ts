import { apiClient } from "./client"
import type { Mesa, MesaCreate, MesaUpdate } from "../types"

export async function crearMesa(restauranteId: string, payload: MesaCreate): Promise<Mesa> {
  const { data } = await apiClient.post<Mesa>(`/restaurantes/${restauranteId}/mesas/`, payload)
  return data
}

export async function actualizarMesa(
  restauranteId: string,
  mesaId: string,
  payload: MesaUpdate,
): Promise<Mesa> {
  const { data } = await apiClient.patch<Mesa>(
    `/restaurantes/${restauranteId}/mesas/${mesaId}`,
    payload,
  )
  return data
}

export async function eliminarMesa(restauranteId: string, mesaId: string): Promise<void> {
  await apiClient.delete(`/restaurantes/${restauranteId}/mesas/${mesaId}`)
}
