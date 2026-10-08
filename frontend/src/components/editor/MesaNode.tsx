import type Konva from "konva"
import { Ellipse, Group, Rect, Text } from "react-konva"
import { construirEstiloMesa, FONT_SERIF } from "../../lib/mesaVisual"
import type { Mesa, Zona } from "../../types"

const MIN_SIZE = 30

interface MesaNodeProps {
  mesa: Mesa
  zona: Zona | undefined
  isSelected: boolean
  onSelect: (id: string) => void
  onChange: (
    id: string,
    attrs: { pos_x: number; pos_y: number; ancho: number; alto: number; rotacion: number },
  ) => void
  registerNodeRef: (id: string, node: Konva.Group | null) => void
}

export default function MesaNode({
  mesa,
  zona,
  isSelected,
  onSelect,
  onChange,
  registerNodeRef,
}: MesaNodeProps) {
  const color = zona?.color ?? "#6366f1"
  const isEllipse = mesa.forma === "circular" || mesa.forma === "ovalada"
  const estilo = construirEstiloMesa(color, mesa.alto, isSelected)

  function handleDragEnd(e: Konva.KonvaEventObject<DragEvent>) {
    onChange(mesa.id, {
      pos_x: e.target.x(),
      pos_y: e.target.y(),
      ancho: mesa.ancho,
      alto: mesa.alto,
      rotacion: mesa.rotacion,
    })
  }

  function handleTransformEnd(e: Konva.KonvaEventObject<Event>) {
    const node = e.target as Konva.Group
    const nuevoAncho = Math.max(MIN_SIZE, mesa.ancho * node.scaleX())
    const nuevoAlto = Math.max(MIN_SIZE, mesa.alto * node.scaleY())
    node.scaleX(1)
    node.scaleY(1)
    onChange(mesa.id, {
      pos_x: node.x(),
      pos_y: node.y(),
      ancho: nuevoAncho,
      alto: nuevoAlto,
      rotacion: node.rotation(),
    })
  }

  return (
    <Group
      ref={(node) => registerNodeRef(mesa.id, node)}
      x={mesa.pos_x}
      y={mesa.pos_y}
      rotation={mesa.rotacion}
      draggable
      onClick={() => onSelect(mesa.id)}
      onTap={() => onSelect(mesa.id)}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
    >
      {isEllipse ? (
        <Ellipse radiusX={mesa.ancho / 2} radiusY={mesa.alto / 2} {...estilo} />
      ) : (
        <Rect
          x={-mesa.ancho / 2}
          y={-mesa.alto / 2}
          width={mesa.ancho}
          height={mesa.alto}
          cornerRadius={Math.min(10, mesa.ancho * 0.08)}
          {...estilo}
        />
      )}
      <Text
        text={mesa.nombre}
        fontFamily={FONT_SERIF}
        fontSize={14}
        fill="#f7f3ea"
        width={mesa.ancho}
        height={mesa.alto}
        offsetX={mesa.ancho / 2}
        offsetY={mesa.alto / 2}
        align="center"
        verticalAlign="middle"
        listening={false}
      />
      <Text
        text={`${mesa.capacidad_min}–${mesa.capacidad_max} PAX`}
        fontSize={9.5}
        letterSpacing={1}
        fill="#b7b3a8"
        width={mesa.ancho}
        offsetX={mesa.ancho / 2}
        y={mesa.alto / 2 - 17}
        align="center"
        listening={false}
      />
    </Group>
  )
}
