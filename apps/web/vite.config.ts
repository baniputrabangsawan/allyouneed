import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

const onVercel = process.env.VERCEL === '1'
const onCloudflare = process.env.CF_PAGES === '1' || Boolean(process.env.CLOUDFLARE_ACCOUNT_ID)

export default defineConfig({
  server: { port: 3000 },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [
    ...(onCloudflare && !onVercel ? [cloudflare({ viteEnvironment: { name: 'ssr' } })] : []),
    tanstackStart(),
    ...(onCloudflare && !onVercel ? [] : [nitro()]),
    tailwindcss(),
    react(),
  ],
})
