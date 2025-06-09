import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  },
  build: {
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    },
    assetsInclude: ['**/*.webmanifest']
  },
  assetsInclude: ['**/*.webmanifest'],
  // Ensure .webmanifest files are served with correct MIME type
  optimizeDeps: {
    exclude: ['manifest.webmanifest']
  }
})
