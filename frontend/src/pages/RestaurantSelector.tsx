import { useEffect, useState, type FormEvent } from "react"
import { Navigate, useNavigate } from "react-router-dom"
import { crearRestaurante, listarRestaurantes } from "../api/restaurantes"
import UserMenu from "../components/shared/UserMenu"
import { useAuth } from "../contexts/AuthContext"
import { APP_NAME, FOOTER_TEXT } from "../lib/branding"
import type { Restaurante } from "../types"

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
}

export default function RestaurantSelector() {
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const esSuperadmin = usuario?.rol === "superadmin"
  const [restaurantes, setRestaurantes] = useState<Restaurante[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [nombre, setNombre] = useState("")
  const [ciudad, setCiudad] = useState("")
  const [adminNombre, setAdminNombre] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    cargarRestaurantes()
  }, [])

  async function cargarRestaurantes() {
    setLoading(true)
    setError(null)
    try {
      const data = await listarRestaurantes()
      setRestaurantes(data)
    } catch {
      setError("No se pudo conectar con el backend. Comprueba que esté levantado en el puerto 8000.")
    } finally {
      setLoading(false)
    }
  }

  async function handleCrear(e: FormEvent) {
    e.preventDefault()
    if (!nombre.trim() || !adminNombre.trim() || !adminEmail.trim() || adminPassword.length < 8) return
    setCreating(true)
    try {
      const nuevo = await crearRestaurante({
        nombre: nombre.trim(),
        slug: slugify(nombre),
        ciudad: ciudad.trim() || null,
        admin_nombre: adminNombre.trim(),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword,
      })
      setRestaurantes((prev) => [...prev, nuevo])
      setNombre("")
      setCiudad("")
      setAdminNombre("")
      setAdminEmail("")
      setAdminPassword("")
      setShowForm(false)
      // Restaurante nuevo = plano vacío: en vez de dejarlo en la lista, se
      // lleva directo al editor con el asistente de configuración inicial.
      navigate(`/restaurantes/${nuevo.id}/plano?onboarding=1`)
      return
    } catch {
      setError("No se pudo crear el restaurante. Revisa que el slug y el email de admin no estén ya en uso.")
    } finally {
      setCreating(false)
    }
  }

  // El admin/staff de un restaurante no gestiona más que el suyo propio: se
  // salta el selector y entra directo a sus reservas. Solo AutoCore
  // (superadmin) ve la lista completa y puede dar de alta restaurantes.
  if (usuario && !esSuperadmin) {
    if (usuario.restaurante_id) {
      return <Navigate to={`/restaurantes/${usuario.restaurante_id}/reservas`} replace />
    }
    return (
      <div className="flex h-screen items-center justify-center text-sm text-ink-muted">
        Tu usuario no está asignado a ningún restaurante. Contacta con AutoCore.
      </div>
    )
  }

  return (
    <div className="min-h-full">
      <header className="hero-bg border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-10">
          <div>
            <h1 className="font-serif text-3xl font-medium tracking-wide text-ink">{APP_NAME}</h1>
          </div>
          <div className="flex items-center gap-4">
            <UserMenu />
            <button onClick={() => setShowForm((v) => !v)} className="btn-primary">
              + Nuevo restaurante
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-10">
        <h2 className="mb-1 text-lg font-medium text-ink">Selecciona un restaurante</h2>
        <p className="mb-6 text-sm text-ink-muted">
          Elige un cliente para abrir su editor de plano de mesas o sus reservas.
        </p>

        {showForm && (
          <form onSubmit={handleCrear} className="card mb-8 flex flex-col gap-4 p-5">
            <h3 className="text-sm font-semibold text-ink">Nuevo restaurante</h3>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-muted">Nombre del restaurante</span>
                <input
                  autoFocus
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="La Terraza de Madrid"
                  className="input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-muted">Ciudad</span>
                <input
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  placeholder="Madrid"
                  className="input"
                />
              </label>
            </div>
            {nombre.trim() && <p className="text-xs text-ink-faint">slug: {slugify(nombre)}</p>}

            <div className="my-1 border-t border-border" />
            <p className="text-xs font-medium text-ink-muted">
              Cuenta del administrador (acceso completo a este restaurante)
            </p>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-muted">Tu nombre</span>
                <input
                  value={adminNombre}
                  onChange={(e) => setAdminNombre(e.target.value)}
                  placeholder="Ana García"
                  className="input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-muted">Email</span>
                <input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                  placeholder="ana@restaurante.com"
                  className="input"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-ink-muted">Contraseña</span>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  className="input"
                />
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  creating ||
                  !nombre.trim() ||
                  !adminNombre.trim() ||
                  !adminEmail.trim() ||
                  adminPassword.length < 8
                }
                className="btn-primary"
              >
                {creating ? "Creando..." : "Crear restaurante"}
              </button>
            </div>
          </form>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-900/50 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-ink-muted">Cargando restaurantes...</p>
        ) : restaurantes.length === 0 ? (
          <div className="card border-dashed px-6 py-12 text-center">
            <p className="text-sm text-ink-muted">Todavía no hay restaurantes.</p>
            <p className="mt-1 text-sm text-ink-faint">Crea el primero con el botón de arriba.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {restaurantes.map((r) => (
              <div
                key={r.id}
                className="card group flex flex-col items-start p-5 text-left transition hover:-translate-y-0.5 hover:border-accent"
              >
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-accent-soft text-lg font-semibold text-accent">
                  {r.nombre.charAt(0).toUpperCase()}
                </div>
                <h3 className="font-medium text-ink group-hover:text-accent">{r.nombre}</h3>
                <p className="mt-0.5 text-sm text-ink-muted">
                  {r.ciudad ?? "Sin ciudad"} · {r.slug}
                </p>
                <div className="mt-3 flex gap-4">
                  <button
                    onClick={() => navigate(`/restaurantes/${r.id}/reservas`)}
                    className="text-xs font-medium text-accent hover:text-accent-hover"
                  >
                    Reservas del día →
                  </button>
                  <button
                    onClick={() => navigate(`/restaurantes/${r.id}/plano`)}
                    className="text-xs font-medium text-ink-muted hover:text-ink"
                  >
                    Editor de plano →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="px-6 pb-8">
        <p className="text-center text-xs text-ink-faint">{FOOTER_TEXT}</p>
      </footer>
    </div>
  )
}
