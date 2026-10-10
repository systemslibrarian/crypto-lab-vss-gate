import { expect, test } from '@playwright/test';

for (const width of [1280, 380, 320]) {
  test(`full-field random mode and deterministic-mode caveats at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('.');
    await page.locator('#crypto-params > summary').click();
    const parameters = page.locator('#crypto-params');
    await expect(parameters).toContainText('full scalar field [0, q), including zero');
    await expect(parameters).toContainText('highest-degree coefficient may be zero');
    await expect(parameters).toContainText('for reading, not for secrecy');
    await expect(page.locator('#deterministic-mode')).toBeChecked();
    await page.locator('#deterministic-mode').uncheck();
    await expect(page.locator('#deterministic-seed')).toBeDisabled();
    await page.locator('#run-feldman').click();
    await expect(page.locator('[aria-label="Feldman verification results"] tbody tr')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  });
}
