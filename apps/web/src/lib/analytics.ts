export type AnalyticsContext = Readonly<{
  toolId: string
  category: string
  processingMode: 'client' | 'remote' | 'hybrid'
}>

export type AnalyticsEvent =
  | { name: 'tool_opened'; context: AnalyticsContext }
  | { name: 'processing_started'; context: AnalyticsContext; sizeBucket?: string }
  | { name: 'processing_completed'; context: AnalyticsContext; durationMs?: number; sizeBucket?: string }
  | { name: 'processing_failed'; context: AnalyticsContext; errorCode?: string }

export interface Analytics {
  track(event: AnalyticsEvent): void
}

export const analytics: Analytics = { track: () => undefined }

export const trackToolOpened = (context: AnalyticsContext) => analytics.track({ name: 'tool_opened', context })
export const trackProcessingStarted = (context: AnalyticsContext, sizeBucket?: string) =>
  analytics.track({ name: 'processing_started', context, ...(sizeBucket === undefined ? {} : { sizeBucket }) })
export const trackProcessingCompleted = (context: AnalyticsContext, durationMs?: number, sizeBucket?: string) =>
  analytics.track({
    name: 'processing_completed',
    context,
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(sizeBucket === undefined ? {} : { sizeBucket }),
  })
export const trackProcessingFailed = (context: AnalyticsContext, errorCode?: string) =>
  analytics.track({ name: 'processing_failed', context, ...(errorCode === undefined ? {} : { errorCode }) })
