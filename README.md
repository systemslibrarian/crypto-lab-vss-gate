# crypto-lab-vss-gate

## What It Is

An educational cryptography lab demonstrating **Feldman VSS (FOCS 1987)** and **Pedersen VSS (CRYPTO 1991)** — the two foundational constructions that add verifiability to Shamir's Secret Sharing.

An interactive, browser-based lab that teaches:

- Why Shamir SSS alone fails when the dealer is malicious
- How Feldman commitments let participants verify shares immediately
- How Pedersen adds information-theoretic hiding with blinded commitments
- What setup assumptions each protocol requires

The lab includes a guided four-step flow (Break Shamir → Feldman Fix → Pedersen Upgrade → Compare), an interactive curve visualization that draws shares as points on the secret polynomial (and shows a tampered share jumping off the curve), pass/fail verification badges, beginner/advanced mode toggle, deterministic reproducibility, and a full test suite.

## When to Use It

- Use it to teach the dealer-cheating problem, because it shows that Shamir shares alone carry no proof of polynomial consistency.
- Use it to compare Feldman and Pedersen side by side, because the four-step flow makes the no-extra-setup / coefficient-leak tradeoff concrete.
- Use it to explain VSS as the verification layer beneath DKG and threshold signatures, because every serious threshold deployment relies on it.
- Do NOT use it for real key management — it is a teaching demo: not audited, not constant-time, and the Pedersen generator `h` is derived with a knowable discrete log.

## Live Demo

**[systemslibrarian.github.io/crypto-lab-vss-gate](https://systemslibrarian.github.io/crypto-lab-vss-gate/)**

The lab runs a guided four-step flow — Break Shamir → Feldman Fix → Pedersen Upgrade → Compare — that first shows a malicious dealer slipping a bad share past plain Shamir, then watches Feldman commitments catch it, then upgrades to Pedersen for information-theoretic hiding, and finally contrasts the two. A live curve visualization makes the geometry concrete: every participant is a point on a single degree-`(t−1)` polynomial whose value at `x = 0` is the secret, and tampering with a share visibly lifts its point off the curve. Pass/fail verification badges, a beginner/advanced mode toggle, and deterministic reproducibility let you change shares and watch verification accept or reject them live.

## What Can Go Wrong

- With plain Shamir, a malicious dealer can hand out inconsistent shares that pass naive reconstruction but corrupt the recovered secret — the exact gap VSS closes.
- Feldman commitments publish `C_j = g^{a_j} mod p`, which verifies shares but leaks information about the polynomial coefficients; it is not hiding.
- Pedersen's hiding holds only if the second generator `h` has an unknown discrete log relative to `g`; if `log_g(h)` is known, the binding/hiding guarantee collapses (this demo derives `h` deterministically and is therefore not secure).
- BigInt arithmetic in JavaScript is not constant-time, so an implementation like this leaks via side channels and must not handle real secrets.
- Using a generator that does not span the prime-order subgroup, or mismatched participant indices, makes the verification equations and Lagrange reconstruction fail.

## Real-World Usage

- Verifiable secret sharing is the integrity layer beneath Distributed Key Generation (DKG) in threshold systems.
- Threshold signature protocols such as FROST and GG20 rely on VSS-style checks during key generation.
- Modern threshold-ECDSA libraries (for example DKLS23-based implementations) use verifiable sharing to detect cheating dealers.
- Institutional threshold wallets and custody systems use VSS so no single dealer can compromise the shared key.

## How to Run Locally

```bash
git clone https://github.com/systemslibrarian/crypto-lab-vss-gate
cd crypto-lab-vss-gate
npm install
npm run dev
```

## Related Demos
- [crypto-lab-shamir-gate](https://systemslibrarian.github.io/crypto-lab-shamir-gate/) — plain Shamir secret sharing, the scheme VSS adds verifiability to.
- [crypto-lab-frost-threshold](https://systemslibrarian.github.io/crypto-lab-frost-threshold/) — FROST threshold signatures, which use VSS commitments during key generation.
- [crypto-lab-gg20-wallet](https://systemslibrarian.github.io/crypto-lab-gg20-wallet/) — threshold-ECDSA distributed key generation built on verifiable sharing.
- [crypto-lab-threshold-decrypt](https://systemslibrarian.github.io/crypto-lab-threshold-decrypt/) — `t-of-n` threshold decryption that depends on a verifiable DKG.
- [crypto-lab-silent-tally](https://systemslibrarian.github.io/crypto-lab-silent-tally/) — Shamir-based secure aggregation, another application of secret sharing.

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

---

*One of 120+ browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*
