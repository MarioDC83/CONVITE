import { apiClient } from "./client"
import type { Estadisticas } from "../types"

export async function obtenerEstadisticas(
  restauranteId: string,
  params: { fechaDesde: string; fechaHasta: string },
): Promise<Estadisticas> {
  const { data } = await apiClient.get<Estadisticas>(
    `/restaurantes/${restauranteId}/estadisticas/`,
    { params: { fecha_desde: params.fechaDesde, fecha_hasta: params.fechaHasta } },
  )
  return data
}

export async function actualizarPrecioMedio(
  restauranteId: string,
  precioMedioPorPersona: number | null,
): Promise<void> {
  await apiClient.put(`/restaurantes/${restauranteId}/estadisticas/config`, {
    precio_medio_por_persona: precioMedioPorPersona,
  })
}
