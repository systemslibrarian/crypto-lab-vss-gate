import { afterEach, expect, it, vi } from 'vitest';
import { buildRandomPolynomial, lagrangeAtZero, Q, runFeldmanWithPolynomial, runPedersen } from './vss';

afterEach(() => vi.restoreAllMocks());

function capturedBytes(values: bigint[]) {
  let scalarCalls = 0;
  vi.spyOn(crypto, 'getRandomValues').mockImplementation((target) => {
    const bytes = target as Uint8Array;
    bytes.fill(0);
    // Seeds are irrelevant to random-mode coefficient sampling. Provide a
    // bounded nonzero fallback so the old zero-rejecting code cannot hang.
    if (bytes.length > 16) {
      let value = values[scalarCalls++] ?? 1n;
      for (let i = bytes.length - 1; i >= 0; i--) {
        bytes[i] = Number(value & 255n);
        value >>= 8n;
      }
    }
    return target;
  });
  return () => scalarCalls;
}

it('accepts zero from the injected full-field coefficient source without retrying', () => {
  let calls = 0;
  const polynomial = buildRandomPolynomial(42n, 2, () => calls++ === 0 ? 0n : 1n);
  expect(polynomial).toEqual([42n, 0n]);
  expect(calls).toBe(1);
});

it('accepts both zero and Q-1 from secure bytes', () => {
  const calls = capturedBytes([0n, Q - 1n]);
  expect(buildRandomPolynomial(42n, 3)).toEqual([42n, 0n, Q - 1n]);
  expect(calls()).toBe(2);
});

it('rejects out-of-range secure bytes rather than introducing modulo bias', () => {
  const calls = capturedBytes([Q, Q + 1n, 0n]);
  expect(buildRandomPolynomial(42n, 2)).toEqual([42n, 0n]);
  expect(calls()).toBe(3);
});

it('allows a zero leading coefficient and reconstructs and verifies ordinary shares', () => {
  capturedBytes([0n, 0n]);
  const polynomial = buildRandomPolynomial(42n, 3);
  expect(polynomial).toEqual([42n, 0n, 0n]);
  const honest = runFeldmanWithPolynomial(polynomial, 5, null);
  expect(honest.verification.every(v => v.ok)).toBe(true);
  expect(lagrangeAtZero(honest.shares.slice(0, 3))).toBe(42n);
  const tampered = runFeldmanWithPolynomial(polynomial, 5, 2);
  expect(tampered.verification.map(v => v.ok)).toEqual([true, false, true, true, true]);
});

it('allows zero in every Pedersen blinder, including r0', () => {
  capturedBytes([0n, 0n, 0n, 0n, 0n]);
  const run = runPedersen(42n, 3, 5, null);
  expect(run.fCoefficients).toEqual([42n, 0n, 0n]);
  expect(run.rCoefficients).toEqual([0n, 0n, 0n]);
  expect(run.verification.every(v => v.ok)).toBe(true);
  expect(lagrangeAtZero(run.shares.slice(0, 3).map(s => ({ participant: s.participant, value: s.s })))).toBe(42n);
  capturedBytes([0n, 0n, 0n]);
  const tampered = runPedersen(42n, 3, 5, 2, run.fCoefficients);
  expect(tampered.rCoefficients).toEqual([0n, 0n, 0n]);
  expect(tampered.verification.map(v => v.ok)).toEqual([true, false, true, true, true]);
  // These forced boundary fixtures check arithmetic, not randomness quality.
});
