import { createContext, useContext, useMemo, useState, type ReactNode } from "react"
import { login as loginRequest } from "../api/auth"
import { getUsuario, guardarSesion, limpiarSesion } from "../lib/authStorage"
import type { Usuario } from "../types"

interface AuthContextValue {
  usuario: Usuario | null
  cargando: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => getUsuario())
  const [cargando, setCargando] = useState(false)

  async function login(email: string, password: string) {
    setCargando(true)
    try {
      const respuesta = await loginRequest({ email, password })
      guardarSesion(respuesta.access_token, respuesta.usuario)
      setUsuario(respuesta.usuario)
    } finally {
      setCargando(false)
    }
  }

  function logout() {
    limpiarSesion()
    setUsuario(null)
    window.location.href = "/login"
  }

  const value = useMemo(() => ({ usuario, cargando, login, logout }), [usuario, cargando])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>")
  return ctx
}
