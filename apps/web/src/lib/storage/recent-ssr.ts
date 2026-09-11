import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { parseRecentCookie } from './tools'

export const loadRecentIds = createServerFn({ method: 'GET' }).handler(() =>
  parseRecentCookie(getRequestHeader('cookie') ?? ''),
)
