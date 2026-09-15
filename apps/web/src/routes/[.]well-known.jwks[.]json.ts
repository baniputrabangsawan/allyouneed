import { createFileRoute } from '@tanstack/react-router'
import { discoveryHandlers } from '@/features/agents/headers'
import { DISCOVERY_PATHS } from '@/features/agents/paths'

export const Route = createFileRoute('/.well-known/jwks.json')({
  server: { handlers: discoveryHandlers(DISCOVERY_PATHS.jwks) },
})
