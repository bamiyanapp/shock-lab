import { defineConfig, devices } from '@playwright/test'

// E2Eはビルド済みdist（vite preview）に対して実行する（reusable-ci.ymlのフローが
// `npm run build`の後に`npm run test:e2e`を呼ぶ前提のため）。GitHub Pagesの
// プロジェクトページ配下（/shock-lab/）へ配信する構成のため、baseURLはオリジンのみ
// とし、各テストがpage.goto('/shock-lab/')のように配信パスを明示する
// （baseURLに配信パス自体を含めると、page.goto('/')解決時にパスが失われるため）。
const PORT = 4173

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /mobile\.spec\.ts/,
    },
    {
      // 検証端末（iPhone）の縦持ちを模す。ブラウザはchromiumのまま使う（issue #444）。
      name: 'mobile-chromium',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
      testMatch: /mobile\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run preview -- --port ' + PORT + ' --strictPort',
    url: `http://localhost:${PORT}/shock-lab/`,
    reuseExistingServer: !process.env.CI,
  },
})
