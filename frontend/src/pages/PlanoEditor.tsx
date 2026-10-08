import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { actualizarMesa, crearMesa, eliminarMesa } from "../api/mesas"
import { guardarPlano, obtenerPlano } from "../api/plano"
import { actualizarZona, crearZona, eliminarZona } from "../api/zonas"
import CanvasStage from "../components/editor/CanvasStage"
import MesaEditPanel from "../components/editor/MesaEditPanel"
import ShapePalette from "../components/editor/ShapePalette"
import Toolbar from "../components/editor/Toolbar"
import ZonePanel from "../components/editor/ZonePanel"
import ZonaFilterBar from "../components/shared/ZonaFilterBar"
import type { FormaMesa, Mesa, Restaurante, Zona } from "../types"

const FORMA_DEFAULTS: Record<
  FormaMesa,
  { ancho: number; alto: number; capacidad: number; capacidad_min: number; capacidad_max: number }
> = {
  circular: { ancho: 80, alto: 80, capacidad: 2, capacidad_min: 1, capacidad_max: 2 },
  cuadrada: { ancho: 80, alto: 80, capacidad: 4, capacidad_min: 2, capacidad_max: 4 },
  rectangular: { ancho: 130, alto: 75, capacidad: 6, capacidad_min: 4, capacidad_max: 6 },
  ovalada: { ancho: 140, alto: 90, capacidad: 8, capacidad_min: 6, capacidad_max: 8 },
}

export default function PlanoEditor() {
  const { restauranteId } = useParams<{ restauranteId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const onboarding = searchParams.get("onboarding") === "1"

  const [restaurante, setRestaurante] = useState<Restaurante | null>(null)
  const [zonas, setZonas] = useState<Zona[]>([])
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [selectedMesaId, setSelectedMesaId] = useState<string | null>(null)
  const [activeZonaId, setActiveZonaId] = useState<string | null>(null)
  // null = mostrar todas las zonas a la vez en el plano.
  const [filtroZonaId, setFiltroZonaId] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)

  const [canvasWrapperEl, setCanvasWrapperEl] = useState<HTMLElement | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })

  useEffect(() => {
    if (!restauranteId) return
    setLoading(true)
    obtenerPlano(restauranteId)
      .then((plano) => {
        setRestaurante(plano.restaurante)
        setZonas(plano.zonas)
        setMesas(plano.mesas)
        setActiveZonaId((prev) => prev ?? plano.zonas[0]?.id ?? null)
      })
      .catch(() => setError("No se pudo cargar el plano de este restaurante."))
      .finally(() => setLoading(false))
  }, [restauranteId])

  useEffect(() => {
    // canvasWrapperEl solo existe una vez montado el <main> real (no durante el
    // "Cargando..." inicial), así que este efecto debe re-ejecutarse cuando
    // aparece; un useEffect(() => {...}, []) con useRef se quedaría enganchado
    // a un elemento nulo para siempre si el ref se adjunta después del mount.
    if (!canvasWrapperEl) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height })
      }
    })
    observer.observe(canvasWrapperEl)
    return () => observer.disconnect()
  }, [canvasWrapperEl])

  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [dirty])

  const selectedMesa = mesas.find((m) => m.id === selectedMesaId) ?? null
  const mesasVisibles = filtroZonaId ? mesas.filter((m) => m.zona_id === filtroZonaId) : mesas

  useEffect(() => {
    if (selectedMesa && filtroZonaId && selectedMesa.zona_id !== filtroZonaId) {
      setSelectedMesaId(null)
    }
  }, [filtroZonaId, selectedMesa])

  const handleChangeMesaGeometry = useCallback(
    (id: string, attrs: { pos_x: number; pos_y: number; ancho: number; alto: number; rotacion: number }) => {
      setMesas((prev) => prev.map((m) => (m.id === id ? { ...m, ...attrs } : m)))
      setDirty(true)
    },
    [],
  )

  async function handleDropForma(forma: FormaMesa, pos: { x: number; y: number }) {
    if (!restauranteId) return
    if (!activeZonaId) {
      setError("Selecciona o crea una zona antes de añadir mesas.")
      return
    }
    const defaults = FORMA_DEFAULTS[forma]
    try {
      const nueva = await crearMesa(restauranteId, {
        zona_id: activeZonaId,
        nombre: `Mesa ${mesas.length + 1}`,
        forma,
        pos_x: pos.x,
        pos_y: pos.y,
        ...defaults,
      })
      setMesas((prev) => [...prev, nueva])
      setSelectedMesaId(nueva.id)
    } catch {
      setError("No se pudo crear la mesa.")
    }
  }

  async function handleUpdateMesa(id: string, attrs: Partial<Mesa>) {
    if (!restauranteId) return
    try {
      const actualizada = await actualizarMesa(restauranteId, id, attrs)
      setMesas((prev) => prev.map((m) => (m.id === id ? actualizada : m)))
    } catch {
      setError("No se pudo actualizar la mesa.")
    }
  }

  async function handleDeleteMesa(id: string) {
    if (!restauranteId) return
    try {
      await eliminarMesa(restauranteId, id)
      setMesas((prev) => prev.filter((m) => m.id !== id))
      setSelectedMesaId(null)
    } catch {
      setError("No se pudo eliminar la mesa.")
    }
  }

  async function handleCreateZona(nombre: string, color: string) {
    if (!restauranteId) return
    const nueva = await crearZona(restauranteId, { nombre, color })
    setZonas((prev) => [...prev, nueva])
    setActiveZonaId(nueva.id)
    // Filtra el plano a la zona recién creada: al no tener mesas todavía, se ve
    // como un lienzo limpio en vez de mezclarse con las mesas de otras zonas.
    setFiltroZonaId(nueva.id)
  }

  async function handleRenameZona(id: string, nombre: string) {
    if (!restauranteId) return
    const actualizada = await actualizarZona(restauranteId, id, { nombre })
    setZonas((prev) => prev.map((z) => (z.id === id ? actualizada : z)))
  }

  async function handleRecolorZona(id: string, color: string) {
    if (!restauranteId) return
    const actualizada = await actualizarZona(restauranteId, id, { color })
    setZonas((prev) => prev.map((z) => (z.id === id ? actualizada : z)))
  }

  async function handleDeleteZona(id: string) {
    if (!restauranteId) return
    await eliminarZona(restauranteId, id)
    setZonas((prev) => prev.filter((z) => z.id !== id))
    setMesas((prev) => prev.filter((m) => m.zona_id !== id))
    setActiveZonaId((prev) => (prev === id ? null : prev))
    setFiltroZonaId((prev) => (prev === id ? null : prev))
    if (selectedMesa?.zona_id === id) setSelectedMesaId(null)
  }

  async function handleGuardarPlano() {
    if (!restauranteId) return
    setSaving(true)
    setError(null)
    try {
      const payload = mesas.map((m) => ({
        id: m.id,
        pos_x: m.pos_x,
        pos_y: m.pos_y,
        ancho: m.ancho,
        alto: m.alto,
        rotacion: m.rotacion,
      }))
      const plano = await guardarPlano(restauranteId, payload)
      setMesas(plano.mesas)
      setDirty(false)
      setSavedAt(new Date())
    } catch {
      setError("No se pudo guardar el plano. Inténtalo de nuevo.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-ink-muted">
        Cargando plano...
      </div>
    )
  }

  if (!restaurante) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-red-400">
        {error ?? "Restaurante no encontrado."}
      </div>
    )
  }

  return (
    <div className="flex h-screen flex-col">
      <Toolbar
        restaurante={restaurante}
        dirty={dirty}
        saving={saving}
        savedAt={savedAt}
        onSave={handleGuardarPlano}
      />

      {onboarding && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-accent/40 bg-accent-soft px-5 py-2.5">
          <p className="text-sm text-ink">
            <span className="font-semibold text-accent">Configuración inicial</span> — crea las
            zonas (Salón, Terraza...) y arrastra mesas al plano. Los turnos ya vienen con Comidas y
            Cenas por defecto.
          </p>
          <button
            onClick={() => navigate(`/restaurantes/${restauranteId}/reservas`)}
            className="btn-primary shrink-0 text-xs"
          >
            Finalizar configuración →
          </button>
        </div>
      )}

      <ZonaFilterBar zonas={zonas} filtroZonaId={filtroZonaId} onChange={setFiltroZonaId} mesas={mesas} />

      {error && (
        <div className="flex items-center justify-between border-b border-red-900/50 bg-red-950/40 px-5 py-2 text-sm text-red-300">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 shrink-0 overflow-y-auto border-r border-border bg-panel p-4">
          <ShapePalette disabled={!activeZonaId} />
          <div className="my-5 border-t border-border" />
          <ZonePanel
            zonas={zonas}
            activeZonaId={activeZonaId}
            onSelectActive={setActiveZonaId}
            onCreate={handleCreateZona}
            onRename={handleRenameZona}
            onRecolor={handleRecolorZona}
            onDelete={handleDeleteZona}
          />
        </aside>

        <main ref={setCanvasWrapperEl} className="relative flex-1 overflow-hidden">
          <CanvasStage
            mesas={mesasVisibles}
            zonas={zonas}
            selectedMesaId={selectedMesaId}
            onSelectMesa={setSelectedMesaId}
            onChangeMesaGeometry={handleChangeMesaGeometry}
            onDropForma={handleDropForma}
            width={canvasSize.width}
            height={canvasSize.height}
          />
        </main>

        {selectedMesa && (
          <aside className="w-72 shrink-0 border-l border-border bg-panel">
            <MesaEditPanel
              mesa={selectedMesa}
              zonas={zonas}
              onUpdate={handleUpdateMesa}
              onDelete={handleDeleteMesa}
              onClose={() => setSelectedMesaId(null)}
            />
          </aside>
        )}
      </div>
    </div>
  )
}
