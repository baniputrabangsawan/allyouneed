import { createFileRoute } from '@tanstack/react-router'
import { AdminLoginPage } from '@/features/admin/AdminLoginPage'

export const Route = createFileRoute('/admin/login')({ head: () => ({ meta: [{ title: 'Sign in | Kits Admin' }, { name: 'robots', content: 'noindex, nofollow' }] }), component: AdminLoginPage })
