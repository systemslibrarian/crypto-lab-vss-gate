import './style.css';
import {
  G,
  H,
  P,
  Q,
  buildDeterministicPolynomial,
  buildRandomPolynomial,
  formatBigint,
  mod,
  runFeldman,
  runFeldmanWithPolynomial,
  runPedersen,
  shamirDemoWithOptions,
  type FeldmanRun,
  type PedersenRun,
  type ThemeMode
} from './vss';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app root');
}

const escapeHtml = (unsafe: string): string =>
  unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

type AppState = {
  theme: ThemeMode;
  secretInput: string;
  threshold: number;
  participants: number;
  deterministicMode: boolean;
  deterministicSeed: string;
  advancedMode: boolean;
  cheatEnabled: boolean;
  cheatParticipant: number;
  shamirCheatEnabled: boolean;
  shamirCheatParticipant: number;
  feldmanRun: FeldmanRun | null;
  pedersenRun: PedersenRun | null;
  sideBySideFeldman: FeldmanRun | null;
  sideBySidePedersen: PedersenRun | null;
  pedersenPrevCommitments: bigint[] | null;
  shamirCache: { key: string; result: ReturnType<typeof shamirDemoWithOptions> } | null;
};

const getTheme = (): ThemeMode =>
  document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

const state: AppState = {
  theme: getTheme(),
  secretInput: '123456789',
  threshold: 2,
  participants: 4,
  deterministicMode: true,
  deterministicSeed: 'vss-gate-lab-seed',
  advancedMode: false,
  cheatEnabled: true,
  cheatParticipant: 2,
  shamirCheatEnabled: true,
  shamirCheatParticipant: 2,
  feldmanRun: null,
  pedersenRun: null,
  sideBySideFeldman: null,
  sideBySidePedersen: null,
  pedersenPrevCommitments: null,
  shamirCache: null
};

const clampPositiveInt = (value: string, fallback: number, min: number, max: number): number => {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, n));
};

const parseSecret = (): bigint => {
  const v = state.secretInput.trim();
  // BigInt('') is 0n, so an empty/whitespace field would silently become 0 —
  // treat it as invalid and use the same fallback as a parse failure.
  if (v === '') {
    return 1n;
  }
  try {
    return BigInt(v);
  } catch {
    return 1n;
  }
};

const short = (v: bigint): string => {
  const s = formatBigint(v);
  if (s.length <= 30) {
    return s;
  }
  return `${s.slice(0, 14)}...${s.slice(-14)}`;
};

const boolBadge = (ok: boolean): string =>
  ok
    ? '<span class="badge pass">Verified</span>'
    : '<span class="badge fail">Failed</span>';

const deterministicOptions = () => ({
  deterministic: state.deterministicMode,
  seed: state.deterministicSeed
});

// ── Decision-first section wrappers ──────────────────────

const sectionAbout = (text: string): string =>
  `<div class="section-about"><strong>What you're about to do:</strong> ${text}</div>`;

const sectionHappened = (text: string): string =>
  `<div class="section-happened"><strong>What just happened:</strong> ${text}</div>`;

const sectionMatters = (text: string): string =>
  `<div class="section-matters"><strong>Why it matters:</strong> ${text}</div>`;

const sectionUseCase = (text: string): string =>
  `<div class="section-usecase"><strong>When you'd use this:</strong> ${text}</div>`;

const sectionTradeoffs = (items: string[]): string =>
  `<div class="section-tradeoffs"><strong>Tradeoffs &amp; risks:</strong>
    <ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>
  </div>`;

// ── Hero ─────────────────────────────────────────────────

const renderHero = (): string => `
  <section class="exhibit hero">
    <p class="eyebrow">Crypto Lab</p>
    <h1>Verifiable Secret Sharing</h1>
    <p class="hero-question">
      How do you split a secret among multiple parties so that <em>no one can cheat</em>
      — and everyone can verify it?
    </p>
    <p>
      This lab walks you through three protocols — Shamir, Feldman, and Pedersen —
      each fixing a specific weakness in the one before it.
      By the end, you'll know which to choose and why.
    </p>
    <nav class="hero-nav" aria-label="Jump to lab section">
      <a href="#step-1" class="btn-outline">1. Break Shamir</a>
      <a href="#step-2" class="btn-outline">2. Feldman Fix</a>
      <a href="#step-3" class="btn-outline">3. Pedersen Upgrade</a>
      <a href="#step-4" class="btn-outline">4. Compare</a>
    </nav>
  </section>
`;

// ── Decision guide ───────────────────────────────────────

const renderDecisionGuide = (): string => `
  <section class="exhibit decision-guide">
    <h2>Which protocol do I need?</h2>
    <div class="decision-grid">
      <article class="decision-card">
        <h3>Shamir</h3>
        <p class="decision-when">When you trust the dealer completely.</p>
        <p class="decision-risk">Risk: a dishonest dealer can hand out bad shares and no one will know until reconstruction fails.</p>
      </article>
      <article class="decision-card">
        <h3>Feldman</h3>
        <p class="decision-when">When you need to verify shares but the secret doesn't need to stay hidden from observers.</p>
        <p class="decision-risk">Risk: commitments reveal the secret to anyone watching.</p>
      </article>
      <article class="decision-card">
        <h3>Pedersen</h3>
        <p class="decision-when">When you need both verification and hiding — the commitment reveals nothing about the secret.</p>
        <p class="decision-risk">Risk: requires an independent second generator h. If someone knows log_g(h), they can forge commitments.</p>
      </article>
    </div>
  </section>
`;

// ── Lab Controls ─────────────────────────────────────────

const renderLabControls = (): string => `
  <section class="exhibit" id="lab-controls">
    <h2>Lab Controls</h2>
    <p class="muted">These settings apply to every step below. Change them and re-run any protocol.</p>
    <div class="controls-grid">
      <label for="secret-input">Secret (integer)
        <input id="secret-input" type="text" value="${escapeHtml(state.secretInput)}" />
      </label>
      <label for="threshold-input">Threshold t
        <input id="threshold-input" type="number" min="2" max="6" value="${state.threshold}" />
      </label>
      <label for="participants-input">Participants n
        <input id="participants-input" type="number" min="2" max="8" value="${state.participants}" />
      </label>
      <label for="deterministic-mode" class="checkbox-label">
        <input id="deterministic-mode" type="checkbox" ${state.deterministicMode ? 'checked' : ''} />
        Deterministic mode (reproducible runs)
      </label>
      <label for="deterministic-seed">Seed
        <input id="deterministic-seed" type="text" value="${escapeHtml(state.deterministicSeed)}" ${state.deterministicMode ? '' : 'disabled'} />
      </label>
      <label for="advanced-mode" class="checkbox-label">
        <input id="advanced-mode" type="checkbox" ${state.advancedMode ? 'checked' : ''} />
        Advanced mode (show internals)
      </label>
      <label for="cheat-enabled" class="checkbox-label">
        <input id="cheat-enabled" type="checkbox" ${state.cheatEnabled ? 'checked' : ''} />
        Cheating dealer (tamper with one share)
      </label>
      <label for="feldman-cheat-participant">Tampered participant
        <select id="feldman-cheat-participant">${Array.from({ length: state.participants }, (_, i) => i + 1)
          .map((i) => `<option value="${i}" ${state.cheatParticipant === i ? 'selected' : ''}>P${i}</option>`)
          .join('')}</select>
      </label>
    </div>
  </section>
`;

// ── Verification table helper ────────────────────────────

const verificationRows = (
  rows: Array<{ participant: number; lhs: bigint; rhs: bigint; ok: boolean }>,
  cheatedParticipant: number | null
): string =>
  rows
    .map((v) => {
      const failFocus = !v.ok && cheatedParticipant === v.participant;
      return `
        <tr class="${v.ok ? 'row-pass' : 'row-fail'} ${failFocus ? 'row-focus' : ''}">
          <td>P${v.participant}</td>
          <td class="mono">${short(v.lhs)}</td>
          <td class="mono">${short(v.rhs)}</td>
          <td>${boolBadge(v.ok)}</td>
        </tr>
      `;
    })
    .join('');

// ── Visual intuition: shares are points on a curve ───────

// Small, *illustrative* coefficients — NOT the 2048-bit field values — so the
// polynomial can actually be drawn. a0 (the y-intercept at x = 0) is "the secret".
// Derived deterministically from the typed secret so the picture is stable.
const illustrativeCoeffs = (secretInput: string, threshold: number): number[] => {
  let h = 2166136261 >>> 0;
  for (const ch of secretInput) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const a0 = 2 + (h % 17); // secret in [2, 18]
  const coeffs = [a0];
  for (let j = 1; j < threshold; j += 1) {
    h = Math.imul(h ^ (j * 2654435761), 16777619) >>> 0;
    coeffs.push(1 + (h % 4)); // small slope / curvature in [1, 4]
  }
  return coeffs;
};

// Horner evaluation over the reals (for plotting only).
const evalReal = (coeffs: number[], x: number): number => {
  let acc = 0;
  for (let j = coeffs.length - 1; j >= 0; j -= 1) {
    acc = acc * x + coeffs[j];
  }
  return acc;
};

const renderShareCurve = (): string => {
  const t = Math.min(state.threshold, state.participants);
  const n = state.participants;
  const coeffs = illustrativeCoeffs(state.secretInput, t);
  const cheatP =
    state.cheatEnabled && state.cheatParticipant >= 1 && state.cheatParticipant <= n
      ? state.cheatParticipant
      : null;

  // Canvas geometry (viewBox units; scales responsively via CSS).
  const W = 540;
  const Hh = 320;
  const padL = 26;
  const padR = 18;
  const padT = 22;
  const padB = 38;
  const xMin = -0.6;
  const xMax = n + 0.6;

  // Sample the curve and gather y-extents.
  const SAMPLES = 240;
  const curve: Array<[number, number]> = [];
  for (let k = 0; k <= SAMPLES; k += 1) {
    const x = xMin + (xMax - xMin) * (k / SAMPLES);
    curve.push([x, evalReal(coeffs, x)]);
  }
  const shareY: number[] = [];
  for (let i = 1; i <= n; i += 1) {
    shareY.push(evalReal(coeffs, i));
  }
  const secretY = evalReal(coeffs, 0);

  const baseVals = [0, secretY, ...shareY, ...curve.map((p) => p[1])];
  const baseMax = Math.max(...baseVals);
  const baseMin = Math.min(...baseVals);
  const baseRange = Math.max(1, baseMax - baseMin);
  const bump = Math.max(2, baseRange * 0.26);

  let cheatHonest = 0;
  let cheatBad = 0;
  let yMax = baseMax;
  const yMin = baseMin;
  if (cheatP !== null) {
    cheatHonest = evalReal(coeffs, cheatP);
    cheatBad = cheatHonest + bump;
    yMax = Math.max(yMax, cheatBad);
  }
  const range = Math.max(1, yMax - yMin);
  const top = yMax + range * 0.1;
  const bottom = yMin - range * 0.08;

  const sx = (x: number): number =>
    padL + ((x - xMin) / (xMax - xMin)) * (W - padL - padR);
  const sy = (y: number): number =>
    Hh - padB - ((y - bottom) / (top - bottom)) * (Hh - padT - padB);
  const f = (v: number): string => v.toFixed(1);

  const curvePath = curve
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${f(sx(p[0]))} ${f(sy(p[1]))}`)
    .join(' ');

  const baseY = sy(bottom);
  const xLabels = Array.from({ length: n }, (_, i) => {
    const x = sx(i + 1);
    return `<text x="${f(x)}" y="${f(baseY + 16)}" class="vz-axislabel" text-anchor="middle">P${i + 1}</text>`;
  }).join('');

  const sharePoints = shareY
    .map((y, i) => {
      const p = i + 1;
      if (cheatP === p) {
        return '';
      }
      return `<circle cx="${f(sx(p))}" cy="${f(sy(y))}" r="5.5" class="vz-share" />`;
    })
    .join('');

  const cheatLayer =
    cheatP === null
      ? ''
      : `
        <line x1="${f(sx(cheatP))}" y1="${f(sy(cheatHonest))}" x2="${f(sx(cheatP))}" y2="${f(sy(cheatBad))}"
              class="vz-deviation" />
        <circle cx="${f(sx(cheatP))}" cy="${f(sy(cheatHonest))}" r="5.5" class="vz-ghost" />
        <circle cx="${f(sx(cheatP))}" cy="${f(sy(cheatBad))}" r="6" class="vz-tampered" />
        <text x="${f(sx(cheatP))}" y="${f(sy(cheatBad) - 11)}" class="vz-tamperlabel" text-anchor="middle">tampered</text>
      `;

  const caption =
    cheatP === null
      ? `All ${n} points sit on one degree-${t - 1} curve. Any <strong>${t}</strong> of them pin it down exactly — and the secret is the curve's value at <span class="mono">x = 0</span>.`
      : `The dealer pushed <strong>P${cheatP}</strong>'s point <em>off</em> the curve. With plain Shamir there's no published curve to compare against, so nobody notices — that's the gap. Feldman and Pedersen publish commitments to the curve, which is exactly what lets verification reject this point.`;

  return `
    <section class="exhibit curve-viz" aria-labelledby="curve-viz-title">
      <h2 id="curve-viz-title">The picture: shares are points on a curve</h2>
      <p class="muted">
        A <span class="mono">t</span>-of-<span class="mono">n</span> sharing hides the secret in a degree-(<span class="mono">t−1</span>)
        polynomial. Each participant gets one point on it. Adjust the controls above and watch the curve respond.
      </p>
      <figure class="curve-figure">
        <svg viewBox="0 0 ${W} ${Hh}" role="img"
             aria-label="Polynomial of degree ${t - 1} with ${n} share points${cheatP !== null ? `, participant P${cheatP}'s point tampered off the curve` : ''}, and the secret marked at x equals zero.">
          <line x1="${f(padL)}" y1="${f(baseY)}" x2="${f(W - padR)}" y2="${f(baseY)}" class="vz-axis" />
          <line x1="${f(sx(0))}" y1="${f(padT - 6)}" x2="${f(sx(0))}" y2="${f(baseY + 4)}" class="vz-axis vz-axis-y" />
          <path d="${curvePath}" class="vz-curve" fill="none" />
          ${sharePoints}
          ${cheatLayer}
          <line x1="${f(sx(0))}" y1="${f(sy(secretY))}" x2="${f(sx(0))}" y2="${f(baseY)}" class="vz-secretdrop" />
          <circle cx="${f(sx(0))}" cy="${f(sy(secretY))}" r="6.5" class="vz-secret" />
          <text x="${f(sx(0) + 9)}" y="${f(sy(secretY) - 8)}" class="vz-secretlabel" text-anchor="start">secret (x=0)</text>
          ${xLabels}
        </svg>
        <figcaption class="curve-caption">${caption}</figcaption>
      </figure>
      <div class="vz-legend" aria-hidden="true">
        <span class="vz-key"><span class="vz-dot vz-dot-share"></span>share point</span>
        <span class="vz-key"><span class="vz-dot vz-dot-secret"></span>secret</span>
        <span class="vz-key"><span class="vz-dot vz-dot-tamper"></span>tampered share</span>
      </div>
      <p class="curve-note muted">
        Illustration only — small whole numbers are used so the curve is drawable. The lab's real arithmetic
        runs in a 2048-bit prime field where points look like random integers.
      </p>
    </section>
  `;
};

// ── Step 1: Break Shamir ─────────────────────────────────

const renderStepOne = (): string => {
  const secret = parseSecret();
  const shamirCheat = state.shamirCheatEnabled ? state.shamirCheatParticipant : null;
  const shamirCacheKey = [
    secret.toString(),
    shamirCheat?.toString() ?? 'none',
    state.deterministicMode ? 'det' : 'rand',
    state.deterministicSeed
  ].join('|');

  if (!state.shamirCache || state.shamirCache.key !== shamirCacheKey) {
    state.shamirCache = {
      key: shamirCacheKey,
      result: shamirDemoWithOptions(secret, shamirCheat, deterministicOptions())
    };
  }

  const shamir = state.shamirCache.result;
  const reconstructedOk = shamir.reconstructed === mod(secret, Q);

  return `
    <section class="exhibit lab-step" id="step-1">
      <span class="step-number">Step 1</span>
      <h2>Break Shamir</h2>

      ${sectionAbout(
        'Run a Shamir secret-sharing round where the dealer cheats — flipping one participant\'s share. ' +
        'Watch what happens when the group tries to reconstruct the secret.'
      )}

      <div class="controls-grid">
        <label for="shamir-cheat-participant">Tampered participant
          <select id="shamir-cheat-participant">${[1, 2, 3, 4]
            .map((i) => `<option value="${i}" ${state.shamirCheatParticipant === i ? 'selected' : ''}>P${i}</option>`)
            .join('')}</select>
        </label>
        <label for="shamir-cheat-enabled" class="checkbox-label">
          <input id="shamir-cheat-enabled" type="checkbox" ${state.shamirCheatEnabled ? 'checked' : ''} />
          Cheating dealer
        </label>
      </div>

      <div class="table-wrap" tabindex="0" role="region" aria-label="Shamir shares table">
        <table>
          <thead><tr><th>Participant</th><th>Share value</th></tr></thead>
          <tbody>${shamir.shares
            .map((s) => `<tr><td>P${s.participant}</td><td class="mono">${short(s.value)}</td></tr>`)
            .join('')}</tbody>
        </table>
      </div>

      <div class="result-block ${reconstructedOk ? 'result-ok' : 'result-bad'}">
        <p>
          Reconstruction from {P${shamir.subset[0].participant}, P${shamir.subset[1].participant}} →
          <span class="mono">${short(shamir.reconstructed)}</span>
        </p>
        <p>Expected: <span class="mono">${short(mod(secret, Q))}</span></p>
        <p>${reconstructedOk
          ? 'Reconstruction matched — this run happened to use honest shares.'
          : 'Reconstruction <strong>failed</strong>. The cheated share corrupted the result, and nobody could tell in advance.'
        }</p>
      </div>

      ${sectionHappened(
        'Shamir shares are just polynomial evaluations. There\'s no checksum, no commitment — nothing for a participant to verify. ' +
        'A dishonest dealer can substitute any value and no one detects it until it\'s too late.'
      )}

      ${sectionMatters(
        'In any protocol where participants contribute to a group key (e.g., threshold wallets, DKG), ' +
        'undetectable cheating means the entire ceremony can be silently poisoned.'
      )}

      ${sectionUseCase(
        'Plain Shamir is fine when you <em>fully trust the dealer</em> — for example, splitting your own backup key across your own devices.'
      )}

      ${sectionTradeoffs([
        'Smallest share size (1 field element per share).',
        'Zero overhead — no commitments, no extra computation.',
        'No verification at all — cheating is invisible until reconstruction.',
      ])}

      <button class="copy-btn" type="button" data-copy="${escapeHtml(
        JSON.stringify(
          shamir.shares.map((s) => ({ participant: s.participant, share: s.value.toString() })),
          null,
          2
        )
      )}">Copy shares</button>
    </section>
  `;
};

// ── Step 2: Feldman Fix ──────────────────────────────────

const renderStepTwo = (): string => {
  const run = state.feldmanRun;

  return `
    <section class="exhibit lab-step" id="step-2">
      <span class="step-number">Step 2</span>
      <h2>Feldman Fix</h2>

      ${sectionAbout(
        'Run Feldman VSS: the dealer publishes commitments g^(a_j). Each participant checks their share ' +
        'against these commitments <em>before</em> reconstruction. Toggle the cheating dealer to see it caught.'
      )}

      <button id="run-feldman" type="button">Run Feldman Verification</button>

      ${
        !run
          ? '<p class="muted">Click the button above to generate shares and verify them.</p>'
          : `
            <div class="table-wrap" tabindex="0" role="region" aria-label="Feldman verification results">
              <table>
                <thead><tr><th>P</th><th>LHS g^(y_i)</th><th>RHS ∏C_j^(i^j)</th><th>Result</th></tr></thead>
                <tbody>${verificationRows(run.verification, run.cheatedParticipant)}</tbody>
              </table>
            </div>

            <div class="result-block ${run.verification.every(v => v.ok) ? 'result-ok' : 'result-bad'}">
              ${run.verification.some((v) => !v.ok)
                ? '<p><strong>Caught.</strong> The tampered share failed verification — participants reject it before reconstruction.</p>'
                : '<p><strong>All shares verified.</strong> Every participant confirmed their share matches the committed polynomial.</p>'
              }
            </div>

            ${sectionHappened(
              'The dealer published g^(a_0), g^(a_1), ... as commitments. Each participant computed g^(y_i) (their share exponentiated) ' +
              'and compared it against the product of commitments raised to powers of their index. A mismatch means tampering.'
            )}

            ${sectionMatters(
              'Feldman turns Shamir from "trust the dealer" into "verify then trust". ' +
              'This is the standard building block for verifiable DKG protocols used in threshold ECDSA and BLS signatures.'
            )}

            ${sectionUseCase(
              'Use Feldman when you need share verification but the <em>secret value itself isn\'t sensitive</em> — ' +
              'e.g., when the secret is a public key component already visible on-chain.'
            )}

            ${sectionTradeoffs([
              'Commitments reveal the secret: C_0 = g^s, so anyone with the commitments can compute s via discrete log (for small s) or confirm a guess.',
              'Adds t group elements of public data (the commitments).',
              'Standard reference: Feldman, "A Practical Scheme for Non-interactive Verifiable Secret Sharing," FOCS 1987.',
            ])}

            <details class="details-block">
              <summary>Internals</summary>
              <div class="grid-2">
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>C_j</th><th>Value</th></tr></thead>
                    <tbody>${run.commitments.map((c, i) => `<tr><td>C${i}</td><td class="mono">${short(c)}</td></tr>`).join('')}</tbody>
                  </table>
                </div>
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>P</th><th>Share</th></tr></thead>
                    <tbody>${run.shares.map((s) => `<tr><td>P${s.participant}</td><td class="mono">${short(s.value)}</td></tr>`).join('')}</tbody>
                  </table>
                </div>
              </div>
              ${
                state.advancedMode
                  ? `<p class="mono">coefficients: ${run.coefficients.map((c, i) => `a${i}=${short(c)}`).join(', ')}</p>`
                  : '<p class="muted">Enable Advanced mode to see coefficients.</p>'
              }
              <button class="copy-btn" type="button" data-copy="${escapeHtml(
                JSON.stringify(
                  {
                    coefficients: run.coefficients.map((x) => x.toString()),
                    commitments: run.commitments.map((x) => x.toString()),
                    shares: run.shares.map((x) => ({ participant: x.participant, share: x.value.toString() }))
                  },
                  null,
                  2
                )
              )}">Copy Feldman data</button>
            </details>
          `
      }
    </section>
  `;
};

// ── Step 3: Pedersen Upgrade ─────────────────────────────

const renderStepThree = (): string => {
  const run = state.pedersenRun;

  return `
    <section class="exhibit lab-step" id="step-3">
      <span class="step-number">Step 3</span>
      <h2>Pedersen Upgrade</h2>

      ${sectionAbout(
        'Run Pedersen VSS: the dealer adds blinding randomness so that commitments hide the secret ' +
        'while still allowing share verification. The equation becomes g^(s_i) · h^(r_i) = ∏C_j^(i^j).'
      )}

      <div class="callout warning">
        <strong>Demo integrity note:</strong> This lab derives h deterministically from g,
        so log_g(h) may be known. A real deployment requires h chosen so that <em>no one</em> knows log_g(h).
      </div>

      <button id="run-pedersen" type="button">Run Pedersen Verification</button>

      ${
        !run
          ? '<p class="muted">Click the button above to generate blinded shares and verify them.</p>'
          : `
            <div class="table-wrap" tabindex="0" role="region" aria-label="Pedersen verification results">
              <table>
                <thead><tr><th>P</th><th>LHS g^s · h^r</th><th>RHS ∏C_j^(i^j)</th><th>Result</th></tr></thead>
                <tbody>${verificationRows(run.verification, run.cheatedParticipant)}</tbody>
              </table>
            </div>

            <div class="result-block ${run.verification.every(v => v.ok) ? 'result-ok' : 'result-bad'}">
              ${run.verification.some((v) => !v.ok)
                ? '<p><strong>Caught.</strong> The tampered share was detected even with blinded commitments.</p>'
                : '<p><strong>All shares verified.</strong> Blinded commits hide the secret while proving share correctness.</p>'
              }
            </div>

            ${sectionHappened(
              'The dealer built two polynomials f(x) for the secret and r(x) for randomness. ' +
              'Commitments C_j = g^(f_j) · h^(r_j) hide individual coefficients. ' +
              'Each participant checks g^(s_i) · h^(r_i) against the committed values.'
            )}

            ${sectionMatters(
              'Pedersen gives you information-theoretic hiding — the commitments reveal <em>nothing</em> about the secret, ' +
              'even to an adversary with unlimited compute. This is critical when the secret must stay confidential during the sharing phase.'
            )}

            ${sectionUseCase(
              'Use Pedersen when the secret itself is sensitive and must not leak through the commitment scheme — ' +
              'e.g., private key shares in a threshold signing ceremony where observers should learn nothing.'
            )}

            ${sectionTradeoffs([
              'Two field elements per share (s_i, r_i) instead of one — doubles share size.',
              'Requires a second generator h with unknown discrete log relative to g.',
              'If log_g(h) is known, the binding property breaks and a dealer can equivocate.',
              'Standard reference: Pedersen, "Non-Interactive and Information-Theoretic Secure Verifiable Secret Sharing," CRYPTO 1991.',
            ])}

            <details class="details-block">
              <summary>Internals</summary>
              <div class="grid-2">
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>C_j</th><th>Value</th><th>Delta</th></tr></thead>
                    <tbody>
                      ${run.commitments
                        .map((c, i) => {
                          const changed = state.pedersenPrevCommitments ? state.pedersenPrevCommitments[i] !== c : false;
                          const delta = state.pedersenPrevCommitments ? (changed ? 'changed' : 'same') : 'first run';
                          return `<tr><td>C${i}</td><td class="mono">${short(c)}</td><td>${delta}</td></tr>`;
                        })
                        .join('')}
                    </tbody>
                  </table>
                </div>
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>P</th><th>Share pair (s, r)</th></tr></thead>
                    <tbody>${run.shares.map((s) => `<tr><td>P${s.participant}</td><td class="mono">(${short(s.s)}, ${short(s.r)})</td></tr>`).join('')}</tbody>
                  </table>
                </div>
              </div>
              ${
                state.advancedMode
                  ? `<p class="mono">f(x): ${run.fCoefficients.map((c, i) => `f${i}=${short(c)}`).join(', ')}</p>
                     <p class="mono">r(x): ${run.rCoefficients.map((c, i) => `r${i}=${short(c)}`).join(', ')}</p>`
                  : '<p class="muted">Enable Advanced mode to see f(x) and r(x) coefficients.</p>'
              }
              <button class="copy-btn" type="button" data-copy="${escapeHtml(
                JSON.stringify(
                  {
                    fCoefficients: run.fCoefficients.map((x) => x.toString()),
                    rCoefficients: run.rCoefficients.map((x) => x.toString()),
                    commitments: run.commitments.map((x) => x.toString()),
                    shares: run.shares.map((x) => ({ participant: x.participant, s: x.s.toString(), r: x.r.toString() }))
                  },
                  null,
                  2
                )
              )}">Copy Pedersen data</button>
            </details>
          `
      }
    </section>
  `;
};

// ── Step 4: Compare ──────────────────────────────────────

const renderStepFour = (): string => {
  const field = state.sideBySideFeldman;
  const ped = state.sideBySidePedersen;

  return `
    <section class="exhibit lab-step" id="step-4">
      <span class="step-number">Step 4</span>
      <h2>Side-by-Side Comparison</h2>

      ${sectionAbout(
        'Run both protocols with the same secret and threshold to directly compare commitment structure, ' +
        'verification behavior, and security properties.'
      )}

      <button id="run-compare" type="button">Compare Feldman vs. Pedersen</button>

      ${
        !field || !ped
          ? '<p class="muted">Click the button to run both protocols and populate the comparison.</p>'
          : `
            <div class="grid-2">
              <article class="card">
                <h3>Feldman</h3>
                <p class="equation">g^(y_i) = ∏C_j^(i^j)</p>
                <p>${field.verification.every((x) => x.ok)
                  ? '<span class="badge pass">All verified</span>'
                  : '<span class="badge fail">Verification failed</span>'
                }</p>
              </article>
              <article class="card">
                <h3>Pedersen</h3>
                <p class="equation">g^(s_i) · h^(r_i) = ∏C_j^(i^j)</p>
                <p>${ped.verification.every((x) => x.ok)
                  ? '<span class="badge pass">All verified</span>'
                  : '<span class="badge fail">Verification failed</span>'
                }</p>
              </article>
            </div>

            <div class="table-wrap" tabindex="0" role="region" aria-label="Protocol comparison table">
              <table>
                <thead><tr><th>Property</th><th>Feldman</th><th>Pedersen</th></tr></thead>
                <tbody>
                  <tr><td>Commitment form</td><td class="mono">g^(a_j)</td><td class="mono">g^(a_j) · h^(r_j)</td></tr>
                  <tr><td>Hiding</td><td>Computational (leaks secret)</td><td>Information-theoretic</td></tr>
                  <tr><td>Binding</td><td>Computational</td><td>Computational</td></tr>
                  <tr><td>Setup assumption</td><td>Group parameters only</td><td>Independent h with unknown log_g(h)</td></tr>
                  <tr><td>Share size</td><td>1 field element</td><td>2 field elements</td></tr>
                  <tr><td>Use when</td><td>Secret is already public</td><td>Secret must stay hidden</td></tr>
                </tbody>
              </table>
            </div>

            ${sectionHappened(
              'Both protocols verified shares against public commitments. ' +
              'Feldman\'s commitments expose the secret; Pedersen\'s commitments hide it. ' +
              'The tradeoff is an extra generator assumption and doubled share size.'
            )}

            ${sectionMatters(
              'Choosing between Feldman and Pedersen is a real engineering decision in threshold cryptography systems. ' +
              'The wrong choice either leaks secrets unnecessarily or adds complexity without benefit.'
            )}

            <div class="callout warning">
              <strong>Demo note:</strong> This lab derives h deterministically. In production, h must come from
              a verifiable random process (e.g., hash-to-curve) so no party knows log_g(h).
            </div>
          `
      }
    </section>
  `;
};

// ── Threat Model ─────────────────────────────────────────

const renderThreatModel = (): string => `
  <section class="exhibit threat-model">
    <h2>Threat Model &amp; Assumptions</h2>
    <div class="grid-2">
      <article class="card">
        <h3>Attacker capabilities</h3>
        <ul>
          <li>Dishonest dealer distributes tampered shares.</li>
          <li>Passive observer sees all public commitments.</li>
          <li>Colluding minority (fewer than t parties) attempts reconstruction.</li>
        </ul>
      </article>
      <article class="card">
        <h3>What's protected</h3>
        <ul>
          <li><strong>Feldman:</strong> share correctness (binding). Secret is <em>not</em> hidden.</li>
          <li><strong>Pedersen:</strong> share correctness <em>and</em> secret hiding.</li>
          <li>Both: threshold property — fewer than t shares reveal nothing.</li>
        </ul>
      </article>
      <article class="card">
        <h3>What's NOT protected</h3>
        <ul>
          <li>Availability — a malicious participant can refuse to contribute.</li>
          <li>Side channels — timing, memory access patterns, etc.</li>
          <li>This demo: h is derived deterministically, which breaks Pedersen's binding in practice.</li>
        </ul>
      </article>
      <article class="card">
        <h3>Disclaimer</h3>
        <ul>
          <li>This is an <strong>educational tool only</strong>. Do not use this code in production.</li>
          <li>BigInt arithmetic is not constant-time. Real implementations need side-channel protection.</li>
          <li>No formal audit has been performed on this implementation.</li>
        </ul>
      </article>
    </div>
  </section>
`;

// ── Crypto Parameters (collapsed by default) ─────────────

const renderParameters = (): string => `
  <details class="exhibit details-block" id="crypto-params">
    <summary><h2 style="display:inline; cursor:pointer;">Crypto Parameters</h2></summary>
    <div class="grid-2" style="padding: 0.8rem;">
      <article class="card">
        <h3>Group</h3>
        <p class="mono">p = ${short(P)}</p>
        <p class="mono">q = (p−1)/2 = ${short(Q)}</p>
        <p class="mono">g = ${G.toString()}, h = ${short(H)}</p>
        <p class="muted">RFC 3526 Group 14 (2048-bit safe prime). g = 4 generates a subgroup of order q.</p>
        <button class="copy-btn" type="button" data-copy="${escapeHtml(
          JSON.stringify({ p: P.toString(), q: Q.toString(), g: G.toString(), h: H.toString() }, null, 2)
        )}">Copy parameters</button>
      </article>
      <article class="card">
        <h3>Why these values</h3>
        <ul>
          <li><strong>p is a safe prime:</strong> (p−1)/2 is also prime, giving a large prime-order subgroup.</li>
          <li><strong>g = 4 = 2²:</strong> squaring canonical generator 2 lands in the order-q subgroup.</li>
          <li><strong>h derived from g:</strong> deterministic for reproducibility. In production, use hash-to-curve or a CRS.</li>
        </ul>
      </article>
    </div>
  </details>
`;

// ── Learning path ────────────────────────────────────────

const renderLearningPath = (): string => `
  <section class="exhibit">
    <h2>Where to go next</h2>
    <ul class="learning-list">
      <li><strong>DKG (Distributed Key Generation):</strong> Combine VSS with interactive protocols so <em>no single dealer</em> exists.</li>
      <li><strong>Threshold ECDSA / BLS:</strong> Use Feldman or Pedersen VSS as the share-distribution layer for threshold signatures.</li>
      <li><strong>Proactive secret sharing:</strong> Periodically refresh shares so a slow adversary can't accumulate enough.</li>
      <li><strong>MPC (Multi-Party Computation):</strong> VSS is a building block for general secure computation protocols.</li>
    </ul>
    <div class="references">
      <h3>References</h3>
      <ul>
        <li>Shamir, "How to Share a Secret," Communications of the ACM, 1979.</li>
        <li>Feldman, "A Practical Scheme for Non-interactive Verifiable Secret Sharing," FOCS 1987.</li>
        <li>Pedersen, "Non-Interactive and Information-Theoretic Secure Verifiable Secret Sharing," CRYPTO 1991.</li>
      </ul>
    </div>
  </section>
`;

// ── Render ───────────────────────────────────────────────

const render = (): void => {
  state.theme = getTheme();

  // A render() replaces all of #app, which would drop focus from whatever input
  // triggered it — making text/number fields impossible to type into (one char
  // per click). Capture the focused control + caret, then restore them after.
  const activeEl = document.activeElement as HTMLElement | null;
  const focusId = activeEl && activeEl.id && app.contains(activeEl) ? activeEl.id : null;
  let selStart: number | null = null;
  let selEnd: number | null = null;
  if (focusId) {
    try {
      const input = activeEl as HTMLInputElement;
      selStart = input.selectionStart;
      selEnd = input.selectionEnd;
    } catch {
      // e.g. number inputs throw on selectionStart access — refocus without caret.
      selStart = null;
    }
  }

  app.innerHTML = `
    <main class="shell" id="main-content" role="main">
      ${renderHero()}
      ${renderDecisionGuide()}
      ${renderLabControls()}
      ${renderShareCurve()}
      ${renderStepOne()}
      ${renderStepTwo()}
      ${renderStepThree()}
      ${renderStepFour()}
      ${renderThreatModel()}
      ${renderParameters()}
      ${renderLearningPath()}
    </main>
  `;

  // Generated tables are header-row only; tag every <th> as a column header so
  // assistive tech announces "Column, P3" etc. (WCAG 1.3.1).
  app.querySelectorAll('th:not([scope])').forEach((th) => th.setAttribute('scope', 'col'));

  bindEvents();

  if (focusId) {
    const restored = document.getElementById(focusId) as HTMLInputElement | null;
    if (restored) {
      restored.focus();
      if (selStart !== null && selEnd !== null && typeof restored.setSelectionRange === 'function') {
        try {
          restored.setSelectionRange(selStart, selEnd);
        } catch {
          // setSelectionRange is invalid for number/checkbox inputs — ignore.
        }
      }
    }
  }
};

// Push a message to the persistent live region. Re-setting identical text won't
// re-announce, so we nudge it with a leading space toggle for repeat actions.
let lastAnnounce = '';
const announce = (message: string): void => {
  const el = document.getElementById('sr-status');
  if (!el) {
    return;
  }
  el.textContent = message === lastAnnounce ? `${message} ` : message;
  lastAnnounce = message;
};

const copyText = async (content: string): Promise<void> => {
  await navigator.clipboard.writeText(content);
};

const bindEvents = (): void => {
  const secretInput = document.querySelector<HTMLInputElement>('#secret-input');
  secretInput?.addEventListener('input', () => {
    state.secretInput = secretInput.value;
    state.feldmanRun = null;
    state.pedersenRun = null;
    state.sideBySideFeldman = null;
    state.sideBySidePedersen = null;
    state.shamirCache = null;
    render();
  });

  const thresholdInput = document.querySelector<HTMLInputElement>('#threshold-input');
  thresholdInput?.addEventListener('input', () => {
    state.threshold = clampPositiveInt(thresholdInput.value, state.threshold, 2, 6);
    if (state.threshold > state.participants) {
      state.participants = state.threshold;
    }
    render();
  });

  const participantsInput = document.querySelector<HTMLInputElement>('#participants-input');
  participantsInput?.addEventListener('input', () => {
    state.participants = clampPositiveInt(participantsInput.value, state.participants, 2, 8);
    if (state.threshold > state.participants) {
      state.threshold = state.participants;
    }
    if (state.cheatParticipant > state.participants) {
      state.cheatParticipant = state.participants;
    }
    render();
  });

  const deterministicMode = document.querySelector<HTMLInputElement>('#deterministic-mode');
  deterministicMode?.addEventListener('change', () => {
    state.deterministicMode = deterministicMode.checked;
    state.feldmanRun = null;
    state.pedersenRun = null;
    state.sideBySideFeldman = null;
    state.sideBySidePedersen = null;
    state.shamirCache = null;
    render();
  });

  const deterministicSeed = document.querySelector<HTMLInputElement>('#deterministic-seed');
  deterministicSeed?.addEventListener('input', () => {
    state.deterministicSeed = deterministicSeed.value || 'vss-gate-lab-seed';
    state.feldmanRun = null;
    state.pedersenRun = null;
    state.sideBySideFeldman = null;
    state.sideBySidePedersen = null;
    state.shamirCache = null;
    render();
  });

  const advancedMode = document.querySelector<HTMLInputElement>('#advanced-mode');
  advancedMode?.addEventListener('change', () => {
    state.advancedMode = advancedMode.checked;
    render();
  });

  const cheatEnabled = document.querySelector<HTMLInputElement>('#cheat-enabled');
  cheatEnabled?.addEventListener('change', () => {
    state.cheatEnabled = cheatEnabled.checked;
    render();
  });

  const cheatParticipant = document.querySelector<HTMLSelectElement>('#feldman-cheat-participant');
  cheatParticipant?.addEventListener('change', () => {
    state.cheatParticipant = clampPositiveInt(cheatParticipant.value, 2, 1, state.participants);
    render();
  });

  const shamirCheatEnabled = document.querySelector<HTMLInputElement>('#shamir-cheat-enabled');
  shamirCheatEnabled?.addEventListener('change', () => {
    state.shamirCheatEnabled = shamirCheatEnabled.checked;
    state.shamirCache = null;
    render();
  });

  const shamirCheatParticipant = document.querySelector<HTMLSelectElement>('#shamir-cheat-participant');
  shamirCheatParticipant?.addEventListener('change', () => {
    state.shamirCheatParticipant = clampPositiveInt(shamirCheatParticipant.value, 2, 1, 4);
    state.shamirCache = null;
    render();
  });

  const runFeldmanBtn = document.querySelector<HTMLButtonElement>('#run-feldman');
  runFeldmanBtn?.addEventListener('click', () => {
    state.feldmanRun = runFeldman(
      parseSecret(),
      state.threshold,
      state.participants,
      state.cheatEnabled ? state.cheatParticipant : null,
      deterministicOptions()
    );
    render();
    const failed = state.feldmanRun.verification.some((v) => !v.ok);
    announce(
      failed
        ? 'Feldman verification finished. Tampered share detected and rejected.'
        : `Feldman verification finished. All ${state.participants} shares verified.`
    );
  });

  const runPedersenBtn = document.querySelector<HTMLButtonElement>('#run-pedersen');
  runPedersenBtn?.addEventListener('click', () => {
    const prior = state.pedersenRun?.commitments ?? null;
    state.pedersenRun = runPedersen(
      parseSecret(),
      state.threshold,
      state.participants,
      state.cheatEnabled ? state.cheatParticipant : null,
      undefined,
      deterministicOptions()
    );
    state.pedersenPrevCommitments = prior;
    render();
    const failed = state.pedersenRun.verification.some((v) => !v.ok);
    announce(
      failed
        ? 'Pedersen verification finished. Tampered share detected even with blinded commitments.'
        : `Pedersen verification finished. All ${state.participants} shares verified.`
    );
  });

  const compareBtn = document.querySelector<HTMLButtonElement>('#run-compare');
  compareBtn?.addEventListener('click', () => {
    const secret = parseSecret();
    const label = `compare-${state.threshold}-${state.participants}`;
    // Both protocols share ONE secret polynomial f(x) so the comparison isolates
    // the protocol difference, not the randomness — in random mode too.
    const basePoly = state.deterministicMode
      ? buildDeterministicPolynomial(secret, state.threshold, label, state.deterministicSeed)
      : buildRandomPolynomial(secret, state.threshold);

    state.sideBySideFeldman = runFeldmanWithPolynomial(basePoly, state.participants, null);

    state.sideBySidePedersen = runPedersen(
      secret,
      state.threshold,
      state.participants,
      null,
      basePoly,
      deterministicOptions()
    );

    render();
    announce('Comparison ready. Feldman and Pedersen ran with the same secret polynomial and threshold.');
  });

  document.querySelectorAll<HTMLButtonElement>('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const payload = btn.dataset.copy;
      if (!payload) {
        return;
      }
      await copyText(payload);
      announce('Copied to clipboard.');
      const prev = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => {
        btn.textContent = prev;
      }, 1200);
    });
  });
};

// Theme is owned by the shared Crypto Lab header (#cl-theme-toggle), which flips
// data-theme + persists it. All page styling keys off CSS variables, so theme
// changes repaint without a re-render here.

render();
