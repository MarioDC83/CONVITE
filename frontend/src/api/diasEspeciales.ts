import { apiClient } from "./client"
import type { DiaEspecial, DiaEspecialCreate } from "../types"

export async function listarDiasEspeciales(restauranteId: string): Promise<DiaEspecial[]> {
  const { data } = await apiClient.get<DiaEspecial[]>(
    `/restaurantes/${restauranteId}/dias-especiales/`,
  )
  return data
}

export async function crearDiaEspecial(
  restauranteId: string,
  payload: DiaEspecialCreate,
): Promise<DiaEspecial> {
  const { data } = await apiClient.post<DiaEspecial>(
    `/restaurantes/${restauranteId}/dias-especiales/`,
    payload,
  )
  return data
}

export async function eliminarDiaEspecial(restauranteId: string, diaId: string): Promise<void> {
  await apiClient.delete(`/restaurantes/${restauranteId}/dias-especiales/${diaId}`)
}
