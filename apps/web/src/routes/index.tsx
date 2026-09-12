import { createFileRoute } from '@tanstack/react-router'
import { Home } from '@/features/home/HomePage'
import { homeSearchSchema } from '@/features/home/home-search'
import { loadDiscovery } from '@/lib/storage/recent-ssr'

export const Route = createFileRoute('/')({
  validateSearch: homeSearchSchema,
  loader: () => loadDiscovery(),
  component: Home,
})
