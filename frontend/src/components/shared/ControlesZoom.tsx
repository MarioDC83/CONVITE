interface ControlesZoomProps {
  onAcercar: () => void
  onAlejar: () => void
  onReajustar: () => void
}

/** Botones flotantes de zoom del plano; el padre debe ser `relative`. */
export default function ControlesZoom({ onAcercar, onAlejar, onReajustar }: ControlesZoomProps) {
  const botones = [
    { texto: "+", titulo: "Acercar", accion: onAcercar },
    { texto: "−", titulo: "Alejar", accion: onAlejar },
    { texto: "⤢", titulo: "Ver todo el plano", accion: onReajustar },
  ]
  return (
    <div className="absolute bottom-3 right-3 flex flex-col gap-2">
      {botones.map((b) => (
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
  )
}
