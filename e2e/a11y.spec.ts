import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/**
 * Strict WCAG regression gate for the VSS Gate (Feldman + Pedersen VSS) demo.
 *
 * The app is a single scrolling page rendered by main.ts into #app. Result
 * tables (Feldman / Pedersen verification, the side-by-side comparison) are
 * only injected after the corresponding "Run" button is clicked, and the
 * Internals + Crypto Parameters sections are <details> collapsibles. So we
 * DRIVE every live demo and EXPAND every <details> before scanning, in both
 * themes, so axe measures the fully-populated page.
 */

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

// Neutralize animation/transition/opacity so transient states can't hide text
// from the contrast checker.
async function killMotion(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `*,*::before,*::after{
      animation-duration:0s!important;animation-delay:0s!important;
      transition-duration:0s!important;transition-delay:0s!important;
      opacity:1!important;scroll-behavior:auto!important;
    }`,
  });
}

async function openAllDetails(page: Page): Promise<void> {
  await page.evaluate(() => {
    for (const d of document.querySelectorAll('details')) {
      (d as HTMLDetailsElement).open = true;
    }
  });
}

// Click each Run button so its injected result region exists during the scan.
async function driveDemos(page: Page): Promise<void> {
  await page.locator('#run-feldman').click();
  await expect(
    page.locator('[aria-label="Feldman verification results"] table')
  ).toBeVisible();

  await page.locator('#run-pedersen').click();
  await expect(
    page.locator('[aria-label="Pedersen verification results"] table')
  ).toBeVisible();

  await page.locator('#run-compare').click();
  await expect(
    page.locator('[aria-label="Protocol comparison table"] table')
  ).toBeVisible();
}

async function scan(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const summary = results.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 5),
  }));
  expect(summary).toEqual([]);
}

test.beforeEach(async ({ page }) => {
  await page.goto('.');
  await expect(page.locator('#cl-theme-toggle')).toBeVisible();
  await expect(page.locator('#run-feldman')).toBeVisible();
  await killMotion(page);
});

test('no WCAG A/AA violations in dark theme (all demos driven)', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await driveDemos(page);
  await openAllDetails(page);
  await scan(page);
});

test('no WCAG A/AA violations in light theme (all demos driven)', async ({ page }) => {
  await page.locator('#cl-theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await driveDemos(page);
  await openAllDetails(page);
  await scan(page);
});
