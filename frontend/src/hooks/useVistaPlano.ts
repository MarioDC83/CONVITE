import type Konva from "konva"
import { useEffect, useMemo, useRef, useState } from "react"
import type { Mesa } from "../types"

interface Vista {
  escala: number
  x: number
  y: number
}

const MARGEN = 24
const ESCALA_MIN = 0.25
const ESCALA_MAX = 2.5
// Por debajo de este ancho (móvil / tablet vertical) el plano se arrastra con
// el dedo y se amplía con pellizco; por encima se queda como siempre.
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

/**
 * Vista (zoom + desplazamiento) de un plano de mesas en un Stage de Konva.
 *
 * - Arranca ajustada para que se vean TODAS las mesas; nunca amplía por encima
 *   de 1, así que en pantallas grandes el plano queda como siempre.
 * - En pantallas táctiles/estrechas se arrastra con un dedo y se amplía con
 *   pellizco o con los botones (zoom / reajustar).
 * - `claveReajuste`: cuando cambia, se vuelve a ajustar la vista (p. ej. al
 *   cambiar de zona). Los cambios de tamaño de ventana también reajustan,
 *   salvo que la persona ya haya movido o ampliado el plano.
 */
export function useVistaPlano(mesas: Mesa[], width: number, height: number, claveReajuste: string) {
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

  const ajusteRef = useRef(ajuste)
  ajusteRef.current = ajuste

  const [vista, setVista] = useState<Vista>(ajuste)
  const tocadoRef = useRef(false)

  useEffect(() => {
    tocadoRef.current = false
  }, [claveReajuste])

  useEffect(() => {
    if (!tocadoRef.current) setVista(ajusteRef.current)
  }, [claveReajuste, width, height])

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
    setVista(ajusteRef.current)
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

  const stageProps = {
    x: vista.x,
    y: vista.y,
    scaleX: vista.escala,
    scaleY: vista.escala,
    draggable: tactil,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      // El dragend de una mesa también sube hasta el Stage: solo cuenta el del propio Stage.
      if (e.target !== e.target.getStage()) return
      tocadoRef.current = true
      setVista((v) => ({ ...v, x: e.target.x(), y: e.target.y() }))
    },
    onTouchMove,
    onTouchEnd: () => {
      ultimoPellizco.current = null
    },
  }

  return {
    tactil,
    stageProps,
    zoom,
    reajustar,
    /** Píxeles del contenedor -> coordenadas del plano (para soltar/añadir mesas). */
    aCoordenadasPlano: (px: number, py: number) => ({
      x: (px - vista.x) / vista.escala,
      y: (py - vista.y) / vista.escala,
    }),
  }
}
