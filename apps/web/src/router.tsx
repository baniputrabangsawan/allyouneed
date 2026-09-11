import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = new QueryClient()
  return createRouter({
    routeTree,
    scrollRestoration: true,
    getScrollRestorationKey: (location) => location.pathname === '/' ? '/' : `${location.pathname}${location.search}`,
    defaultPreload: 'intent',
    context: { queryClient },
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
