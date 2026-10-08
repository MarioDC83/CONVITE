import { useState } from "react"
import { useAuth } from "../../contexts/AuthContext"
import CambiarPasswordModal from "./CambiarPasswordModal"

export default function UserMenu() {
  const { usuario, logout } = useAuth()
  const [mostrarModal, setMostrarModal] = useState(false)
  if (!usuario) return null

  const iniciales = usuario.nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-ink">
          {iniciales}
        </div>
        <div className="hidden leading-tight sm:block">
          <p className="text-sm font-medium text-ink">{usuario.nombre}</p>
          <p className="text-xs capitalize text-ink-muted">{usuario.rol}</p>
        </div>
      </div>
      <button
        onClick={() => setMostrarModal(true)}
        className="text-xs font-medium text-ink-muted transition hover:text-accent"
      >
        Cambiar contraseña
      </button>
      <button
        onClick={logout}
        className="text-xs font-medium text-ink-muted transition hover:text-accent"
      >
        Salir
      </button>

      {mostrarModal && <CambiarPasswordModal onClose={() => setMostrarModal(false)} />}
    </div>
  )
}
