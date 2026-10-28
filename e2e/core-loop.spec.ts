import { expect, test } from '@playwright/test';
import { loadE2eEnv, requireCredentials } from './global-setup';

// Signed in as the e2e user (session saved by auth.setup.ts).
test('write, discuss, edit and delete an interpretation', async ({ page, browser, baseURL }) => {
  const stamp = Date.now();
  const title = `E2E reading ${stamp}`;
  const claim = `The recurring staircase is a symbol of class mobility ${stamp}.`;

  await page.goto('/films');
  await expect(page.getByRole('link', { name: /signed in as/i })).toBeVisible();
  await page.getByRole('link', { name: /Metropolis/ }).click();
  await page.getByRole('link', { name: 'Write an interpretation' }).click();
  await expect(page.getByRole('heading', { name: 'Write an interpretation' })).toBeVisible();

  // Empty and invalid input is rejected with specific messages, before any request is made.
  await page.getByRole('button', { name: 'Publish interpretation' }).click();
  await expect(page.getByText('Give your interpretation a title.')).toBeVisible();
  await expect(page.getByText('State your claim.')).toBeVisible();
  await expect(page.getByText('Add at least one observation or scene reference.')).toBeVisible();

  await page.getByLabel('Title').fill(title);
  await page.getByLabel('Main claim').fill(claim);
  await page.getByLabel('Tags (optional)').fill('Staircase, Class');
  await page.getByLabel('What do you point to?').fill('The camera tilts up as the figure climbs.');
  await page.getByLabel('Timestamp (optional)').fill('-5');
  await page.getByRole('button', { name: 'Publish interpretation' }).click();
  await expect(page.getByText('Use a time like 1:15 or 1:02:05.')).toBeVisible(); // no negative timestamps

  await page.getByLabel('Timestamp (optional)').fill('1:15');
  await page.getByRole('button', { name: 'Publish interpretation' }).click();

  // Stable public URL for the new interpretation.
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(page).toHaveURL(/\/interpretations\/[0-9a-f-]{36}$/);
  const url = page.url();
  await expect(page.getByText(claim)).toBeVisible();
  await expect(page.getByText(/at 1:15/)).toBeVisible(); // timestamp parsed from "1:15" and shown back
  await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Report' })).toHaveCount(0); // not on your own work

  // A counter-reading with its own evidence; the original stays visible.
  await page.getByRole('button', { name: 'Add counter-reading' }).click();
  await expect(page.getByText('Describe your alternative reading.')).toBeVisible();
  const counter = `A different reading: it is about labour, not class ${stamp}.`;
  await page.getByLabel('Your reading').fill(counter);
  await page.getByRole('button', { name: 'Add observation' }).click();
  await page
    .getByRole('form', { name: 'Add a counter-reading' })
    .getByLabel('What do you point to?')
    .fill('The stairs are crowded with workers.');
  await page.getByRole('button', { name: 'Add counter-reading' }).click();
  await expect(page.getByText(counter)).toBeVisible();
  await expect(page.getByText('The stairs are crowded with workers.')).toBeVisible();
  await expect(page.getByText(claim)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Counter-readings (1)' })).toBeVisible();

  // It is public: a signed-out visitor sees it, with no owner controls.
  // browser.newContext() inherits the project's saved login, so ask for an empty session explicitly.
  const anon = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  });
  const anonPage = await anon.newPage();
  await anonPage.goto(url);
  await expect(anonPage.getByRole('heading', { level: 1, name: title })).toBeVisible();
  await expect(anonPage.getByRole('link', { name: 'Edit' })).toHaveCount(0);
  await expect(anonPage.getByRole('button', { name: 'Delete' })).toHaveCount(0);

  // It appears on the author's public profile and on the film page.
  await page.goto('/profile/pranavpise');
  await expect(page.getByRole('link', { name: title })).toBeVisible();

  // Edit: only the title changes, and the change is public.
  await page.goto(url);
  await page.getByRole('link', { name: 'Edit' }).click();
  await expect(page.getByRole('heading', { name: 'Edit interpretation' })).toBeVisible();
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Nothing has changed yet.')).toBeVisible();
  const newTitle = `${title} (edited)`;
  await page.getByLabel('Title').fill(newTitle);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('heading', { level: 1, name: newTitle })).toBeVisible();
  await anonPage.reload();
  await expect(anonPage.getByRole('heading', { level: 1, name: newTitle })).toBeVisible();

  // Delete needs a second, deliberate click; afterwards it is gone for everyone.
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: newTitle })).toBeVisible(); // not yet deleted
  await page.getByRole('button', { name: 'Yes, delete it' }).click();
  await expect(page).toHaveURL(/\/films\/[0-9a-f-]{36}$/);
  await anonPage.reload();
  await expect(anonPage.getByText('Interpretation not found')).toBeVisible();
  await page.goto('/profile/pranavpise');
  await expect(page.getByRole('link', { name: newTitle })).toHaveCount(0);
  await anon.close();
});

test('signing out returns to the signed-out experience', async ({ browser, baseURL }) => {
  // Log in with a session of its own: logging out revokes the session it runs in, and every
  // other test shares the saved one.
  loadE2eEnv();
  const { email, password } = requireCredentials();
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByRole('link', { name: /signed in as/i })).toBeVisible();

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(
    page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Log in' }),
  ).toBeVisible();
  await page.goto('/new/interpretation?filmId=00000000-0000-4000-8000-000000000000');
  await expect(page).toHaveURL(/\/login/);
  await context.close();
});
