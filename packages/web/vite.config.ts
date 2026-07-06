/// <reference types="vitest" />
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
    test: {
      environment: 'jsdom',
      globals: true,
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      proxy: {
        '/setup': { target: apiTarget, changeOrigin: true },
        '/auth': { target: apiTarget, changeOrigin: true },
        '/users': { target: apiTarget, changeOrigin: true },
        '/admin': { target: apiTarget, changeOrigin: true },
        '/settings': { target: apiTarget, changeOrigin: true },
        '/tokens': { target: apiTarget, changeOrigin: true },
        '/teams': { target: apiTarget, changeOrigin: true },
        '/timelines': { target: apiTarget, changeOrigin: true },
        '/status-templates': { target: apiTarget, changeOrigin: true },
        '/status-template-items': { target: apiTarget, changeOrigin: true },
        '/statuses': { target: apiTarget, changeOrigin: true },
        '/activities': { target: apiTarget, changeOrigin: true },
        '/tags': { target: apiTarget, changeOrigin: true },
        '/saved_filters': { target: apiTarget, changeOrigin: true },
        '/shares': { target: apiTarget, changeOrigin: true },
        '/import': { target: apiTarget, changeOrigin: true },
        '/events': { target: apiTarget, changeOrigin: true },
        '/health': { target: apiTarget, changeOrigin: true },
        '/ws': {
          target: apiTarget.replace(/^http/, 'ws'),
          changeOrigin: true,
          ws: true,
          rewriteWsOrigin: true,
        },
      },
    },
  }
})
