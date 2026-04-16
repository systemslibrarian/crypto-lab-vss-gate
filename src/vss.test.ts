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
