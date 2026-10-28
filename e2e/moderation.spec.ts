import { expect, test, type Browser } from '@playwright/test';
import { setRole } from './db';
import { loadE2eEnv, requireCredentials } from './global-setup';

// Report -> moderate -> restore across two roles. One shared account, so the steps run in order.
test.describe.configure({ mode: 'serial' });

const SAMPLE_TITLE = '[SAMPLE] The machine as a devouring idol';
let interpretationUrl = '';
let username = '';

test.beforeAll(() => {
  loadE2eEnv();
  username = requireCredentials().username;
});

test.afterAll(async () => {
  await setRole(username, 'user').catch(() => {}); // leave the account as an ordinary user
});

async function anonymousPage(browser: Browser, baseURL: string | undefined) {
  // An explicitly empty session: browser.newContext() would otherwise inherit the saved login.
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  return { page: await context.newPage(), close: () => context.close() };
}

test('a signed-in user can report someone else’s interpretation', async ({ page }) => {
  await page.goto('/films');
  await page.getByRole('link', { name: /Metropolis/ }).click();
  await page.getByRole('link', { name: SAMPLE_TITLE }).click();
  await expect(page.getByRole('heading', { level: 1, name: SAMPLE_TITLE })).toBeVisible();
  interpretationUrl = page.url();

  await page.getByRole('button', { name: 'Report' }).first().click();
  await page.getByLabel('Reason').selectOption('spam');
  await page.getByLabel('Details (optional)').fill('e2e: pretending this is an advert');
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText('Thanks. A moderator will review your report.')).toBeVisible();
});

test('an ordinary user cannot open the moderation queue', async ({ page }) => {
  await page.goto('/moderation');
  await expect(page.getByText('Moderators only')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Moderation' })).toHaveCount(0);
});

test('a moderator hides the reported content and it disappears from the public site', async ({
  page,
  browser,
  baseURL,
}) => {
  await setRole(username, 'moderator'); // there is deliberately no UI for assigning roles
  await page.goto('/moderation'); // fresh load: the role comes from the server
  await expect(page.getByRole('link', { name: 'Moderation' })).toBeVisible();

  await expect(page.getByText('Spam')).toBeVisible();
  await expect(page.getByText('e2e: pretending this is an advert')).toBeVisible();
  await expect(page.getByText(/devouring idol/)).toBeVisible();
  await page.getByLabel(/Note/).fill('e2e: hiding for the test');
  await page.getByRole('button', { name: 'Hide content' }).click();
  await expect(page.getByText('No open reports')).toBeVisible();

  const anon = await anonymousPage(browser, baseURL);
  await anon.page.goto(interpretationUrl);
  await expect(anon.page.getByText('Interpretation not found')).toBeVisible();
  await anon.close();
});

test('the moderator can restore it from the Handled tab', async ({ page, browser, baseURL }) => {
  await page.goto('/moderation');
  await page.getByRole('button', { name: 'Handled' }).click();
  await expect(page.getByText('Status:')).toContainText('Hidden');
  await page.getByRole('button', { name: 'Restore content' }).click();
  await expect(page.getByRole('button', { name: 'Restore content' })).toHaveCount(0);
  await expect(page.getByText('Status:')).toContainText('Published');

  const anon = await anonymousPage(browser, baseURL);
  await anon.page.goto(interpretationUrl);
  await expect(anon.page.getByRole('heading', { level: 1, name: SAMPLE_TITLE })).toBeVisible();
  await anon.close();
});
