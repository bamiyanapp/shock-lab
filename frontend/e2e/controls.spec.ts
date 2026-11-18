import { test, expect } from './fixtures'

test('プリセット「トラック」を選ぶと車重が8000になる', async ({ page }) => {
  await page.goto('/shock-lab/')
  await page.getByLabel('プリセット').selectOption({ label: 'トラック' })

  await expect(page.getByRole('spinbutton', { name: /車重/ })).toHaveValue('8000')
})

test('開始→✕→「再開」「最初から」が表示される', async ({ page }) => {
  await page.goto('/shock-lab/')
  await page.getByRole('button', { name: '開始' }).click()
  await page.getByRole('button', { name: 'フルスクリーンを閉じる' }).click()

  await expect(page.getByRole('button', { name: '再開' })).toBeVisible()
  await expect(page.getByRole('button', { name: '最初から' })).toBeVisible()
})
