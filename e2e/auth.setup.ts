import { expect, test as setup } from '@playwright/test';
import { loadE2eEnv, requireCredentials } from './global-setup';

// Logs in once through the real UI against real Supabase, and saves the browser session for the other tests.
setup('sign in as the e2e user', async ({ page }) => {
  loadE2eEnv();
  const { email, password, username } = requireCredentials();

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();

  await expect(
    page.getByRole('link', { name: new RegExp(`signed in as ${username}`, 'i') }),
  ).toBeVisible();
  await page.context().storageState({ path: 'e2e/.auth/user.json' });
});
