import type Konva from "konva"
import { useCallback, useEffect, useImperativeHandle, useRef } from "react"
import type { DragEvent, Ref } from "react"
import { Layer, Stage, Transformer } from "react-konva"
import { useVistaPlano } from "../../hooks/useVistaPlano"
import type { FormaMesa, Mesa, Zona } from "../../types"
import ControlesZoom from "../shared/ControlesZoom"
import MesaNode from "./MesaNode"

export interface CanvasStageHandle {
  /** Centro de la zona visible, en coordenadas del plano (para añadir una mesa ahí). */
  centroVisible: () => { x: number; y: number }
}

interface CanvasStageProps {
  mesas: Mesa[]
  zonas: Zona[]
  selectedMesaId: string | null
  onSelectMesa: (id: string | null) => void
  onChangeMesaGeometry: (
    id: string,
    attrs: { pos_x: number; pos_y: number; ancho: number; alto: number; rotacion: number },
  ) => void
  onDropForma: (forma: FormaMesa, pos: { x: number; y: number }) => void
  width: number
  height: number
  /** Cuando cambia (p. ej. otra zona en el filtro), la vista se reajusta. */
  claveVista: string
  ref?: Ref<CanvasStageHandle>
}

export default function CanvasStage({
  mesas,
  zonas,
  selectedMesaId,
  onSelectMesa,
  onChangeMesaGeometry,
  onDropForma,
  width,
  height,
  claveVista,
  ref,
}: CanvasStageProps) {
  const stageRef = useRef<Konva.Stage>(null)
  const layerRef = useRef<Konva.Layer>(null)
  const transformerRef = useRef<Konva.Transformer>(null)
  const nodeRefs = useRef<Map<string, Konva.Group>>(new Map())

  const { tactil, stageProps, zoom, reajustar, aCoordenadasPlano } = useVistaPlano(
    mesas,
    width,
    height,
    claveVista,
  )

  useImperativeHandle(ref, () => ({
    centroVisible: () => aCoordenadasPlano(width / 2, height / 2),
  }))

  const registerNodeRef = useCallback((id: string, node: Konva.Group | null) => {
    if (node) nodeRefs.current.set(id, node)
    else nodeRefs.current.delete(id)
  }, [])

  // react-konva no siempre repinta el layer al añadir/quitar nodos (solo al
  // cambiar atributos de nodos ya existentes), así que forzamos el redraw
  // explícitamente cada vez que cambia el set de mesas.
  useEffect(() => {
    layerRef.current?.batchDraw()
  }, [mesas])

  useEffect(() => {
    const transformer = transformerRef.current
    if (!transformer) return
    const node = selectedMesaId ? nodeRefs.current.get(selectedMesaId) : undefined
    transformer.nodes(node ? [node] : [])
    transformer.getLayer()?.batchDraw()
  }, [selectedMesaId, mesas])

  function handleStagePointerDown(e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (e.target === e.target.getStage()) {
      onSelectMesa(null)
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const forma = e.dataTransfer.getData("forma") as FormaMesa
    if (!forma) return
    const container = stageRef.current?.container()
    if (!container) return
    const rect = container.getBoundingClientRect()
    // Con zoom/desplazamiento, la posición del puntero ya no coincide con la del plano.
    onDropForma(forma, aCoordenadasPlano(e.clientX - rect.left, e.clientY - rect.top))
  }

  return (
    <div
      className="relative h-full w-full bg-page bg-[radial-gradient(circle,#33343d_1px,transparent_1px)] bg-[length:22px_22px]"
      style={tactil ? { touchAction: "none" } : undefined}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <Stage
        ref={stageRef}
        width={width}
        height={height}
        onMouseDown={handleStagePointerDown}
        onTouchStart={handleStagePointerDown}
        {...stageProps}
      >
        <Layer ref={layerRef}>
          {mesas.map((mesa) => (
            <MesaNode
              key={mesa.id}
              mesa={mesa}
              zona={zonas.find((z) => z.id === mesa.zona_id)}
              isSelected={mesa.id === selectedMesaId}
              onSelect={onSelectMesa}
              onChange={onChangeMesaGeometry}
              registerNodeRef={registerNodeRef}
            />
          ))}
          <Transformer
            ref={transformerRef}
            rotateEnabled
            rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
            borderStroke="#2986cc"
            anchorStroke="#2986cc"
            anchorFill="#1a1b20"
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 30 || newBox.height < 30) return oldBox
              return newBox
            }}
          />
        </Layer>
      </Stage>

      {tactil && (
        <ControlesZoom
          onAcercar={() => zoom(1.4)}
          onAlejar={() => zoom(1 / 1.4)}
          onReajustar={reajustar}
        />
      )}
    </div>
  )
}
