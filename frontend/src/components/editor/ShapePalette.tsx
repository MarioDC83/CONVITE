import type { FormaMesa } from "../../types"

interface ShapePaletteProps {
  disabled: boolean
}

const FORMAS: { forma: FormaMesa; label: string }[] = [
  { forma: "circular", label: "Mesa redonda" },
  { forma: "cuadrada", label: "Mesa cuadrada" },
  { forma: "rectangular", label: "Mesa rectangular" },
]

function ShapeIcon({ forma }: { forma: FormaMesa }) {
  const base = "border-2 border-accent bg-accent-soft"
  if (forma === "circular") return <div className={`h-6 w-6 rounded-full ${base}`} />
  if (forma === "rectangular") return <div className={`h-5 w-8 rounded ${base}`} />
  return <div className={`h-6 w-6 rounded ${base}`} />
}

export default function ShapePalette({ disabled }: ShapePaletteProps) {
  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">Mesas</h3>
      <p className="mb-3 text-xs text-ink-faint">Arrastra una forma al plano.</p>
      <div className="flex flex-col gap-2">
        {FORMAS.map(({ forma, label }) => (
          <div
            key={forma}
            draggable={!disabled}
            onDragStart={(e) => e.dataTransfer.setData("forma", forma)}
            className={`flex items-center gap-3 rounded-lg border border-border bg-panel-alt px-3 py-2.5 text-sm shadow-sm transition ${
              disabled
                ? "cursor-not-allowed opacity-40"
                : "cursor-grab hover:border-accent hover:bg-accent-soft active:cursor-grabbing"
            }`}
          >
            <ShapeIcon forma={forma} />
            <span className="font-medium text-ink">{label}</span>
          </div>
        ))}
      </div>
      {disabled && (
        <p className="mt-3 text-xs text-amber-400">
          Crea una zona primero para poder añadir mesas.
        </p>
      )}
    </div>
  )
}
