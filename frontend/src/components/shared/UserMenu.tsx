import { useState } from "react"
import { useAuth } from "../../contexts/AuthContext"
import CambiarPasswordModal from "./CambiarPasswordModal"

export default function UserMenu() {
  const { usuario, logout } = useAuth()
  const [abierto, setAbierto] = useState(false)
  const [mostrarModal, setMostrarModal] = useState(false)
  if (!usuario) return null

  const iniciales = usuario.nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div className="relative">
      {/* Desplegable en todas las pantallas: ocupa lo mismo en móvil que en
          escritorio y deja sitio a la cabecera, que ya va cargada de menús. */}
      <button
        onClick={() => setAbierto((v) => !v)}
        className="flex items-center gap-2 rounded-lg p-1 transition hover:bg-panel-alt"
        aria-haspopup="menu"
        aria-expanded={abierto}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-ink">
          {iniciales}
        </span>
        <span className="hidden text-left leading-tight lg:block">
          <span className="block text-sm font-medium text-ink">{usuario.nombre}</span>
          <span className="block text-xs capitalize text-ink-muted">{usuario.rol}</span>
        </span>
        <span className="hidden text-xs text-ink-faint lg:inline">▾</span>
      </button>

      {abierto && (
        <>
          <button
            aria-label="Cerrar menú"
            onClick={() => setAbierto(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl border border-border bg-panel p-2 shadow-xl shadow-black/40"
          >
            <div className="border-b border-border px-3 pb-2 pt-1">
              <p className="truncate text-sm font-medium text-ink">{usuario.nombre}</p>
              <p className="truncate text-xs capitalize text-ink-muted">{usuario.rol}</p>
            </div>
            <button
              role="menuitem"
              onClick={() => {
                setAbierto(false)
                setMostrarModal(true)
              }}
              className="mt-1 block w-full rounded-md px-3 py-2.5 text-left text-sm text-ink transition hover:bg-panel-alt"
            >
              Cambiar contraseña
            </button>
            <button
              role="menuitem"
              onClick={logout}
              className="block w-full rounded-md px-3 py-2.5 text-left text-sm text-ink transition hover:bg-panel-alt"
            >
              Salir
            </button>
          </div>
        </>
      )}

      {mostrarModal && <CambiarPasswordModal onClose={() => setMostrarModal(false)} />}
    </div>
  )
}
