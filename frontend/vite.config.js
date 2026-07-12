import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy /api to the Spring Boot backend so we avoid CORS entirely
// (the backend has no CORS config). Start the backend on :8080 first.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
