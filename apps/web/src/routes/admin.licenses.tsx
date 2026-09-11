import { createFileRoute } from '@tanstack/react-router'
import { AdminPage } from '@/features/admin/AdminPage'

export const Route = createFileRoute('/admin/licenses')({ head: () => ({ meta: [{ title: 'Licenses | Kits Admin' }, { name: 'robots', content: 'noindex, nofollow' }] }), component: () => <AdminPage view="licenses" /> })
