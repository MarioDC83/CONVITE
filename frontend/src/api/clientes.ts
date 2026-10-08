import { apiClient } from "./client"
import type { Cliente, ClienteUpdate, Reserva } from "../types"

export async function listarClientes(
  restauranteId: string,
  params?: { busqueda?: string; soloVip?: boolean },
): Promise<Cliente[]> {
  const { data } = await apiClient.get<Cliente[]>(`/restaurantes/${restauranteId}/clientes/`, {
    params: { busqueda: params?.busqueda || undefined, solo_vip: params?.soloVip || undefined },
  })
  return data
}

export async function obtenerCliente(restauranteId: string, clienteId: string): Promise<Cliente> {
  const { data } = await apiClient.get<Cliente>(`/restaurantes/${restauranteId}/clientes/${clienteId}`)
  return data
}

export async function historialCliente(
  restauranteId: string,
  clienteId: string,
): Promise<Reserva[]> {
  const { data } = await apiClient.get<Reserva[]>(
    `/restaurantes/${restauranteId}/clientes/${clienteId}/reservas`,
  )
  return data
}

export async function actualizarCliente(
  restauranteId: string,
  clienteId: string,
  payload: ClienteUpdate,
): Promise<Cliente> {
  const { data } = await apiClient.patch<Cliente>(
    `/restaurantes/${restauranteId}/clientes/${clienteId}`,
    payload,
  )
  return data
}
