import { createFileRoute } from '@tanstack/react-router'
import { AdminPage } from '@/features/admin/AdminPage'

export const Route = createFileRoute('/admin/system')({ head: () => ({ meta: [{ title: 'System | Kits Admin' }, { name: 'robots', content: 'noindex, nofollow' }] }), component: () => <AdminPage view="system" /> })
