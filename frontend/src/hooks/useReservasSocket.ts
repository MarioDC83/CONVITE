import { useEffect, useRef, useState } from "react"
import { getToken } from "../lib/authStorage"
import type { ReservaWsEvent } from "../types"

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000"
const WS_URL = API_URL.replace(/^http/, "ws")

/** Se conecta al WebSocket de un restaurante y reconecta con backoff fijo si se cae. */
export function useReservasSocket(
  restauranteId: string | undefined,
  onEvent: (event: ReservaWsEvent) => void,
): { conectado: boolean } {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent
  const [conectado, setConectado] = useState(false)

  useEffect(() => {
    if (!restauranteId) return

    let cerrado = false
    let socket: WebSocket | null = null
    let reintentoTimeout: ReturnType<typeof setTimeout> | null = null

    function conectar() {
      const token = getToken()
      const url = `${WS_URL}/ws/restaurantes/${restauranteId}${token ? `?token=${encodeURIComponent(token)}` : ""}`
      socket = new WebSocket(url)

      socket.onopen = () => setConectado(true)

      socket.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data) as ReservaWsEvent
          onEventRef.current(data)
        } catch {
          // mensaje no reconocido, se ignora
        }
      }

      socket.onclose = () => {
        setConectado(false)
        if (!cerrado) reintentoTimeout = setTimeout(conectar, 2000)
      }
    }

    conectar()

    return () => {
      cerrado = true
      if (reintentoTimeout) clearTimeout(reintentoTimeout)
      socket?.close()
    }
  }, [restauranteId])

  return { conectado }
}
