import { createFileRoute } from '@tanstack/react-router'
import { Home } from '@/features/home/HomePage'
import { homeSearchSchema } from '@/features/home/home-search'
import { getMessages } from '@/i18n'
import { pageSeo } from '@/i18n/seo'
import { loadDiscovery } from '@/lib/storage/recent-ssr'

export const Route = createFileRoute('/id/')({
  validateSearch: homeSearchSchema,
  loader: () => loadDiscovery(),
  head: () => {
    const copy = getMessages('id')
    return pageSeo('id', '/', copy.home.titleA, copy.home.copy)
  },
  component: Home,
})
