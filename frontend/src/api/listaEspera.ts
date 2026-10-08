import { apiClient } from "./client"
import type { ListaEspera, ListaEsperaCreate } from "../types"

export async function listarListaEspera(
  restauranteId: string,
  fecha: string,
): Promise<ListaEspera[]> {
  const { data } = await apiClient.get<ListaEspera[]>(
    `/restaurantes/${restauranteId}/lista-espera/`,
    { params: { fecha } },
  )
  return data
}

export async function crearEntradaListaEspera(
  restauranteId: string,
  payload: ListaEsperaCreate,
): Promise<ListaEspera> {
  const { data } = await apiClient.post<ListaEspera>(
    `/restaurantes/${restauranteId}/lista-espera/`,
    payload,
  )
  return data
}

export async function confirmarEntradaListaEspera(
  restauranteId: string,
  entradaId: string,
): Promise<ListaEspera> {
  const { data } = await apiClient.post<ListaEspera>(
    `/restaurantes/${restauranteId}/lista-espera/${entradaId}/confirmar`,
  )
  return data
}

export async function cancelarEntradaListaEspera(
  restauranteId: string,
  entradaId: string,
): Promise<ListaEspera> {
  const { data } = await apiClient.post<ListaEspera>(
    `/restaurantes/${restauranteId}/lista-espera/${entradaId}/cancelar`,
  )
  return data
}
