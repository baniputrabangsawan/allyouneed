import { apiClient, type ApiClient, type ApiRequestOptions } from './client'
import type { ApiResponse } from './types'

export interface TtsVoice {
  id: string
  name: string
  language: string
  provider: string
  model: string
  available: boolean
}

export interface TtsCapabilities {
  voices: TtsVoice[]
  languages: string[]
}

export const getTtsCapabilities = async (
  options?: ApiRequestOptions,
  client: ApiClient = apiClient,
): Promise<TtsCapabilities> =>
  (await client.get<ApiResponse<TtsCapabilities>>('/api/v1/tts/capabilities', options)).data
