import { test, expect } from '@playwright/test';

test('renders home dashboard layout', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('OptiTrade')).toBeVisible();
});
