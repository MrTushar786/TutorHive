import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
      },
      '/booking-socket': {
        target: 'http://127.0.0.1:5000',
        ws: true,
      },
      '/bridge': {
        target: 'http://127.0.0.1:5000',
        ws: true,
      },
      '/ws': {
        target: 'http://127.0.0.1:5000',
        ws: true,
      },
    },
    watch: {
      usePolling: true,
    },
  },
})
