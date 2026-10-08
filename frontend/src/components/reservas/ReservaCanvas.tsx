import type Konva from "konva"
import { useEffect, useRef } from "react"
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

  return (
    <div className="h-full w-full bg-page bg-[radial-gradient(circle,#33343d_1px,transparent_1px)] bg-[length:22px_22px]">
      <Stage width={width} height={height}>
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
    </div>
  )
}
