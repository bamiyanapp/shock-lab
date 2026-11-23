import { test, expect, SEDAN_VEHICLE, encodeSharedConfig } from './fixtures'

test('共有URLで車重・バネ定数を指定して開くと、スライダーにその値が出る', async ({ page }) => {
  const vehicle = {
    ...SEDAN_VEHICLE,
    body: { ...SEDAN_VEHICLE.body, weightKg: 2000 },
    suspension: { ...SEDAN_VEHICLE.suspension, springConstant: 50000 },
  }
  const config = encodeSharedConfig(vehicle, { speed: 10, terrainType: 'smallBump' })
  await page.goto(`/shock-lab/?config=${config}`)

  await expect(page.getByRole('slider', { name: /車重/ })).toHaveValue('2000')
  await expect(page.getByRole('slider', { name: /バネ定数/ })).toHaveAttribute('aria-valuetext', '50 kN/m')
})

test('壊れたconfig値でも既定値で起動し、エラーにならない', async ({ page }) => {
  await page.goto('/shock-lab/?config=xxx')

  await expect(page.getByRole('button', { name: '開始' })).toBeVisible()
  await expect(page.getByRole('slider', { name: /車重/ })).toHaveValue('1200')
})
