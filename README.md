# crypto-lab-vss-gate

## 1. What It Is
VSS Gate demonstrates Verifiable Secret Sharing, specifically Feldman VSS (1987) and Pedersen VSS (1991), the two foundational constructions that add verifiability to Shamir's Secret Sharing. In standard Shamir SSS, a malicious dealer can distribute invalid shares and participants have no way to detect fraud until reconstruction fails. VSS fixes this by letting participants verify their own share against public commitments before accepting it, catching cheating dealers immediately. Feldman VSS provides computational hiding with public commitments. Pedersen VSS adds information-theoretic hiding using a blinding factor. Both are foundational to real-world threshold cryptography.

## 2. When to Use It
- ✅ Feldman VSS: distributed key generation, FROST-style threshold signatures, and threshold protocols where public verifiability of shares is needed
- ✅ Pedersen VSS: MPC protocols requiring information-theoretic hiding, e-voting systems, and privacy-preserving DKG
- ❌ Do not use plain Shamir SSS in distributed systems where the dealer might be malicious; use Feldman or Pedersen VSS instead
- ❌ Pedersen VSS requires setup for a second generator h with unknown log_g(h); if this cannot be established, use Feldman VSS

## 3. Live Demo
Link: https://systemslibrarian.github.io/crypto-lab-vss-gate/

Five exhibits are included: why Shamir alone is insufficient with a live cheating dealer demo, Feldman VSS with commitment verification and cheating detection, Pedersen VSS with blinded commitments and information-theoretic hiding, side-by-side Feldman vs Pedersen comparison on the same secret, and real-world VSS deployments in FROST, threshold wallets, and PVSS.

## 4. How to Run Locally
```bash
git clone https://github.com/systemslibrarian/crypto-lab-vss-gate
cd crypto-lab-vss-gate
npm install
npm run dev
```

## 5. Part of the Crypto-Lab Suite
Part of [crypto-lab](https://systemslibrarian.github.io/crypto-lab/) — browser-based cryptography demos spanning 2,500 years of cryptographic history to NIST FIPS 2024 post-quantum standards.

Whether you eat or drink or whatever you do, do it all for the glory of God. — 1 Corinthians 10:31