import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const queryClient = new QueryClient()
  return createRouter({
    routeTree,
    scrollRestoration: ({ location }) => !location.hash && (typeof window === 'undefined' || !window.location.hash),
    scrollRestorationBehavior: 'instant',
    defaultHashScrollIntoView: { behavior: 'instant', block: 'start' },
    getScrollRestorationKey: (location) => `${location.pathname}${typeof location.searchStr === 'string' ? location.searchStr : ''}`,
    defaultPreload: 'intent',
    context: { queryClient },
  })
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
