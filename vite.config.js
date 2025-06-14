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
      },
      output: {
        manualChunks: {
          // Firebase chunk
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/functions', 'firebase/storage'],
          // React chunk  
          react: ['react', 'react-dom', 'react-router-dom'],
          // UI libraries
          ui: ['framer-motion', '@dnd-kit/core', '@dnd-kit/sortable'],
          // Large utilities
          utils: ['pptxgenjs', 'lodash.debounce']
        },
        // Ensure consistent file extensions
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    assetsInclude: ['**/*.webmanifest'],
    target: 'esnext',
    sourcemap: false, // Disable source maps for production
    minify: 'terser', // Use terser for better minification
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.logs in production
        drop_debugger: true
      }
    },
    // Ensure proper module format
    modulePreload: {
      polyfill: true
    }
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
