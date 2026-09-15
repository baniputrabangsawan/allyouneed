import { StartClient } from '@tanstack/react-start/client'
import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'
import posthog from 'posthog-js'
import { PostHogProvider } from '@posthog/react'
import { posthogInitHosts } from '@/lib/posthog-proxy'

const posthogToken = import.meta.env.VITE_POSTHOG_PROJECT_TOKEN
if (posthogToken) {
  posthog.init(posthogToken, {
    ...posthogInitHosts(window.location.origin, import.meta.env.VITE_POSTHOG_HOST),
    defaults: '2026-05-30',
  })
}

hydrateRoot(
  document,
  <StrictMode>
    <PostHogProvider client={posthog}>
      <StartClient />
    </PostHogProvider>
  </StrictMode>,
)
