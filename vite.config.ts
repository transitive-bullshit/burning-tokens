import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { cloudflare } from '@cloudflare/vite-plugin'

export default defineConfig({
  plugins: [react(), cloudflare({ configPath: 'worker/wrangler.jsonc' })],
  optimizeDeps: { entries: ['index.html'] },
  server: {
    watch: { ignored: ['**/work/**'] },
    fs: {
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem}',
        '**/.git/**',
        '**/.dev.vars*',
        '**/work/**'
      ]
    }
  },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } }
})
