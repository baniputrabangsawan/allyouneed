import { ApiError } from '@/lib/api/client'

export const adminErrorMessage = (error: unknown): string =>
  error instanceof ApiError ? error.message : 'The request could not be completed.'
