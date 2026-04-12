(function(){const e=document.createElement("link").relList;if(e&&e.supports&&e.supports("modulepreload"))return;for(const n of document.querySelectorAll('link[rel="modulepreload"]'))s(n);new MutationObserver(n=>{for(const i of n)if(i.type==="childList")for(const o of i.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function a(n){const i={};return n.integrity&&(i.integrity=n.integrity),n.referrerPolicy&&(i.referrerPolicy=n.referrerPolicy),n.crossOrigin==="use-credentials"?i.credentials="include":n.crossOrigin==="anonymous"?i.credentials="omit":i.credentials="same-origin",i}function s(n){if(n.ep)return;n.ep=!0;const i=a(n);fetch(n.href,i)}})();const H="FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA237327FFFFFFFFFFFFFFFF",p=BigInt(`0x${H}`),c=(p-1n)/2n,v=4n,V=N(),l=(t,e)=>{const a=t%e;return a>=0n?a:a+e},g=(t,e,a)=>{let s=1n,n=l(t,a),i=e;for(;i>0n;)(i&1n)===1n&&(s=l(s*n,a)),i>>=1n,n=l(n*n,a);return s},q=t=>{let e="";for(const a of t)e+=a.toString(16).padStart(2,"0");return BigInt(`0x${e||"00"}`)},O=t=>{const e=Math.ceil(t.toString(2).length/8),a=new Uint8Array(e);for(;;){crypto.getRandomValues(a);const s=q(a);if(s>0n&&s<t)return s}},K=async t=>{const e=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(t));return q(new Uint8Array(e))};function N(){const t=new TextEncoder().encode("pedersen-vss-generator-h");let e=0n;for(const s of t)e=l(e*257n+BigInt(s),c);const a=l(e,c-2n)+2n;return g(v,a,p)}const U=t=>t.toString(),A=(t,e,a)=>{let s=0n,n=1n;for(const i of t)s=l(s+i*n,a),n=l(n*e,a);return s},T=(t,e)=>{const a=[l(t,c)];for(let s=1;s<e;s+=1)a.push(O(c));return a},z=async(t,e,a)=>{const s=[l(t,c)];for(let n=1;n<e;n+=1){const i=await K(`${a}|${t.toString()}|${n}`);s.push(l(i,c-1n)+1n)}return s},G=(t,e)=>{const a=[];for(let s=1;s<=e;s+=1)a.push({participant:s,value:A(t,BigInt(s),c)});return a},M=(t,e,a)=>{const s=X(t),n=G(t,e);if(a!==null){const o=a-1;n[o]={participant:a,value:l(n[o].value+1n,c)}}const i=n.map(o=>{const d=Q(o,s);return{participant:o.participant,lhs:d.lhs,rhs:d.rhs,ok:d.ok}});return{secret:l(t[0],c),threshold:t.length,participants:e,coefficients:t,commitments:s,shares:n,verification:i,cheatedParticipant:a}},X=t=>t.map(e=>g(v,e,p)),Z=(t,e)=>t.map((a,s)=>l(g(v,a,p)*g(V,e[s],p),p)),Q=(t,e)=>{const a=BigInt(t.participant),s=g(v,t.value,p);let n=1n,i=1n;for(const o of e)n=l(n*g(o,i,p),p),i=l(i*a,c);return{lhs:s,rhs:n,ok:s===n}},Y=(t,e)=>{const a=BigInt(t.participant),s=l(g(v,t.s,p)*g(V,t.r,p),p);let n=1n,i=1n;for(const o of e)n=l(n*g(o,i,p),p),i=l(i*a,c);return{lhs:s,rhs:n,ok:s===n}},J=t=>{let e=0n;for(let a=0;a<t.length;a+=1){const s=BigInt(t[a].participant);let n=1n,i=1n;for(let d=0;d<t.length;d+=1){if(a===d)continue;const m=BigInt(t[d].participant);n=l(n*-m,c),i=l(i*(s-m),c)}const o=g(i,c-2n,c);e=l(e+t[a].value*n*o,c)}return e},tt=(t,e,a,s)=>{const n=T(t,e);return M(n,a,s)},j=(t,e,a,s,n)=>{const i=n??T(t,e),o=Array.from({length:e},()=>O(c)),d=Z(i,o),m=[];for(let u=1;u<=a;u+=1){const y=BigInt(u);m.push({participant:u,s:A(i,y,c),r:A(o,y,c)})}if(s!==null){const u=s-1;m[u]={participant:s,s:l(m[u].s+1n,c),r:m[u].r}}const C=m.map(u=>{const y=Y(u,d);return{participant:u.participant,lhs:y.lhs,rhs:y.rhs,ok:y.ok}});return{secret:l(t,c),threshold:e,participants:a,fCoefficients:i,rCoefficients:o,commitments:d,shares:m,verification:C,cheatedParticipant:s}},et=(t,e)=>{const a=T(t,2),s=G(a,4);if(e!==null){const i=e-1;s[i]={participant:e,value:l(s[i].value+1n,c)}}const n=e!==null?[s[e-1],s[0].participant===e?s[1]:s[0]]:[s[0],s[1]];return{coefficients:a,shares:s,reconstructed:J(n),subset:n}},_=document.querySelector("#app");if(!_)throw new Error("Missing #app root");const L=()=>document.documentElement.getAttribute("data-theme")==="light"?"light":"dark",nt=t=>t==="dark"?{icon:"🌙",label:"Switch to light mode"}:{icon:"☀️",label:"Switch to dark mode"},st=t=>{document.documentElement.setAttribute("data-theme",t),localStorage.setItem("theme",t)},r={theme:L(),secretInput:"123456789",threshold:2,participants:4,cheatEnabled:!1,cheatParticipant:2,shamirCheatEnabled:!0,shamirCheatParticipant:2,feldmanRun:null,pedersenRun:null,sideBySideFeldman:null,sideBySidePedersen:null,pedersenPrevCommitments:null,pvssCheck:null},E=(t,e,a,s)=>{const n=Number.parseInt(t,10);return Number.isFinite(n)?Math.min(s,Math.max(a,n)):e},R=()=>{const t=r.secretInput.trim();try{return t.startsWith("0x")||t.startsWith("0X"),BigInt(t)}catch{return 1n}},h=t=>{const e=U(t);return e.length<=36?e:`${e.slice(0,16)}...${e.slice(-16)}`},I=t=>t?"✓":"✗",rt=(t,e="share")=>t.map(a=>`<tr><td>P${a.participant}</td><td>${e}</td><td class="mono">${h(a.value)}</td></tr>`).join(""),f=()=>{r.theme=L();const t=nt(r.theme),e=R(),a=et(e,r.shamirCheatEnabled?r.shamirCheatParticipant:null);_.innerHTML=`
    <main class="shell" id="main-content" role="main">
      <header class="hero">
        <button id="theme-toggle" class="theme-toggle" type="button" aria-label="${t.label}" title="${t.label}">${t.icon}</button>
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
        <h3>Exhibit 1 — Why Shamir Alone Is Not Enough</h3>
        <p>
          In plain Shamir SSS, participants receive points (xᵢ, yᵢ) but cannot verify if yᵢ came from the committed polynomial.
          A malicious dealer can send one corrupted share that looks normal until reconstruction fails.
        </p>
        <div class="controls-grid">
          <label>Secret (integer)
            <input id="secret-input" type="text" value="${r.secretInput}" />
          </label>
          <label>Cheated participant
            <select id="shamir-cheat-participant">${[1,2,3,4].map(s=>`<option value="${s}" ${r.shamirCheatParticipant===s?"selected":""}>Participant ${s}</option>`).join("")}</select>
          </label>
          <label class="checkbox-label">
            <input id="shamir-cheat-enabled" type="checkbox" ${r.shamirCheatEnabled?"checked":""} />
            Cheating dealer mode
          </label>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Participant</th><th>Type</th><th>Value</th></tr></thead>
            <tbody>${rt(a.shares)}</tbody>
          </table>
        </div>
        <p class="callout danger">
          With Shamir alone, the cheated participant cannot detect fraud immediately. Reconstruction from subset
          {P${a.subset[0].participant}, P${a.subset[1].participant}} gives
          <span class="mono">${h(a.reconstructed)}</span> instead of
          <span class="mono">${h(e%c)}</span>.
        </p>
        <p class="callout">
          Why this matters: threshold wallets, distributed key generation, and MPC cannot assume an honest dealer.
          VSS is the mechanism that checks shares upfront.
        </p>
        <p class="linkline">See FROST Threshold for VSS in threshold signatures:
          <a href="https://systemslibrarian.github.io/crypto-lab-frost-threshold/" target="_blank" rel="noreferrer">https://systemslibrarian.github.io/crypto-lab-frost-threshold/</a>
        </p>
      </section>

      <section class="exhibit">
        <h3>Exhibit 2 — Feldman VSS</h3>
        <p>
          Dealer picks f(x)=s+a₁x+... over Z<sub>q</sub>, publishes commitments Cⱼ=g<sup>aⱼ</sup> mod p, then each participant verifies
          g<sup>sᵢ</sup> = ∏ Cⱼ<sup>iʲ</sup> mod p.
        </p>
        <div class="controls-grid">
          <label>Threshold t
            <input id="threshold-input" type="number" min="2" max="6" value="${r.threshold}" />
          </label>
          <label>Participants n
            <input id="participants-input" type="number" min="2" max="8" value="${r.participants}" />
          </label>
          <label>Cheated participant
            <select id="feldman-cheat-participant">${Array.from({length:r.participants},(s,n)=>n+1).map(s=>`<option value="${s}" ${r.cheatParticipant===s?"selected":""}>Participant ${s}</option>`).join("")}</select>
          </label>
          <label class="checkbox-label">
            <input id="cheat-enabled" type="checkbox" ${r.cheatEnabled?"checked":""} />
            Introduce cheating dealer
          </label>
        </div>
        <button id="run-feldman" type="button">Run Feldman VSS</button>
        ${r.feldmanRun?at(r.feldmanRun):'<p class="muted">Run the protocol to see commitments, shares, and verification equations.</p>'}
        <p class="callout">
          Why this matters: Feldman commitments are public and widely used in threshold systems including FROST-style DKG.
        </p>
      </section>

      <section class="exhibit">
        <h3>Exhibit 3 — Pedersen VSS</h3>
        <p>
          Dealer uses two polynomials f(x), r(x) and commitments Cⱼ=g<sup>fⱼ</sup>·h<sup>rⱼ</sup> mod p.
          Participant i checks g<sup>sᵢ</sup>·h<sup>rᵢ</sup> = ∏ Cⱼ<sup>iʲ</sup> mod p.
        </p>
        <button id="run-pedersen" type="button">Run Pedersen VSS</button>
        ${r.pedersenRun?it(r.pedersenRun,r.pedersenPrevCommitments):'<p class="muted">Run the protocol to see blinded commitments and share-pair verification.</p>'}
        <p class="callout">
          Why this matters: Pedersen commitments are information-theoretically hiding, with a setup assumption that no one knows log<sub>g</sub>(h).
        </p>
      </section>

      <section class="exhibit">
        <h3>Exhibit 4 — Side-by-Side: Feldman vs Pedersen</h3>
        <p>Same secret and threshold, two protocols side by side.</p>
        <button id="run-compare" type="button">Run Side-by-Side</button>
        ${ot()}
      </section>

      <section class="exhibit">
        <h3>Exhibit 5 — VSS in the Real World</h3>
        <div class="card-grid">
          <article class="card">
            <h4>Deployment A — FROST Threshold Signatures (RFC 9591)</h4>
            <p>FROST DKG uses Feldman VSS so participants can validate distributed shares before signing rounds.</p>
            <a href="https://systemslibrarian.github.io/crypto-lab-frost-threshold/" target="_blank" rel="noreferrer">Open FROST Threshold demo</a>
          </article>
          <article class="card">
            <h4>Deployment B — Threshold Wallet Key Generation</h4>
            <p>Wallet MPC stacks use VSS-backed DKG so no single machine holds the full private key.</p>
          </article>
          <article class="card">
            <h4>Deployment C — Publicly Verifiable Secret Sharing (PVSS)</h4>
            <p>PVSS extends VSS so third parties can validate shares against public commitments.</p>
            <button id="run-pvss-check" type="button">Run third-party share check</button>
            ${r.pvssCheck?`<p class="mono">P${r.pvssCheck.participant}: ${I(r.pvssCheck.ok)} | lhs=${h(r.pvssCheck.lhs)} rhs=${h(r.pvssCheck.rhs)}</p>`:'<p class="muted">Generate Feldman output first, then run a public share check.</p>'}
          </article>
        </div>
        <pre class="family-tree">Shamir SSS (no verification)
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
        <h3>Cryptographic Parameters</h3>
        <p class="mono">p = ${h(p)}</p>
        <p class="mono">q = (p-1)/2 = ${h(c)}</p>
        <p class="mono">g = ${v.toString()} (subgroup generator), h = ${V.toString()} (second generator for Pedersen commitments)</p>
      </section>
    </main>
  `,ct()},at=t=>{const e=t.verification.map(n=>`<tr><td>P${n.participant}</td><td class="mono">g^sᵢ=${h(n.lhs)}</td><td class="mono">∏Cⱼ^(i^j)=${h(n.rhs)}</td><td>${I(n.ok)}</td></tr>`).join(""),a=t.commitments.map((n,i)=>`<tr><td>C${i}</td><td class="mono">${h(n)}</td></tr>`).join("");return`
    <p class="mono">f(x) coefficients: ${t.coefficients.map((n,i)=>`a${i}=${h(n)}`).join(", ")}</p>
    <div class="grid-2">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Commitment</th><th>Value</th></tr></thead>
          <tbody>${a}</tbody>
        </table>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Participant</th><th>Share</th></tr></thead>
          <tbody>${t.shares.map(n=>`<tr><td>P${n.participant}</td><td class="mono">${h(n.value)}</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Participant</th><th>LHS</th><th>RHS</th><th>Result</th></tr></thead>
        <tbody>${e}</tbody>
      </table>
    </div>
  `},it=(t,e)=>{const a=t.verification.map(o=>`<tr><td>P${o.participant}</td><td class="mono">g^sᵢ·h^rᵢ=${h(o.lhs)}</td><td class="mono">∏Cⱼ^(i^j)=${h(o.rhs)}</td><td>${I(o.ok)}</td></tr>`).join(""),s=t.fCoefficients.map((o,d)=>`f${d}=${h(o)}`).join(", "),n=t.rCoefficients.map((o,d)=>`r${d}=${h(o)}`).join(", "),i=t.commitments.map((o,d)=>{const m=e?e[d]!==o:!1;return`<tr><td>C${d}</td><td class="mono">${h(o)}</td><td>${e?m?"changed":"same":"first run"}</td></tr>`}).join("");return`
    <p class="mono">f(x): ${s}</p>
    <p class="mono">r(x): ${n}</p>
    <div class="grid-2">
      <div class="table-wrap">
        <table>
          <thead><tr><th>Commitment</th><th>Value</th><th>Run delta</th></tr></thead>
          <tbody>${i}</tbody>
        </table>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Participant</th><th>Share pair</th></tr></thead>
          <tbody>${t.shares.map(o=>`<tr><td>P${o.participant}</td><td class="mono">(s=${h(o.s)}, r=${h(o.r)})</td></tr>`).join("")}</tbody>
        </table>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Participant</th><th>LHS</th><th>RHS</th><th>Result</th></tr></thead>
        <tbody>${a}</tbody>
      </table>
    </div>
  `},ot=()=>{if(!r.sideBySideFeldman||!r.sideBySidePedersen)return'<p class="muted">Run comparison to populate both panels and table.</p>';const t=r.sideBySideFeldman.commitments.map(h).join(", "),e=r.sideBySidePedersen.commitments.map(h).join(", ");return`
    <div class="grid-2">
      <article class="card">
        <h4>Feldman panel</h4>
        <p class="mono">Commitments: ${t}</p>
        <p>${r.sideBySideFeldman.verification.every(a=>a.ok)?"All checks pass":"At least one check failed"}</p>
      </article>
      <article class="card">
        <h4>Pedersen panel</h4>
        <p class="mono">Commitments: ${e}</p>
        <p>${r.sideBySidePedersen.verification.every(a=>a.ok)?"All checks pass":"At least one check failed"}</p>
      </article>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Property</th><th>Feldman VSS (1987)</th><th>Pedersen VSS (1991)</th></tr></thead>
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
  `},ct=()=>{const t=document.querySelector("#theme-toggle");t==null||t.addEventListener("click",()=>{const b=L()==="dark"?"light":"dark";st(b),f()});const e=document.querySelector("#secret-input");e==null||e.addEventListener("input",()=>{r.secretInput=e.value,r.feldmanRun=null,r.pedersenRun=null,f()});const a=document.querySelector("#threshold-input");a==null||a.addEventListener("input",()=>{r.threshold=E(a.value,r.threshold,2,6),r.threshold>r.participants&&(r.participants=r.threshold),f()});const s=document.querySelector("#participants-input");s==null||s.addEventListener("input",()=>{r.participants=E(s.value,r.participants,2,8),r.threshold>r.participants&&(r.threshold=r.participants),r.cheatParticipant>r.participants&&(r.cheatParticipant=r.participants),f()});const n=document.querySelector("#shamir-cheat-enabled");n==null||n.addEventListener("change",()=>{r.shamirCheatEnabled=n.checked,f()});const i=document.querySelector("#shamir-cheat-participant");i==null||i.addEventListener("change",()=>{r.shamirCheatParticipant=E(i.value,2,1,4),f()});const o=document.querySelector("#cheat-enabled");o==null||o.addEventListener("change",()=>{r.cheatEnabled=o.checked});const d=document.querySelector("#feldman-cheat-participant");d==null||d.addEventListener("change",()=>{r.cheatParticipant=E(d.value,2,1,r.participants)});const m=document.querySelector("#run-feldman");m==null||m.addEventListener("click",()=>{const b=R();r.feldmanRun=tt(b,r.threshold,r.participants,r.cheatEnabled?r.cheatParticipant:null),r.pvssCheck=null,f()});const C=document.querySelector("#run-pedersen");C==null||C.addEventListener("click",()=>{var S;const b=R(),F=((S=r.pedersenRun)==null?void 0:S.commitments)??null;r.pedersenRun=j(b,r.threshold,r.participants,r.cheatEnabled?r.cheatParticipant:null),r.pedersenPrevCommitments=F,f()});const u=document.querySelector("#run-compare");u==null||u.addEventListener("click",async()=>{const b=R(),F=await z(b,r.threshold,"side-by-side");r.sideBySideFeldman=M(F,r.participants,null),r.sideBySidePedersen=j(b,r.threshold,r.participants,null,F),f()});const y=document.querySelector("#run-pvss-check");y==null||y.addEventListener("click",()=>{if(!r.feldmanRun)return;const b=1,F=r.feldmanRun.shares[b-1];let S=1n,w=1n;for(const W of r.feldmanRun.commitments){let x=1n,k=W%p,D=w;for(;D>0n;)(D&1n)===1n&&(x=x*k%p),k=k*k%p,D>>=1n;S=S*x%p,w=w*BigInt(b)%c}let $=1n,P=v%p,B=F.value;for(;B>0n;)(B&1n)===1n&&($=$*P%p),P=P*P%p,B>>=1n;r.pvssCheck={participant:b,ok:$===S,lhs:$,rhs:S},f()})};f();
