import { Ellipse, Group, Rect, Text } from "react-konva"
import type { EstadoVisualMesa } from "../../lib/estadoMesa"
import { construirEstiloMesa, FONT_SERIF } from "../../lib/mesaVisual"
import type { Mesa } from "../../types"

const ESTADO_COLOR: Record<EstadoVisualMesa, string> = {
  libre: "#10b981",
  reservada: "#f59e0b",
  ocupada: "#ef4444",
}

interface ReservaMesaNodeProps {
  mesa: Mesa
  estado: EstadoVisualMesa
  etiqueta: string
  isSelected: boolean
  onSelect: (mesaId: string) => void
}

export default function ReservaMesaNode({
  mesa,
  estado,
  etiqueta,
  isSelected,
  onSelect,
}: ReservaMesaNodeProps) {
  const isEllipse = mesa.forma === "circular" || mesa.forma === "ovalada"
  const estilo = construirEstiloMesa(ESTADO_COLOR[estado], mesa.alto, isSelected)

  return (
    <Group
      x={mesa.pos_x}
      y={mesa.pos_y}
      rotation={mesa.rotacion}
      onClick={() => onSelect(mesa.id)}
      onTap={() => onSelect(mesa.id)}
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
        offsetX={mesa.ancho / 2}
        y={-mesa.alto / 2 + 11}
        align="center"
        listening={false}
      />
      <Text
        text={etiqueta}
        fontSize={10}
        letterSpacing={0.3}
        fill="#b7b3a8"
        width={mesa.ancho}
        offsetX={mesa.ancho / 2}
        y={mesa.alto / 2 - 19}
        align="center"
        listening={false}
      />
    </Group>
  )
}
