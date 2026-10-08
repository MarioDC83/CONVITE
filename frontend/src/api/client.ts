import axios from "axios"
import { getToken, limpiarSesion } from "../lib/authStorage"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

export const apiClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
})

apiClient.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== "/login") {
      limpiarSesion()
      window.location.href = "/login"
    }
    return Promise.reject(error)
  },
)
