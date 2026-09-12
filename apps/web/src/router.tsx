import { createRouter } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { routeTree } from './routeTree.gen'
import { peekKeepScroll } from '@/lib/motion/restore'
import { peekGoHomeTop } from '@/lib/navigation/home-top'

function shouldRestoreScroll({ location }: { location: { hash?: string } }) {
  if (typeof window !== 'undefined' && (peekKeepScroll() || peekGoHomeTop())) return false
  return !location.hash && (typeof window === 'undefined' || !window.location.hash)
}

export function getRouter() {
  const queryClient = new QueryClient()
  return createRouter({
    routeTree,
    scrollRestoration: shouldRestoreScroll,
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
