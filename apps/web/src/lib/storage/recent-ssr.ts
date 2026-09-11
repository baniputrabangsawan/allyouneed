import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { parseFavoritesCookie, parseRecentCookie } from './tools'

export const loadDiscovery = createServerFn({ method: 'GET' }).handler(() => {
  const cookie = getRequestHeader('cookie') ?? ''
  return {
    recent: parseRecentCookie(cookie),
    favorites: parseFavoritesCookie(cookie),
  }
})
