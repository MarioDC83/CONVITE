import type Konva from "konva"
import { useEffect, useMemo, useRef, useState } from "react"
import { Layer, Stage } from "react-konva"
import { estadoVisualMesa, reservaActivaParaMesa } from "../../lib/estadoMesa"
import type { Mesa, Reserva } from "../../types"
import ReservaMesaNode from "./ReservaMesaNode"

interface ReservaCanvasProps {
  mesas: Mesa[]
  reservas: Reserva[]
  selectedMesaId: string | null
  onSelectMesa: (mesaId: string) => void
  width: number
  height: number
}

interface Vista {
  escala: number
  x: number
  y: number
}

const MARGEN = 24
const ESCALA_MIN = 0.25
const ESCALA_MAX = 2.5
// Por debajo de este ancho (móvil / tablet vertical) el plano se puede
// arrastrar con el dedo y ampliar con pellizco; por encima se queda como
// siempre, sin arrastre.
const ANCHO_TACTIL = 768

const acotar = (v: number) => Math.min(ESCALA_MAX, Math.max(ESCALA_MIN, v))

/** Rectángulo que contiene todas las mesas (con holgura por si están rotadas). */
function limites(mesas: Mesa[]) {
  if (mesas.length === 0) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const m of mesas) {
    const r = Math.max(m.ancho, m.alto) / 2
    minX = Math.min(minX, m.pos_x - r)
    minY = Math.min(minY, m.pos_y - r)
    maxX = Math.max(maxX, m.pos_x + r)
    maxY = Math.max(maxY, m.pos_y + r)
  }
  return { minX, minY, maxX, maxY }
}

export default function ReservaCanvas({
  mesas,
  reservas,
  selectedMesaId,
  onSelectMesa,
  width,
  height,
}: ReservaCanvasProps) {
  const layerRef = useRef<Konva.Layer>(null)

  // Igual que en el editor: react-konva no siempre repinta solo con el cambio
  // de props, así que forzamos el redraw cuando cambian mesas o reservas.
  useEffect(() => {
    layerRef.current?.batchDraw()
  }, [mesas, reservas])

  // Vista que deja TODAS las mesas a la vista. Nunca amplía por encima de 1
  // (así, en pantallas grandes el plano queda en su tamaño y posición de siempre).
  const ajuste = useMemo<Vista>(() => {
    const b = limites(mesas)
    if (!b || width <= 0 || height <= 0) return { escala: 1, x: 0, y: 0 }
    const w = b.maxX - b.minX
    const h = b.maxY - b.minY
    const escala = Math.min(1, (width - 2 * MARGEN) / w, (height - 2 * MARGEN) / h)
    if (escala >= 1) return { escala: 1, x: 0, y: 0 }
    const e = acotar(escala)
    return {
      escala: e,
      x: (width - w * e) / 2 - b.minX * e,
      y: (height - h * e) / 2 - b.minY * e,
    }
  }, [mesas, width, height])

  const [vista, setVista] = useState<Vista>(ajuste)
  // Si la persona ya ha movido o ampliado el plano, un cambio de tamaño de la
  // ventana (p. ej. la barra de direcciones del móvil) no debe deshacérselo.
  const tocadoRef = useRef(false)
  const firmaMesas = mesas.map((m) => m.id).join(",")

  useEffect(() => {
    tocadoRef.current = false // otra zona u otras mesas: volver a ajustar
  }, [firmaMesas])

  useEffect(() => {
    if (!tocadoRef.current) setVista(ajuste)
  }, [ajuste])

  const tactil = width < ANCHO_TACTIL

  function zoom(factor: number) {
    tocadoRef.current = true
    setVista((v) => {
      const escala = acotar(v.escala * factor)
      const cx = width / 2
      const cy = height / 2
      const px = (cx - v.x) / v.escala
      const py = (cy - v.y) / v.escala
      return { escala, x: cx - px * escala, y: cy - py * escala }
    })
  }

  function reajustar() {
    tocadoRef.current = false
    setVista(ajuste)
  }

  // Pellizco con dos dedos: amplía/reduce alrededor del punto medio.
  const ultimoPellizco = useRef<{ dist: number; cx: number; cy: number } | null>(null)

  function onTouchMove(e: Konva.KonvaEventObject<TouchEvent>) {
    const [t1, t2] = [e.evt.touches[0], e.evt.touches[1]]
    if (!t1 || !t2) return
    e.evt.preventDefault()
    const stage = e.target.getStage()
    if (!stage) return
    if (stage.isDragging()) stage.stopDrag()

    const caja = stage.container().getBoundingClientRect()
    const p1 = { x: t1.clientX - caja.left, y: t1.clientY - caja.top }
    const p2 = { x: t2.clientX - caja.left, y: t2.clientY - caja.top }
    const cx = (p1.x + p2.x) / 2
    const cy = (p1.y + p2.y) / 2
    const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y)

    const previo = ultimoPellizco.current
    ultimoPellizco.current = { dist, cx, cy }
    if (!previo || previo.dist === 0) return

    tocadoRef.current = true
    setVista((v) => {
      const escala = acotar(v.escala * (dist / previo.dist))
      const px = (previo.cx - v.x) / v.escala
      const py = (previo.cy - v.y) / v.escala
      return { escala, x: cx - px * escala, y: cy - py * escala }
    })
  }

  return (
    <div
      className="relative h-full w-full bg-page bg-[radial-gradient(circle,#33343d_1px,transparent_1px)] bg-[length:22px_22px]"
      style={tactil ? { touchAction: "none" } : undefined}
    >
      <Stage
        width={width}
        height={height}
        x={vista.x}
        y={vista.y}
        scaleX={vista.escala}
        scaleY={vista.escala}
        draggable={tactil}
        onDragEnd={(e) => {
          if (e.target !== e.target.getStage()) return
          tocadoRef.current = true
          setVista((v) => ({ ...v, x: e.target.x(), y: e.target.y() }))
        }}
        onTouchMove={onTouchMove}
        onTouchEnd={() => {
          ultimoPellizco.current = null
        }}
      >
        <Layer ref={layerRef}>
          {mesas.map((mesa) => {
            const estado = estadoVisualMesa(mesa.id, reservas)
            const reserva = reservaActivaParaMesa(mesa.id, reservas)
            const etiqueta = reserva
              ? `${reserva.hora.slice(0, 5)} · ${reserva.cliente_nombre}`
              : `${mesa.capacidad_min}-${mesa.capacidad_max}p`
            return (
              <ReservaMesaNode
                key={mesa.id}
                mesa={mesa}
                estado={estado}
                etiqueta={etiqueta}
                isSelected={mesa.id === selectedMesaId}
                onSelect={onSelectMesa}
              />
            )
          })}
        </Layer>
      </Stage>

      {tactil && (
        <div className="absolute bottom-3 right-3 flex flex-col gap-2">
          {[
            { texto: "+", titulo: "Acercar", accion: () => zoom(1.4) },
            { texto: "−", titulo: "Alejar", accion: () => zoom(1 / 1.4) },
            { texto: "⤢", titulo: "Ver todo el plano", accion: reajustar },
          ].map((b) => (
            <button
              key={b.titulo}
              onClick={b.accion}
              title={b.titulo}
              aria-label={b.titulo}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border-strong bg-panel/90 text-lg text-ink shadow-lg backdrop-blur transition active:scale-95"
            >
              {b.texto}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
