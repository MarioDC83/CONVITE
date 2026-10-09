import { useCallback, useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { obtenerPlano } from "../api/plano"
import {
  cambiarEstadoReserva,
  cancelarReserva,
  crearReserva,
  extraerMensajeError,
  listarReservas,
} from "../api/reservas"
import { actualizarTurno, crearTurno, listarTurnos } from "../api/turnos"
import ListaEsperaPanel from "../components/reservas/ListaEsperaPanel"
import ReservaCanvas from "../components/reservas/ReservaCanvas"
import ReservaDetailPanel from "../components/reservas/ReservaDetailPanel"
import ReservaFormCreate from "../components/reservas/ReservaFormCreate"
import ReservasList from "../components/reservas/ReservasList"
import TurnoDatePicker from "../components/reservas/TurnoDatePicker"
import UserMenu from "../components/shared/UserMenu"
import ZonaFilterBar from "../components/shared/ZonaFilterBar"
import { useAuth } from "../contexts/AuthContext"
import { useReservasSocket } from "../hooks/useReservasSocket"
import { estadoVisualMesa, reservaActivaParaMesa } from "../lib/estadoMesa"
import type { EstadoReserva, Mesa, Reserva, Restaurante, Turno, Zona } from "../types"

function hoyISO(): string {
  return new Date().toISOString().slice(0, 10)
}

type Modo = { tipo: "crear"; mesa: Mesa } | { tipo: "detalle"; reservaId: string } | null

export default function ReservasDelDia() {
  const { restauranteId } = useParams<{ restauranteId: string }>()
  const navigate = useNavigate()
  const { usuario } = useAuth()
  const esAdmin = usuario?.rol === "admin" || usuario?.rol === "superadmin"
  const esSuperadmin = usuario?.rol === "superadmin"
  const [menuAbierto, setMenuAbierto] = useState(false)

  // Una sola lista para el menú en línea (pantalla ancha) y el desplegable (móvil).
  const enlacesMenu = [
    ...(esSuperadmin ? [{ ruta: "plano", texto: "Editor de plano" }] : []),
    { ruta: "camarero", texto: "Vista camarero" },
    { ruta: "clientes", texto: "Clientes" },
    ...(esAdmin
      ? [
          { ruta: "estadisticas", texto: "Estadísticas" },
          { ruta: "dias-especiales", texto: "Días especiales" },
          { ruta: "usuarios", texto: "Usuarios" },
          { ruta: "integraciones", texto: "Integraciones" },
        ]
      : []),
  ]

  const [restaurante, setRestaurante] = useState<Restaurante | null>(null)
  const [zonas, setZonas] = useState<Zona[]>([])
  const [mesas, setMesas] = useState<Mesa[]>([])
  const [turnos, setTurnos] = useState<Turno[]>([])
  const [reservas, setReservas] = useState<Reserva[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const [fecha, setFecha] = useState(hoyISO())
  const [turnoId, setTurnoId] = useState<string | null>(null)
  const [vista, setVista] = useState<"plano" | "lista" | "espera">("plano")
  const [modo, setModo] = useState<Modo>(null)
  // null = mostrar todas las zonas a la vez en el plano.
  const [filtroZonaId, setFiltroZonaId] = useState<string | null>(null)

  const [canvasWrapperEl, setCanvasWrapperEl] = useState<HTMLElement | null>(null)
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })

  useEffect(() => {
    if (!restauranteId) return
    Promise.all([obtenerPlano(restauranteId), listarTurnos(restauranteId)])
      .then(([plano, turnosData]) => {
        setRestaurante(plano.restaurante)
        setZonas(plano.zonas)
        setMesas(plano.mesas)
        setTurnos(turnosData)
        setTurnoId((prev) => prev ?? turnosData[0]?.id ?? null)
      })
      .catch(() => setError("No se pudo cargar el restaurante."))
      .finally(() => setLoading(false))
  }, [restauranteId])

  useEffect(() => {
    if (!restauranteId || !turnoId) {
      setReservas([])
      return
    }
    listarReservas(restauranteId, { fecha, turnoId })
      .then(setReservas)
      .catch(() => setError("No se pudieron cargar las reservas de este turno."))
  }, [restauranteId, fecha, turnoId])

  useEffect(() => {
    // canvasWrapperEl solo existe una vez montado el <main> real (no durante la
    // carga inicial), así que este efecto debe re-ejecutarse cuando aparece.
    if (!canvasWrapperEl) return
    // Medida inmediata: no depende de que el navegador llegue a pintar un
    // fotograma (el observer solo avisa en el siguiente) y evita que el plano
    // arranque con el tamaño por defecto de 800x600 en una pantalla estrecha.
    setCanvasSize({ width: canvasWrapperEl.clientWidth, height: canvasWrapperEl.clientHeight })
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setCanvasSize({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(canvasWrapperEl)
    return () => observer.disconnect()
  }, [canvasWrapperEl])

  const mergeReserva = useCallback(
    (incoming: Reserva) => {
      if (incoming.fecha !== fecha || incoming.turno_id !== turnoId) return
      setReservas((prev) => {
        const idx = prev.findIndex((r) => r.id === incoming.id)
        if (idx === -1) return [...prev, incoming]
        const copia = [...prev]
        copia[idx] = incoming
        return copia
      })
    },
    [fecha, turnoId],
  )

  const { conectado } = useReservasSocket(restauranteId, (event) => mergeReserva(event.reserva))

  function handleSelectMesa(mesaId: string) {
    if (!turnoId) {
      setError("Selecciona o crea un turno antes de gestionar reservas.")
      return
    }
    const mesa = mesas.find((m) => m.id === mesaId)
    if (!mesa) return
    const estado = estadoVisualMesa(mesaId, reservas)
    setFormError(null)
    if (estado === "libre") {
      setModo({ tipo: "crear", mesa })
    } else {
      const activa = reservaActivaParaMesa(mesaId, reservas)
      if (activa) setModo({ tipo: "detalle", reservaId: activa.id })
    }
  }

  function handleSelectReservaFromList(reservaId: string) {
    setModo({ tipo: "detalle", reservaId })
  }

  async function handleCrearReserva(payload: {
    cliente_nombre: string
    cliente_telefono: string
    num_personas: number
    hora: string
    notas: string
  }) {
    if (!restauranteId || !turnoId || modo?.tipo !== "crear") return
    setFormError(null)
    try {
      const nueva = await crearReserva(restauranteId, {
        cliente_nombre: payload.cliente_nombre,
        cliente_telefono: payload.cliente_telefono || undefined,
        num_personas: payload.num_personas,
        hora: payload.hora,
        notas: payload.notas || undefined,
        fecha,
        turno_id: turnoId,
        mesa_ids: [modo.mesa.id],
      })
      mergeReserva(nueva)
      setModo(null)
    } catch (err) {
      setFormError(extraerMensajeError(err, "No se pudo crear la reserva."))
    }
  }

  async function handleCambiarEstado(estado: EstadoReserva) {
    if (!restauranteId || modo?.tipo !== "detalle") return
    try {
      const actualizada = await cambiarEstadoReserva(restauranteId, modo.reservaId, estado)
      mergeReserva(actualizada)
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo actualizar la reserva."))
    }
  }

  async function handleCancelar() {
    if (!restauranteId || modo?.tipo !== "detalle") return
    if (!confirm("¿Cancelar esta reserva?")) return
    try {
      const cancelada = await cancelarReserva(restauranteId, modo.reservaId)
      mergeReserva(cancelada)
      setModo(null)
    } catch (err) {
      setError(extraerMensajeError(err, "No se pudo cancelar la reserva."))
    }
  }

  async function handleCrearTurno(payload: { nombre: string; hora_inicio: string; hora_fin: string }) {
    if (!restauranteId) return
    const nuevo = await crearTurno(restauranteId, payload)
    setTurnos((prev) => [...prev, nuevo])
    setTurnoId(nuevo.id)
  }

  async function handleEditarTurno(
    turnoIdAEditar: string,
    payload: { nombre: string; hora_inicio: string; hora_fin: string },
  ) {
    if (!restauranteId) return
    const actualizado = await actualizarTurno(restauranteId, turnoIdAEditar, payload)
    setTurnos((prev) => prev.map((t) => (t.id === actualizado.id ? actualizado : t)))
  }

  const reservaSeleccionada =
    modo?.tipo === "detalle" ? reservas.find((r) => r.id === modo.reservaId) ?? null : null
  const selectedMesaId =
    modo?.tipo === "crear" ? modo.mesa.id : (reservaSeleccionada?.mesas[0]?.id ?? null)
  const mesasVisibles = filtroZonaId ? mesas.filter((m) => m.zona_id === filtroZonaId) : mesas

  useEffect(() => {
    if (modo?.tipo === "crear" && filtroZonaId && modo.mesa.zona_id !== filtroZonaId) {
      setModo(null)
    }
  }, [filtroZonaId, modo])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center text-sm text-ink-muted">
        Cargando...
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
      <header className="relative flex items-center justify-between gap-3 border-b border-border bg-panel px-3 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate("/")}
            className="shrink-0 rounded-md p-1.5 text-ink-muted transition hover:bg-panel-alt hover:text-ink"
            title="Volver a restaurantes"
          >
            ←
          </button>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold uppercase tracking-wide text-accent">
              Reservas del día
            </p>
            <h1 className="truncate text-sm font-semibold text-ink">{restaurante.nombre}</h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:gap-5">
          {/* Pantalla ancha: menús en línea. Estrecha: botón "Menú" (abajo). */}
          <nav className="hidden items-center gap-5 xl:flex">
            {enlacesMenu.map((e) => (
              <button
                key={e.ruta}
                onClick={() => navigate(`/restaurantes/${restauranteId}/${e.ruta}`)}
                className="text-sm font-medium text-ink-muted transition hover:text-accent"
              >
                {e.texto}
              </button>
            ))}
          </nav>
          <button
            onClick={() => setMenuAbierto((v) => !v)}
            className="rounded-md border border-border-strong px-3 py-1.5 text-sm font-medium text-ink transition hover:border-accent hover:text-accent xl:hidden"
            aria-expanded={menuAbierto}
          >
            ☰ Menú
          </button>
          <span
            className="flex items-center gap-1.5 text-xs text-ink-faint"
            title={conectado ? "En vivo" : "Reconectando..."}
          >
            <span className={`h-2 w-2 rounded-full ${conectado ? "bg-emerald-500" : "bg-ink-faint"}`} />
            <span className="hidden sm:inline">{conectado ? "En vivo" : "Reconectando..."}</span>
          </span>
          <UserMenu />
        </div>

        {menuAbierto && (
          <nav className="absolute inset-x-0 top-full z-30 border-b border-border bg-panel shadow-xl shadow-black/40 xl:hidden">
            {enlacesMenu.map((e) => (
              <button
                key={e.ruta}
                onClick={() => navigate(`/restaurantes/${restauranteId}/${e.ruta}`)}
                className="block w-full border-b border-border/60 px-5 py-3.5 text-left text-sm font-medium text-ink transition last:border-b-0 hover:bg-panel-alt hover:text-accent"
              >
                {e.texto}
              </button>
            ))}
          </nav>
        )}
      </header>

      <TurnoDatePicker
        fecha={fecha}
        onFechaChange={setFecha}
        turnos={turnos}
        turnoId={turnoId}
        onTurnoChange={setTurnoId}
        onCrearTurno={handleCrearTurno}
        onEditarTurno={handleEditarTurno}
        puedeGestionar={esAdmin}
      />

      <div className="flex flex-wrap items-center gap-1 border-b border-border bg-panel px-3 py-2 sm:px-5">
        {(["plano", "lista", "espera"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setVista(v)}
            className={`rounded-md px-3 py-1 text-sm font-medium transition ${
              vista === v ? "bg-accent-soft text-accent" : "text-ink-muted hover:bg-panel-alt"
            }`}
          >
            {v === "plano" ? "Plano" : v === "lista" ? "Lista" : "Espera"}
          </button>
        ))}
        <div className="flex w-full items-center gap-3 pt-1 text-xs text-ink-muted sm:ml-4 sm:w-auto sm:pt-0">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Libre
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Reservada
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Sentada
          </span>
        </div>
      </div>

      {vista === "plano" && (
        <ZonaFilterBar zonas={zonas} filtroZonaId={filtroZonaId} onChange={setFiltroZonaId} mesas={mesas} />
      )}

      {error && (
        <div className="flex items-center justify-between border-b border-red-900/50 bg-red-950/40 px-5 py-2 text-sm text-red-300">
          {error}
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-200">
            ✕
          </button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <main ref={setCanvasWrapperEl} className="relative flex-1 overflow-hidden">
          {vista === "plano" ? (
            <ReservaCanvas
              mesas={mesasVisibles}
              reservas={reservas}
              selectedMesaId={selectedMesaId}
              onSelectMesa={handleSelectMesa}
              width={canvasSize.width}
              height={canvasSize.height}
            />
          ) : vista === "lista" ? (
            <div className="h-full overflow-y-auto bg-page">
              <ReservasList
                reservas={reservas}
                selectedReservaId={modo?.tipo === "detalle" ? modo.reservaId : null}
                onSelect={handleSelectReservaFromList}
              />
            </div>
          ) : (
            restauranteId && (
              <ListaEsperaPanel restauranteId={restauranteId} fecha={fecha} turnos={turnos} />
            )
          )}
        </main>

        {modo && (
          // Escritorio: panel lateral de 320 px. Móvil: hoja que sube desde
          // abajo (si no, 320 px de panel dejan el plano en una rendija).
          <aside className="fixed inset-x-0 bottom-0 z-40 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-border bg-panel shadow-2xl shadow-black/50 md:static md:inset-auto md:z-auto md:max-h-none md:w-80 md:shrink-0 md:overflow-visible md:rounded-none md:border-l md:border-t-0 md:shadow-none">
            {modo.tipo === "crear" && (
              <ReservaFormCreate
                mesa={modo.mesa}
                error={formError}
                onSubmit={handleCrearReserva}
                onClose={() => setModo(null)}
              />
            )}
            {modo.tipo === "detalle" && reservaSeleccionada && (
              <ReservaDetailPanel
                reserva={reservaSeleccionada}
                onCambiarEstado={handleCambiarEstado}
                onCancelar={handleCancelar}
                onClose={() => setModo(null)}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
