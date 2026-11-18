import { test, expect, shotName, SEDAN_VEHICLE, encodeSharedConfig } from './fixtures'
import { captureScreenshot } from './screenshot.js' // symlink

// 平坦路・30m/sのゴールは約11秒（コース約325m）。余裕を見て30秒にする。
test.setTimeout(30_000)

test('共有URLで平坦路・30m/sを指定して走り切ると、リザルトが表示され「もう一度」で再走行できる', async ({ page }, testInfo) => {
  const config = encodeSharedConfig(SEDAN_VEHICLE, { speed: 30, terrainType: 'flat' })
  await page.goto(`/shock-lab/?config=${config}`)
  await page.getByRole('button', { name: '開始' }).click()

  // ゴール到達でフルスクリーンが解除され、リザルトが出る（ランクの具体値は物理モデル変更で
  // 変わりうるため検証しない。ランクのバッジが出ることだけ確認する）。
  const result = page.locator('.card', { has: page.getByRole('heading', { name: 'リザルト' }) })
  await expect(result).toBeVisible({ timeout: 25_000 })
  await expect(result.locator('.badge')).toBeVisible()
  await expect(result.getByText(/最大衝撃/)).toBeVisible()
  await expect(result.getByText(/走破タイム/)).toBeVisible()

  await captureScreenshot(page, testInfo, shotName(testInfo, 'run-result'), 'ゴール後のリザルト')

  await result.getByRole('button', { name: 'もう一度' }).click()
  await expect(page.getByRole('button', { name: 'フルスクリーンを閉じる' })).toBeVisible()
  await expect(result).toBeHidden()
})
