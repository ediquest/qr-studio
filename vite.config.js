import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/qr-studio/',           // <=== NAZWA REPOZYTORIUM
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    hmr: { protocol: 'ws', host: 'localhost', clientPort: 5173 }
  }
})
