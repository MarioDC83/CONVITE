import { apiClient } from "./client"
import type { Plano, PlanoMesaUpdate } from "../types"

export async function obtenerPlano(restauranteId: string): Promise<Plano> {
  const { data } = await apiClient.get<Plano>(`/restaurantes/${restauranteId}/plano/`)
  return data
}

export async function guardarPlano(
  restauranteId: string,
  mesas: PlanoMesaUpdate[],
): Promise<Plano> {
  const { data } = await apiClient.put<Plano>(`/restaurantes/${restauranteId}/plano/`, { mesas })
  return data
}
