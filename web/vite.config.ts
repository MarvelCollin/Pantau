import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/pantau/',
  plugins: [react()],
  server: {
    proxy: {
      '/pantau/api': 'http://localhost:8787',
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist/pantau',
    emptyOutDir: true,
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre'
          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react'
          if (id.includes('node_modules/@tanstack')) return 'query'
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
})
