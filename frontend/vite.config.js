import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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

  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('jspdf')) return 'pdf';
            if (id.includes('react-hot-toast')) return 'ui';
            if (id.includes('react')) return 'vendor';
          }
        },
      },
    },
  },

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