import { apiClient } from "./client"
import type { Zona, ZonaCreate, ZonaUpdate } from "../types"

export async function listarZonas(restauranteId: string): Promise<Zona[]> {
  const { data } = await apiClient.get<Zona[]>(`/restaurantes/${restauranteId}/zonas/`)
  return data
}

export async function crearZona(restauranteId: string, payload: ZonaCreate): Promise<Zona> {
  const { data } = await apiClient.post<Zona>(`/restaurantes/${restauranteId}/zonas/`, payload)
  return data
}

export async function actualizarZona(
  restauranteId: string,
  zonaId: string,
  payload: ZonaUpdate,
): Promise<Zona> {
  const { data } = await apiClient.patch<Zona>(
    `/restaurantes/${restauranteId}/zonas/${zonaId}`,
    payload,
  )
  return data
}

export async function eliminarZona(restauranteId: string, zonaId: string): Promise<void> {
  await apiClient.delete(`/restaurantes/${restauranteId}/zonas/${zonaId}`)
}
