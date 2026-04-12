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
  shamirDemo,
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
  cheatEnabled: boolean;
  cheatParticipant: number;
  shamirCheatEnabled: boolean;
  shamirCheatParticipant: number;
  feldmanRun: FeldmanRun | null;
  pedersenRun: PedersenRun | null;
  sideBySideFeldman: FeldmanRun | null;
  sideBySidePedersen: PedersenRun | null;
  pedersenPrevCommitments: bigint[] | null;
  pvssCheck: { participant: number; ok: boolean; lhs: bigint; rhs: bigint } | null;
  shamirCache: { key: string; result: ReturnType<typeof shamirDemo> } | null;
};

const getTheme = (): ThemeMode =>
  document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';

const getThemeMeta = (theme: ThemeMode): { icon: string; label: string } =>
  theme === 'dark'
    ? { icon: '🌙', label: 'Switch to light mode' }
    : { icon: '☀️', label: 'Switch to dark mode' };

const setTheme = (theme: ThemeMode): void => {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
};

const state: AppState = {
  theme: getTheme(),
  secretInput: '123456789',
  threshold: 2,
  participants: 4,
  cheatEnabled: false,
  cheatParticipant: 2,
  shamirCheatEnabled: true,
  shamirCheatParticipant: 2,
  feldmanRun: null,
  pedersenRun: null,
  sideBySideFeldman: null,
  sideBySidePedersen: null,
  pedersenPrevCommitments: null,
  pvssCheck: null,
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
  if (s.length <= 36) {
    return s;
  }
  return `${s.slice(0, 16)}...${s.slice(-16)}`;
};

const boolMark = (ok: boolean): string => (ok ? '✓' : '✗');

const renderShareRows = (rows: Array<{ participant: number; value: bigint }>, label = 'share'): string =>
  rows
    .map((r) => `<tr><td>P${r.participant}</td><td>${label}</td><td class="mono">${short(r.value)}</td></tr>`)
    .join('');

const render = (): void => {
  state.theme = getTheme();
  const themeMeta = getThemeMeta(state.theme);
  const secret = parseSecret();
  const shamirCheat = state.shamirCheatEnabled ? state.shamirCheatParticipant : null;
  const shamirCacheKey = `${secret}|${shamirCheat}`;
  if (!state.shamirCache || state.shamirCache.key !== shamirCacheKey) {
    state.shamirCache = { key: shamirCacheKey, result: shamirDemo(secret, shamirCheat) };
  }
  const shamir = state.shamirCache.result;

  app.innerHTML = `
    <main class="shell" id="main-content" role="main">
      <header class="hero">
        <button id="theme-toggle" class="theme-toggle" type="button" aria-label="${themeMeta.label}" title="${themeMeta.label}">${themeMeta.icon}</button>
        <p class="eyebrow">systemslibrarian · crypto-lab</p>
        <h1>crypto-lab-vss-gate</h1>
        <p>
          Verifiable Secret Sharing in one browser lab: <strong>Feldman VSS (FOCS 1987)</strong> and
          <strong>Pedersen VSS (CRYPTO 1991)</strong>, including cheating-dealer detection before reconstruction.
        </p>
        <div class="hero-chips">
          <span class="chip">Prime Field</span>
          <span class="chip">Feldman 1987</span>
          <span class="chip">Pedersen 1991</span>
          <span class="chip">Cheating Detection</span>
        </div>
      </header>

      <section class="exhibit">
        <h2>Exhibit 1 — Why Shamir Alone Is Not Enough</h2>
        <p>
          In plain Shamir SSS, participants receive points (xᵢ, yᵢ) but cannot verify if yᵢ came from the committed polynomial.
          A malicious dealer can send one corrupted share that looks normal until reconstruction fails.
        </p>
        <div class="controls-grid">
          <label for="secret-input">Secret (integer)
            <input id="secret-input" type="text" value="${escapeHtml(state.secretInput)}" />
          </label>
          <label for="shamir-cheat-participant">Cheated participant
            <select id="shamir-cheat-participant">${[1, 2, 3, 4].map((i) => `<option value="${i}" ${state.shamirCheatParticipant === i ? 'selected' : ''}>Participant ${i}</option>`).join('')}</select>
          </label>
          <label for="shamir-cheat-enabled" class="checkbox-label">
            <input id="shamir-cheat-enabled" type="checkbox" ${state.shamirCheatEnabled ? 'checked' : ''} />
            Cheating dealer mode
          </label>
        </div>
        <div class="table-wrap" tabindex="0" role="region" aria-label="Shamir shares table">
          <table>
            <caption class="sr-only">Shamir secret shares for 4 participants</caption>
            <thead><tr><th scope="col">Participant</th><th scope="col">Type</th><th scope="col">Value</th></tr></thead>
            <tbody>${renderShareRows(shamir.shares)}</tbody>
          </table>
        </div>
        <p class="callout danger">
          With Shamir alone, the cheated participant cannot detect fraud immediately. Reconstruction from subset
          {P${shamir.subset[0].participant}, P${shamir.subset[1].participant}} gives
          <span class="mono">${short(shamir.reconstructed)}</span> instead of
          <span class="mono">${short(secret % Q)}</span>.
        </p>
        <p class="callout">
          Why this matters: threshold wallets, distributed key generation, and MPC cannot assume an honest dealer.
          VSS is the mechanism that checks shares upfront.
        </p>
        <p class="linkline">See FROST Threshold for VSS in threshold signatures:
          <a href="https://systemslibrarian.github.io/crypto-lab-frost-threshold/" target="_blank" rel="noreferrer">https://systemslibrarian.github.io/crypto-lab-frost-threshold/</a>
        </p>
      </section>

      <section class="exhibit" aria-live="polite">
        <h2>Exhibit 2 — Feldman VSS</h2>
        <p>
          Dealer picks f(x)=s+a₁x+... over Z<sub>q</sub>, publishes commitments Cⱼ=g<sup>aⱼ</sup> mod p, then each participant verifies
          g<sup>sᵢ</sup> = ∏ Cⱼ<sup>iʲ</sup> mod p.
        </p>
        <div class="controls-grid">
          <label for="threshold-input">Threshold t
            <input id="threshold-input" type="number" min="2" max="6" value="${state.threshold}" />
          </label>
          <label for="participants-input">Participants n
            <input id="participants-input" type="number" min="2" max="8" value="${state.participants}" />
          </label>
          <label for="feldman-cheat-participant">Cheated participant
            <select id="feldman-cheat-participant">${Array.from({ length: state.participants }, (_, i) => i + 1).map((i) => `<option value="${i}" ${state.cheatParticipant === i ? 'selected' : ''}>Participant ${i}</option>`).join('')}</select>
          </label>
          <label for="cheat-enabled" class="checkbox-label">
            <input id="cheat-enabled" type="checkbox" ${state.cheatEnabled ? 'checked' : ''} />
            Introduce cheating dealer
          </label>
        </div>
        <button id="run-feldman" type="button">Run Feldman VSS</button>
        ${state.feldmanRun ? renderFeldman(state.feldmanRun) : '<p class="muted">Run the protocol to see commitments, shares, and verification equations.</p>'}
        <p class="callout">
          Why this matters: Feldman commitments are public and widely used in threshold systems including FROST-style DKG.
        </p>
      </section>

      <section class="exhibit" aria-live="polite">
        <h2>Exhibit 3 — Pedersen VSS</h2>
        <p>
          Dealer uses two polynomials f(x), r(x) and commitments Cⱼ=g<sup>fⱼ</sup>·h<sup>rⱼ</sup> mod p.
          Participant i checks g<sup>sᵢ</sup>·h<sup>rᵢ</sup> = ∏ Cⱼ<sup>iʲ</sup> mod p.
        </p>
        <button id="run-pedersen" type="button">Run Pedersen VSS</button>
        ${state.pedersenRun ? renderPedersen(state.pedersenRun, state.pedersenPrevCommitments) : '<p class="muted">Run the protocol to see blinded commitments and share-pair verification.</p>'}
        <p class="callout">
          Why this matters: Pedersen commitments are information-theoretically hiding, with a setup assumption that no one knows log<sub>g</sub>(h).
        </p>
      </section>

      <section class="exhibit" aria-live="polite">
        <h2>Exhibit 4 — Side-by-Side: Feldman vs Pedersen</h2>
        <p>Same secret and threshold, two protocols side by side.</p>
        <button id="run-compare" type="button">Run Side-by-Side</button>
        ${renderComparison()}
      </section>

      <section class="exhibit">
        <h2>Exhibit 5 — VSS in the Real World</h2>
        <div class="card-grid">
          <article class="card">
            <h3>Deployment A — FROST Threshold Signatures (RFC 9591)</h3>
            <p>FROST DKG uses Feldman VSS so participants can validate distributed shares before signing rounds.</p>
            <a href="https://systemslibrarian.github.io/crypto-lab-frost-threshold/" target="_blank" rel="noreferrer">Open FROST Threshold demo</a>
          </article>
          <article class="card">
            <h3>Deployment B — Threshold Wallet Key Generation</h3>
            <p>Wallet MPC stacks use VSS-backed DKG so no single machine holds the full private key.</p>
          </article>
          <article class="card">
            <h3>Deployment C — Publicly Verifiable Secret Sharing (PVSS)</h3>
            <p>PVSS extends VSS so third parties can validate shares against public commitments.</p>
            <button id="run-pvss-check" type="button">Run third-party share check</button>
            ${state.pvssCheck ? `<p class="mono">P${state.pvssCheck.participant}: ${boolMark(state.pvssCheck.ok)} | lhs=${short(state.pvssCheck.lhs)} rhs=${short(state.pvssCheck.rhs)}</p>` : '<p class="muted">Generate Feldman output first, then run a public share check.</p>'}
          </article>
        </div>
        <pre class="family-tree" role="img" aria-label="VSS family tree: Shamir leads to Feldman, Pedersen, PVSS, DKG, then FROST GG20 DKLS23">Shamir SSS (no verification)
└─ Feldman VSS (computational hiding, public commitments)
   └─ Pedersen VSS (information-theoretic hiding, blinded commitments)
      └─ PVSS (third-party verifiable)
         └─ DKG protocols (no trusted dealer)
            └─ FROST, GG20, DKLS23</pre>
        <p class="callout">
          Every serious threshold deployment relies on VSS foundations. Understanding Feldman and Pedersen explains the integrity layer behind modern multi-party cryptography.
        </p>
        <p class="linkline">Cross-demo links:
          <a href="https://systemslibrarian.github.io/crypto-lab-frost-threshold/" target="_blank" rel="noreferrer">FROST Threshold</a> ·
          <a href="https://systemslibrarian.github.io/crypto-lab-shamir-gate/" target="_blank" rel="noreferrer">Shamir Gate</a> ·
          <a href="https://systemslibrarian.github.io/crypto-lab-silent-tally/" target="_blank" rel="noreferrer">Silent Tally (MPC)</a> ·
          <a href="https://systemslibrarian.github.io/crypto-compare/" target="_blank" rel="noreferrer">Crypto Compare reference</a>
        </p>
      </section>

      <section class="exhibit">
        <h2>Cryptographic Parameters</h2>
        <p class="mono">p = ${short(P)}</p>
        <p class="mono">q = (p-1)/2 = ${short(Q)}</p>
        <p class="mono">g = ${G.toString()} (subgroup generator), h = ${H.toString()} (second generator for Pedersen commitments)</p>
      </section>
    </main>
  `;

  bindEvents();
};

const renderFeldman = (run: FeldmanRun): string => {
  const verificationRows = run.verification
    .map(
      (v) =>
        `<tr><td>P${v.participant}</td><td class="mono">g^sᵢ=${short(v.lhs)}</td><td class="mono">∏Cⱼ^(i^j)=${short(v.rhs)}</td><td>${boolMark(v.ok)}</td></tr>`
    )
    .join('');

  const commitmentRows = run.commitments
    .map((c, i) => `<tr><td>C${i}</td><td class="mono">${short(c)}</td></tr>`)
    .join('');

  const coefficientList = run.coefficients.map((c, i) => `a${i}=${short(c)}`).join(', ');

  return `
    <p class="mono">f(x) coefficients: ${coefficientList}</p>
    <div class="grid-2">
      <div class="table-wrap" tabindex="0" role="region" aria-label="Feldman commitments">
        <table>
          <caption class="sr-only">Public commitments C₀ through C_{t-1}</caption>
          <thead><tr><th scope="col">Commitment</th><th scope="col">Value</th></tr></thead>
          <tbody>${commitmentRows}</tbody>
        </table>
      </div>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Feldman shares">
        <table>
          <caption class="sr-only">Participant shares</caption>
          <thead><tr><th scope="col">Participant</th><th scope="col">Share</th></tr></thead>
          <tbody>${run.shares.map((s) => `<tr><td>P${s.participant}</td><td class="mono">${short(s.value)}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Feldman verification results">
      <table>
        <caption class="sr-only">Share verification equations and results</caption>
        <thead><tr><th scope="col">Participant</th><th scope="col">LHS</th><th scope="col">RHS</th><th scope="col">Result</th></tr></thead>
        <tbody>${verificationRows}</tbody>
      </table>
    </div>
  `;
};

const renderPedersen = (run: PedersenRun, previousCommitments: bigint[] | null): string => {
  const verificationRows = run.verification
    .map(
      (v) =>
        `<tr><td>P${v.participant}</td><td class="mono">g^sᵢ·h^rᵢ=${short(v.lhs)}</td><td class="mono">∏Cⱼ^(i^j)=${short(v.rhs)}</td><td>${boolMark(v.ok)}</td></tr>`
    )
    .join('');

  const coefficientF = run.fCoefficients.map((c, i) => `f${i}=${short(c)}`).join(', ');
  const coefficientR = run.rCoefficients.map((c, i) => `r${i}=${short(c)}`).join(', ');
  const commitmentRows = run.commitments
    .map((c, i) => {
      const changed = previousCommitments ? previousCommitments[i] !== c : false;
      return `<tr><td>C${i}</td><td class="mono">${short(c)}</td><td>${previousCommitments ? (changed ? 'changed' : 'same') : 'first run'}</td></tr>`;
    })
    .join('');

  return `
    <p class="mono">f(x): ${coefficientF}</p>
    <p class="mono">r(x): ${coefficientR}</p>
    <div class="grid-2">
      <div class="table-wrap" tabindex="0" role="region" aria-label="Pedersen commitments">
        <table>
          <caption class="sr-only">Pedersen blinded commitments</caption>
          <thead><tr><th scope="col">Commitment</th><th scope="col">Value</th><th scope="col">Run delta</th></tr></thead>
          <tbody>${commitmentRows}</tbody>
        </table>
      </div>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Pedersen shares">
        <table>
          <caption class="sr-only">Participant share pairs (s, r)</caption>
          <thead><tr><th scope="col">Participant</th><th scope="col">Share pair</th></tr></thead>
          <tbody>${run.shares.map((s) => `<tr><td>P${s.participant}</td><td class="mono">(s=${short(s.s)}, r=${short(s.r)})</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Pedersen verification results">
      <table>
        <caption class="sr-only">Share verification equations and results</caption>
        <thead><tr><th scope="col">Participant</th><th scope="col">LHS</th><th scope="col">RHS</th><th scope="col">Result</th></tr></thead>
        <tbody>${verificationRows}</tbody>
      </table>
    </div>
  `;
};

const renderComparison = (): string => {
  if (!state.sideBySideFeldman || !state.sideBySidePedersen) {
    return '<p class="muted">Run comparison to populate both panels and table.</p>';
  }

  const feldmanCommitments = state.sideBySideFeldman.commitments.map(short).join(', ');
  const pedersenCommitments = state.sideBySidePedersen.commitments.map(short).join(', ');

  return `
    <div class="grid-2">
      <article class="card">
        <h3>Feldman panel</h3>
        <p class="mono">Commitments: ${feldmanCommitments}</p>
        <p>${state.sideBySideFeldman.verification.every((x) => x.ok) ? 'All checks pass' : 'At least one check failed'}</p>
      </article>
      <article class="card">
        <h3>Pedersen panel</h3>
        <p class="mono">Commitments: ${pedersenCommitments}</p>
        <p>${state.sideBySidePedersen.verification.every((x) => x.ok) ? 'All checks pass' : 'At least one check failed'}</p>
      </article>
    </div>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Feldman vs Pedersen comparison">
      <table>
        <caption class="sr-only">Property comparison between Feldman and Pedersen VSS</caption>
        <thead><tr><th scope="col">Property</th><th scope="col">Feldman VSS (1987)</th><th scope="col">Pedersen VSS (1991)</th></tr></thead>
        <tbody>
          <tr><td>Commitment type</td><td class="mono">g^(a_j)</td><td class="mono">g^(a_j) · h^(r_j)</td></tr>
          <tr><td>Hiding property</td><td>Computational</td><td>Information-theoretic</td></tr>
          <tr><td>Binding property</td><td>Computational</td><td>Computational</td></tr>
          <tr><td>Setup requirement</td><td>Group parameters</td><td>Second generator h with unknown log_g(h)</td></tr>
          <tr><td>Commitment randomness</td><td>Deterministic for fixed polynomial</td><td>Randomized by r_j each run</td></tr>
          <tr><td>Publicly verifiable</td><td>✓</td><td>✓</td></tr>
          <tr><td>Share size</td><td>1 field element</td><td>2 field elements</td></tr>
          <tr><td>Used in</td><td>FROST, most DKG</td><td>MPC, e-voting, privacy DKG</td></tr>
        </tbody>
      </table>
    </div>
    <p class="callout">Use Feldman when public verifiability and no trusted h setup are required. Use Pedersen when information-theoretic hiding of coefficients is required and setup is available.</p>
  `;
};

const bindEvents = (): void => {
  const themeToggle = document.querySelector<HTMLButtonElement>('#theme-toggle');
  themeToggle?.addEventListener('click', () => {
    const nextTheme: ThemeMode = getTheme() === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    render();
  });

  const secretInput = document.querySelector<HTMLInputElement>('#secret-input');
  secretInput?.addEventListener('input', () => {
    state.secretInput = secretInput.value;
    state.feldmanRun = null;
    state.pedersenRun = null;
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

  const shamirCheatEnabled = document.querySelector<HTMLInputElement>('#shamir-cheat-enabled');
  shamirCheatEnabled?.addEventListener('change', () => {
    state.shamirCheatEnabled = shamirCheatEnabled.checked;
    render();
  });

  const shamirCheatParticipant = document.querySelector<HTMLSelectElement>('#shamir-cheat-participant');
  shamirCheatParticipant?.addEventListener('change', () => {
    state.shamirCheatParticipant = clampPositiveInt(shamirCheatParticipant.value, 2, 1, 4);
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

  const runFeldmanBtn = document.querySelector<HTMLButtonElement>('#run-feldman');
  runFeldmanBtn?.addEventListener('click', () => {
    const secret = parseSecret();
    state.feldmanRun = runFeldman(
      secret,
      state.threshold,
      state.participants,
      state.cheatEnabled ? state.cheatParticipant : null
    );
    state.pvssCheck = null;
    render();
  });

  const runPedersenBtn = document.querySelector<HTMLButtonElement>('#run-pedersen');
  runPedersenBtn?.addEventListener('click', () => {
    const secret = parseSecret();
    const prior = state.pedersenRun?.commitments ?? null;
    state.pedersenRun = runPedersen(
      secret,
      state.threshold,
      state.participants,
      state.cheatEnabled ? state.cheatParticipant : null
    );
    state.pedersenPrevCommitments = prior;
    render();
  });

  const runCompareBtn = document.querySelector<HTMLButtonElement>('#run-compare');
  runCompareBtn?.addEventListener('click', async () => {
    const secret = parseSecret();
    const basePoly = await buildDeterministicPolynomial(secret, state.threshold, 'side-by-side');
    state.sideBySideFeldman = runFeldmanWithPolynomial(basePoly, state.participants, null);
    state.sideBySidePedersen = runPedersen(secret, state.threshold, state.participants, null, basePoly);
    render();
  });

  const pvssBtn = document.querySelector<HTMLButtonElement>('#run-pvss-check');
  pvssBtn?.addEventListener('click', () => {
    if (!state.feldmanRun) {
      return;
    }
    const participant = 1;
    const share = state.feldmanRun.shares[participant - 1];
    let rhs = 1n;
    let pow = 1n;
    for (const c of state.feldmanRun.commitments) {
      let part = 1n;
      let b = c % P;
      let e = pow;
      while (e > 0n) {
        if ((e & 1n) === 1n) {
          part = (part * b) % P;
        }
        b = (b * b) % P;
        e >>= 1n;
      }
      rhs = (rhs * part) % P;
      pow = (pow * BigInt(participant)) % Q;
    }
    let lhs = 1n;
    let base = G % P;
    let exp = share.value;
    while (exp > 0n) {
      if ((exp & 1n) === 1n) {
        lhs = (lhs * base) % P;
      }
      base = (base * base) % P;
      exp >>= 1n;
    }
    state.pvssCheck = { participant, ok: lhs === rhs, lhs, rhs };
    render();
  });
};

render();
