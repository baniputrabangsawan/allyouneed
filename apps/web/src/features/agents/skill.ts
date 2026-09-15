export const USE_KITS_SKILL_NAME = 'use-kits'

export const USE_KITS_SKILL_DESCRIPTION =
  'Find and use Kits browser tools for images, PDFs, audio, video, text, QR codes, and developer files. Activate a Pro license key for labeled server AI tools.'

export const USE_KITS_SKILL_MD = `---
name: use-kits
description: Find and use Kits browser tools for images, PDFs, audio, video, text, QR codes, and developer files. Activate a Pro license key for labeled server AI tools.
---

# Use Kits

Kits (https://usekits.online) is a browser-first utility app. Most tools run in the tab. Server tools are labeled before upload. There is no user account.

## Find a tool

- Search the homepage: \`https://usekits.online/?q={query}\`
- Browse the catalog: \`https://usekits.online/tools\`
- Category pages: \`https://usekits.online/tools/{image|pdf|audio|video|text|developer|generator|qr|converter}\`
- Indonesian locale uses the \`/id\` prefix.

## Open a tool

Canonical workspace: \`https://usekits.online/tools/{slug}\`

Examples: \`compress-image\`, \`merge-pdf\`, \`qr-code-generator\`, \`json-formatter\`, \`speech-to-text\`.

Human docs: \`https://usekits.online/docs/tools/{slug}\`

## Processing

- **Local**: the file never leaves the browser.
- **Server / hybrid**: the tool uploads to \`https://api.usekits.online\` for a short-lived job. Results download from the job URL. Temporary objects are not a personal library.

## Pro licenses

Kits does not use OAuth sign-in. Pro is a license key activated on one browser at a time.

1. User pastes the key at \`https://usekits.online/license\`
2. The app POSTs JSON to \`https://api.usekits.online/api/v1/licenses/activate\` with \`licenseKey\`, \`installationId\`, and \`deviceSecret\`
3. Later API calls send \`X-Entitlement-Token\`

Do not create accounts, send mail, or mint keys during discovery. Keys are issued by an admin after a manual purchase.

## Public API (server tools)

Origin: \`https://api.usekits.online\`

- \`GET /api/v1/health/live\`
- \`GET /api/v1/health/ready\`
- \`POST /api/v1/uploads/presign\` then upload bytes
- \`POST /api/v1/jobs\` with \`toolId\`, \`input\`, \`options\`
- \`GET /api/v1/jobs/{jobId}\`
- \`GET /api/v1/tts/capabilities\`

OpenAPI: \`https://usekits.online/openapi.json\`
`
