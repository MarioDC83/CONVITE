import { useState, type FormEvent } from "react"
import { cambiarMiPassword } from "../../api/auth"

export default function CambiarPasswordModal({ onClose }: { onClose: () => void }) {
  const [passwordActual, setPasswordActual] = useState("")
  const [passwordNueva, setPasswordNueva] = useState("")
  const [passwordConfirmar, setPasswordConfirmar] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (passwordNueva.length < 8) {
      setError("La contraseña nueva debe tener al menos 8 caracteres.")
      return
    }
    if (passwordNueva !== passwordConfirmar) {
      setError("Las dos contraseñas nuevas no coinciden.")
      return
    }
    setGuardando(true)
    try {
      await cambiarMiPassword(passwordActual, passwordNueva)
      setExito(true)
    } catch (err: unknown) {
      const respuesta = (err as { response?: { status?: number } }).response
      setError(
        respuesta?.status === 400
          ? "La contraseña actual no es correcta."
          : "No se pudo cambiar la contraseña.",
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="card w-full max-w-sm p-6">
        {exito ? (
          <>
            <h2 className="mb-2 text-sm font-semibold text-ink">Contraseña actualizada</h2>
            <p className="mb-5 text-sm text-ink-muted">
              La próxima vez que inicies sesión, usa la contraseña nueva.
            </p>
            <button onClick={onClose} className="btn-primary w-full">
              Cerrar
            </button>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 className="mb-4 text-sm font-semibold text-ink">Cambiar contraseña</h2>

            {error && (
              <div className="mb-4 rounded-md border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <label className="mb-3 flex flex-col gap-1">
              <span className="text-xs font-medium text-ink-muted">Contraseña actual</span>
              <input
                type="password"
                value={passwordActual}
                onChange={(e) => setPasswordActual(e.target.value)}
                required
                autoFocus
                className="input"
              />
            </label>

            <label className="mb-3 flex flex-col gap-1">
              <span className="text-xs font-medium text-ink-muted">Contraseña nueva</span>
              <input
                type="password"
                value={passwordNueva}
                onChange={(e) => setPasswordNueva(e.target.value)}
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
                className="input"
              />
            </label>

            <label className="mb-5 flex flex-col gap-1">
              <span className="text-xs font-medium text-ink-muted">Repite la contraseña nueva</span>
              <input
                type="password"
                value={passwordConfirmar}
                onChange={(e) => setPasswordConfirmar(e.target.value)}
                required
                minLength={8}
                className="input"
              />
            </label>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" disabled={guardando} className="btn-primary">
                {guardando ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
