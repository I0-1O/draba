import path from 'path'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = env.VITE_API_TARGET ?? 'http://localhost:8080'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/setup': { target: apiTarget, changeOrigin: true },
        '/auth': { target: apiTarget, changeOrigin: true },
        '/teams': { target: apiTarget, changeOrigin: true },
        '/timelines': { target: apiTarget, changeOrigin: true },
        '/events': { target: apiTarget, changeOrigin: true },
        '/ws': { target: apiTarget, changeOrigin: true, ws: true },
      },
    },
  }
})
