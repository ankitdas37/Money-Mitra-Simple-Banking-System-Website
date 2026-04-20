import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  server: {
    port: 5173,
    host: true,          // listen on 0.0.0.0 — accessible from any device on LAN
    strictPort: true,
    open: true,          // 🏠 Auto-open home page (React SPA at /) when server starts

    // ── HMR — use machine's LAN IP so hot-reload works on other devices too ──
    hmr: {
      host: '192.168.1.4',
      port: 5173,
    },

    // ── Proxy — forward /api calls to backend ──────────────────────────────
    proxy: {
      '/api': {
        target: 'http://192.168.1.4:5000',   // use LAN IP, not localhost
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

    // ── Increase watch file limit for large projects ──────────────────────
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
