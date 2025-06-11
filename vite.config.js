import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({
    // Fix for React refresh issues
    fastRefresh: true,
    babel: {
      plugins: [
        ['@babel/plugin-transform-react-jsx', { runtime: 'automatic' }]
      ]
    }
  })],
  define: {
    // Fix global variables
    global: 'globalThis',
    'process.env': 'import.meta.env',
  },
  server: {
    cors: true,
    host: true,
    port: 5173,
    strictPort: false,
    fs: {
      strict: false
    },
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  },  build: {
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    },
    assetsInclude: ['**/*.webmanifest'],
    target: 'esnext',
    sourcemap: true
  },
  // Ensure proper module resolution
  optimizeDeps: {
    exclude: ['manifest.webmanifest'],
    include: ['react', 'react-dom', 'react-router-dom'],
    force: true
  },
  // Fix potential MIME type issues
  publicDir: 'public',
  // Ensure proper module resolution
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
