import { expect, test } from '@playwright/test'

test('app boots and renders the Arabic placeholder', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /إنستاهيلث/ })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
})
