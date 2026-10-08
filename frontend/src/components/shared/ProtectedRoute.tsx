import type { ReactNode } from "react"
import { Navigate, useParams } from "react-router-dom"
import { useAuth } from "../../contexts/AuthContext"
import type { RolUsuario } from "../../types"

interface ProtectedRouteProps {
  children: ReactNode
  rolesPermitidos?: RolUsuario[]
}

export default function ProtectedRoute({ children, rolesPermitidos }: ProtectedRouteProps) {
  const { usuario } = useAuth()
  const { restauranteId } = useParams<{ restauranteId: string }>()

  if (!usuario) {
    return <Navigate to="/login" replace />
  }

  const perteneceAlRestaurante =
    usuario.rol === "superadmin" || !restauranteId || usuario.restaurante_id === restauranteId
  if (!perteneceAlRestaurante) {
    return <Navigate to="/" replace />
  }

  if (rolesPermitidos && !rolesPermitidos.includes(usuario.rol)) {
    return <Navigate to={`/restaurantes/${restauranteId}/reservas`} replace />
  }

  return <>{children}</>
}
