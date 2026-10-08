import { useEffect, useState, type FormEvent } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { actualizarUsuario, crearUsuario, listarUsuarios } from "../api/usuarios"
import UserMenu from "../components/shared/UserMenu"
import type { RolUsuario, Usuario } from "../types"

const ROL_LABELS: Record<RolUsuario, string> = {
  superadmin: "Superadmin",
  admin: "Administrador",
  manager: "Manager",
  staff: "Personal",
}

export default function UsuariosAdmin() {
  const { restauranteId } = useParams<{ restauranteId: string }>()
  const navigate = useNavigate()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [nombre, setNombre] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rol, setRol] = useState<RolUsuario>("staff")
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!restauranteId) return
    listarUsuarios(restauranteId)
      .then(setUsuarios)
      .catch(() => setError("No se pudieron cargar los usuarios."))
      .finally(() => setLoading(false))
  }, [restauranteId])

  function resetForm() {
    setNombre("")
    setEmail("")
    setPassword("")
    setRol("staff")
    setMostrarForm(false)
    setEditandoId(null)
  }

  function abrirEdicion(u: Usuario) {
    setNombre(u.nombre)
    setEmail(u.email)
    setPassword("")
    setRol(u.rol)
    setEditandoId(u.id)
    setMostrarForm(false)
  }

  async function handleCrear(e: FormEvent) {
    e.preventDefault()
    if (!restauranteId || !nombre.trim() || !email.trim() || password.length < 8) return
    setGuardando(true)
    setError(null)
    try {
      const nuevo = await crearUsuario(restauranteId, {
        nombre: nombre.trim(),
        email: email.trim(),
        password,
        rol,
      })
      setUsuarios((prev) => [...prev, nuevo])
      resetForm()
    } catch {
      setError("No se pudo crear el usuario (¿el email ya está en uso?).")
    } finally {
      setGuardando(false)
    }
  }

  async function handleGuardarEdicion(e: FormEvent) {
    e.preventDefault()
    if (!restauranteId || !editandoId) return
    setGuardando(true)
    setError(null)
    try {
      const payload: { nombre: string; rol: RolUsuario; password?: string } = {
        nombre: nombre.trim(),
        rol,
      }
      if (password) payload.password = password
      const actualizado = await actualizarUsuario(restauranteId, editandoId, payload)
      setUsuarios((prev) => prev.map((u) => (u.id === actualizado.id ? actualizado : u)))
      resetForm()
    } catch {
      setError("No se pudo actualizar el usuario.")
    } finally {
      setGuardando(false)
    }
  }

  async function toggleActivo(u: Usuario) {
    if (!restauranteId) return
    try {
      const actualizado = await actualizarUsuario(restauranteId, u.id, { activo: !u.activo })
      setUsuarios((prev) => prev.map((x) => (x.id === actualizado.id ? actualizado : x)))
    } catch {
      setError("No se pudo actualizar el usuario.")
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-ink-muted">
        Cargando...
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border bg-panel px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/restaurantes/${restauranteId}/reservas`)}
            className="rounded-md p-1.5 text-ink-muted transition hover:bg-panel-alt hover:text-ink"
            title="Volver"
          >
            ←
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">
              Gestión de usuarios
            </p>
            <h1 className="text-sm font-semibold text-ink">Personal del restaurante</h1>
          </div>
        </div>
        <UserMenu />
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto px-6 py-8">
        {error && (
          <div className="mb-4 flex items-center justify-between rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
            {error}
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
              ✕
            </button>
          </div>
        )}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-medium text-ink">Usuarios</h2>
          <button
            onClick={() => {
              resetForm()
              setMostrarForm(true)
            }}
            className="btn-primary"
          >
            + Nuevo usuario
          </button>
        </div>

        {(mostrarForm || editandoId) && (
          <form
            onSubmit={editandoId ? handleGuardarEdicion : handleCrear}
            className="card mb-6 flex flex-col gap-4 p-5"
          >
            <h3 className="text-sm font-semibold text-ink">
              {editandoId ? "Editar usuario" : "Nuevo usuario"}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-muted">Nombre</span>
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  required
                  className="input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-muted">Email</span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={!!editandoId}
                  className="input disabled:opacity-50"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-muted">Rol</span>
                <select
                  value={rol}
                  onChange={(e) => setRol(e.target.value as RolUsuario)}
                  className="input"
                >
                  <option value="admin">Administrador (todos los permisos)</option>
                  <option value="staff">Personal (reservas)</option>
                </select>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-muted">
                  {editandoId ? "Nueva contraseña (opcional)" : "Contraseña"}
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={!editandoId}
                  minLength={8}
                  placeholder={editandoId ? "Dejar en blanco para no cambiar" : undefined}
                  className="input"
                />
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetForm} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" disabled={guardando} className="btn-primary">
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        )}

        <div className="card divide-y divide-border overflow-hidden">
          {usuarios.map((u) => (
            <div key={u.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink">{u.nombre}</p>
                <p className="truncate text-xs text-ink-muted">{u.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="rounded-full bg-panel-alt px-2.5 py-1 text-xs font-medium text-ink-muted">
                  {ROL_LABELS[u.rol]}
                </span>
                <span
                  className={`h-2 w-2 rounded-full ${u.activo ? "bg-emerald-500" : "bg-ink-faint"}`}
                  title={u.activo ? "Activo" : "Desactivado"}
                />
                <button
                  onClick={() => abrirEdicion(u)}
                  className="text-xs font-medium text-accent hover:text-accent-hover"
                >
                  Editar
                </button>
                <button
                  onClick={() => toggleActivo(u)}
                  className="text-xs font-medium text-ink-muted hover:text-ink"
                >
                  {u.activo ? "Desactivar" : "Activar"}
                </button>
              </div>
            </div>
          ))}
          {usuarios.length === 0 && (
            <p className="px-5 py-8 text-center text-sm text-ink-muted">
              No hay usuarios todavía.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
