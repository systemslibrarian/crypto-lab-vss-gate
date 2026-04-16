import './style.css';
import {
  G,
  H,
  P,
  Q,
  buildDeterministicPolynomial,
  formatBigint,
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

const setTheme = (theme: ThemeMode): void => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
};

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
  try {
    if (v.startsWith('0x') || v.startsWith('0X')) {
      return BigInt(v);
    }
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

const renderStartHere = (): string => `
  <section class="exhibit start-here">
    <h2>Start Here</h2>
    <div class="step-grid">
      <article class="step-card">
        <h3>Step 1 - Break Shamir</h3>
        <p>Run the cheating dealer simulation to see that plain Shamir shares cannot be self-verified.</p>
        <p class="delta">What changed: no commitments, so fraud is only discovered at reconstruction time.</p>
        <a href="#step-1" class="step-link">Go to Step 1</a>
      </article>
      <article class="step-card">
        <h3>Step 2 - Feldman Fix</h3>
        <p>Run Feldman verification to validate each share against public polynomial commitments.</p>
        <p class="delta">What changed: commitments let each participant check their share immediately.</p>
        <a href="#step-2" class="step-link">Go to Step 2</a>
      </article>
      <article class="step-card">
        <h3>Step 3 - Pedersen Upgrade</h3>
        <p>Run Pedersen verification to add blinding and dual commitment structure.</p>
        <p class="delta">What changed: commitment hiding is stronger, while verification still detects tampering.</p>
        <a href="#step-3" class="step-link">Go to Step 3</a>
      </article>
      <article class="step-card">
        <h3>Step 4 - Compare</h3>
        <p>Compare Feldman and Pedersen side-by-side with the same secret and threshold.</p>
        <p class="delta">What changed: you can directly inspect setup assumptions and tradeoffs.</p>
        <a href="#step-4" class="step-link">Go to Step 4</a>
      </article>
    </div>
  </section>
`;

const renderLearningPanel = (): string => `
  <section class="exhibit">
    <h2>What You're Learning</h2>
    <ul class="learning-list">
      <li>Shamir alone is insufficient when a dealer can cheat.</li>
      <li>Feldman prevents cheating by binding shares to public commitments.</li>
      <li>Pedersen improves coefficient hiding with blinded commitments.</li>
      <li>Trusted setup assumptions matter: Pedersen requires an independent h.</li>
    </ul>
  </section>
`;

const renderDemoIntegrityNote = (): string => `
  <section class="exhibit warning-panel">
    <h2>Demo Integrity Note</h2>
    <p>
      This demo illustrates Pedersen verification mechanics.
      In a real system, the generator h must be chosen so that no one knows its discrete log relative to g.
      This implementation derives h deterministically for demonstration purposes only and is NOT secure for production use.
    </p>
  </section>
`;

const renderProtocolFlow = (): string => `
  <section class="exhibit">
    <h2>Protocol Flow Summaries</h2>
    <div class="grid-2">
      <article class="flow-card">
        <h3>Feldman</h3>
        <p>Dealer -> Commit coefficients -> Distribute shares -> Participants verify</p>
      </article>
      <article class="flow-card">
        <h3>Pedersen</h3>
        <p>Dealer -> Dual commitments -> Distribute shares + randomness -> Verify both equations</p>
      </article>
    </div>
  </section>
`;

const renderLabControls = (): string => `
  <section class="exhibit">
    <h2>Lab Controls</h2>
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
        Deterministic mode (reproducible)
      </label>
      <label for="deterministic-seed">Deterministic seed
        <input id="deterministic-seed" type="text" value="${escapeHtml(state.deterministicSeed)}" ${state.deterministicMode ? '' : 'disabled'} />
      </label>
      <label for="advanced-mode" class="checkbox-label">
        <input id="advanced-mode" type="checkbox" ${state.advancedMode ? 'checked' : ''} />
        Advanced mode
      </label>
      <label for="cheat-enabled" class="checkbox-label">
        <input id="cheat-enabled" type="checkbox" ${state.cheatEnabled ? 'checked' : ''} />
        Cheating dealer mode
      </label>
      <label for="feldman-cheat-participant">Cheated participant
        <select id="feldman-cheat-participant">${Array.from({ length: state.participants }, (_, i) => i + 1)
          .map((i) => `<option value="${i}" ${state.cheatParticipant === i ? 'selected' : ''}>Participant ${i}</option>`)
          .join('')}</select>
      </label>
    </div>
    <p class="muted">Beginner mode hides internals and focuses on outcomes. Advanced mode reveals coefficients, commitments, equations, and intermediate values.</p>
  </section>
`;

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
  const reconstructedOk = shamir.reconstructed === (secret % Q + Q) % Q;

  return `
    <section class="exhibit" id="step-1" aria-live="polite">
      <h2>Step 1 - Break Shamir</h2>
      <p>Shamir shares alone carry no proof that the dealer used the claimed polynomial.</p>
      <p class="equation">Key idea: participants only receive y_i = f(x_i), with no verification equation.</p>
      <div class="controls-grid">
        <label for="shamir-cheat-participant">Cheated participant
          <select id="shamir-cheat-participant">${[1, 2, 3, 4]
            .map((i) => `<option value="${i}" ${state.shamirCheatParticipant === i ? 'selected' : ''}>Participant ${i}</option>`)
            .join('')}</select>
        </label>
        <label for="shamir-cheat-enabled" class="checkbox-label">
          <input id="shamir-cheat-enabled" type="checkbox" ${state.shamirCheatEnabled ? 'checked' : ''} />
          Cheating dealer mode
        </label>
        <button class="copy-btn" type="button" data-copy="${escapeHtml(
          JSON.stringify(
            shamir.shares.map((s) => ({ participant: s.participant, share: s.value.toString() })),
            null,
            2
          )
        )}">Copy shares</button>
      </div>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Shamir shares table">
        <table>
          <thead><tr><th>Participant</th><th>Share</th></tr></thead>
          <tbody>${shamir.shares
            .map((s) => `<tr><td>P${s.participant}</td><td class="mono">${short(s.value)}</td></tr>`)
            .join('')}</tbody>
        </table>
      </div>
      <p class="callout danger">
        Reconstruction from subset {P${shamir.subset[0].participant}, P${shamir.subset[1].participant}} gives
        <span class="mono">${short(shamir.reconstructed)}</span> instead of
        <span class="mono">${short(secret % Q)}</span>.
      </p>
      <p class="callout ${reconstructedOk ? 'success' : 'danger'}">
        ${reconstructedOk ? 'This run happened to reconstruct correctly.' : 'Verification failed because the share does not match the committed polynomial.'}
      </p>
    </section>
  `;
};

const renderStepTwo = (): string => {
  const run = state.feldmanRun;

  return `
    <section class="exhibit" id="step-2" aria-live="polite">
      <h2>Step 2 - Feldman Fix</h2>
      <p>Feldman adds public commitments so each participant can verify their share before reconstruction.</p>
      <p class="equation">g^y_i == Product(C_j^(x_i^j)) mod p</p>
      <button id="run-feldman" type="button">Run Feldman Verification</button>
      ${
        !run
          ? '<p class="muted">Run Feldman verification to see pass/fail status for each participant.</p>'
          : `
            <div class="table-wrap" tabindex="0" role="region" aria-label="Feldman verification results">
              <table>
                <thead><tr><th>Participant</th><th>LHS g^y_i</th><th>RHS Product(C_j^(x_i^j))</th><th>Result</th></tr></thead>
                <tbody>${verificationRows(run.verification, run.cheatedParticipant)}</tbody>
              </table>
            </div>
            ${
              run.verification.some((v) => !v.ok)
                ? '<p class="callout danger">Verification failed because the share does not match the committed polynomial.</p>'
                : '<p class="callout success">All participant shares match the committed polynomial.</p>'
            }
            <details class="details-block">
              <summary>Show details</summary>
              <div class="grid-2">
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Commitment</th><th>Value</th></tr></thead>
                    <tbody>${run.commitments.map((c, i) => `<tr><td>C${i}</td><td class="mono">${short(c)}</td></tr>`).join('')}</tbody>
                  </table>
                </div>
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Participant</th><th>Share</th></tr></thead>
                    <tbody>${run.shares.map((s) => `<tr><td>P${s.participant}</td><td class="mono">${short(s.value)}</td></tr>`).join('')}</tbody>
                  </table>
                </div>
              </div>
              ${
                state.advancedMode
                  ? `<p class="mono">coefficients: ${run.coefficients.map((c, i) => `a${i}=${short(c)}`).join(', ')}</p>`
                  : '<p class="muted">Switch to Advanced mode to view coefficients and intermediate values.</p>'
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
              )}">Copy Feldman details</button>
            </details>
          `
      }
    </section>
  `;
};

const renderStepThree = (): string => {
  const run = state.pedersenRun;

  return `
    <section class="exhibit" id="step-3" aria-live="polite">
      <h2>Step 3 - Pedersen Upgrade</h2>
      <p>Pedersen commitments add blinding randomness while retaining share verifiability.</p>
      <p class="equation">g^s_i * h^r_i == Product(C_j^(x_i^j)) mod p</p>
      <p class="callout warning">
        Demo integrity note: this lab derives h deterministically from g, so log_g(h) may be known.
        Real Pedersen deployments require h chosen so no one knows log_g(h).
      </p>
      <button id="run-pedersen" type="button">Run Pedersen Verification</button>
      ${
        !run
          ? '<p class="muted">Run Pedersen verification to inspect dual commitments and share-pair checks.</p>'
          : `
            <div class="table-wrap" tabindex="0" role="region" aria-label="Pedersen verification results">
              <table>
                <thead><tr><th>Participant</th><th>LHS g^s_i * h^r_i</th><th>RHS Product(C_j^(x_i^j))</th><th>Result</th></tr></thead>
                <tbody>${verificationRows(run.verification, run.cheatedParticipant)}</tbody>
              </table>
            </div>
            ${
              run.verification.some((v) => !v.ok)
                ? '<p class="callout danger">Verification failed because the share does not match the committed polynomial.</p>'
                : '<p class="callout success">All participant share pairs match the committed polynomials.</p>'
            }
            <details class="details-block">
              <summary>Show details</summary>
              <div class="grid-2">
                <div class="table-wrap">
                  <table>
                    <thead><tr><th>Commitment</th><th>Value</th><th>Run delta</th></tr></thead>
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
                    <thead><tr><th>Participant</th><th>Share pair</th></tr></thead>
                    <tbody>${run.shares.map((s) => `<tr><td>P${s.participant}</td><td class="mono">(s=${short(s.s)}, r=${short(s.r)})</td></tr>`).join('')}</tbody>
                  </table>
                </div>
              </div>
              ${
                state.advancedMode
                  ? `<p class="mono">f(x): ${run.fCoefficients.map((c, i) => `f${i}=${short(c)}`).join(', ')}</p>
                     <p class="mono">r(x): ${run.rCoefficients.map((c, i) => `r${i}=${short(c)}`).join(', ')}</p>`
                  : '<p class="muted">Switch to Advanced mode to view f(x), r(x), and intermediate values.</p>'
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
              )}">Copy Pedersen details</button>
            </details>
          `
      }
    </section>
  `;
};

const renderStepFour = (): string => {
  const field = state.sideBySideFeldman;
  const ped = state.sideBySidePedersen;

  return `
    <section class="exhibit" id="step-4" aria-live="polite">
      <h2>Step 4 - Compare Protocols</h2>
      <p>Use the same secret and threshold to compare verification behavior and commitment properties.</p>
      <button id="run-compare" type="button">Compare Protocols</button>
      ${
        !field || !ped
          ? '<p class="muted">Run comparison to populate both panels.</p>'
          : `
            <div class="grid-2">
              <article class="card">
                <h3>Feldman</h3>
                <p>Equation: g^y_i == Product(C_j^(x_i^j))</p>
                <p>${field.verification.every((x) => x.ok) ? 'All checks passed' : 'One or more checks failed'}</p>
              </article>
              <article class="card">
                <h3>Pedersen</h3>
                <p>Equation: g^s_i * h^r_i == Product(C_j^(x_i^j))</p>
                <p>${ped.verification.every((x) => x.ok) ? 'All checks passed' : 'One or more checks failed'}</p>
              </article>
            </div>
            <div class="table-wrap" tabindex="0" role="region" aria-label="Protocol comparison">
              <table>
                <thead><tr><th>Property</th><th>Feldman</th><th>Pedersen</th></tr></thead>
                <tbody>
                  <tr><td>Commitment form</td><td class="mono">g^(a_j)</td><td class="mono">g^(a_j) * h^(r_j)</td></tr>
                  <tr><td>Hiding</td><td>Computational</td><td>Information-theoretic</td></tr>
                  <tr><td>Binding</td><td>Computational</td><td>Computational</td></tr>
                  <tr><td>Setup assumption</td><td>Group parameters</td><td>Independent h with unknown log_g(h)</td></tr>
                  <tr><td>Share size</td><td>1 field element</td><td>2 field elements</td></tr>
                </tbody>
              </table>
            </div>
            <p class="callout warning">
              Demo integrity note: Pedersen security relies on independent h. This demo uses deterministic h only to teach the mechanics.
            </p>
          `
      }
    </section>
  `;
};

const renderParameters = (): string => `
  <section class="exhibit">
    <h2>Crypto Parameters</h2>
    <div class="grid-2">
      <article class="card">
        <h3>Parameters</h3>
        <p class="mono">p = ${short(P)}</p>
        <p class="mono">q = (p-1)/2 = ${short(Q)}</p>
        <p class="mono">g = ${G.toString()}, h = ${H.toString()}</p>
        <button class="copy-btn" type="button" data-copy="${escapeHtml(
          JSON.stringify(
            {
              p: P.toString(),
              q: Q.toString(),
              g: G.toString(),
              h: H.toString()
            },
            null,
            2
          )
        )}">Copy parameters</button>
      </article>
      <article class="card">
        <h3>Why These Choices</h3>
        <p>p is prime so arithmetic has inverses and the group has clean algebraic structure.</p>
        <p>q = (p-1)/2 gives a large prime-order subgroup for stable exponent arithmetic.</p>
        <p>g is a subgroup generator so commitments span the full subgroup.</p>
        <p>Pedersen needs h independent from g; knowing log_g(h) breaks binding assumptions.</p>
      </article>
    </div>
  </section>
`;

const render = (): void => {
  state.theme = getTheme();

  app.innerHTML = `
    <main class="shell" id="main-content" role="main">
      <section class="exhibit hero">
        <p class="eyebrow">systemslibrarian · crypto-lab</p>
        <h1>VSS Gate - Verifiable Secret Sharing Lab</h1>
        <p>
          A cryptography teaching lab for Shamir, Feldman, and Pedersen VSS.
          This project is educational and intentionally explicit about setup assumptions and security limits.
        </p>
      </section>

      ${renderLearningPanel()}
      ${renderDemoIntegrityNote()}
      ${renderStartHere()}
      ${renderLabControls()}
      ${renderProtocolFlow()}
      ${renderStepOne()}
      ${renderStepTwo()}
      ${renderStepThree()}
      ${renderStepFour()}
      ${renderParameters()}
    </main>
  `;

  bindEvents();
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
  });

  const cheatParticipant = document.querySelector<HTMLSelectElement>('#feldman-cheat-participant');
  cheatParticipant?.addEventListener('change', () => {
    state.cheatParticipant = clampPositiveInt(cheatParticipant.value, 2, 1, state.participants);
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
  });

  const compareBtn = document.querySelector<HTMLButtonElement>('#run-compare');
  compareBtn?.addEventListener('click', () => {
    const secret = parseSecret();
    const label = `compare-${state.threshold}-${state.participants}`;
    const basePoly = state.deterministicMode
      ? buildDeterministicPolynomial(secret, state.threshold, label, state.deterministicSeed)
      : undefined;

    state.sideBySideFeldman = basePoly
      ? runFeldmanWithPolynomial(basePoly, state.participants, null)
      : runFeldman(secret, state.threshold, state.participants, null, deterministicOptions());

    state.sideBySidePedersen = runPedersen(
      secret,
      state.threshold,
      state.participants,
      null,
      basePoly,
      deterministicOptions()
    );

    render();
  });

  document.querySelectorAll<HTMLButtonElement>('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const payload = btn.dataset.copy;
      if (!payload) {
        return;
      }
      await copyText(payload);
      const prev = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => {
        btn.textContent = prev;
      }, 1200);
    });
  });
};

// ── Theme toggle (persistent header, outside #app) ──────
const themeToggleBtn = document.getElementById('themeToggle');
const updateThemeButton = () => {
  if (!themeToggleBtn) return;
  const isDark = getTheme() === 'dark';
  themeToggleBtn.textContent = isDark ? '☀' : '☾';
  themeToggleBtn.setAttribute('aria-label', isDark ? 'Switch to light mode' : 'Switch to dark mode');
};
themeToggleBtn?.addEventListener('click', () => {
  const next: ThemeMode = getTheme() === 'dark' ? 'light' : 'dark';
  setTheme(next);
  updateThemeButton();
  render();
});
updateThemeButton();
// ─────────────────────────────────────────────────────────

render();
