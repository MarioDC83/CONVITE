export const FONT_SERIF = "Georgia, 'Times New Roman', serif"

/** Props compartidas para dar a las mesas del canvas un acabado más elegante:
 * relleno con degradado sutil (como una vitrina con luz cenital), sombra suave
 * de tarjeta flotante y un trazo más fino salvo cuando está seleccionada. */
export function construirEstiloMesa(color: string, alto: number, seleccionada: boolean) {
  return {
    fillLinearGradientColorStops: [0, `${color}58`, 1, `${color}16`],
    fillLinearGradientStartPoint: { x: 0, y: -alto / 2 },
    fillLinearGradientEndPoint: { x: 0, y: alto / 2 },
    stroke: seleccionada ? "#2986cc" : color,
    strokeWidth: seleccionada ? 2 : 1.25,
    shadowColor: "#000000",
    shadowBlur: seleccionada ? 16 : 9,
    shadowOffsetY: 3,
    shadowOpacity: seleccionada ? 0.5 : 0.32,
  }
}
