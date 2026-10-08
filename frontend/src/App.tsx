import { BrowserRouter, Route, Routes } from "react-router-dom"
import ProtectedRoute from "./components/shared/ProtectedRoute"
import { AuthProvider } from "./contexts/AuthContext"
import CamareroView from "./pages/CamareroView"
import ClientesAdmin from "./pages/ClientesAdmin"
import DiasEspecialesAdmin from "./pages/DiasEspecialesAdmin"
import EstadisticasAdmin from "./pages/EstadisticasAdmin"
import IntegracionesAdmin from "./pages/IntegracionesAdmin"
import Login from "./pages/Login"
import PlanoEditor from "./pages/PlanoEditor"
import ReservasDelDia from "./pages/ReservasDelDia"
import RestaurantSelector from "./pages/RestaurantSelector"
import UsuariosAdmin from "./pages/UsuariosAdmin"

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <RestaurantSelector />
              </ProtectedRoute>
            }
          />
          <Route
            path="/restaurantes/:restauranteId/plano"
            element={
              <ProtectedRoute rolesPermitidos={["superadmin"]}>
                <PlanoEditor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/restaurantes/:restauranteId/reservas"
            element={
              <ProtectedRoute>
                <ReservasDelDia />
              </ProtectedRoute>
            }
          />
          <Route
            path="/restaurantes/:restauranteId/usuarios"
            element={
              <ProtectedRoute rolesPermitidos={["admin", "superadmin"]}>
                <UsuariosAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/restaurantes/:restauranteId/integraciones"
            element={
              <ProtectedRoute rolesPermitidos={["admin", "superadmin"]}>
                <IntegracionesAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/restaurantes/:restauranteId/clientes"
            element={
              <ProtectedRoute>
                <ClientesAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/restaurantes/:restauranteId/estadisticas"
            element={
              <ProtectedRoute rolesPermitidos={["admin", "superadmin"]}>
                <EstadisticasAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/restaurantes/:restauranteId/dias-especiales"
            element={
              <ProtectedRoute rolesPermitidos={["admin", "superadmin"]}>
                <DiasEspecialesAdmin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/restaurantes/:restauranteId/camarero"
            element={
              <ProtectedRoute>
                <CamareroView />
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
