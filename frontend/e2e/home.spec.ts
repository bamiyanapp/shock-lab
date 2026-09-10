import { test, expect } from '@playwright/test'
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

  await captureScreenshot(page, testInfo, 'initial-view', '起動直後のトップページ')
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

  // 物理シミュレーションが数tick進み、車両が動き出した状態を撮影する
  await page.waitForTimeout(1000)

  await captureScreenshot(page, testInfo, 'simulation-running', 'シミュレーション実行中（フルスクリーン）')

  // 閉じるボタンで一時停止状態（フルスクリーン解除）に戻る
  await closeButton.click()
  await expect(page.getByRole('button', { name: '再開' })).toBeVisible()
  await expect
    .poll(() => canvas.evaluate((el) => getComputedStyle(el.parentElement!).position))
    .not.toBe('fixed')
})
