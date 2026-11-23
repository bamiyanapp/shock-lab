import { test, expect, shotName } from './fixtures'
import { captureScreenshot } from './screenshot.js' // symlink

// トップページの基本シナリオ（起動→初期表示→シミュレーション開始）をスクリーンショットで
// 記録する（issue #105）。canvas描画（Matter.jsシミュレーション）はユニットテストで
// 見た目を検証しづらく、スクリーンショットによる確認と相性が良い。
// 撮影ポイント:
//   1. initial-view: 起動直後、シミュレーション開始前の静止画面（決定的で差分が安定する）
//   2. simulation-running: 開始ボタン押下後、走行が進んだ状態（物理シミュレーションのため
//      毎回のピクセルは変動しうるが、UIレイアウト自体の崩れは検知できる）
test('起動直後のトップページを表示する', async ({ page }, testInfo) => {
  await page.goto('/shock-lab/')
  await expect(page.getByRole('heading', { name: 'ShockLab' })).toBeVisible()
  await expect(page.getByRole('button', { name: '開始' })).toBeVisible()

  await captureScreenshot(page, testInfo, shotName(testInfo, 'initial-view'), '起動直後のトップページ')
})

test('開始ボタン押下でシミュレーションがフルスクリーン表示の走行状態になる', async ({ page }, testInfo) => {
  await page.goto('/shock-lab/')
  await page.getByRole('button', { name: '開始' }).click()

  // 試験開始中は画面全体を覆うフルスクリーン表示になる（issue #231）。
  const closeButton = page.getByRole('button', { name: 'フルスクリーンを閉じる' })
  await expect(closeButton).toBeVisible()
  const canvas = page.getByTestId('vehicle-canvas')
  await expect(canvas).toBeVisible()
  await expect
    .poll(() => canvas.evaluate((el) => getComputedStyle(el.parentElement!).position))
    .toBe('fixed')

  // 物理シミュレーションが数tick進み、車両が動き出した状態を撮影する。固定時間の待機では
  // なく、canvas描画が初期フレームから実際に変化したこと（アニメーションの進行）を
  // 観測可能な条件として待つ（sonarjs/no-fixed-wait-in-tests）。
  const initialFrame = await canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL())
  await expect
    .poll(() => canvas.evaluate((el) => (el as HTMLCanvasElement).toDataURL()))
    .not.toBe(initialFrame)

  await captureScreenshot(page, testInfo, shotName(testInfo, 'simulation-running'), 'シミュレーション実行中（フルスクリーン）')

  // 閉じるボタンで一時停止状態（フルスクリーン解除）に戻る
  await closeButton.click()
  await expect(page.getByRole('button', { name: '再開' })).toBeVisible()
  await expect
    .poll(() => canvas.evaluate((el) => getComputedStyle(el.parentElement!).position))
    .not.toBe('fixed')
})

test('走行中にEscキーを押すと一時停止する（issue #449）', async ({ page }) => {
  await page.goto('/shock-lab/')
  await page.getByRole('button', { name: '開始' }).click()
  await expect(page.getByRole('button', { name: 'フルスクリーンを閉じる' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: '再開' })).toBeVisible()
})

test('開始→一時停止→再開/最初から→スライダー変更で開始に戻る（issue #443）', async ({ page }) => {
  await page.goto('/shock-lab/')
  await page.getByRole('button', { name: '開始' }).click()
  await page.getByRole('button', { name: 'フルスクリーンを閉じる' }).click()

  await expect(page.getByRole('button', { name: '再開' })).toBeVisible()
  await expect(page.getByRole('button', { name: '最初から' })).toBeVisible()

  // 一時停止中に設定を変えると、状態が食い違わず「開始」に戻る
  const weight = page.getByRole('slider', { name: /車重/ })
  await weight.fill('1500')
  await expect(page.getByRole('button', { name: '開始' })).toBeVisible()
  await expect(page.getByRole('button', { name: '再開' })).toHaveCount(0)
})

// プレビュー（canvas・操作・タブ見出し）の固定と、設定のタブ切り替え（issue #550）。
test('下へスクロールしてもプレビューは画面上端に残り、タブで車両パラメータへ切り替わる', async ({ page }) => {
  await page.goto('/shock-lab/')
  const preview = page.getByTestId('preview-area')
  await expect(preview).toBeVisible()

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect.poll(() => preview.evaluate((el) => Math.round(el.getBoundingClientRect().top))).toBeLessThanOrEqual(1)
  await expect(page.getByRole('button', { name: '開始' })).toBeInViewport()

  await page.getByRole('tab', { name: '車両', exact: true }).click()
  await expect(page.getByRole('tab', { name: '車両', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('slider', { name: /車重/ })).toBeInViewport()

  await page.getByRole('tab', { name: 'サスペンション', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'サスペンション', exact: true })).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('slider', { name: /バネ取り付け位置/ })).toBeInViewport()
})

// ストローク量を上げると、バネが長くなり、実際の車高が上がる（issue #569）。
test('ストローク量を上げると、実際の車高の数値が上がる', async ({ page }) => {
  await page.goto('/shock-lab/')
  await page.getByRole('tab', { name: 'サスペンション', exact: true }).click()
  const state = page.getByTestId('static-state')
  const height = async () => Number((await state.innerText()).match(/実際の車高: ([\d.]+) cm/)![1])

  await page.getByRole('slider', { name: /ストローク量/ }).fill('0.2')
  const low = await height()
  await page.getByRole('slider', { name: /ストローク量/ }).fill('0.3')
  expect(await height()).toBeGreaterThan(low + 5)
})
