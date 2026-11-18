import { test, expect } from '@playwright/test'
import { captureScreenshot } from './screenshot.js' // symlink

// スマホ縦持ち（iPhone 13相当）での表示崩れを検知する（issue #444）。
test('待機画面で横スクロールが発生しない', async ({ page }, testInfo) => {
  await page.goto('/shock-lab/')
  await expect(page.getByRole('button', { name: '開始' })).toBeVisible()

  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }))
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth)

  await captureScreenshot(page, testInfo, 'mobile-initial-view', 'スマホ縦持ち: 起動直後')
})

test('走行中は縦持ちでもcanvasが画面の長辺いっぱいに表示される', async ({ page }, testInfo) => {
  await page.goto('/shock-lab/')
  await page.getByRole('button', { name: '開始' }).click()
  const canvas = page.getByTestId('vehicle-canvas')
  await expect(page.getByRole('button', { name: 'フルスクリーンを閉じる' })).toBeVisible()

  const viewport = page.viewportSize()!
  const longSide = Math.max(viewport.width, viewport.height)
  await expect
    .poll(async () => {
      const box = (await canvas.boundingBox())!
      return Math.max(box.width, box.height)
    })
    .toBeGreaterThanOrEqual(longSide * 0.9)

  await captureScreenshot(page, testInfo, 'mobile-simulation-running', 'スマホ縦持ち: 走行中')
})
