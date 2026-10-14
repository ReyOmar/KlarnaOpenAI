import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Expone al navegador las VITE_* y la llave publicable de Clerk (la secreta no coincide
  // con ningún prefijo). Así una sola variable CLERK_PUBLISHABLE_KEY sirve en Render.
  envPrefix: ['VITE_', 'CLERK_PUBLISHABLE_KEY'],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
