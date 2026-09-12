import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:3010', trace: 'on-first-retry' },
  webServer: [
    {
      command: 'uv run python -m scripts.e2e_server',
      cwd: '../api',
      url: 'http://127.0.0.1:8010/api/v1/health/live',
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        APP_ENV: 'test',
        LICENSE_DATABASE_URL: 'sqlite+aiosqlite:////tmp/kits-admin-e2e.db',
        DATABASE_URL: 'sqlite+aiosqlite:////tmp/kits-admin-e2e.db',
        ADMIN_TOTP_ENCRYPTION_KEY: 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=',
        ADMIN_CORS_ORIGINS: '["http://127.0.0.1:3010","http://localhost:3010"]',
        CORS_ORIGINS: '["http://127.0.0.1:3010","http://localhost:3010"]',
        INLINE_JOBS: 'true',
        E2E_API_PORT: '8010',
      },
    },
    {
      command: 'node ./node_modules/vite/bin/vite.js dev --host 127.0.0.1 --port 3010',
      url: 'http://127.0.0.1:3010',
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        VITE_API_BASE_URL: process.env.E2E_API_BASE_URL ?? 'http://127.0.0.1:8010',
      },
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
