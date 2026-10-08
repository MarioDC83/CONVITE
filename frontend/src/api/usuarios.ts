import { apiClient } from "./client"
import type { Usuario, UsuarioCreate, UsuarioUpdate } from "../types"

export async function listarUsuarios(restauranteId: string): Promise<Usuario[]> {
  const { data } = await apiClient.get<Usuario[]>(`/restaurantes/${restauranteId}/usuarios/`)
  return data
}

export async function crearUsuario(
  restauranteId: string,
  payload: UsuarioCreate,
): Promise<Usuario> {
  const { data } = await apiClient.post<Usuario>(
    `/restaurantes/${restauranteId}/usuarios/`,
    payload,
  )
  return data
}

export async function actualizarUsuario(
  restauranteId: string,
  usuarioId: string,
  payload: UsuarioUpdate,
): Promise<Usuario> {
  const { data } = await apiClient.patch<Usuario>(
    `/restaurantes/${restauranteId}/usuarios/${usuarioId}`,
    payload,
  )
  return data
}
