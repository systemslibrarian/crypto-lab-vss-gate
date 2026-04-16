# VSS Gate — Verifiable Secret Sharing Lab

An educational cryptography lab demonstrating **Feldman VSS (FOCS 1987)** and **Pedersen VSS (CRYPTO 1991)** — the two foundational constructions that add verifiability to Shamir's Secret Sharing.

## What This Project Is

An interactive, browser-based lab that teaches:

- Why Shamir SSS alone fails when the dealer is malicious
- How Feldman commitments let participants verify shares immediately
- How Pedersen adds information-theoretic hiding with blinded commitments
- What setup assumptions each protocol requires

The lab includes a guided four-step flow (Break Shamir → Feldman Fix → Pedersen Upgrade → Compare), pass/fail verification badges, beginner/advanced mode toggle, deterministic reproducibility, and a full test suite.

## What This Project Is NOT

- **Not production-ready.** This code has not been audited and is not suitable for real key management.
- **Not constant-time.** BigInt arithmetic in JavaScript is not side-channel resistant.
- **Not a secure Pedersen implementation.** The second generator `h` is derived deterministically from `g`, meaning `log_g(h)` is knowable. A real deployment must choose `h` so no one knows this discrete log. See the warning below.

> **⚠️ Demo Integrity Note**
>
> This demo illustrates Pedersen verification mechanics.
> In a real system, the generator `h` must be chosen so that no one knows its discrete log relative to `g`.
> This implementation derives `h` deterministically for demonstration purposes only and is **NOT secure for production use**.

## Why This Matters

VSS is a foundational building block in modern threshold cryptography:

```
Shamir Secret Sharing
        ↓
Verifiable Secret Sharing (Feldman / Pedersen)
        ↓
Distributed Key Generation (DKG)
        ↓
Threshold Signatures (FROST, etc.)
        ↓
Secure MPC Systems
```

Every serious threshold deployment — FROST, GG20, DKLS23, threshold wallets — relies on VSS integrity checks. Understanding Feldman and Pedersen explains the verification layer behind all of them.

## Learning Goals

After completing the four-step guided lab, you should understand:

1. **The dealer cheating problem**: Shamir shares alone carry no proof of polynomial consistency.
2. **Commitment-based verification**: Feldman publishes `C_j = g^{a_j} mod p` so participants verify `g^{y_i} = ∏ C_j^{x_i^j}`.
3. **Pedersen's stronger hiding**: Dual commitments `C_j = g^{a_j} · h^{r_j}` yield information-theoretic hiding, at the cost of a trusted setup for `h`.
4. **Feldman vs Pedersen tradeoffs**: Feldman requires no extra setup but leaks coefficient information. Pedersen hides coefficients but requires independent `h`.

## Live Demo

**https://systemslibrarian.github.io/crypto-lab-vss-gate/**

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-vss-gate
cd crypto-lab-vss-gate
npm install
npm run dev
```

## Test Suite

```bash
npm test          # single run
npm run test:watch # watch mode
```

Tests cover:
- Feldman valid shares pass / tampered share fails
- Pedersen valid shares pass / tampered share fails
- Lagrange reconstruction returns original secret
- Deterministic polynomial generation is stable
- Subgroup generator validation (G^Q = 1, H^Q = 1)

## Crypto Parameter Choices

| Parameter | Value | Reason |
|-----------|-------|--------|
| `p` | RFC 3526 Group 14 (2048-bit safe prime) | Prime field with clean algebraic structure and inverses |
| `q = (p-1)/2` | Large prime | Prime-order subgroup for stable exponent arithmetic |
| `g = 4` | Subgroup generator (2² mod p) | Spans the full order-q subgroup |
| `h` | Derived from `g` deterministically | **Demo only.** Real systems need `h` with unknown `log_g(h)` |

## Protocol References

- **Feldman, P.** "A Practical Scheme for Non-interactive Verifiable Secret Sharing." *FOCS 1987.*
- **Pedersen, T. P.** "Non-Interactive and Information-Theoretic Secure Verifiable Secret Sharing." *CRYPTO 1991.*

## GitHub Pages Setup

Deploys automatically via GitHub Actions using [`.github/workflows/deploy-pages.yml`](.github/workflows/deploy-pages.yml).

Required one-time setting: `Settings → Pages → Source → GitHub Actions`.

## Part of the Crypto-Lab Suite

Part of [crypto-lab](https://systemslibrarian.github.io/crypto-lab/) — browser-based cryptography demos spanning 2,500 years of cryptographic history to NIST FIPS 2024 post-quantum standards.

Whether you eat or drink or whatever you do, do it all for the glory of God. — 1 Corinthians 10:31