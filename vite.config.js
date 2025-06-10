import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Explicitly define global variables to prevent __DEFINES__ errors
    global: 'globalThis',
    '__DEFINES__': '{}',
    // Define process.env for compatibility
    'process.env': 'import.meta.env',
  },
  server: {
    cors: true,
    host: true,
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
    assetsInclude: ['**/*.webmanifest'],
    target: 'esnext'
  },
  assetsInclude: ['**/*.webmanifest'],
  // Ensure proper module resolution
  optimizeDeps: {
    exclude: ['manifest.webmanifest'],
    include: ['react', 'react-dom']
  },
  // Fix potential MIME type issues
  publicDir: 'public'
})
