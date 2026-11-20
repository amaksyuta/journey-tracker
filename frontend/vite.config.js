import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// In dev, Vite serves the UI on :5173 and forwards /api calls to FastAPI on :8000,
// so the browser sees one origin (no CORS issues, same as production behind Nginx).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8000' },
  },
})
