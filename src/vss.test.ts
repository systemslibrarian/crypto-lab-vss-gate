import { describe, it, expect } from 'vitest';
import {
  mod,
  modPow,
  P,
  Q,
  G,
  H,
  lagrangeAtZero,
  runFeldman,
  runFeldmanWithPolynomial,
  runPedersen,
  buildDeterministicPolynomial,
  shamirDemoWithOptions,
  SMALL_P,
  SMALL_Q,
  SMALL_G,
  SMALL_H,
  feldmanSmallTrace,
  feldmanHomomorphism,
  pedersenAlternateOpenings,
  type RunOptions
} from './vss';

const DETERMINISTIC: RunOptions = { deterministic: true, seed: 'test-seed-stable' };

describe('Feldman VSS', () => {
  it('valid shares pass verification', () => {
    const run = runFeldman(42n, 2, 4, null, DETERMINISTIC);
    for (const v of run.verification) {
      expect(v.ok).toBe(true);
    }
  });

  it('tampered share fails verification', () => {
    const run = runFeldman(42n, 2, 4, 2, DETERMINISTIC);
    expect(run.verification[1].ok).toBe(false);
    // other shares should still pass
    expect(run.verification[0].ok).toBe(true);
    expect(run.verification[2].ok).toBe(true);
    expect(run.verification[3].ok).toBe(true);
  });

  it('commitments are consistent with polynomial', () => {
    const run = runFeldman(99n, 3, 5, null, DETERMINISTIC);
    for (let j = 0; j < run.coefficients.length; j++) {
      expect(run.commitments[j]).toBe(modPow(G, run.coefficients[j], P));
    }
  });
});

describe('Pedersen VSS', () => {
  it('valid shares pass verification', () => {
    const run = runPedersen(42n, 2, 4, null, undefined, DETERMINISTIC);
    for (const v of run.verification) {
      expect(v.ok).toBe(true);
    }
  });

  it('tampered share fails verification', () => {
    const run = runPedersen(42n, 2, 4, 3, undefined, DETERMINISTIC);
    expect(run.verification[2].ok).toBe(false);
    expect(run.verification[0].ok).toBe(true);
    expect(run.verification[1].ok).toBe(true);
    expect(run.verification[3].ok).toBe(true);
  });

  it('commitments use both generators', () => {
    const run = runPedersen(77n, 2, 3, null, undefined, DETERMINISTIC);
    for (let j = 0; j < run.fCoefficients.length; j++) {
      const expected = mod(
        modPow(G, run.fCoefficients[j], P) * modPow(H, run.rCoefficients[j], P),
        P
      );
      expect(run.commitments[j]).toBe(expected);
    }
  });
});

describe('Lagrange reconstruction', () => {
  it('returns original secret from valid shares', () => {
    const secret = 123456789n;
    const run = runFeldman(secret, 3, 5, null, DETERMINISTIC);
    const subset = run.shares.slice(0, 3);
    const recovered = lagrangeAtZero(subset);
    expect(recovered).toBe(mod(secret, Q));
  });

  it('returns original secret with different subset', () => {
    const secret = 999n;
    const run = runFeldman(secret, 2, 4, null, DETERMINISTIC);
    const subset = [run.shares[1], run.shares[3]];
    const recovered = lagrangeAtZero(subset);
    expect(recovered).toBe(mod(secret, Q));
  });

  it('fails with tampered share', () => {
    const secret = 42n;
    const run = runFeldman(secret, 2, 4, 1, DETERMINISTIC);
    const subset = [run.shares[0], run.shares[1]]; // share 0 is tampered (participant 1)
    const recovered = lagrangeAtZero(subset);
    expect(recovered).not.toBe(mod(secret, Q));
  });
});

describe('Deterministic polynomial generation', () => {
  it('is stable across calls with same seed', () => {
    const a = buildDeterministicPolynomial(42n, 3, 'test', 'seed-a');
    const b = buildDeterministicPolynomial(42n, 3, 'test', 'seed-a');
    expect(a).toEqual(b);
  });

  it('differs with different seeds', () => {
    const a = buildDeterministicPolynomial(42n, 3, 'test', 'seed-a');
    const b = buildDeterministicPolynomial(42n, 3, 'test', 'seed-b');
    expect(a[0]).toBe(b[0]); // same secret
    expect(a[1]).not.toBe(b[1]); // different higher coefficients
  });

  it('secret coefficient is secret mod Q', () => {
    const poly = buildDeterministicPolynomial(42n, 2, 'lbl', 'seed');
    expect(poly[0]).toBe(mod(42n, Q));
  });
});

describe('Shamirs demo with options', () => {
  it('deterministic mode produces same output', () => {
    const a = shamirDemoWithOptions(42n, 2, DETERMINISTIC);
    const b = shamirDemoWithOptions(42n, 2, DETERMINISTIC);
    expect(a.shares).toEqual(b.shares);
    expect(a.reconstructed).toBe(b.reconstructed);
  });

  it('cheated participant corrupts reconstruction', () => {
    const result = shamirDemoWithOptions(42n, 2, DETERMINISTIC);
    // subset includes the cheated participant, so reconstruction should differ
    const secretMod = mod(42n, Q);
    expect(result.reconstructed).not.toBe(secretMod);
  });
});

describe('Crypto primitives', () => {
  it('modPow produces correct result', () => {
    expect(modPow(2n, 10n, 1000n)).toBe(24n);
    expect(modPow(3n, 4n, 100n)).toBe(81n);
  });

  it('mod handles negative values', () => {
    expect(mod(-1n, 5n)).toBe(4n);
    expect(mod(-7n, 3n)).toBe(2n);
  });

  it('G is in the subgroup (G^Q mod P == 1)', () => {
    expect(modPow(G, Q, P)).toBe(1n);
  });

  it('H is in the subgroup (H^Q mod P == 1)', () => {
    expect(modPow(H, Q, P)).toBe(1n);
  });
});

describe('Small-field illustrative instance', () => {
  it('SMALL_P is a safe prime and SMALL_G generates the order-q subgroup', () => {
    expect(2n * SMALL_Q + 1n).toBe(SMALL_P);
    expect(modPow(2n, SMALL_P - 1n, SMALL_P)).toBe(1n); // Fermat base-2
    expect(modPow(2n, SMALL_Q - 1n, SMALL_Q)).toBe(1n);
    expect(modPow(SMALL_G, SMALL_Q, SMALL_P)).toBe(1n);
    expect(modPow(SMALL_H, SMALL_Q, SMALL_P)).toBe(1n);
  });

  it('feldmanSmallTrace: honest share verifies, decomposition product equals RHS', () => {
    const t = feldmanSmallTrace(13n, 5n, 3, false);
    expect(t.ok).toBe(true);
    expect(t.lhs).toBe(t.rhs);
    // last running partial equals the full RHS product
    expect(t.rhsTerms[t.rhsTerms.length - 1].partial).toBe(t.rhs);
    // LHS is genuinely g^(shareValue) in the small field
    expect(t.lhs).toBe(modPow(SMALL_G, t.shareValue, SMALL_P));
  });

  it('feldmanSmallTrace: tampered share fails and LHS != RHS', () => {
    const t = feldmanSmallTrace(13n, 5n, 2, true);
    expect(t.ok).toBe(false);
    expect(t.lhs).not.toBe(t.rhs);
    expect(t.shareValue).not.toBe(t.honestValue);
  });

  it('feldmanHomomorphism: recombined commitments land exactly on g^(f(i))', () => {
    for (const i of [1, 2, 3, 4]) {
      const h = feldmanHomomorphism(9n, 3n, i);
      expect(h.match).toBe(true);
      expect(h.recombined).toBe(h.gPowFofI);
    }
  });

  it('pedersenAlternateOpenings: every candidate secret yields the identical commitment', () => {
    const { commitment, openings } = pedersenAlternateOpenings(13n, 42n, [13n, 500n, 999n, 1n]);
    expect(openings.length).toBe(4);
    for (const o of openings) {
      expect(o.commitment).toBe(commitment);
      // each opening genuinely satisfies g^s * h^r == C in the small field
      expect(mod(modPow(SMALL_G, o.secret, SMALL_P) * modPow(SMALL_H, o.randomness, SMALL_P), SMALL_P)).toBe(commitment);
    }
    // exactly one row is the true opening, and it uses the real randomness
    const real = openings.filter((o) => o.isReal);
    expect(real.length).toBe(1);
    expect(real[0].randomness).toBe(42n);
  });
});

describe('Group parameters (RFC 3526 group 14)', () => {
  it('P is exactly 2048 bits', () => {
    // Guards against a mangled PRIME_HEX literal silently shrinking the field.
    expect(P.toString(2).length).toBe(2048);
  });

  it('P is a safe prime: P = 2Q + 1', () => {
    expect(2n * Q + 1n).toBe(P);
  });

  it('P passes a Fermat base-2 primality check (2^(P-1) ≡ 1)', () => {
    expect(modPow(2n, P - 1n, P)).toBe(1n);
  });

  it('Q passes a Fermat base-2 primality check (2^(Q-1) ≡ 1)', () => {
    expect(modPow(2n, Q - 1n, Q)).toBe(1n);
  });
});
