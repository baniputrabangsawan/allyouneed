import { createFileRoute } from '@tanstack/react-router'
import { discoveryHandlers } from '@/features/agents/headers'
import { DISCOVERY_PATHS } from '@/features/agents/paths'

export const Route = createFileRoute('/.well-known/ai-catalog.json')({
  server: { handlers: discoveryHandlers(DISCOVERY_PATHS.aiCatalog) },
})
