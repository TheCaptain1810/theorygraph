import { expect, test } from '@playwright/test';

// Everything here runs signed out: no saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('signed-out visitor', () => {
  test('can browse the catalogue, sees sign-in options and TMDB attribution', async ({ page }) => {
    await page.goto('/films');
    for (const title of ['Metropolis', 'Nosferatu', 'The Cabinet of Dr. Caligari']) {
      await expect(page.getByRole('link', { name: new RegExp(title) })).toBeVisible();
    }
    const nav = page.getByRole('navigation', { name: 'Main' });
    await expect(nav.getByRole('link', { name: 'Log in' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Sign up' })).toBeVisible();
    await expect(page.getByText(/not endorsed or certified by TMDB/)).toBeVisible();
  });

  test('is sent to log in for authoring pages, and back afterwards is preserved in the URL', async ({
    page,
  }) => {
    await page.goto('/new/interpretation?filmId=00000000-0000-4000-8000-000000000000');
    await expect(page).toHaveURL(/\/login\?next=%2Fnew%2Finterpretation/);
    await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
    await page.goto('/moderation');
    await expect(page).toHaveURL(/\/login\?next=%2Fmoderation/);
  });

  test('shows a wrong-password error without revealing whether the account exists', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nobody-here@example.com');
    await page.getByLabel('Password').fill('definitely-wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByRole('alert')).toHaveText('Email or password is incorrect.');
    await expect(page).toHaveURL(/\/login/);
  });

  test('major spoilers stay out of the page and the API until deliberately revealed', async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));

    await page.goto('/films');
    const listResponse = page.waitForResponse((r) =>
      /\/api\/films\/[^/]+\/interpretations/.test(r.url()),
    );
    await page.getByRole('link', { name: /Nosferatu/ }).click();
    const body = await (await listResponse).text();
    expect(body).not.toContain('Sunrise as the story');
    expect(body).not.toContain('light and time');

    await expect(page.getByText('Concealed: contains major spoilers')).toBeVisible();
    await expect(page.getByText(/Major spoilers$/)).toBeVisible(); // status as text, not colour alone
    await expect(page.getByText('Sunrise as the story')).toHaveCount(0);

    await page.getByRole('link', { name: /open this interpretation/i }).click();
    await expect(page.getByRole('button', { name: /reveal major spoilers/i })).toBeVisible();
    await expect(page.getByText('light and time')).toHaveCount(0);
    expect(requests.some((u) => u.includes('reveal=true'))).toBe(false);

    await page.getByRole('button', { name: /reveal major spoilers/i }).click();
    await expect(page.getByText(/light and time as the decisive force/)).toBeVisible();
    expect(requests.some((u) => u.includes('reveal=true'))).toBe(true);
  });

  test('a public profile shows contributions with spoiler gating', async ({ page }) => {
    await page.goto('/profile/sample_author');
    await expect(page.getByText('[SAMPLE] The machine as a devouring idol')).toBeVisible();
    await expect(page.getByText('Concealed: contains major spoilers')).toBeVisible();
    await expect(page.getByText('Sunrise as the story')).toHaveCount(0);
    await page.goto('/profile/nobody_by_this_name');
    await expect(page.getByText('User not found')).toBeVisible();
  });

  test('is keyboard accessible: first Tab reaches the skip link', async ({ page }) => {
    await page.goto('/films');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  });

  test('has no horizontal scrolling on a phone-sized screen', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    for (const path of ['/', '/films', '/guidelines', '/login', '/signup']) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
    }
  });
});
