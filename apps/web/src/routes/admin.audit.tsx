import { createFileRoute } from '@tanstack/react-router'
import { AdminPage } from '@/features/admin/AdminPage'

export const Route = createFileRoute('/admin/audit')({ head: () => ({ meta: [{ title: 'Audit log | Kits Admin' }, { name: 'robots', content: 'noindex, nofollow' }] }), component: () => <AdminPage view="audit" /> })
