/* ================= SILNIK SYMULACJI =================
   Analiza węzłowa (MNA w postaci Nortona) + metoda Newtona z numerycznym jakobianem
   + warstwa cyfrowa sterowana zdarzeniami (sterowniki/słuchacze sieci). */
'use strict';
const VT = 0.025852;
function dexp(x) { return x < 40 ? Math.exp(x) : Math.exp(40) * (1 + x - 40); }
// prąd diody Shockleya (z przebiciem wstecznym opcjonalnie)
// wykładnik z liniową kontynuacją powyżej prądu ok. 10 A (dobra zbieżność Newtona)
function jexp(x, Is) { const xc = Math.log(10 / Is); return x < xc ? Math.exp(x) : Math.exp(xc) * (1 + x - xc); }
function diodeI(v, Is, n, bv, ibv, nbv) {
  let i = Is * (jexp(v / (n * VT), Is) - 1);
  if (bv) i -= ibv * jexp((-v - bv) / ((nbv || 1) * VT), ibv);
  return i + v * 1e-12;
}
const softplus = (x, s) => { const z = x / s; return z > 30 ? x : s * Math.log1p(Math.exp(z)); };
const sigm = x => 1 / (1 + Math.exp(-Math.max(-60, Math.min(60, x))));

const E = {
  t: 0, dt: 1e-3, dirty: true, depth: 0,
  frameBudgetMs: 10, speed: 1,
};
let CIR = null;

function compileCircuit() {
  const par = new Map();
  const f = k => { let p = par.get(k); if (p === undefined) { par.set(k, k); return k; } if (p === k) return k; const r = f(p); par.set(k, r); return r; };
  const un = (a, b) => { a = f(a); b = f(b); if (a !== b) par.set(a, b); };
  const K = (c, t) => c + ':' + t;
  for (const w of S.comps.length ? S.wires : []) if (byId(w.a.c) && byId(w.b.c)) un(K(w.a.c, w.a.t), K(w.b.c, w.b.t));
  const pos = new Map();
  for (const c of S.comps) {
    const pins = pinsOf(c);
    for (let i = 0; i < pins.length; i++) {
      const k = K(c.id, i); f(k);
      if (c.type === 'bb') un(k, 'g' + c.id + bbTerms(c)[i].g);
      const p = pinPos(c, i), pk = Math.round(p[0]) + ',' + Math.round(p[1]);
      const prev = pos.get(pk); if (prev) un(prev, k); else pos.set(pk, k);
    }
    const P = PARTS[c.type];
    if (P.bridges) for (const [a, b] of P.bridges(c)) un(K(c.id, a), K(c.id, b)); // wewnętrznie zwarte piny (np. 2x GND)
  }
  const idx = new Map(); let n = 0;
  // masa: pierwszy pin oznaczony gnd
  for (const c of S.comps) { const P = PARTS[c.type]; if (P.sim && P.gnd !== undefined) { idx.set(f(K(c.id, P.gnd)), n++); break; } }
  const devs = [];
  for (const c of S.comps) {
    const P = PARTS[c.type]; if (!P.sim) continue;
    const np = pinsOf(c).length;
    const nodes = [];
    for (let i = 0; i < np; i++) { const r = f(K(c.id, i)); if (!idx.has(r)) idx.set(r, n++); nodes.push(idx.get(r)); }
    const nint = typeof P.sim.int === 'function' ? P.sim.int(c) : (P.sim.int || 0);
    for (let i = 0; i < nint; i++) nodes.push(n++);
    if (n === 0) n = 1;
    devs.push({ c, P, n: nodes, s: rt(c), drv: {}, inl: {}, lis: [] });
  }
  if (n === 0) n = 1;
  if (!idx.size && !devs.length) n = 1;
  // jeśli żaden węzeł nie dostał 0 (brak masy) – węzeł 0 i tak istnieje jako odniesienie
  const dnet = Array.from({ length: n }, () => ({ drv: [], lis: [], lvl: undefined }));
  // wykrywanie fragmentów odizolowanych galwanicznie (np. uzwojenie wtórne) i kotwiczenie ich do masy przez 1 MΩ
  const gp = Array.from({ length: n }, (_, i) => i); const gf = x => gp[x] === x ? x : (gp[x] = gf(gp[x]));
  for (const d of devs) { const groups = d.P.sim.iso ? d.P.sim.iso(d.c) : [d.n.map((_, i) => i)]; for (const g of groups) for (let i = 1; i < g.length; i++) { const a = gf(d.n[g[0]]), b = gf(d.n[g[i]]); if (a !== b) gp[a] = b; } }
  const anchors = []; const seenG = new Set([gf(0)]);
  for (let i = 1; i < n; i++) { const r = gf(i); if (!seenG.has(r)) { seenG.add(r); anchors.push(i); } }
  CIR = { anchors, devs, n, dnet, nl: devs.filter(d => d.P.sim.nl), lin: devs.filter(d => d.P.sim.lin), post: devs.filter(d => d.P.sim.post),
    commit: devs.filter(d => d.P.sim.commit), mcus: devs.filter(d => d.P.sim.mcuRun), dyn: devs.some(d => d.P.sim.dyn && (typeof d.P.sim.dyn !== 'function' || d.P.sim.dyn(d.c))),
    V: new Float64Array(n), Vprev: new Float64Array(n), keyOf: (c, t) => f(K(c, t)), nodeOfKey: k => idx.get(f(k)) };
  // krok czasowy
  let dt = 1e-3;
  for (const d of devs) if (d.P.sim.maxDt) dt = Math.min(dt, d.P.sim.maxDt(d.c));
  E.dt = Math.max(2e-6, dt);
  E.dirty = true;
  return CIR;
}

/* ---------- API dla elementów ---------- */
function dV(d, p) { return CIR.V[d.n[p]]; }
function dVp(d, p, q) { return CIR.V[d.n[p]] - CIR.V[d.n[q]]; }

// warstwa cyfrowa
function eListen(d, p) { const net = CIR.dnet[d.n[p]]; if (!net.lis.some(l => l.d === d && l.p === p)) net.lis.push({ d, p }); d.lis.push(p); }
function eDrive(d, p, lvl, R, hi, lo, pu) {
  let r = d.drv[p];
  if (!r) { r = d.drv[p] = { d, p, lvl: null, R: 50, hi, lo, pu: false }; CIR.dnet[d.n[p]].drv.push(r); }
  const chg = r.lvl !== lvl || r.pu !== !!pu || (R !== undefined && r.R !== R);
  r.lvl = lvl; r.pu = !!pu; if (R !== undefined) r.R = R; if (hi !== undefined) r.hi = hi; if (lo !== undefined) r.lo = lo;
  if (chg) { E.dirty = true; propagate(d.n[p]); }
}
function netLevel(node) { const net = CIR.dnet[node]; for (const r of net.drv) if (r.lvl === 0 || r.lvl === 1) return r.lvl; return undefined; }
function propagate(node) {
  const net = CIR.dnet[node]; const lvl = netLevel(node);
  if (lvl === undefined) { net.lvl = undefined; return; }
  if (lvl === net.lvl) return; net.lvl = lvl;
  if (E.depth > 200) return;
  E.depth++;
  for (const l of net.lis) setInput(l.d, l.p, lvl);
  E.depth--;
}
function setInput(d, p, lvl) { const old = d.inl[p]; if (old === lvl) return; d.inl[p] = lvl; if (d.P.sim.onIn) d.P.sim.onIn(d, p, lvl, old); }
// odczyt poziomu logicznego pinu (z uwzględnieniem sterownika cyfrowego lub progów analogowych)
function eLevel(d, p) { const l = d.inl[p]; return l === undefined ? 0 : l; }
function supplyOf(d) { const sp = d.P.sim.supply; if (!sp) return [5, 0]; const vcc = typeof sp[0] === 'number' ? dV(d, sp[0]) : 5, gnd = typeof sp[1] === 'number' ? dV(d, sp[1]) : 0; return [vcc, gnd]; }
function sampleDigital() {
  for (const d of CIR.devs) {
    if (!d.lis.length) continue;
    const sp = d.P.sim.supply;
    let vcc = 5, g0 = 0;
    if (sp) { vcc = dV(d, sp[0]); g0 = dV(d, sp[1]); }
    const span = Math.max(0.5, vcc - g0);
    const pw = !sp || span > (d.P.sim.minV || 2);
    if (d.pw !== pw) { d.pw = pw; if (d.P.sim.power) d.P.sim.power(d, pw); }
    const sch = d.P.sim.schmitt;
    for (const p of d.lis) {
      const net = CIR.dnet[d.n[p]];
      if (netLevel(d.n[p]) !== undefined) { if (d.inl[p] !== net.lvl && net.lvl !== undefined) setInput(d, p, net.lvl); continue; }
      const prev = d.inl[p];
      let lvl = prev, v, hi, lo;
      // progi przełączania: funkcja vth(span) w woltach (np. TTL ≈ 1,3–1,4 V), inaczej ułamek napięcia zasilania
      if (d.P.sim.vth) { const th = d.P.sim.vth(span, d, p); v = CIR.V[d.n[p]] - g0; lo = th[0]; hi = th[1]; }
      else { v = (CIR.V[d.n[p]] - g0) / span; hi = sch ? 0.55 : 0.52; lo = sch ? 0.34 : 0.46; }
      if (v > hi) lvl = 1; else if (v < lo) lvl = 0; else if (lvl === undefined) lvl = 0;
      if (lvl !== prev) setInput(d, p, lvl);
    }
  }
}

/* ---------- rozwiązywanie ---------- */
let MA = null, MB = null, MSZ = 0;
function luSolve(A, b, m) {
  for (let i = 0; i < m; i++) {
    let p = i, mx = Math.abs(A[i * m + i]);
    for (let r = i + 1; r < m; r++) { const v = Math.abs(A[r * m + i]); if (v > mx) { mx = v; p = r; } }
    if (mx < 1e-18) { A[i * m + i] = 1e-12; }
    else if (p !== i) { for (let k = 0; k < m; k++) { const t = A[i * m + k]; A[i * m + k] = A[p * m + k]; A[p * m + k] = t; } const tb = b[i]; b[i] = b[p]; b[p] = tb; }
    const di = A[i * m + i];
    for (let r = i + 1; r < m; r++) {
      const fct = A[r * m + i] / di; if (fct === 0) continue;
      for (let k = i; k < m; k++) A[r * m + k] -= fct * A[i * m + k];
      b[r] -= fct * b[i];
    }
  }
  const x = new Float64Array(m);
  for (let i = m - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < m; k++) s -= A[i * m + k] * x[k]; x[i] = s / A[i * m + i]; }
  return x;
}
const ST = { A: null, b: null, m: 0, d: null };
const stG = (na, nb, g) => { const m = ST.m, A = ST.A; na--; nb--; if (na >= 0) A[na * m + na] += g; if (nb >= 0) A[nb * m + nb] += g; if (na >= 0 && nb >= 0) { A[na * m + nb] -= g; A[nb * m + na] -= g; } };
const STAMP = {
  G(p, q, g) { stG(ST.d.n[p], ST.d.n[q], g); },
  G0(p, g) { stG(ST.d.n[p], 0, g); },
  I(p, i) { const n = ST.d.n[p] - 1; if (n >= 0) ST.b[n] += i; },          // prąd wpływający do węzła z elementu
  T(p, q, g) { const r = ST.d.n[p] - 1, c = ST.d.n[q] - 1; if (r >= 0 && c >= 0) ST.A[r * ST.m + c] += g; }, // wpis macierzy (VCCS)
  // źródło napięcia Thevenina p(+) q(-) o napięciu v i rezystancji r
  V(p, q, v, r) { const g = 1 / r; stG(ST.d.n[p], ST.d.n[q], g); this.I(p, v * g); this.I(q, -v * g); },
};
function newton(dt) {
  const n = CIR.n, m = n - 1;
  if (m <= 0) return true;
  if (MSZ !== m) { MA = new Float64Array(m * m); MB = new Float64Array(m); MSZ = m; }
  const V = CIR.V;
  const maxIt = E.first ? 300 : 60;
  const hasNL = CIR.nl.length > 0;
  let conv = false;
  for (let it = 0; it < maxIt; it++) {
    MA.fill(0); MB.fill(0); ST.A = MA; ST.b = MB; ST.m = m;
    for (let i = 0; i < m; i++) MA[i * m + i] = 1e-11;
    for (const a of CIR.anchors) MA[(a - 1) * m + (a - 1)] += 1e-6;
    for (const d of CIR.lin) { ST.d = d; d.P.sim.lin(d, STAMP, dt); }
    // sterowniki cyfrowe
    for (const net of CIR.dnet) for (const r of net.drv) {
      ST.d = r.d;
      if (r.lvl === 1) STAMP.G(r.p, r.hi, 1 / r.R); else if (r.lvl === 0) STAMP.G(r.p, r.lo, 1 / r.R);
      else if (r.pu) STAMP.G(r.p, r.hi, 1 / 35000);
    }
    if (hasNL) for (const d of CIR.nl) {
      ST.d = d; const np = d.n.length;
      const v0 = d.n.map(k => V[k]);
      const f0 = d.P.sim.nl(d, v0, dt);
      d.ip = f0;
      const vv = v0.slice();
      for (let j = 0; j < np; j++) {
        const h = 1e-6 * (1 + Math.abs(v0[j]));
        vv[j] = v0[j] + h; const f1 = d.P.sim.nl(d, vv, dt); vv[j] = v0[j];
        const cj = d.n[j] - 1;
        for (let k = 0; k < np; k++) {
          const Jkj = (f1[k] - f0[k]) / h; if (Jkj === 0) continue;
          const rk = d.n[k] - 1; if (rk < 0) continue;
          if (cj >= 0) MA[rk * m + cj] += Jkj;
          MB[rk] += Jkj * v0[j];
        }
      }
      for (let k = 0; k < np; k++) { const rk = d.n[k] - 1; if (rk >= 0) MB[rk] -= f0[k]; }
    }
    const x = luSolve(MA, MB, m);
    let maxd = 0, vmax = 0;
    const lim = it < 3 ? 50 : 8;
    for (let i = 0; i < m; i++) {
      let nv = x[i]; if (!isFinite(nv)) nv = 0;
      let dv = nv - V[i + 1];
      if (dv > lim) dv = lim; else if (dv < -lim) dv = -lim;
      const ad = Math.abs(dv); if (ad > maxd) maxd = ad;
      V[i + 1] += dv; const av = Math.abs(V[i + 1]); if (av > vmax) vmax = av;
    }
    if (!hasNL) { conv = true; break; }
    if (maxd < 2e-6 || (it > 4 && maxd < 1e-5 * (1 + vmax))) { conv = true; break; }
  }
  return conv;
}
function simStep(dt) {
  if (!CIR) compileCircuit();
  for (const d of CIR.mcus) d.P.sim.mcuRun(d, dt);
  if (CIR.dyn || E.dirty || E.first) {
    E.dirty = false;
    for (let k = 0; k < 10; k++) {
      newton(dt);
      let ch = false;
      for (const d of CIR.post) if (d.P.sim.post(d, dt)) ch = true;
      if (!ch) break;
      E.dirty = false;
    }
    if (CIR.nl.length) for (const d of CIR.nl) d.ip = d.P.sim.nl(d, d.n.map(k => CIR.V[k]), dt);
    E.first = false;
  }
  for (const d of CIR.commit) d.P.sim.commit(d, dt);
  sampleDigital();
  E.t += dt;
}
function simReset() {
  if (typeof pyStopAll === 'function') pyStopAll();
  if (typeof encStopAll === 'function') encStopAll();
  RT = {}; CIR = null; compileCircuit(); E.t = 0; E.first = true;
  for (const d of CIR.devs) { d.s = rt(d.c); if (d.P.sim.init) d.P.sim.init(d); }
  // stan początkowy cyfrowy
  for (const d of CIR.devs) for (const p of d.lis) d.inl[p] = undefined;
  E.dirty = true;
}
// pomiar napięcia/prądu dla wyświetlania (2 pierwsze piny)
function measure2(d, I) { d.s.U = dV(d, 0) - dV(d, 1); d.s.I = I; d.s.P = Math.abs(d.s.U * I); }
