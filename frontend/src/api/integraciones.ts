import { apiClient } from "./client"
import type { ApiKeyCreada, GoogleConectarUrl, IntegracionesRead } from "../types"

export async function obtenerIntegraciones(restauranteId: string): Promise<IntegracionesRead> {
  const { data } = await apiClient.get<IntegracionesRead>(
    `/restaurantes/${restauranteId}/integraciones/`,
  )
  return data
}

export async function regenerarApiKey(restauranteId: string): Promise<ApiKeyCreada> {
  const { data } = await apiClient.post<ApiKeyCreada>(
    `/restaurantes/${restauranteId}/integraciones/api-key/regenerar`,
  )
  return data
}

export async function actualizarWebhookN8n(
  restauranteId: string,
  url: string | null,
): Promise<IntegracionesRead> {
  const { data } = await apiClient.put<IntegracionesRead>(
    `/restaurantes/${restauranteId}/integraciones/n8n-webhook`,
    { url },
  )
  return data
}

export async function actualizarRecordatorio(
  restauranteId: string,
  horasAntes: number | null,
): Promise<IntegracionesRead> {
  const { data } = await apiClient.put<IntegracionesRead>(
    `/restaurantes/${restauranteId}/integraciones/recordatorio`,
    { horas_antes: horasAntes },
  )
  return data
}

export async function obtenerUrlConexionGoogle(restauranteId: string): Promise<GoogleConectarUrl> {
  const { data } = await apiClient.get<GoogleConectarUrl>(
    `/restaurantes/${restauranteId}/integraciones/google/conectar`,
  )
  return data
}

export async function desconectarGoogle(restauranteId: string): Promise<IntegracionesRead> {
  const { data } = await apiClient.post<IntegracionesRead>(
    `/restaurantes/${restauranteId}/integraciones/google/desconectar`,
  )
  return data
}
