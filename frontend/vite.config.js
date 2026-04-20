import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Backend URL: use environment variable in production, local IP in development
const BACKEND_URL = process.env.VITE_API_URL || 'http://localhost:5000';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  server: {
    port: 5173,
    host: true,
    strictPort: true,
    open: true,

    // ── Proxy — forward /api calls to backend ──────────────────────────────
    proxy: {
      '/api': {
        target: BACKEND_URL,
        changeOrigin: true,
        secure: false,
        timeout: 15000,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('[proxy error]', err.message);
          });
        },
      }
    },

    watch: {
      usePolling: false,
    },
  },

  // ── Build / Bundle optimisation ─────────────────────────────────────────
  build: {
    target: 'es2020',
    minify: 'esbuild',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor:  ['react', 'react-dom'],
          pdf:     ['jspdf', 'jspdf-autotable'],
          ui:      ['react-hot-toast'],
        },
      },
    },
  },

  // ── Dependency pre-bundling — speeds up cold start ──────────────────────
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'axios',
      'react-hot-toast',
      'jspdf',
      'jspdf-autotable',
    ],
  },
})
