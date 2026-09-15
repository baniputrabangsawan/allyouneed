import { cloudflare } from '@cloudflare/vite-plugin'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'
import https from 'node:https'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { assertProductionApiBaseUrl } from './src/lib/api/public-origin'
import {
  isPosthogProxyPath,
  posthogViteProxy,
  rewritePosthogProxyUrl,
} from './src/lib/posthog-proxy'

const onVercel = process.env.VERCEL === '1'
const onCloudflare = process.env.CF_PAGES === '1' || process.env.WORKERS_CI === '1' || Boolean(process.env.CLOUDFLARE_ACCOUNT_ID)

function posthogIngestPlugin(): Plugin {
  return {
    name: 'kits-posthog-ingest',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url ?? '').split('?')[0] ?? ''
        if (!isPosthogProxyPath(pathname) || pathname.startsWith('/ingest/static')) {
          next()
          return
        }
        const target = rewritePosthogProxyUrl(
          `http://${req.headers.host ?? 'localhost:3000'}${req.url}`,
          process.env.VITE_POSTHOG_HOST,
        )
        if (!target) {
          next()
          return
        }
        const headers: Record<string, string> = { host: target.host }
        const contentType = req.headers['content-type']
        if (contentType) headers['content-type'] = String(contentType)
        const upstream = https.request(target, { method: req.method, headers, family: 4 }, (up) => {
          res.statusCode = up.statusCode ?? 502
          for (const [key, value] of Object.entries(up.headers)) {
            if (!value || key === 'transfer-encoding') continue
            res.setHeader(key, value)
          }
          up.pipe(res)
        })
        upstream.on('error', next)
        req.pipe(upstream)
      })
    },
  }
}

export default defineConfig(({ command }) => {
  assertProductionApiBaseUrl(process.env.VITE_API_BASE_URL, command)
  return {
    server: {
      port: 3000,
      proxy: posthogViteProxy(process.env.VITE_POSTHOG_HOST),
    },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    plugins: [
      posthogIngestPlugin(),
      ...(onCloudflare && !onVercel ? [cloudflare({ viteEnvironment: { name: 'ssr' } })] : []),
      tanstackStart(),
      ...(onCloudflare && !onVercel ? [] : [nitro()]),
      tailwindcss(),
      react(),
    ],
  }
})
