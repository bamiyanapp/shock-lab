import { test as base, expect } from '@playwright/test'

// ページの未捕捉例外（pageerror）と console.error を監視し、1件でも出たらテストを失敗にする
// 共通フィクスチャ（issue #452）。画面が壊れたのに表示確認だけ通ってしまうのを防ぐ。
export const test = base.extend({
  page: async ({ page }, applyPage) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(`console.error: ${message.text()}`)
    })
    await applyPage(page)
    expect(errors).toEqual([])
  },
})

export { expect }

// セダン（標準）の既定の車両設定。共有URLの組み立てに使う。
export const SEDAN_VEHICLE = {
  body: { weightKg: 1200, frontWeightRatio: 0.55, centerOfGravityHeight: 0.5, wheelbase: 2.5 },
  suspension: { springConstant: 30000, damperCoefficient: 3000, strokeLength: 0.25, mountHeight: 0.19 },
  tire: { diameter: 0.6, stiffness: 200000 },
}

// 共有URL用のクエリ値（store/urlConfig.tsのencodeSharedConfigと同じ形式）。
export function encodeSharedConfig(vehicle: unknown, testConditions: unknown): string {
  return Buffer.from(encodeURIComponent(JSON.stringify({ vehicle, testConditions }))).toString('base64')
}

// スクリーンショット名にproject名を付け、デスクトップ・モバイルで同名ファイルが上書きされないようにする。
export function shotName(testInfo: { project: { name: string } }, name: string): string {
  return `${name}-${testInfo.project.name}`
}
