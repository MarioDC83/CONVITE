import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: true,
    port: 5173,
    // Docker Desktop en Windows no siempre propaga eventos de filesystem al
    // bind mount, así que el watcher por eventos de Vite se queda servido
    // en caché; con polling detecta los cambios igualmente.
    watch: {
      usePolling: true,
      interval: 300,
    },
  },
})
