import { test, expect } from '@playwright/test'

// Bootstrapを外部CDNではなくバンドルして配信していること（オフライン時もスタイルが
// 効くこと）を、CDN・Webフォントへの通信を遮断した状態で検証する（issue #448）。
test('外部CDN・Webフォントを遮断してもBootstrapのスタイルが効く', async ({ page }) => {
  await page.route(/cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com/, (route) => route.abort())
  await page.goto('/shock-lab/')
  const startButton = page.getByRole('button', { name: '開始' })
  await expect(startButton).toBeVisible()

  const background = await startButton.evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(background).not.toBe('rgba(0, 0, 0, 0)')
  expect(background).not.toBe('rgb(239, 239, 239)')
})
