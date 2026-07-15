import { expect, test } from '@playwright/test';

test.describe('frontend user flows', () => {
  test('shows the public dashboard shell for a signed-out visitor', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('OptiTrade')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit Layout' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible();
  });

  test('toggles edit mode and exposes the widget library', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Edit Layout' }).click();

    await expect(page.getByRole('button', { name: 'Editing' })).toBeVisible();
    await expect(page.getByText('Widget Library').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open chat' })).not.toBeVisible();

    await page.getByRole('button', { name: 'Editing' }).click();

    await expect(page.getByRole('button', { name: 'Edit Layout' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open chat' })).toBeVisible();
  });

  test('navigates from the home page into the auth flow', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('link', { name: 'Sign In' }).click();

    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByText('Account Access')).toBeVisible();

    const firebaseSetupNotice = page.getByText(
      'Firebase config missing. Set NEXT_PUBLIC_FIREBASE_* environment variables.',
    );

    if (await firebaseSetupNotice.isVisible()) {
      await expect(firebaseSetupNotice).toBeVisible();
    } else {
      await expect(page.getByRole('button', { name: 'Sign In' }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: 'Register' })).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expect(page.getByLabel('Password')).toBeVisible();
    }
  });
});
