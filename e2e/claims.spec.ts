/**
 * Functional coverage for the claims this lab makes on screen.
 *
 * The lab's thesis is that a Feldman or Pedersen verifier learns one specific
 * thing — "this share is consistent with the published commitments" — and that
 * plain Shamir learns nothing at all. So the load-bearing states are:
 *   - each verification badge agreeing with the LHS/RHS the page printed beside it,
 *   - the readable-field panels being arithmetically re-derivable from their own
 *     printed numbers (the small field is small enough to recompute in the test),
 *   - the tamper path failing, and failing on the participant the controls name,
 *   - the several panels that render one configuration agreeing with each other,
 *   - and no verification table outliving the controls that produced it.
 *
 * Everything is read back out of the rendered DOM. Nothing asserts a hardcoded
 * cryptographic value: where an expected number is needed it is recomputed from
 * other numbers the page printed. Any uncaught page exception or console error
 * fails the test that provoked it.
 */
import { expect, test as base, type Page, type Locator } from '@playwright/test';

const test = base.extend<{ errors: string[] }>({
  errors: async ({ page }, use) => {
    const errs: string[] = [];
    page.on('pageerror', (e) => errs.push(`pageerror: ${String(e)}`));
    page.on('console', (m) => {
      if (m.type() === 'error') errs.push(`console.error: ${m.text()}`);
    });
    await use(errs);
    expect(errs, 'uncaught page exceptions / console errors').toEqual([]);
  },
});

// The readable illustrative field the teaching panels run in. These are the only
// constants the suite hardcodes, and they are printed on the page itself (the
// panels say "p = 2039"), so the tests assert the page still says so.
const SMALL_P = 2039n;
const SMALL_G = 4n;
const SMALL_H_EXP = 7n;

function modPow(base: bigint, exp: bigint, m: bigint): bigint {
  let r = 1n;
  let b = base % m;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) r = (r * b) % m;
    e >>= 1n;
    b = (b * b) % m;
  }
  return r;
}

const SMALL_H = modPow(SMALL_G, SMALL_H_EXP, SMALL_P);

async function open(page: Page): Promise<void> {
  await page.goto('.');
  await expect(page.locator('#run-feldman')).toBeVisible();
  await expect(page.locator('#secret-note')).toBeVisible();
}

const textOf = async (l: Locator): Promise<string> => ((await l.textContent()) ?? '').trim();

/** All decimal integers in a blob of text, in order. */
function ints(s: string): bigint[] {
  return (s.match(/\d+/g) ?? []).map((v) => BigInt(v));
}

/**
 * The value on the right of the last "=" in a label.
 *
 * The teaching panels use <sub>/<sup> for indices, and textContent splices those
 * digits straight into their neighbours ("a<sub>0</sub> = 18" reads as "a0 = 18"),
 * so "the first integer" is not a safe way to read one of these labels.
 */
function rhsValue(s: string): bigint {
  const parts = s.split('=');
  const found = ints(parts[parts.length - 1])[0];
  if (found === undefined) throw new Error(`no value after '=' in ${JSON.stringify(s)}`);
  return found;
}

async function setNumber(page: Page, id: string, value: number): Promise<void> {
  await page.locator(`#${id}`).fill(String(value));
}

type Row = { participant: string; lhs: string; rhs: string; verdict: string };

async function readTable(page: Page, label: string): Promise<Row[]> {
  return page.evaluate((lbl) => {
    const region = document.querySelector(`[aria-label="${lbl}"]`);
    if (!region) throw new Error(`no region ${lbl}`);
    return Array.from(region.querySelectorAll('tbody tr')).map((tr) => {
      const td = Array.from(tr.querySelectorAll('td')).map((c) => (c.textContent ?? '').trim());
      return { participant: td[0], lhs: td[1], rhs: td[2], verdict: td[3] };
    });
  }, label);
}

async function runFeldman(page: Page): Promise<Row[]> {
  await page.locator('#run-feldman').click();
  await expect(page.locator('[aria-label="Feldman verification results"] table')).toBeVisible();
  return readTable(page, 'Feldman verification results');
}

async function runPedersen(page: Page): Promise<Row[]> {
  await page.locator('#run-pedersen').click();
  await expect(page.locator('[aria-label="Pedersen verification results"] table')).toBeVisible();
  return readTable(page, 'Pedersen verification results');
}

/**
 * The verdict badge must be exactly the comparison of the two operands printed
 * next to it. This is the whole lab in one assertion: a "Verified" badge over
 * two visibly different numbers, or a "Failed" over two equal ones, would be the
 * page asserting something its own output contradicts.
 */
function expectBadgesMatchOperands(rows: Row[]): void {
  for (const r of rows) {
    expect(r.verdict, `${r.participant}: badge vs printed operands`).toBe(
      r.lhs === r.rhs ? 'Verified' : 'Failed',
    );
  }
}

// ------------------------------------------------------------------ Feldman

test('every Feldman badge is the comparison of the two operands printed beside it', async ({
  page,
  errors,
}) => {
  void errors;
  await open(page);

  const rows = await runFeldman(page);
  expect(rows).toHaveLength(4);
  expectBadgesMatchOperands(rows);
});

test('the tampered share fails, and only on the participant the controls name', async ({
  page,
  errors,
}) => {
  void errors;
  await open(page);

  for (const victim of [1, 3, 4]) {
    await page.locator('#feldman-cheat-participant').selectOption(String(victim));
    const rows = await runFeldman(page);
    expectBadgesMatchOperands(rows);

    const failed = rows.filter((r) => r.verdict === 'Failed');
    expect(failed.map((r) => r.participant), `victim P${victim}`).toEqual([`P${victim}`]);

    // The verdict block must name the same participant the table failed on.
    const block = await textOf(page.locator('#step-2 .result-block'));
    expect(block).toContain('Caught.');
    expect(block).toContain(`P${victim}`);

    // ...and so must the curve above it, which is rendered from the controls
    // rather than from the run. These two disagreeing is the bug this covers.
    const curve = await page.locator('.curve-figure svg').getAttribute('aria-label');
    expect(curve).toContain(`participant P${victim}'s point tampered off the curve`);
  }
});

test('with an honest dealer every share verifies and nothing claims a catch', async ({
  page,
  errors,
}) => {
  void errors;
  await open(page);

  await page.locator('#cheat-enabled').uncheck();
  const rows = await runFeldman(page);
  expectBadgesMatchOperands(rows);
  expect(rows.every((r) => r.verdict === 'Verified')).toBe(true);
  expect(rows.every((r) => r.lhs === r.rhs)).toBe(true);

  const block = await textOf(page.locator('#step-2 .result-block'));
  expect(block).toContain('All shares verified');
  expect(block).not.toContain('Caught');
  // What Feldman establishes is consistency with the committed polynomial —
  // not that the dealer was honest about anything else.
  expect(block).toContain('matches the committed polynomial');

  const curve = await page.locator('.curve-figure svg').getAttribute('aria-label');
  expect(curve).not.toContain('tampered');
});

test('the table has one row per participant and one commitment per threshold', async ({
  page,
  errors,
}) => {
  void errors;
  await open(page);

  await setNumber(page, 'threshold-input', 3);
  await setNumber(page, 'participants-input', 6);
  await page.locator('#cheat-enabled').uncheck();

  const rows = await runFeldman(page);
  expect(rows.map((r) => r.participant)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
  expectBadgesMatchOperands(rows);

  const internals = page.locator('#step-2 details:not(.teaching-panel)').first();
  await internals.click();
  const tables = internals.locator('.table-wrap');
  // t commitments C_0..C_(t-1) for a degree-(t-1) polynomial, n share rows.
  expect(await tables.nth(0).locator('tbody tr td:first-child').allTextContents()).toEqual([
    'C0',
    'C1',
    'C2',
  ]);
  expect(await tables.nth(1).locator('tbody tr').count()).toBe(6);
});

// ----------------------------------------------------------------- Pedersen

test('every Pedersen badge is the comparison of the operands printed beside it', async ({
  page,
  errors,
}) => {
  void errors;
  await open(page);

  const rows = await runPedersen(page);
  expectBadgesMatchOperands(rows);
  expect(rows.filter((r) => r.verdict === 'Failed').map((r) => r.participant)).toEqual(['P2']);

  const block = await textOf(page.locator('#step-3 .result-block'));
  expect(block).toContain('Caught.');
  expect(block).toContain('even with blinded commitments');
});

test('blinding does not stop the tamper being caught, at any victim', async ({ page, errors }) => {
  void errors;
  await open(page);

  for (const victim of [1, 4]) {
    await page.locator('#feldman-cheat-participant').selectOption(String(victim));
    const rows = await runPedersen(page);
    expectBadgesMatchOperands(rows);
    expect(rows.filter((r) => r.verdict === 'Failed').map((r) => r.participant)).toEqual([
      `P${victim}`,
    ]);
  }
});

test('honest Pedersen shares all verify', async ({ page, errors }) => {
  void errors;
  await open(page);

  await page.locator('#cheat-enabled').uncheck();
  const rows = await runPedersen(page);
  expectBadgesMatchOperands(rows);
  expect(rows.every((r) => r.verdict === 'Verified')).toBe(true);
  expect(await textOf(page.locator('#step-3 .result-block'))).toContain('All shares verified');
});

// -------------------------------------------------- readable-field teaching panels

test('the decomposition panel recomputes correctly from its own printed numbers', async ({
  page,
  errors,
}) => {
  void errors;
  await open(page);
  await runFeldman(page);

  const panel = page.locator('#feldman-check-decomp');
  await panel.locator('summary').click();
  const body = await textOf(panel);
  expect(body).toContain(`p = ${SMALL_P}`);

  // The share y actually held. Read it from the verdict prose: the LHS formula
  // renders y inside a <sup>, and textContent fuses "g^y = 4^27" into "gy = 427",
  // which is both the wrong number and a plausible-looking one.
  const y = BigInt((await textOf(panel.locator('.chk-verdict'))).match(/y = (\d+)/)?.[1] ?? '');
  const lhsPrinted = ints(await textOf(panel.locator('.chk-side').first().locator('.chk-big')))[0];
  // The LHS is a claim about small-field arithmetic; recompute it independently.
  expect(lhsPrinted).toBe(modPow(SMALL_G, y, SMALL_P));

  // The RHS chain: each partial must be the previous partial times this factor.
  const terms = await panel.locator('.chk-term').all();
  expect(terms.length).toBeGreaterThanOrEqual(2);
  let running = 1n;
  for (const term of terms) {
    // Read the markup, not the text: "1519<sup>1</sup>" flattens to "15191".
    const html = await term.locator('.chk-term-sub').innerHTML();
    const m = html.match(/=\s*(\d+)<sup>(\d+)<\/sup>\s*=\s*<strong>(\d+)<\/strong>/);
    expect(m, `term markup: ${html}`).not.toBeNull();
    const [commitment, exponent, factor] = [BigInt(m![1]), BigInt(m![2]), BigInt(m![3])];
    expect(factor, 'C_j^(i^j)').toBe(modPow(commitment, exponent, SMALL_P));
    running = (running * factor) % SMALL_P;
    const partial = ints(await textOf(term.locator('.chk-term-partial')))[0];
    expect(partial, 'running product').toBe(running);
  }

  const rhsPrinted = ints(await textOf(panel.locator('.chk-side').nth(1).locator('.chk-big')))[0];
  expect(rhsPrinted).toBe(running);

  // The panel's own verdict must be that comparison, not a fixed string.
  const verdict = await textOf(panel.locator('.chk-verdict'));
  if (lhsPrinted === rhsPrinted) {
    expect(verdict).toContain('They match.');
  } else {
    expect(verdict).toContain('These differ.');
  }
});

test('the decomposition panel splits exactly when the share is tampered', async ({
  page,
  errors,
}) => {
  void errors;
  await open(page);

  await runFeldman(page);
  await page.locator('#feldman-check-decomp summary').click();
  const tampered = await textOf(page.locator('#feldman-check-decomp .chk-verdict'));
  expect(tampered).toContain('These differ.');
  // It must say why: y is not f(i), and both numbers are shown.
  const nums = ints(tampered);
  expect(nums.length).toBeGreaterThanOrEqual(3);
  expect(await textOf(page.locator('#feldman-check-decomp .chk-eq'))).toBe('≠');

  await page.locator('#cheat-enabled').uncheck();
  await runFeldman(page);
  await page.locator('#feldman-check-decomp summary').click();
  expect(await textOf(page.locator('#feldman-check-decomp .chk-verdict'))).toContain('They match.');
  expect(await textOf(page.locator('#feldman-check-decomp .chk-eq'))).toBe('=');
});

test('the homomorphism panel lands on g^f(i), verified against its own factors', async ({
  page,
  errors,
}) => {
  void errors;
  await open(page);
  await runFeldman(page);

  const panel = page.locator('#feldman-homomorphism');
  await panel.locator('summary').click();

  // Stage 1: each commitment must be g raised to its own coefficient.
  for (const node of await panel.locator('.hz-node').all()) {
    const coefficient = rhsValue(await textOf(node.locator('.hz-label').first()));
    const commitment = rhsValue(await textOf(node.locator('.hz-commit')));
    expect(commitment).toBe(modPow(SMALL_G, coefficient, SMALL_P));
  }

  // Stage 2: the product of the printed factors must be the printed recombination.
  const factors = await panel.locator('.hz-factor').all();
  let product = 1n;
  for (const f of factors) {
    product = (product * rhsValue(await textOf(f))) % SMALL_P;
  }
  const stage2 = panel.locator('.hz-stage').nth(1);
  expect(ints(await textOf(stage2.locator('.hz-result')))[0]).toBe(product);

  // Stage 3: that value must equal g^f(i), and the tick only appears if it does.
  const stage3 = await textOf(panel.locator('.hz-stage').nth(2));
  const gPow = ints(await textOf(panel.locator('.hz-stage').nth(2).locator('.hz-result')))[0];
  expect(gPow).toBe(product);
  expect(stage3).toContain('they land on the same value');
});

test('every equivocation row really opens the one published commitment', async ({
  page,
  errors,
}) => {
  void errors;
  await open(page);
  await runPedersen(page);

  const panel = page.locator('#pedersen-equivocation');
  await panel.locator('summary').click();
  // The intro also contains the literal formula "C = g^s·h^r", so read the
  // published value from the verdict, which names it unambiguously.
  const verdictLine = await textOf(panel.locator('.chk-verdict'));
  const published = BigInt(verdictLine.match(/identical commitment (\d+)/)?.[1] ?? '');

  const rows = await panel.locator('tbody tr').all();
  expect(rows.length).toBeGreaterThanOrEqual(3);

  const secrets: bigint[] = [];
  for (const row of rows) {
    const cells = await row.locator('td').allTextContents();
    const s = ints(cells[0])[0];
    const r = ints(cells[1])[0];
    const c = ints(cells[2])[0];
    secrets.push(s);
    // The page's claim is that (s, r) is a valid opening of the SAME commitment.
    // Recompute g^s·h^r independently rather than trusting the printed column.
    expect((modPow(SMALL_G, s, SMALL_P) * modPow(SMALL_H, r, SMALL_P)) % SMALL_P).toBe(published);
    expect(c).toBe(published);
  }

  // Distinct secrets, exactly one flagged real — otherwise "many secrets, one
  // commitment" would be a row of duplicates dressed up as equivocation.
  expect(new Set(secrets.map(String)).size).toBe(secrets.length);
  expect(await panel.locator('tbody tr.equiv-real').count()).toBe(1);

  expect(verdictLine).toContain(`identical commitment ${published}`);
  // Hiding is unconditional; the known log is what breaks BINDING. The panel
  // must not sell the known discrete log as the reason hiding works.
  const foot = await textOf(panel.locator('.chk-foot'));
  expect(foot).toContain(`log`);
  expect(foot).toContain('binding');
});

// -------------------------------------------------------------------- Shamir

test('Shamir reconstruction misses under a cheating dealer and matches without one', async ({
  page,
  errors,
}) => {
  void errors;
  await open(page);

  const block = page.locator('#step-1 .result-block');
  let got = ints((await textOf(block)).split('→')[1])[0];
  let want = ints((await textOf(block)).split('Expected:')[1])[0];
  expect(got).not.toBe(want);
  expect(await textOf(block)).toContain('Reconstruction <strong>failed'.replace(/<[^>]+>/g, ''));

  await page.locator('#shamir-cheat-enabled').uncheck();
  got = ints((await textOf(block)).split('→')[1])[0];
  want = ints((await textOf(block)).split('Expected:')[1])[0];
  expect(got).toBe(want);
  expect(await textOf(block)).toContain('Reconstruction matched');
});

test('the tampered Shamir share is the one the selector names', async ({ page, errors }) => {
  void errors;
  await open(page);

  const shareCells = async (): Promise<string[]> =>
    page.locator('[aria-label="Shamir shares table"] tbody tr td.mono').allTextContents();

  const withP2 = await shareCells();
  await page.locator('#shamir-cheat-participant').selectOption('3');
  const withP3 = await shareCells();

  // Only the two victims' rows may differ between the runs; the polynomial is
  // deterministic, so every honest share must be byte-identical.
  const differing = withP2.map((v, i) => (v === withP3[i] ? null : i + 1)).filter((v) => v !== null);
  expect(differing).toEqual([2, 3]);
});

// ------------------------------------------------------- determinism / seed

test('deterministic mode reproduces a run, and the seed changes it', async ({ page, errors }) => {
  void errors;
  await open(page);
  await page.locator('#cheat-enabled').uncheck();

  const first = await runFeldman(page);
  const again = await runFeldman(page);
  expect(again).toEqual(first);

  await page.locator('#deterministic-seed').fill('a-different-seed');
  const reseeded = await runFeldman(page);
  expect(reseeded).not.toEqual(first);
  expectBadgesMatchOperands(reseeded);
  // Different randomness, same secret: the shares move but everything still verifies.
  expect(reseeded.every((r) => r.verdict === 'Verified')).toBe(true);
});

test('turning determinism off makes successive runs differ', async ({ page, errors }) => {
  void errors;
  await open(page);
  await page.locator('#cheat-enabled').uncheck();
  await page.locator('#deterministic-mode').uncheck();
  await expect(page.locator('#deterministic-seed')).toBeDisabled();

  const first = await runFeldman(page);
  const second = await runFeldman(page);
  expect(second).not.toEqual(first);
  expectBadgesMatchOperands(first);
  expectBadgesMatchOperands(second);
  expect(second.every((r) => r.verdict === 'Verified')).toBe(true);
});

test('Pedersen commitments repeat under a fixed seed and move without one', async ({
  page,
  errors,
}) => {
  void errors;
  await open(page);
  await page.locator('#cheat-enabled').uncheck();

  const deltas = async (): Promise<string[]> => {
    await page.locator('#step-3 details:not(.teaching-panel)').first().click();
    return page
      .locator('#step-3 details:not(.teaching-panel)')
      .first()
      .locator('tbody tr td:nth-child(3)')
      .allTextContents();
  };

  await runPedersen(page);
  await runPedersen(page);
  expect(new Set(await deltas())).toEqual(new Set(['same']));

  await page.locator('#deterministic-mode').uncheck();
  await runPedersen(page);
  await runPedersen(page);
  expect(new Set(await deltas())).toEqual(new Set(['changed']));
});

// ------------------------------------------------------------------ compare

test('the comparison says which run it is reporting on', async ({ page, errors }) => {
  void errors;
  await open(page);

  // The cheating dealer is ON by default, yet Step 4 deliberately runs honest
  // shares. It must say so, or two green badges read as "the tamper was missed".
  await expect(page.locator('#cheat-enabled')).toBeChecked();
  expect(await textOf(page.locator('#compare-scope'))).toContain('honest shares');

  await page.locator('#run-compare').click();
  await expect(page.locator('[aria-label="Protocol comparison table"] table')).toBeVisible();

  const cards = await page.locator('#step-4 .grid-2 .card').allTextContents();
  expect(cards).toHaveLength(2);
  expect(cards.every((c) => c.includes('All verified'))).toBe(true);

  const table = await textOf(page.locator('[aria-label="Protocol comparison table"]'));
  expect(table).toContain('Information-theoretic');
  expect(table).toContain('unknown log_g h');
});

// ----------------------------------------------- verdicts must not outlive inputs

const CONTROL_CHANGES: Array<{ name: string; apply: (page: Page) => Promise<unknown> }> = [
  { name: 'cheating dealer off', apply: (p) => p.locator('#cheat-enabled').uncheck() },
  {
    name: 'a different victim',
    apply: (p) => p.locator('#feldman-cheat-participant').selectOption('3'),
  },
  { name: 'threshold', apply: (p) => setNumber(p, 'threshold-input', 3) },
  { name: 'participants', apply: (p) => setNumber(p, 'participants-input', 6) },
  { name: 'the secret', apply: (p) => p.locator('#secret-input').fill('987654321') },
  { name: 'the seed', apply: (p) => p.locator('#deterministic-seed').fill('other-seed') },
  { name: 'determinism', apply: (p) => p.locator('#deterministic-mode').uncheck() },
];

test('changing any control retires the Feldman table it was not computed under', async ({
  page,
  errors,
}) => {
  void errors;

  for (const change of CONTROL_CHANGES) {
    await open(page);
    await runFeldman(page);
    await expect(page.locator('[aria-label="Feldman verification results"]')).toBeVisible();

    await change.apply(page);

    await expect(
      page.locator('[aria-label="Feldman verification results"]'),
      `Feldman table survived: ${change.name}`,
    ).toHaveCount(0);
    expect(await textOf(page.locator('#step-2')), change.name).toContain(
      'Click the button above to generate shares and verify them',
    );
    expect(await textOf(page.locator('#step-2')), change.name).not.toContain('Caught.');
  }
});

test('changing any control retires the Pedersen table and the comparison', async ({
  page,
  errors,
}) => {
  void errors;

  for (const change of CONTROL_CHANGES) {
    await open(page);
    await runPedersen(page);
    await page.locator('#run-compare').click();
    await expect(page.locator('[aria-label="Protocol comparison table"] table')).toBeVisible();

    await change.apply(page);

    await expect(
      page.locator('[aria-label="Pedersen verification results"]'),
      `Pedersen table survived: ${change.name}`,
    ).toHaveCount(0);
    await expect(
      page.locator('[aria-label="Protocol comparison table"]'),
      `comparison survived: ${change.name}`,
    ).toHaveCount(0);
  }
});

test('advanced mode reveals internals without invalidating the run', async ({ page, errors }) => {
  void errors;
  await open(page);

  const before = await runFeldman(page);
  await page.locator('#step-2 details:not(.teaching-panel)').first().click();
  expect(await textOf(page.locator('#step-2 details:not(.teaching-panel)').first())).toContain(
    'Enable Advanced mode',
  );

  await page.locator('#advanced-mode').check();
  // Showing coefficients already computed changes nothing about the run, so the
  // table must still be there — retirement has to be about inputs, not repaints.
  expect(await readTable(page, 'Feldman verification results')).toEqual(before);
  await page.locator('#step-2 details:not(.teaching-panel)').first().click();
  expect(await textOf(page.locator('#step-2 details:not(.teaching-panel)').first())).toContain(
    'coefficients:',
  );
});

// ------------------------------------------------------------- invalid input

test('a secret that is not an integer is named, not silently replaced', async ({
  page,
  errors,
}) => {
  void errors;
  await open(page);

  expect(await textOf(page.locator('#secret-note'))).toContain('Sharing the secret');

  await page.locator('#secret-input').fill('not-a-number');
  const note = page.locator('#secret-note');
  await expect(note).toHaveClass(/warning/);
  expect(await textOf(note)).toContain('Not a whole number');
  expect(await textOf(note)).toContain('not-a-number');
  expect(await textOf(note)).toContain('fallback secret');

  // Whatever it says, the run below must be the run that actually happened.
  const rows = await runFeldman(page);
  expectBadgesMatchOperands(rows);

  // The fallback is 1, and Step 1 must print that as the expected value rather
  // than pretending the typed text was shared.
  const expected = ints((await textOf(page.locator('#step-1 .result-block'))).split('Expected:')[1]);
  expect(expected[0]).toBe(1n);

  await page.locator('#secret-input').fill('42');
  await expect(note).not.toHaveClass(/warning/);
  expect(await textOf(note)).toContain('42');
});

test('the lab halts with an explanation when there is no secure RNG', async ({ page }) => {
  // Deterministic mode needs no randomness, so the lab boots. Turning it off is
  // the first moment coefficients must actually be sampled — and that used to
  // throw out of the listener with nothing on screen to explain it.
  await page.addInitScript(() => {
    Object.defineProperty(crypto, 'getRandomValues', { value: undefined, configurable: true });
  });
  await page.goto('.');
  await expect(page.locator('#run-feldman')).toBeVisible();

  // click(), not uncheck(): the halt panel replaces the whole page including this
  // checkbox, so uncheck() would wait forever to confirm its new state.
  await page.locator('#deterministic-mode').click();

  const halt = page.locator('.rng-halt');
  await expect(halt).toBeVisible();
  await expect(halt).toHaveAttribute('role', 'alert');
  const body = await textOf(halt);
  expect(body).toContain('crypto.getRandomValues');
  expect(body).toContain('Math.random()');
  // The point of halting: the checks would still pass while the secret leaked.
  expect(body).toContain('fewer than');
});

// ------------------------------------------------------------------ the page

test('nothing carrying the hidden attribute is still painted', async ({ page, errors }) => {
  void errors;
  await open(page);
  await runFeldman(page);
  await runPedersen(page);
  await page.locator('#run-compare').click();
  await expect(page.locator('[aria-label="Protocol comparison table"] table')).toBeVisible();

  // Author display rules outrank the UA's [hidden]{display:none}, so an element
  // can carry the attribute, be visible to sighted users, and still be treated
  // as absent by tests.
  const leaks = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[hidden]'))
      .filter((el) => getComputedStyle(el as HTMLElement).display !== 'none')
      .map((el) => `${el.tagName.toLowerCase()}#${el.id}.${(el as HTMLElement).className}`),
  );
  expect(leaks, '[hidden]{display:none} loses to any author display rule').toEqual([]);
});

test('the page never claims this Pedersen instance is production-safe', async ({
  page,
  errors,
}) => {
  void errors;
  await open(page);

  const notes = await page.locator('.callout.warning').allTextContents();
  expect(notes.some((n) => n.includes('log_g(h)'))).toBe(true);
  expect(await textOf(page.locator('.threat-model'))).toContain(
    'h is derived deterministically, which breaks Pedersen\'s binding in practice',
  );
});
