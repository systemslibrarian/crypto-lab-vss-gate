export type ThemeMode = 'dark' | 'light';

export type Share = {
  participant: number;
  value: bigint;
};

export type PedersenShare = {
  participant: number;
  s: bigint;
  r: bigint;
};

export type FeldmanRun = {
  secret: bigint;
  threshold: number;
  participants: number;
  coefficients: bigint[];
  commitments: bigint[];
  shares: Share[];
  verification: Array<{ participant: number; lhs: bigint; rhs: bigint; ok: boolean }>;
  cheatedParticipant: number | null;
};

export type PedersenRun = {
  secret: bigint;
  threshold: number;
  participants: number;
  fCoefficients: bigint[];
  rCoefficients: bigint[];
  commitments: bigint[];
  shares: PedersenShare[];
  verification: Array<{ participant: number; lhs: bigint; rhs: bigint; ok: boolean }>;
  cheatedParticipant: number | null;
};

export type RunOptions = {
  deterministic?: boolean;
  seed?: string;
};

// RFC 3526 group 14 prime (2048-bit safe prime).
const PRIME_HEX =
  'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E08' +
  '8A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD' +
  '3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E' +
  '7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899F' +
  'A5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF05' +
  '98DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C' +
  '62F356208552BB9ED529077096966D670C354E4ABC9804F174' +
  '6C08CA237327FFFFFFFFFFFFFFFF';

export const mod = (value: bigint, modulus: bigint): bigint => {
  const r = value % modulus;
  return r >= 0n ? r : r + modulus;
};

export const modPow = (base: bigint, exponent: bigint, modulus: bigint): bigint => {
  let result = 1n;
  let b = mod(base, modulus);
  let e = exponent;
  while (e > 0n) {
    if ((e & 1n) === 1n) {
      result = mod(result * b, modulus);
    }
    e >>= 1n;
    b = mod(b * b, modulus);
  }
  return result;
};

export const P = BigInt(`0x${PRIME_HEX}`);
export const Q = (P - 1n) / 2n;

// Use a subgroup generator of order Q by squaring canonical g=2.
export const G = 4n;
export const H = deriveSecondGenerator();

const bytesToBigint = (bytes: Uint8Array): bigint => {
  let hex = '';
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, '0');
  }
  return BigInt(`0x${hex || '00'}`);
};


const hashStringToBigint = (input: string): bigint => {
  let acc = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < input.length; i += 1) {
    acc ^= BigInt(input.charCodeAt(i));
    acc = mod(acc * prime, 1n << 64n);
  }
  return acc;
};

const createDeterministicRng = (seed: string): (() => bigint) => {
  let state = hashStringToBigint(seed) | 1n;
  return () => {
    state ^= state << 13n;
    state ^= state >> 7n;
    state ^= state << 17n;
    return mod(state, 1n << 64n);
  };
};
const randomBigintBelow = (modulus: bigint, deterministicRng?: () => bigint): bigint => {
  if (deterministicRng) {
    while (true) {
      const candidate = mod(deterministicRng(), modulus);
      if (candidate > 0n && candidate < modulus) {
        return candidate;
      }
    }
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const byteLength = Math.ceil(modulus.toString(2).length / 8);
    const bytes = new Uint8Array(byteLength);
    while (true) {
      crypto.getRandomValues(bytes);
      const candidate = bytesToBigint(bytes);
      if (candidate > 0n && candidate < modulus) {
        return candidate;
      }
    }
  }

  while (true) {
    const candidate = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
    if (candidate > 0n && candidate < modulus) {
      return candidate;
    }
  }
};

const randomSeed = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `fallback-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
};

const normalizeRunOptions = (options?: RunOptions): { deterministic: boolean; seed: string } => ({
  deterministic: Boolean(options?.deterministic),
  seed: options?.seed ?? randomSeed()
});

const deriveDeterministicScalar = (seed: string, label: string, secret: bigint, i: number): bigint => {
  const h = hashStringToBigint(`${seed}|${label}|${secret.toString()}|${i}`);
  return mod(h, Q - 1n) + 1n;
};

const resolvePolynomial = (
  secret: bigint,
  threshold: number,
  label: string,
  options?: RunOptions
): bigint[] => {
  const run = normalizeRunOptions(options);
  if (!run.deterministic) {
    return buildRandomPolynomial(secret, threshold);
  }
  return buildDeterministicPolynomial(secret, threshold, label, run.seed);
};

function deriveSecondGenerator(): bigint {
  // Deterministic map into the subgroup; protocols require unknown log_g(h).
  // For demo use, we derive h from domain-separated entropy and expose assumption in UI text.
  const digestInput = new TextEncoder().encode('pedersen-vss-generator-h');
  let acc = 0n;
  for (const b of digestInput) {
    acc = mod(acc * 257n + BigInt(b), Q);
  }
  const seed = mod(acc, Q - 2n) + 2n;
  return modPow(G, seed, P);
}

export const formatBigint = (value: bigint): string => value.toString();

const evalPolynomial = (coefficients: bigint[], x: bigint, modulus: bigint): bigint => {
  let acc = 0n;
  let power = 1n;
  for (const c of coefficients) {
    acc = mod(acc + c * power, modulus);
    power = mod(power * x, modulus);
  }
  return acc;
};

const buildRandomPolynomial = (secret: bigint, threshold: number, deterministicRng?: () => bigint): bigint[] => {
  const coefficients: bigint[] = [mod(secret, Q)];
  for (let i = 1; i < threshold; i += 1) {
    coefficients.push(randomBigintBelow(Q, deterministicRng));
  }
  return coefficients;
};

export const buildDeterministicPolynomial = (
  secret: bigint,
  threshold: number,
  label: string,
  seed = 'vss-gate-demo-seed'
): bigint[] => {
  const coefficients: bigint[] = [mod(secret, Q)];
  for (let i = 1; i < threshold; i += 1) {
    coefficients.push(deriveDeterministicScalar(seed, label, secret, i));
  }
  return coefficients;
};

const sharesFromPolynomial = (coefficients: bigint[], participants: number): Share[] => {
  const shares: Share[] = [];
  for (let i = 1; i <= participants; i += 1) {
    shares.push({ participant: i, value: evalPolynomial(coefficients, BigInt(i), Q) });
  }
  return shares;
};

export const runFeldmanWithPolynomial = (
  coefficients: bigint[],
  participants: number,
  cheatParticipant: number | null
): FeldmanRun => {
  const commitments = feldmanCommitments(coefficients);
  const shares = sharesFromPolynomial(coefficients, participants);

  if (cheatParticipant !== null) {
    const idx = cheatParticipant - 1;
    shares[idx] = { participant: cheatParticipant, value: mod(shares[idx].value + 1n, Q) };
  }

  const verification = shares.map((s) => {
    const out = verifyFeldmanShare(s, commitments);
    return { participant: s.participant, lhs: out.lhs, rhs: out.rhs, ok: out.ok };
  });

  return {
    secret: mod(coefficients[0], Q),
    threshold: coefficients.length,
    participants,
    coefficients,
    commitments,
    shares,
    verification,
    cheatedParticipant: cheatParticipant
  };
};

const feldmanCommitments = (coefficients: bigint[]): bigint[] =>
  coefficients.map((c) => modPow(G, c, P));

const pedersenCommitments = (f: bigint[], r: bigint[]): bigint[] =>
  f.map((coef, i) => mod(modPow(G, coef, P) * modPow(H, r[i], P), P));

const verifyFeldmanShare = (share: Share, commitments: bigint[]): { lhs: bigint; rhs: bigint; ok: boolean } => {
  const i = BigInt(share.participant);
  const lhs = modPow(G, share.value, P);
  let rhs = 1n;
  let power = 1n;
  for (const commitment of commitments) {
    rhs = mod(rhs * modPow(commitment, power, P), P);
    power = mod(power * i, Q);
  }
  return { lhs, rhs, ok: lhs === rhs };
};

const verifyPedersenShare = (share: PedersenShare, commitments: bigint[]): { lhs: bigint; rhs: bigint; ok: boolean } => {
  const i = BigInt(share.participant);
  const lhs = mod(modPow(G, share.s, P) * modPow(H, share.r, P), P);
  let rhs = 1n;
  let power = 1n;
  for (const commitment of commitments) {
    rhs = mod(rhs * modPow(commitment, power, P), P);
    power = mod(power * i, Q);
  }
  return { lhs, rhs, ok: lhs === rhs };
};

export const lagrangeAtZero = (shares: Share[]): bigint => {
  let secret = 0n;
  for (let i = 0; i < shares.length; i += 1) {
    const xi = BigInt(shares[i].participant);
    let num = 1n;
    let den = 1n;
    for (let j = 0; j < shares.length; j += 1) {
      if (i === j) {
        continue;
      }
      const xj = BigInt(shares[j].participant);
      num = mod(num * (-xj), Q);
      den = mod(den * (xi - xj), Q);
    }
    const inv = modPow(den, Q - 2n, Q);
    secret = mod(secret + shares[i].value * num * inv, Q);
  }
  return secret;
};

export const runFeldman = (
  secret: bigint,
  threshold: number,
  participants: number,
  cheatParticipant: number | null,
  options?: RunOptions
): FeldmanRun => {
  const coefficients = resolvePolynomial(secret, threshold, 'feldman-f', options);
  return runFeldmanWithPolynomial(coefficients, participants, cheatParticipant);
};

export const runPedersen = (
  secret: bigint,
  threshold: number,
  participants: number,
  cheatParticipant: number | null,
  basePolynomial?: bigint[],
  options?: RunOptions
): PedersenRun => {
  const run = normalizeRunOptions(options);
  const deterministicRng = run.deterministic ? createDeterministicRng(`${run.seed}|pedersen-r`) : undefined;
  const fCoefficients = basePolynomial ?? resolvePolynomial(secret, threshold, 'pedersen-f', options);
  const rCoefficients = Array.from({ length: threshold }, (_, i) => {
    if (run.deterministic) {
      return deriveDeterministicScalar(run.seed, 'pedersen-r', secret, i + 1);
    }
    return randomBigintBelow(Q, deterministicRng);
  });
  const commitments = pedersenCommitments(fCoefficients, rCoefficients);

  const shares: PedersenShare[] = [];
  for (let i = 1; i <= participants; i += 1) {
    const x = BigInt(i);
    shares.push({
      participant: i,
      s: evalPolynomial(fCoefficients, x, Q),
      r: evalPolynomial(rCoefficients, x, Q)
    });
  }

  if (cheatParticipant !== null) {
    const idx = cheatParticipant - 1;
    shares[idx] = { participant: cheatParticipant, s: mod(shares[idx].s + 1n, Q), r: shares[idx].r };
  }

  const verification = shares.map((s) => {
    const out = verifyPedersenShare(s, commitments);
    return { participant: s.participant, lhs: out.lhs, rhs: out.rhs, ok: out.ok };
  });

  return {
    secret: mod(secret, Q),
    threshold,
    participants,
    fCoefficients,
    rCoefficients,
    commitments,
    shares,
    verification,
    cheatedParticipant: cheatParticipant
  };
};

export const shamirDemo = (secret: bigint, cheatedParticipant: number | null): {
  coefficients: bigint[];
  shares: Share[];
  reconstructed: bigint;
  subset: Share[];
} => {
  const coefficients = buildRandomPolynomial(secret, 2);
  const shares = sharesFromPolynomial(coefficients, 4);
  if (cheatedParticipant !== null) {
    const idx = cheatedParticipant - 1;
    shares[idx] = { participant: cheatedParticipant, value: mod(shares[idx].value + 1n, Q) };
  }

  const subset = cheatedParticipant !== null
    ? [shares[cheatedParticipant - 1], shares[0].participant === cheatedParticipant ? shares[1] : shares[0]]
    : [shares[0], shares[1]];

  return {
    coefficients,
    shares,
    reconstructed: lagrangeAtZero(subset),
    subset
  };
};

export const shamirDemoWithOptions = (
  secret: bigint,
  cheatedParticipant: number | null,
  options?: RunOptions
): {
  coefficients: bigint[];
  shares: Share[];
  reconstructed: bigint;
  subset: Share[];
} => {
  const run = normalizeRunOptions(options);
  const coefficients = run.deterministic
    ? buildDeterministicPolynomial(secret, 2, 'shamir-demo', run.seed)
    : buildRandomPolynomial(secret, 2);
  const shares = sharesFromPolynomial(coefficients, 4);

  if (cheatedParticipant !== null) {
    const idx = cheatedParticipant - 1;
    shares[idx] = { participant: cheatedParticipant, value: mod(shares[idx].value + 1n, Q) };
  }

  const subset = cheatedParticipant !== null
    ? [shares[cheatedParticipant - 1], shares[0].participant === cheatedParticipant ? shares[1] : shares[0]]
    : [shares[0], shares[1]];

  return {
    coefficients,
    shares,
    reconstructed: lagrangeAtZero(subset),
    subset
  };
};
