import { apiClient } from "./client"
import type { Restaurante, RestauranteCreate } from "../types"

export async function listarRestaurantes(): Promise<Restaurante[]> {
  const { data } = await apiClient.get<Restaurante[]>("/restaurantes/")
  return data
}

export async function obtenerRestaurante(id: string): Promise<Restaurante> {
  const { data } = await apiClient.get<Restaurante>(`/restaurantes/${id}`)
  return data
}

export async function crearRestaurante(payload: RestauranteCreate): Promise<Restaurante> {
  const { data } = await apiClient.post<Restaurante>("/restaurantes/", payload)
  return data
}
