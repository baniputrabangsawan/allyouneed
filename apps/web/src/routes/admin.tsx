import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { AdminPage } from '@/features/admin/AdminPage'

export const Route = createFileRoute('/admin')({ head: () => ({ meta: [{ title: 'Overview | Kits Admin' }, { name: 'robots', content: 'noindex, nofollow' }] }), component: AdminRoute })

function AdminRoute() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  return pathname === '/admin' ? <AdminPage view="overview" /> : <Outlet />
}
