import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true, // Permite conexiones externas
    strictPort: true,
    allowedHosts: [
      'localhost',
      '.trycloudflare.com', // Permite todos los subdominios de Cloudflare
    ],
    proxy: {
      // Redirige las peticiones /api/match a la API de Matchmaking en el puerto 5000
      '/api/match': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/match/, ''), // Quita /api/match del path
      },
      // Redirige las peticiones /api/optimize a la API de Optimización en el puerto 5001
      '/api/optimize': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/optimize/, ''), // Quita /api/optimize del path
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})