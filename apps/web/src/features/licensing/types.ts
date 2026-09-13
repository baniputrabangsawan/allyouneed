export const LICENSE_PLANS = ['pro_1_month', 'pro_6_months', 'pro_12_months'] as const
export const LICENSE_STATUSES = ['active', 'expired', 'suspended', 'revoked'] as const

export type LicensePlan = (typeof LICENSE_PLANS)[number]
export type LicenseStatus = (typeof LICENSE_STATUSES)[number]

export type ToolCapability =
  | 'audio.noise_reduction'
  | 'audio.speech_to_text'
  | 'audio.text_to_speech'
  | 'document.ocr.advanced'
  | 'image.ai.background_removal'
  | 'image.ai.upscale'
  | 'image.face_blur'
  | 'video.add_subtitle'

export interface Entitlement {
  plan: LicensePlan
  status: LicenseStatus
  expiresAt: string | null
  capabilities: string[]
}

export interface EntitlementPayload extends Entitlement {
  token: string
}

export interface LicenseStatusView extends Entitlement {
  installationActive: boolean
}
