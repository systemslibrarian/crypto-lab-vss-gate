import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { auditContrast, formatContrastFailures } from './contrast';
import { auditNonText, formatNonTextFailures, type NonTextFailure } from './nontext';
import { NONTEXT_BASELINE } from './nontext-baseline';

export const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

/** A phone-width viewport, for the WCAG 1.4.10 reflow half of the gate. */
export const NARROW = { width: 380, height: 800 };

/**
 * Shared machinery for the WCAG gate.
 *
 * Three rules govern everything here:
 *
 *  1. NOTHING IS INJECTED INTO THE PAGE BEFORE A SCAN. The gate this replaces
 *     pushed `*{opacity:1!important}` through `addStyleTag` before scanning,
 *     and force-opened every `<details>` from script rather than clicking a
 *     summary — six teaching panels open at once, which is not a document this
 *     lab produces.
 *
 *  2. IT DROVE THREE BUTTONS AND SCANNED ONCE, AT THE END — and it drove them
 *     only in the configuration the lab happens to ship in. That default is
 *     `cheatEnabled: true`, `shamirCheatEnabled: true`, so the tones it saw
 *     were the FAILING ones: `.badge.fail`, `.row-fail`, `.row-focus`,
 *     `.result-bad`. The half that went unmeasured is the honest half —
 *     `.badge.pass` in a table where every row passes, and `.result-ok` — which
 *     is the state a reader has to reach before the failure means anything.
 *     Whichever way a lab's defaults fall, a gate that scans one configuration
 *     scans one half.
 *
 *  3. EVERY SCAN ASSERTS ITS CONTENT IS PRESENT FIRST, and there are scans well
 *     past first paint. axe over an empty container passes having checked
 *     nothing: at first paint no Feldman table, no Pedersen table and no
 *     comparison exist at all.
 *
 *  4. `violations` IS NOT THE WHOLE ORACLE. See `scan`.
 */

/**
 * Wait for every running animation and transition to drain.
 *
 * Transitions drain in waves, not in one batch, so a poll for "nothing running
 * right now" can exit through a gap between waves. Require quiescence to hold
 * for several consecutive frames instead.
 */
export async function settle(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __quietFrames?: number };
      const running = document.getAnimations().filter((a) => a.playState === 'running');
      w.__quietFrames = running.length === 0 ? (w.__quietFrames ?? 0) + 1 : 0;
      return w.__quietFrames >= 6;
    },
    undefined,
    { timeout: 20_000, polling: 'raf' }
  );
}

/**
 * Assert that reduced motion left the page visible, not merely un-animated.
 *
 * The failure mode this guards against is an element whose only route to its
 * visible state is an animation, in a stylesheet whose reduced-motion block
 * cancels that animation without restoring its end state — the element then
 * renders at `opacity: 0` for every reader with the preference set. This lab's
 * reduced-motion block collapses durations to 0.01ms rather than setting
 * `animation: none`, which is the safe form — a cancelled animation loses its
 * end state, a zero-length one still lands on it.
 *
 * `aria-hidden` subtrees are excluded. The cost of that exclusion is stated
 * plainly: text removed from the accessibility tree AND painted at zero opacity
 * is not checked here.
 */
async function expectNotBlank(page: Page, label: string): Promise<void> {
  const invisible = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of Array.from(document.querySelectorAll('body *'))) {
      const own = Array.from(el.childNodes)
        .filter((n) => n.nodeType === Node.TEXT_NODE)
        .map((n) => n.textContent ?? '')
        .join('')
        .trim();
      if (!own) continue;
      // Deliberately hidden subtrees are not "blank", they are closed.
      if (!(el as HTMLElement).checkVisibility?.({ checkVisibilityCSS: true })) continue;
      if (el.closest('[aria-hidden="true"]')) continue;
      let effective = 1;
      let node: Element | null = el;
      while (node) {
        effective *= parseFloat(getComputedStyle(node).opacity);
        node = node.parentElement;
      }
      if (effective === 0) {
        out.push(`${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}`);
      }
    }
    return Array.from(new Set(out));
  });
  expect(invisible, `no visible text may render at opacity 0 in state: ${label}`).toEqual([]);
}

/**
 * Load the page in a known theme with reduced motion actually in effect, and
 * assert the content every scan relies on is really on the page.
 *
 * `test.use({ reducedMotion })` silently does nothing on Playwright 1.61.1, so
 * the emulation is applied imperatively BEFORE the navigation and then
 * *asserted* from inside the page, because a silent no-op there would mean
 * an emulation that silently did nothing would leave the gate certifying a
 * different rendering than the one it claims to.
 */
export async function boot(page: Page, theme: 'dark' | 'light'): Promise<void> {
  // A click on a control that never becomes actionable otherwise burns the
  // whole test timeout and reports nothing useful. 20s turns that silent hang
  // into a named failure naming the locator.
  page.setDefaultTimeout(20_000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
  await page.goto('.');
  expect(
    await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches),
    'reduced-motion emulation must actually be in effect'
  ).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);

  // The whole page is built by `src/main.ts` into an empty `#app`, so a
  // navigation that resolves proves nothing. Require one control from each of
  // the four lab steps.
  await expect(page.locator('#run-feldman')).toBeVisible();
  await expect(page.locator('#run-pedersen')).toBeVisible();
  await expect(page.locator('#run-compare')).toBeVisible();
  // This lab SHIPS dishonest: both cheat toggles default to on, so the state a
  // visitor lands in is the one where verification fails. Asserted rather than
  // assumed — the first version of this gate asserted the opposite and was
  // wrong about its own subject.
  await expect(page.locator('#cheat-enabled')).toBeChecked();
  await expect(page.locator('#shamir-cheat-enabled')).toBeChecked();
  // The three result regions do not exist yet — that is the whole reason
  // `driveAllStates` exists.
  await expect(page.locator('[aria-label="Feldman verification results"]')).toHaveCount(0);
  await expect(page.locator('[aria-label="Pedersen verification results"]')).toHaveCount(0);
  await expect(page.locator('[aria-label="Protocol comparison table"]')).toHaveCount(0);
  // Six teaching disclosures, all shut, as they are for every visitor.
  await expect(page.locator('details[open]')).toHaveCount(0);

  await settle(page);
  await expectNotBlank(page, `${theme} first paint`);
}

/**
 * Assert the page does not require horizontal scrolling.
 *
 * WCAG 1.4.10 (Reflow, AA). axe has no rule for this at all, and this lab is a
 * plausible offender: it prints curve points and field elements as long hex in
 * five separate tables, and lays the lab out on `auto-fit` grids whose tracks
 * have 160–260px minimums.
 */
export async function expectNoHorizontalOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    if (doc.scrollWidth <= doc.clientWidth) return null;

    // Only elements that actually push the DOCUMENT sideways are culprits. A
    // wide box inside an `overflow-x: auto` wrapper has a huge bounding rect
    // but is clipped by its scroller and contributes nothing to the document's
    // scroll width — naming it sends you off fixing the wrong element. That
    // cost a run elsewhere in this fleet, and this lab has the same decoy:
    // every result table is wrapped in a `.table-wrap` that is its own
    // `overflow-x: auto` scroller.
    const clipped = (el: Element): boolean => {
      let n = el.parentElement;
      while (n && n !== doc) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip') return true;
        n = n.parentElement;
      }
      return false;
    };

    const over = Array.from(document.querySelectorAll('body *'))
      .map((el) => ({ el, r: el.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && x.r.right > doc.clientWidth + 1)
      .sort((a, b) => b.r.right - a.r.right);
    // Prefer an unclipped culprit; fall back to the widest clipped one rather
    // than reporting nothing, so the message always names something to look at.
    const widest = over.filter((x) => !clipped(x.el))[0] ?? over[0];
    return {
      scrollWidth: doc.scrollWidth,
      clientWidth: doc.clientWidth,
      widest: widest
        ? `${clipped(widest.el) ? '[clipped] ' : ''}${widest.el.tagName.toLowerCase()}${widest.el.id ? '#' + widest.el.id : ''}` +
          `${widest.el.getAttribute('class') ? '.' + widest.el.getAttribute('class')!.trim().split(/\s+/).join('.') : ''}` +
          ` @${Math.round(widest.r.width)}px right=${Math.round(widest.r.right)}`
        : '(none identified)',
    };
  });
  expect(overflow, `page must not scroll horizontally in state: ${label}`).toBeNull();
}

/**
 * Every scrolling container must be operable from the keyboard (WCAG 2.1.1).
 * If it holds no focusable content it needs `tabindex="0"`, so it becomes a
 * focus target arrow keys can then scroll.
 */
export async function expectScrollersReachable(page: Page, label: string): Promise<void> {
  const unreachable = await page.evaluate(() => {
    const FOCUSABLE = 'a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])';
    return Array.from(document.querySelectorAll<HTMLElement>('body *'))
      .filter((el) => el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
      .filter((el) => {
        const cs = getComputedStyle(el);
        return (
          ['auto', 'scroll'].includes(cs.overflowX) || ['auto', 'scroll'].includes(cs.overflowY)
        );
      })
      .filter((el) => el.tabIndex < 0 && !el.querySelector(FOCUSABLE))
      .map(
        (el) =>
          `${el.tagName.toLowerCase()}.${(el.getAttribute('class') ?? '').trim()}` +
          ` (${el.scrollWidth}x${el.scrollHeight} in ${el.clientWidth}x${el.clientHeight})`
      );
  });
  expect(
    Array.from(new Set(unreachable)),
    `scrolling regions with no keyboard route in state: ${label}`
  ).toEqual([]);
}

/**
 * Scan the page as it currently stands.
 *
 * Five assertions, because axe's `violations` array alone is not a complete
 * oracle:
 *
 *  - `violations` — the usual WCAG A/AA rule failures.
 *  - `incomplete` — axe's "could not decide" bucket, which never reaches the
 *    violations array. The one rule id allowed to remain incomplete is
 *    `color-contrast`, and only because the next assertion computes those
 *    ratios arithmetically — which matters more here than in most labs, since
 *    almost every tinted surface is a `color-mix()` axe declines to resolve.
 *    Everything else in that bucket is a real result axe simply could not
 *    finish — including `aria-prohibited-attr`, which is where an `aria-label`
 *    on a role-less div hides, a defect that never reaches the violations array
 *    at all.
 *  - arithmetic contrast — composite-aware WCAG 1.4.3 over every text node.
 *  - keyboard reachability of scrolling regions — WCAG 2.1.1.
 *  - reflow — WCAG 1.4.10, which axe has no rule for at all.
 */
/**
 * WCAG 1.4.11 and generated content, ratcheted against a per-repo baseline.
 *
 * Neither class has ANY other oracle: axe has no rule for non-text contrast,
 * and the arithmetic text walk cannot reach a control's boundary or a
 * `::before` glyph, because a pseudo-element is not an element and owns no text
 * node. Both were being found by hand-sampling screenshot pixels, which does
 * not regress-test.
 *
 * The backlog is real, so this does not block on it — but a check that merely
 * logs is not a gate, and this sweep has spent its whole length deleting checks
 * that could not fail. So it ratchets instead: anything NOT in the baseline
 * fails, anything in the baseline that got WORSE fails, and anything in the
 * baseline that has been FIXED fails until its entry is deleted. That last rule
 * is what stops the allowlist becoming a permanent exemption.
 */
const nonTextSeen = new Set<string>();

export async function expectNoNewNonTextFailures(page: Page, label: string): Promise<void> {
  const found = await auditNonText(page);
  // Capture mode: emit every finding and assert nothing, so a baseline can be
  // generated by the SAME path that checks it. Opt-in via env, and the run is
  // deliberately left failing at the end by `expectBaselineNotStale` so a
  // capture pass can never be mistaken for a passing gate.
  if (process.env.NT_BASELINE_CAPTURE) {
    for (const f of found) {
      console.log(`NTCAP|${f.kind}|${f.selector}|${f.ratio}|${f.required}|${/POSITIONED/.test(f.detail)}`);
    }
    return;
  }
  const problems: string[] = [];
  for (const f of found) {
    const key = `${f.kind}|${f.selector}`;
    nonTextSeen.add(key);
    const base = NONTEXT_BASELINE[key];
    if (!base) {
      problems.push(`NEW ${f.ratio}:1 (needs ${f.required}:1) [${f.kind}] ${f.selector} — ${f.detail}`);
    } else if (f.ratio < base.ratio - 0.01) {
      problems.push(
        `WORSE ${f.selector}: ${f.ratio}:1, baseline recorded ${base.ratio}:1`
      );
    }
  }
  expect(problems, `new or worsened non-text contrast in state: ${label}`).toEqual([]);
}

/**
 * Fail if a baselined finding never appeared during the whole drive.
 *
 * It has either been fixed — in which case delete the entry, which is the point
 * — or the drive stopped reaching the state that shows it, which is a coverage
 * regression worth knowing about. Call once, after `driveAllStates`.
 */
export function expectBaselineNotStale(): void {
  const unseen = Object.keys(NONTEXT_BASELINE).filter((k) => !nonTextSeen.has(k));
  expect(
    unseen,
    'baselined non-text findings that no longer appear — delete them from nontext-baseline.ts (or restore the drive state that showed them)'
  ).toEqual([]);
}

export async function scan(page: Page, label: string): Promise<void> {
  await settle(page);
  await expectNotBlank(page, label);
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();

  const violations = results.violations.map((v) => ({
    state: label,
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
  }));
  expect(violations, `axe violations in state: ${label}`).toEqual([]);

  const unexplainedIncomplete = results.incomplete
    .filter((v) => v.id !== 'color-contrast')
    .map((v) => ({
      state: label,
      id: v.id,
      nodes: v.nodes.map((n) => n.target.join(' ')).slice(0, 8),
    }));
  expect(unexplainedIncomplete, `axe incomplete results in state: ${label}`).toEqual([]);

  const contrast = Array.from(new Set(formatContrastFailures(await auditContrast(page))));
  expect(contrast, `measured contrast failures in state: ${label}`).toEqual([]);

  await expectNoNewNonTextFailures(page, label);
  await expectScrollersReachable(page, label);
  await expectNoHorizontalOverflow(page, label);
}



/** Open a `<details>` the way a reader does, and wait for it to actually open. */
async function openDisclosure(page: Page, selector: string): Promise<void> {
  await page.locator(`${selector} > summary`).click();
  await expect(page.locator(selector)).toHaveAttribute('open', '');
}

/**
 * Drive the lab through the states that render content, scanning each.
 *
 * Three things shape this drive:
 *
 *  - BOTH SIDES OF EVERY VERDICT. Verifiable secret sharing exists so a
 *    dishonest dealer is caught, and this lab models three dishonesties: a
 *    Feldman share bumped off its commitment, a Shamir share corrupted with no
 *    commitments to catch it, and a Pedersen commitment opened two ways. It
 *    also SHIPS with the first two switched on, so the failing tones are what a
 *    visitor sees on arrival and the passing ones — `.badge.pass` across a
 *    fully verified table, `.result-ok` — are what nothing had scanned. The
 *    drive therefore turns the cheats OFF first, scans the honest run, and then
 *    turns each back on.
 *
 *  - THE DISCLOSURES ARE OPENED ONE AT A TIME, BY THEIR SUMMARIES. There are
 *    six, and the old gate set `.open` on all of them from script at once.
 *    Opening them individually is both the state a reader produces and the only
 *    way to know which one a failure belongs to.
 *
 *  - THE INVALID-INPUT BRANCH IS A REAL STATE. A secret that is not a whole
 *    number renders a `role="alert"` callout saying the lab has fallen back to
 *    1 — a warning tone that exists nowhere else on the page.
 */
export async function driveAllStates(page: Page, theme: string): Promise<void> {
  const scanAt = (s: string): Promise<void> => scan(page, `${theme} / ${s}`);

  await scanAt('first paint');

  await page.locator('a.cl-skip-link').focus();
  await scanAt('skip link focused');

  // ── The honest run: reached by turning the shipped cheats OFF ────────────
  await page.locator('#cheat-enabled').uncheck();
  await page.locator('#shamir-cheat-enabled').uncheck();
  await page.locator('#run-feldman').click();
  await expect(page.locator('[aria-label="Feldman verification results"] table')).toBeVisible();
  await expect(page.locator('.badge.fail')).toHaveCount(0);
  // Scoped to step 2: the reconstruction block in step 1 is also `.result-ok`.
  await expect(page.locator('#step-2 .result-ok')).toBeVisible();
  await scanAt('Feldman run, every share verified');

  await page.locator('#run-pedersen').click();
  await expect(page.locator('[aria-label="Pedersen verification results"] table')).toBeVisible();
  await scanAt('Pedersen run, every share verified');

  await page.locator('#run-compare').click();
  await expect(page.locator('[aria-label="Protocol comparison table"] table')).toBeVisible();
  await scanAt('protocol comparison rendered');

  // Display-only: reveals the polynomial coefficients already computed, so it
  // invalidates no run and the tables above stay on screen beneath it.
  await page.locator('#advanced-mode').check();
  await scanAt('advanced mode, coefficients revealed');

  // ── The dishonest dealer: a Feldman share off its commitment ─────────────
  // Toggling this clears the previous runs, so the exhibits are re-run.
  await page.locator('#cheat-enabled').check();
  await expect(page.locator('[aria-label="Feldman verification results"]')).toHaveCount(0);
  await scanAt('cheat armed, previous runs cleared');

  await page.locator('#run-feldman').click();
  await expect(page.locator('[aria-label="Feldman verification results"] table')).toBeVisible();
  await expect(page.locator('.badge.fail').first()).toBeVisible();
  await expect(page.locator('.row-fail').first()).toBeVisible();
  await expect(page.locator('#step-2 .result-bad')).toBeVisible();
  await scanAt('Feldman catches the tampered share');

  await page.locator('#run-pedersen').click();
  await expect(page.locator('[aria-label="Pedersen verification results"] table')).toBeVisible();
  await scanAt('Pedersen run against the same tampered dealer');

  // A different victim: the `.row-focus` highlight follows the chosen index.
  await page.locator('#feldman-cheat-participant').selectOption('3');
  await page.locator('#run-feldman').click();
  await expect(page.locator('.row-focus')).toBeVisible();
  await scanAt('cheat moved to participant 3');

  // ── Shamir with no commitments: the corruption nothing catches ───────────
  await page.locator('#shamir-cheat-enabled').check();
  await expect(page.locator('[aria-label="Shamir shares table"]')).toBeVisible();
  await scanAt('Shamir share corrupted, undetectable');

  await page.locator('#shamir-cheat-participant').selectOption('3');
  await scanAt('Shamir corruption moved to participant 3');

  // ── The teaching disclosures, one at a time ──────────────────────────────
  // Three of the four live INSIDE a result block: `#feldman-check-decomp` and
  // `#feldman-homomorphism` are rendered by the Feldman run, and
  // `#pedersen-equivocation` by the Pedersen one. Changing any control calls
  // `clearRuns()`, which tears all of them back out — so both exhibits are
  // re-run here rather than assumed to still be on screen from earlier.
  await page.locator('#run-pedersen').click();
  await expect(page.locator('[aria-label="Pedersen verification results"] table')).toBeVisible();
  for (const id of [
    '#feldman-check-decomp',
    '#feldman-homomorphism',
    '#pedersen-equivocation',
    '#crypto-params',
  ]) {
    await openDisclosure(page, `details${id}`);
    await scanAt(`disclosure ${id} open`);
  }

  // ── The invalid-secret warning ───────────────────────────────────────────
  await page.locator('#secret-input').fill('not a number');
  await expect(page.locator('#secret-note.callout.warning')).toBeVisible();
  await expect(page.locator('#secret-note')).toHaveAttribute('role', 'alert');
  await scanAt('secret is not a whole number, lab fell back to 1');

  await page.locator('#secret-input').fill('12345');
  await expect(page.locator('#secret-note.callout.warning')).toHaveCount(0);
  await page.locator('#run-feldman').click();
  await expect(page.locator('[aria-label="Feldman verification results"] table')).toBeVisible();
  await scanAt('secret corrected and re-run');

  // ── Randomised mode ──────────────────────────────────────────────────────
  // The lab SHIPS deterministic (`deterministicMode: true`), so the seeded
  // path is the one every previous scan already covered and the randomised one
  // is what nothing had seen. Unchecking also hides the seed field, which is a
  // layout change in its own right.
  await expect(page.locator('#deterministic-mode')).toBeChecked();
  await page.locator('#deterministic-mode').uncheck();
  await expect(page.locator('[aria-label="Feldman verification results"]')).toHaveCount(0);
  await page.locator('#run-feldman').click();
  await expect(page.locator('[aria-label="Feldman verification results"] table')).toBeVisible();
  await scanAt('randomised mode, unseeded run');
}
