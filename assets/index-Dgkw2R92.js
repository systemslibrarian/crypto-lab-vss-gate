(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))r(n);new MutationObserver(n=>{for(const i of n)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&r(o)}).observe(document,{childList:!0,subtree:!0});function s(n){const i={};return n.integrity&&(i.integrity=n.integrity),n.referrerPolicy&&(i.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?i.credentials="include":n.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function r(n){if(n.ep)return;n.ep=!0;const i=s(n);fetch(n.href,i)}})();const W="FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA237327FFFFFFFFFFFFFFFF",p=BigInt(`0x${W}`),c=(p-1n)/2n,v=4n,V=N(),l=(e,t)=>{const s=e%t;return s>=0n?s:s+t},g=(e,t,s)=>{let r=1n,n=l(e,s),i=t;for(;i>0n;)(i&1n)===1n&&(r=l(r*n,s)),i>>=1n,n=l(n*n,s);return r},j=e=>{let t="";for(const s of e)t+=s.toString(16).padStart(2,"0");return BigInt(`0x${t||"00"}`)},O=e=>{const t=Math.ceil(e.toString(2).length/8),s=new Uint8Array(t);for(;;){crypto.getRandomValues(s);const r=j(s);if(r>0n&&r<e)return r}},H=async e=>{const t=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(e));return j(new Uint8Array(t))};function N(){const e=new TextEncoder().encode("pedersen-vss-generator-h");let t=0n;for(const r of e)t=l(t*257n+BigInt(r),c);const s=l(t,c-2n)+2n;return g(v,s,p)}const U=e=>e.toString(),A=(e,t,s)=>{let r=0n,n=1n;for(const i of e)r=l(r+i*n,s),n=l(n*t,s);return r},T=(e,t)=>{const s=[l(e,c)];for(let r=1;r<t;r+=1)s.push(O(c));return s},z=async(e,t,s)=>{const r=[l(e,c)];for(let n=1;n<t;n+=1){const i=await H(`${s}|${e.toString()}|${n}`);r.push(l(i,c-1n)+1n)}return r},G=(e,t)=>{const s=[];for(let r=1;r<=t;r+=1)s.push({participant:r,value:A(e,BigInt(r),c)});return s},M=(e,t,s)=>{const r=X(e),n=G(e,t);if(s!==null){const o=s-1;n[o]={participant:s,value:l(n[o].value+1n,c)}}const i=n.map(o=>{const d=Q(o,r);return{participant:o.participant,lhs:d.lhs,rhs:d.rhs,ok:d.ok}});return{secret:l(e[0],c),threshold:e.length,participants:t,coefficients:e,commitments:r,shares:n,verification:i,cheatedParticipant:s}},X=e=>e.map(t=>g(v,t,p)),Z=(e,t)=>e.map((s,r)=>l(g(v,s,p)*g(V,t[r],p),p)),Q=(e,t)=>{const s=BigInt(e.participant),r=g(v,e.value,p);let n=1n,i=1n;for(const o of t)n=l(n*g(o,i,p),p),i=l(i*s,c);return{lhs:r,rhs:n,ok:r===n}},Y=(e,t)=>{const s=BigInt(e.participant),r=l(g(v,e.s,p)*g(V,e.r,p),p);let n=1n,i=1n;for(const o of t)n=l(n*g(o,i,p),p),i=l(i*s,c);return{lhs:r,rhs:n,ok:r===n}},J=e=>{let t=0n;for(let s=0;s<e.length;s+=1){const r=BigInt(e[s].participant);let n=1n,i=1n;for(let d=0;d<e.length;d+=1){if(s===d)continue;const m=BigInt(e[d].participant);n=l(n*-m,c),i=l(i*(r-m),c)}const o=g(i,c-2n,c);t=l(t+e[s].value*n*o,c)}return t},ee=(e,t,s,r)=>{const n=T(e,t);return M(n,s,r)},I=(e,t,s,r,n)=>{const i=n??T(e,t),o=Array.from({length:t},()=>O(c)),d=Z(i,o),m=[];for(let u=1;u<=s;u+=1){const y=BigInt(u);m.push({participant:u,s:A(i,y,c),r:A(o,y,c)})}if(r!==null){const u=r-1;m[u]={participant:r,s:l(m[u].s+1n,c),r:m[u].r}}const C=m.map(u=>{const y=Y(u,d);return{participant:u.participant,lhs:y.lhs,rhs:y.rhs,ok:y.ok}});return{secret:l(e,c),threshold:t,participants:s,fCoefficients:i,rCoefficients:o,commitments:d,shares:m,verification:C,cheatedParticipant:r}},te=(e,t)=>{const s=T(e,2),r=G(s,4);if(t!==null){const i=t-1;r[i]={participant:t,value:l(r[i].value+1n,c)}}const n=t!==null?[r[t-1],r[0].participant===t?r[1]:r[0]]:[r[0],r[1]];return{coefficients:s,shares:r,reconstructed:J(n),subset:n}},_=document.querySelector("#app");if(!_)throw new Error("Missing #app root");const ne=e=>e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;"),L=()=>document.documentElement.getAttribute("data-theme")==="light"?"light":"dark",ae=e=>e==="dark"?{icon:"🌙",label:"Switch to light mode"}:{icon:"☀️",label:"Switch to dark mode"},se=e=>{document.documentElement.setAttribute("data-theme",e),localStorage.setItem("theme",e)},a={theme:L(),secretInput:"123456789",threshold:2,participants:4,cheatEnabled:!1,cheatParticipant:2,shamirCheatEnabled:!0,shamirCheatParticipant:2,feldmanRun:null,pedersenRun:null,sideBySideFeldman:null,sideBySidePedersen:null,pedersenPrevCommitments:null,pvssCheck:null,shamirCache:null},E=(e,t,s,r)=>{const n=Number.parseInt(e,10);return Number.isFinite(n)?Math.min(r,Math.max(s,n)):t},x=()=>{const e=a.secretInput.trim();try{return e.startsWith("0x")||e.startsWith("0X"),BigInt(e)}catch{return 1n}},h=e=>{const t=U(e);return t.length<=36?t:`${t.slice(0,16)}...${t.slice(-16)}`},q=e=>e?"✓":"✗",re=(e,t="share")=>e.map(s=>`<tr><td>P${s.participant}</td><td>${t}</td><td class="mono">${h(s.value)}</td></tr>`).join(""),f=()=>{a.theme=L();const e=ae(a.theme),t=x(),s=a.shamirCheatEnabled?a.shamirCheatParticipant:null,r=`${t}|${s}`;(!a.shamirCache||a.shamirCache.key!==r)&&(a.shamirCache={key:r,result:te(t,s)});const n=a.shamirCache.result;_.innerHTML=`
    <main class="shell" id="main-content" role="main">
      <header class="hero">
        <button id="theme-toggle" class="theme-toggle" type="button" aria-label="${e.label}" title="${e.label}">${e.icon}</button>
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
            <input id="secret-input" type="text" value="${ne(a.secretInput)}" />
          </label>
          <label for="shamir-cheat-participant">Cheated participant
            <select id="shamir-cheat-participant">${[1,2,3,4].map(i=>`<option value="${i}" ${a.shamirCheatParticipant===i?"selected":""}>Participant ${i}</option>`).join("")}</select>
          </label>
          <label for="shamir-cheat-enabled" class="checkbox-label">
            <input id="shamir-cheat-enabled" type="checkbox" ${a.shamirCheatEnabled?"checked":""} />
            Cheating dealer mode
          </label>
        </div>
        <div class="table-wrap" tabindex="0" role="region" aria-label="Shamir shares table">
          <table>
            <caption class="sr-only">Shamir secret shares for 4 participants</caption>
            <thead><tr><th scope="col">Participant</th><th scope="col">Type</th><th scope="col">Value</th></tr></thead>
            <tbody>${re(n.shares)}</tbody>
          </table>
        </div>
        <p class="callout danger">
          With Shamir alone, the cheated participant cannot detect fraud immediately. Reconstruction from subset
          {P${n.subset[0].participant}, P${n.subset[1].participant}} gives
          <span class="mono">${h(n.reconstructed)}</span> instead of
          <span class="mono">${h(t%c)}</span>.
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
            <input id="threshold-input" type="number" min="2" max="6" value="${a.threshold}" />
          </label>
          <label for="participants-input">Participants n
            <input id="participants-input" type="number" min="2" max="8" value="${a.participants}" />
          </label>
          <label for="feldman-cheat-participant">Cheated participant
            <select id="feldman-cheat-participant">${Array.from({length:a.participants},(i,o)=>o+1).map(i=>`<option value="${i}" ${a.cheatParticipant===i?"selected":""}>Participant ${i}</option>`).join("")}</select>
          </label>
          <label for="cheat-enabled" class="checkbox-label">
            <input id="cheat-enabled" type="checkbox" ${a.cheatEnabled?"checked":""} />
            Introduce cheating dealer
          </label>
        </div>
        <button id="run-feldman" type="button">Run Feldman VSS</button>
        ${a.feldmanRun?ie(a.feldmanRun):'<p class="muted">Run the protocol to see commitments, shares, and verification equations.</p>'}
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
        ${a.pedersenRun?oe(a.pedersenRun,a.pedersenPrevCommitments):'<p class="muted">Run the protocol to see blinded commitments and share-pair verification.</p>'}
        <p class="callout">
          Why this matters: Pedersen commitments are information-theoretically hiding, with a setup assumption that no one knows log<sub>g</sub>(h).
        </p>
      </section>

      <section class="exhibit" aria-live="polite">
        <h2>Exhibit 4 — Side-by-Side: Feldman vs Pedersen</h2>
        <p>Same secret and threshold, two protocols side by side.</p>
        <button id="run-compare" type="button">Run Side-by-Side</button>
        ${ce()}
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
            ${a.pvssCheck?`<p class="mono">P${a.pvssCheck.participant}: ${q(a.pvssCheck.ok)} | lhs=${h(a.pvssCheck.lhs)} rhs=${h(a.pvssCheck.rhs)}</p>`:'<p class="muted">Generate Feldman output first, then run a public share check.</p>'}
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
        <p class="mono">p = ${h(p)}</p>
        <p class="mono">q = (p-1)/2 = ${h(c)}</p>
        <p class="mono">g = ${v.toString()} (subgroup generator), h = ${V.toString()} (second generator for Pedersen commitments)</p>
      </section>
    </main>
  `,le()},ie=e=>{const t=e.verification.map(n=>`<tr><td>P${n.participant}</td><td class="mono">g^sᵢ=${h(n.lhs)}</td><td class="mono">∏Cⱼ^(i^j)=${h(n.rhs)}</td><td>${q(n.ok)}</td></tr>`).join(""),s=e.commitments.map((n,i)=>`<tr><td>C${i}</td><td class="mono">${h(n)}</td></tr>`).join("");return`
    <p class="mono">f(x) coefficients: ${e.coefficients.map((n,i)=>`a${i}=${h(n)}`).join(", ")}</p>
    <div class="grid-2">
      <div class="table-wrap" tabindex="0" role="region" aria-label="Feldman commitments">
        <table>
          <caption class="sr-only">Public commitments C₀ through C_{t-1}</caption>
          <thead><tr><th scope="col">Commitment</th><th scope="col">Value</th></tr></thead>
          <tbody>${s}</tbody>
        </table>
      </div>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Feldman shares">
        <table>
          <caption class="sr-only">Participant shares</caption>
          <thead><tr><th scope="col">Participant</th><th scope="col">Share</th></tr></thead>
          <tbody>${e.shares.map(n=>`<tr><td>P${n.participant}</td><td class="mono">${h(n.value)}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </div>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Feldman verification results">
      <table>
        <caption class="sr-only">Share verification equations and results</caption>
        <thead><tr><th scope="col">Participant</th><th scope="col">LHS</th><th scope="col">RHS</th><th scope="col">Result</th></tr></thead>
        <tbody>${t}</tbody>
      </table>
    </div>
  `},oe=(e,t)=>{const s=e.verification.map(o=>`<tr><td>P${o.participant}</td><td class="mono">g^sᵢ·h^rᵢ=${h(o.lhs)}</td><td class="mono">∏Cⱼ^(i^j)=${h(o.rhs)}</td><td>${q(o.ok)}</td></tr>`).join(""),r=e.fCoefficients.map((o,d)=>`f${d}=${h(o)}`).join(", "),n=e.rCoefficients.map((o,d)=>`r${d}=${h(o)}`).join(", "),i=e.commitments.map((o,d)=>{const m=t?t[d]!==o:!1;return`<tr><td>C${d}</td><td class="mono">${h(o)}</td><td>${t?m?"changed":"same":"first run"}</td></tr>`}).join("");return`
    <p class="mono">f(x): ${r}</p>
    <p class="mono">r(x): ${n}</p>
    <div class="grid-2">
      <div class="table-wrap" tabindex="0" role="region" aria-label="Pedersen commitments">
        <table>
          <caption class="sr-only">Pedersen blinded commitments</caption>
          <thead><tr><th scope="col">Commitment</th><th scope="col">Value</th><th scope="col">Run delta</th></tr></thead>
          <tbody>${i}</tbody>
        </table>
      </div>
      <div class="table-wrap" tabindex="0" role="region" aria-label="Pedersen shares">
        <table>
          <caption class="sr-only">Participant share pairs (s, r)</caption>
          <thead><tr><th scope="col">Participant</th><th scope="col">Share pair</th></tr></thead>
          <tbody>${e.shares.map(o=>`<tr><td>P${o.participant}</td><td class="mono">(s=${h(o.s)}, r=${h(o.r)})</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </div>
    <div class="table-wrap" tabindex="0" role="region" aria-label="Pedersen verification results">
      <table>
        <caption class="sr-only">Share verification equations and results</caption>
        <thead><tr><th scope="col">Participant</th><th scope="col">LHS</th><th scope="col">RHS</th><th scope="col">Result</th></tr></thead>
        <tbody>${s}</tbody>
      </table>
    </div>
  `},ce=()=>{if(!a.sideBySideFeldman||!a.sideBySidePedersen)return'<p class="muted">Run comparison to populate both panels and table.</p>';const e=a.sideBySideFeldman.commitments.map(h).join(", "),t=a.sideBySidePedersen.commitments.map(h).join(", ");return`
    <div class="grid-2">
      <article class="card">
        <h3>Feldman panel</h3>
        <p class="mono">Commitments: ${e}</p>
        <p>${a.sideBySideFeldman.verification.every(s=>s.ok)?"All checks pass":"At least one check failed"}</p>
      </article>
      <article class="card">
        <h3>Pedersen panel</h3>
        <p class="mono">Commitments: ${t}</p>
        <p>${a.sideBySidePedersen.verification.every(s=>s.ok)?"All checks pass":"At least one check failed"}</p>
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
  `},le=()=>{const e=document.querySelector("#theme-toggle");e==null||e.addEventListener("click",()=>{const b=L()==="dark"?"light":"dark";se(b),f()});const t=document.querySelector("#secret-input");t==null||t.addEventListener("input",()=>{a.secretInput=t.value,a.feldmanRun=null,a.pedersenRun=null,f()});const s=document.querySelector("#threshold-input");s==null||s.addEventListener("input",()=>{a.threshold=E(s.value,a.threshold,2,6),a.threshold>a.participants&&(a.participants=a.threshold),f()});const r=document.querySelector("#participants-input");r==null||r.addEventListener("input",()=>{a.participants=E(r.value,a.participants,2,8),a.threshold>a.participants&&(a.threshold=a.participants),a.cheatParticipant>a.participants&&(a.cheatParticipant=a.participants),f()});const n=document.querySelector("#shamir-cheat-enabled");n==null||n.addEventListener("change",()=>{a.shamirCheatEnabled=n.checked,f()});const i=document.querySelector("#shamir-cheat-participant");i==null||i.addEventListener("change",()=>{a.shamirCheatParticipant=E(i.value,2,1,4),f()});const o=document.querySelector("#cheat-enabled");o==null||o.addEventListener("change",()=>{a.cheatEnabled=o.checked});const d=document.querySelector("#feldman-cheat-participant");d==null||d.addEventListener("change",()=>{a.cheatParticipant=E(d.value,2,1,a.participants)});const m=document.querySelector("#run-feldman");m==null||m.addEventListener("click",()=>{const b=x();a.feldmanRun=ee(b,a.threshold,a.participants,a.cheatEnabled?a.cheatParticipant:null),a.pvssCheck=null,f()});const C=document.querySelector("#run-pedersen");C==null||C.addEventListener("click",()=>{var S;const b=x(),F=((S=a.pedersenRun)==null?void 0:S.commitments)??null;a.pedersenRun=I(b,a.threshold,a.participants,a.cheatEnabled?a.cheatParticipant:null),a.pedersenPrevCommitments=F,f()});const u=document.querySelector("#run-compare");u==null||u.addEventListener("click",async()=>{const b=x(),F=await z(b,a.threshold,"side-by-side");a.sideBySideFeldman=M(F,a.participants,null),a.sideBySidePedersen=I(b,a.threshold,a.participants,null,F),f()});const y=document.querySelector("#run-pvss-check");y==null||y.addEventListener("click",()=>{if(!a.feldmanRun)return;const b=1,F=a.feldmanRun.shares[b-1];let S=1n,R=1n;for(const K of a.feldmanRun.commitments){let B=1n,k=K%p,D=R;for(;D>0n;)(D&1n)===1n&&(B=B*k%p),k=k*k%p,D>>=1n;S=S*B%p,R=R*BigInt(b)%c}let $=1n,P=v%p,w=F.value;for(;w>0n;)(w&1n)===1n&&($=$*P%p),P=P*P%p,w>>=1n;a.pvssCheck={participant:b,ok:$===S,lhs:$,rhs:S},f()})};f();
