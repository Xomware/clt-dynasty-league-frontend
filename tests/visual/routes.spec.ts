import { test, expect, type Page } from '@playwright/test';

/**
 * Baseline screenshots of the publicly reachable routes.
 *
 * Purpose: make adopting the shared Xomware design tokens verifiable. This app
 * defines its own $text-* scale at different values, so adoption resizes text
 * app-wide — reflow is the failure mode and only screenshots catch it.
 *
 * Coverage limit, stated plainly: most of this app sits behind AuthGuard and a
 * Sleeper account. What is covered here is the login page, search, and the
 * guest-accessible views. That is a real but partial safety net — anything
 * behind auth still needs manual review.
 */
const ROUTES = [
  { path: '/login', name: 'login' },
  { path: '/search', name: 'search' },
  { path: '/selected-profile', name: 'selected-profile' },
  { path: '/selected-league', name: 'selected-league' },
  { path: '/selected-team', name: 'selected-team' },
];

/**
 * Backend calls are stubbed so a diff means "the CSS changed", not "the data
 * changed". Live Sleeper data would make every roster move look like a
 * regression.
 */
async function stubBackend(page: Page): Promise<void> {
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    const isLocal = url.startsWith('http://127.0.0.1:') || url.startsWith('http://localhost:');
    const isFont = url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com');
    if (isLocal || isFont) {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);

  // Height must stop changing before capture, otherwise a late render lands
  // between measurement and screenshot and shows up as flake.
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __h?: number; __stable?: number };
      const h = document.body.scrollHeight;
      if (w.__h === h) {
        w.__stable = (w.__stable ?? 0) + 1;
      } else {
        w.__h = h;
        w.__stable = 0;
      }
      return (w.__stable ?? 0) >= 3;
    },
    undefined,
    { polling: 100, timeout: 10_000 },
  );
}

for (const route of ROUTES) {
  test(`${route.name} renders consistently`, async ({ page }) => {
    await stubBackend(page);
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    await settle(page);

    await expect(page).toHaveScreenshot(`${route.name}.png`, { fullPage: true });
  });
}
