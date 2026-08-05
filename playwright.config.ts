import { defineConfig, devices } from '@playwright/test';

/**
 * Visual regression config.
 *
 * Exists so this app can adopt the shared Xomware design tokens safely. Its own
 * $text-* scale differs from the shared one ($text-xs 0.75 vs 0.8125rem,
 * $text-xl 1.25 vs 1.5rem, $text-4xl 2.5 vs 2.375rem), so adoption resizes text
 * app-wide. Without screenshots there is nothing to catch what that breaks.
 *
 * Runs against the production build, not `ng serve` — dev-mode CSS and bundling
 * differ from what ships.
 */
const PORT = 4310;

export default defineConfig({
  testDir: './tests/visual',
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],

  expect: {
    toHaveScreenshot: {
      // ABSOLUTE pixel count, not a ratio. A ratio of even 1% is ~25,000 pixels
      // on a tall page, which is enough to hide a heading changing size — the
      // exact thing this suite exists to detect.
      maxDiffPixels: 150,
      animations: 'disabled',
      caret: 'hide',
    },
  },

  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'retain-on-failure',
    // Context level, so it applies before the first navigation.
    reducedMotion: 'reduce',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
  ],

  webServer: {
    // Builds its own input rather than trusting whatever is in dist/ — a
    // stale bundle left by another build presents as flaky screenshots, not as
    // an obvious error.
    command: `npm run build:visual && npx serve -s dist/xomper-frontend -l ${PORT} --no-clipboard`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
