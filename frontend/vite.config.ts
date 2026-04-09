import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const runtimeRoot = process.cwd()

export default defineConfig({
  root: runtimeRoot,
  plugins: [react()],
  test: {
    environment: "jsdom",
    css: true,
    globals: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('recharts')) {
            return 'charts'
          }

          if (id.includes('lucide-react')) {
            return 'icons'
          }

          return 'vendor'
        },
      },
    },
  },
})
