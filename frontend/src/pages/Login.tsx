import { useState, type FormEvent } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../contexts/AuthContext"
import { APP_NAME, FOOTER_TEXT } from "../lib/branding"

export default function Login() {
  const { login, cargando } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await login(email, password)
      navigate("/")
    } catch {
      setError("Email o contraseña incorrectos")
    }
  }

  return (
    <div className="hero-bg flex min-h-full flex-col px-4">
      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-sm">
          <div className="mb-8 text-center">
            <h1 className="font-serif text-4xl font-medium tracking-wide text-ink">{APP_NAME}</h1>
          </div>

          <form onSubmit={handleSubmit} className="card p-8 backdrop-blur-sm">
            <h2 className="mb-6 text-lg font-medium text-ink">Iniciar sesión</h2>

            {error && (
              <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <label className="mb-4 flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-muted">Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="input"
                placeholder="tu@restaurante.com"
              />
            </label>

            <label className="mb-7 flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-muted">Contraseña</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="input"
                placeholder="••••••••"
              />
            </label>

            <button type="submit" disabled={cargando} className="btn-primary w-full">
              {cargando ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>

      <p className="pb-6 text-center text-xs text-ink-faint">{FOOTER_TEXT}</p>
    </div>
  )
}
