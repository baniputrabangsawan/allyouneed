import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import { assertProductionApiBaseUrl } from './src/lib/api/public-origin'

const onVercel = process.env.VERCEL === '1'
const onCloudflare = process.env.CF_PAGES === '1' || process.env.WORKERS_CI === '1' || Boolean(process.env.CLOUDFLARE_ACCOUNT_ID)

export default defineConfig(({ command }) => {
  assertProductionApiBaseUrl(process.env.VITE_API_BASE_URL, command)
  return {
    server: { port: 3000 },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    plugins: [
      ...(onCloudflare && !onVercel ? [cloudflare({ viteEnvironment: { name: 'ssr' } })] : []),
      tanstackStart(),
      ...(onCloudflare && !onVercel ? [] : [nitro()]),
      tailwindcss(),
      react(),
    ],
  }
})
