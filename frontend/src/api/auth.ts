import { apiClient } from "./client"
import type { LoginRequest, TokenResponse, Usuario } from "../types"

export async function login(payload: LoginRequest): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>("/auth/login", payload)
  return data
}

export async function obtenerUsuarioActual(): Promise<Usuario> {
  const { data } = await apiClient.get<Usuario>("/auth/me")
  return data
}

export async function cambiarMiPassword(
  passwordActual: string,
  passwordNueva: string,
): Promise<Usuario> {
  const { data } = await apiClient.patch<Usuario>("/auth/me/password", {
    password_actual: passwordActual,
    password_nueva: passwordNueva,
  })
  return data
}
