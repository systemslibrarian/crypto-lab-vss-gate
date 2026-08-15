import { test } from '@playwright/test';
import { boot, driveAllStates, expectBaselineNotStale, NARROW } from './gate';

/**
 * WCAG A/AA regression gate.
 *
 * The lab is driven the way a visitor drives it: the honest run of all three
 * exhibits first, then advanced mode, then each of the three dishonesties this
 * lab models — a Feldman share bumped off its commitment (and moved to a second
 * victim), a Shamir share corrupted with no commitments to catch it, and the
 * Pedersen equivocation panel — then each teaching disclosure opened by its own
 * summary, the invalid-secret warning produced and cleared, and a seeded
 * deterministic run. Every resulting state is scanned in both themes at desktop
 * and phone width.
 *
 * See `gate.ts` for why nothing is injected into the page, why no `<details>`
 * is opened from script, why every step is scanned rather than only the last,
 * and why `violations` is not the whole oracle.
 */

for (const theme of ['dark', 'light'] as const) {
  test(`no WCAG A/AA violations in ${theme} theme`, async ({ page }) => {
    test.setTimeout(900_000);
    await boot(page, theme);
    await driveAllStates(page, theme);
    expectBaselineNotStale();
  });

  test(`no WCAG A/AA violations in ${theme} theme at 380px`, async ({ page }) => {
    test.setTimeout(900_000);
    await page.setViewportSize(NARROW);
    await boot(page, theme);
    await driveAllStates(page, `${theme} @380px`);
    expectBaselineNotStale();
  });
}
