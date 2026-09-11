import { createFileRoute } from '@tanstack/react-router'
import { Home, homeSearchSchema } from '@/features/home/HomePage'
import { loadDiscovery } from '@/lib/storage/recent-ssr'

export const Route = createFileRoute('/')({
  validateSearch: homeSearchSchema,
  loader: () => loadDiscovery(),
  component: Home,
})
