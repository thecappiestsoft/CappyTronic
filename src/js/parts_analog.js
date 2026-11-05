'use strict';
/* ====== WZMACNIACZE OPERACYJNE ====== */
// parametry typowe z kart katalogowych: GBW – iloczyn wzmocnienia i pasma [Hz], SR – szybkość narastania [V/s],
// vos – napięcie niezrównoważenia [V], ib – prąd polaryzacji wejść [A] (+ wpływa do wejścia), hl/hh – odległość wyjścia od szyn [V]
const OPM = {
  ua741: { hl: 1.6, hh: 1.6, A: 2e5, gbw: 1e6, sr: 0.5e6, vos: 1e-3, ib: 80e-9, rout: 75, iq: 1.7e-3, ilim: 0.025, minV: 10 },
  ne5534: { hl: 1.2, hh: 1.2, A: 1e5, gbw: 10e6, sr: 13e6, vos: 0.5e-3, ib: 500e-9, rout: 30, iq: 4e-3, ilim: 0.038, minV: 6 },
  lm358: { hl: 0.02, hh: 1.5, A: 1e5, gbw: 0.7e6, sr: 0.3e6, vos: 2e-3, ib: -45e-9, rout: 50, iq: 0.35e-3, ilim: 0.03, minV: 3 },
  tl072: { hl: 1.5, hh: 1.5, A: 2e5, gbw: 3e6, sr: 13e6, vos: 3e-3, ib: 65e-12, rout: 50, iq: 1.4e-3, ilim: 0.03, minV: 6 },
};
// Model (odcinkowo liniowy, z przełączaniem trybów jak w SPICE-owych makromodelach):
// • węzeł wewnętrzny Y = stopień wzmocnienia z biegunem dominującym, całkowanie niejawne:
//   Y = (y0 + a·A·(vd + Vos)) / (1 + a), a = dt·2π·GBW/A  → pasmo zamkniętej pętli = GBW / wzmocnienie
// • wyjście: źródło napięcia E przez R_out; E = Y (tryb liniowy) albo ograniczone przez szynę zasilania,
//   szybkość narastania SR (E = y0 ± SR·dt) lub prąd zwarcia I_lim.
function opLin(S, dt, ip, iN, iY, m, y0) {
  const a = dt * 2 * Math.PI * m.gbw / m.A, k = a * m.A / (1 + a), c0 = (y0 + a * m.A * m.vos) / (1 + a), g = 1e-3;
  S.T(iY, iY, g); S.T(iY, ip, -g * k); S.T(iY, iN, g * k); S.I(iY, g * c0);
}
const OPMODE = { LIN: 0, HI: 1, LO: 2, SUP: 3, SDN: 4 };
function opOutStamp(S, st, iO, iY, iVp, iVn, m, dt) {
  // ograniczenie prądu zwarcia: rezystancja wyjścia rośnie tak, by |I| ≤ I_lim (st.rl, z histerezą w post)
  const g = 1 / Math.max(m.rout, st.rl || 0), md = st.md || 0, y0 = st.y || 0, sl = m.sr * dt;
  S.T(iO, iO, g);
  if (md === OPMODE.LIN) S.T(iO, iY, -g);
  else if (md === OPMODE.HI) { S.T(iO, iVp, -g); S.I(iO, -m.hh * g); }
  else if (md === OPMODE.LO) { S.T(iO, iVn, -g); S.I(iO, m.hl * g); }
  else S.I(iO, (y0 + (md === OPMODE.SUP ? sl : -sl)) * g);
  // prąd wyjścia pobierany z odpowiedniej szyny (z poprzedniego kroku)
  const io = st.io || 0; if (io > 0) S.I(iVp, -io); else S.I(iVn, -io);
}
function opEmf(V, st, iO, iY, iVp, iVn, m, dt) {
  const lo = V[iVn] + m.hl, hi = V[iVp] - m.hh, y0 = st.y || 0, sl = m.sr * dt, Y = V[iY];
  let E = Y, md = OPMODE.LIN;
  if (Y > y0 + sl) { E = y0 + sl; md = OPMODE.SUP; } else if (Y < y0 - sl) { E = y0 - sl; md = OPMODE.SDN; }
  if (E > hi) { E = hi; md = OPMODE.HI; } else if (E < lo) { E = lo; md = OPMODE.LO; }
  // z trybu ograniczenia wracamy zawsze najpierw do liniowego (funkcja E→Y jest malejąca, więc to zbiega)
  if (st.md !== OPMODE.LIN && md !== st.md) { md = OPMODE.LIN; E = Y; }
  const R = Math.max(m.rout, st.rl || 0), i = (E - V[iO]) / R;
  // potrzebna rezystancja, by prąd nie przekroczył I_lim
  const need = Math.abs(E - V[iO]) / m.ilim, rl = need > m.rout * 1.02 ? need : 0;
  return { E, md, i, lo, hi, rl };
}
function opBias(v, o, ip, iN, iVp, iVn, m) {
  const vcc = v[iVp], vee = v[iVn]; const ibp = m.ib * sigm((vcc - vee - 1) * 4), lk = x => (v[x] - vee) * 1e-12;
  o[ip] += ibp + lk(ip); o[iN] += ibp + lk(iN); o[iVn] -= 2 * ibp + lk(ip) + lk(iN);
}
// komparator z otwartym kolektorem: prąd zwarcia wyjścia 16 mA, U_OL ≈ 0,25 V przy 4 mA, U_IO = 1 mV, I_B = 25 nA (wypływa z wejść)
function cmpSection(v, o, ip, iN, iO, iG) {
  const isink = 0.016 * sigm((v[iN] - v[ip] - 1e-3) * 3000) * Math.tanh(Math.max(0, v[iO] - v[iG]) / 0.12);
  o[iO] += isink; o[iG] -= isink;
  o[ip] -= 25e-9; o[iN] -= 25e-9; o[iG] += 50e-9;
}
function icPart(id, o) {
  const pk = pkgDIP(o.n, o.names, o.pkgOpt);
  def(id, Object.assign({
    cat: o.cat, name: o.name, sub: o.sub, kw: o.kw, info: o.info, props: o.props || {},
    pins: pk.pins, bbox: pk.bbox, ui: o.ui,
    draw(c, r) { return pk.body(o.label || (typeof o.name === 'string' ? o.name : L(o.name)), o.sub2 ? L(o.sub2) : '', o.col) + (o.extra ? o.extra(c, r) : '') + (r.burnt ? smoke(pk.pins[o.n / 2 - 1].x / 2, -70) : ''); },
  }, o.more || {}));
  return pk;
}
const P = n => n - 1; // numer pinu -> indeks
function opampIC(id, label, kind, model, o) {
  const names = kind === 'single' ? ['OFS N1', 'IN−', 'IN+', 'V−', 'OFS N2', 'OUT', 'V+', 'NC'] :
    kind === 'dual' ? ['OUT A', 'IN− A', 'IN+ A', 'V−/GND', 'IN+ B', 'IN− B', 'OUT B', 'V+'] :
      ['OUT 1', 'IN− 1', 'IN+ 1', 'V+', 'IN+ 2', 'IN− 2', 'OUT 2', 'OUT 3', 'IN− 3', 'IN+ 3', 'V−/GND', 'IN+ 4', 'IN− 4', 'OUT 4'];
  const secs = kind === 'single' ? [[3, 2, 6]] : kind === 'dual' ? [[3, 2, 1], [5, 6, 7]] : [[3, 2, 1], [5, 6, 7], [10, 9, 8], [12, 13, 14]];
  const vp = kind === 'quad' ? 4 : kind === 'dual' ? 8 : 7, vn = kind === 'quad' ? 11 : 4;
  const m = OPM[model];
  icPart(id, {
    cat: 'opamp', n: kind === 'quad' ? 14 : 8, names, name: o.name || label, label, sub: o.sub, kw: o.kw, info: o.info,
    more: {
      sim: {
        supply: [P(vp), P(vn)],
        dyn: true, int: secs.length,
        lin(d, S, dt) {
          const np = d.n.length - secs.length, st = d.s.op || (d.s.op = secs.map(() => ({ md: 0, y: 0, io: 0 })));
          const vs = dVp(d, P(vp), P(vn));
          secs.forEach(([a, b, c2], k) => { opLin(S, dt, P(a), P(b), np + k, m, st[k].y);
            if (vs < 1) S.G(P(c2), P(vn), 1e-7); else opOutStamp(S, st[k], P(c2), np + k, P(vp), P(vn), m, dt); });
          const iq = vs > 0 ? m.iq * secs.length * Math.tanh(vs / 2) : 0; S.I(P(vp), -iq); S.I(P(vn), iq);
        },
        nl(d, v) { const out = new Array(v.length).fill(0); secs.forEach(([a, b]) => opBias(v, out, P(a), P(b), P(vp), P(vn), m)); return out; },
        post(d, dt) {
          if (dVp(d, P(vp), P(vn)) < 1) return false;
          if ((d.s.flips || 0) >= 8) return false; // brak zbieżności trybów – zostajemy przy ostatnim rozwiązaniu
          const V = d.n.map(k => CIR.V[k]), np = V.length - secs.length, st = d.s.op; let ch = false;
          secs.forEach(([, , c2], k) => { const r = opEmf(V, st[k], P(c2), np + k, P(vp), P(vn), m, dt); if (r.md !== st[k].md) { st[k].md = r.md; ch = true; }
            const ol = st[k].rl || 0; if ((r.rl === 0) !== (ol === 0) || (ol && Math.abs(r.rl - ol) > 0.05 * ol)) { st[k].rl = r.rl ? Math.max(r.rl, ol * 0.5) : 0; ch = true; } });
          if (ch) { d.s.flips = (d.s.flips || 0) + 1; E.opFlips = (E.opFlips || 0) + 1; } return ch;
        },
        commit(d, dt) {
          d.s.flips = 0;
          const V = d.n.map(k => CIR.V[k]), np = V.length - secs.length, st = d.s.op || (d.s.op = secs.map(() => ({ md: 0, y: 0, io: 0 })));
          secs.forEach(([, , c2], k) => { const r = opEmf(V, st[k], P(c2), np + k, P(vp), P(vn), m, dt), sl = m.sr * dt;
            st[k].io = r.i; st[k].y = Math.max(r.lo - 0.3, Math.min(r.hi + 0.3, Math.max(st[k].y - sl, Math.min(st[k].y + sl, V[np + k])))); });
          const vs = dVp(d, P(vp), P(vn)); d.s.vs = vs; d.s.outs = secs.map(s => dVp(d, P(s[2]), P(vn))); d.s.warn = vs < 0.5 ? null : vs < m.minV ? 'opLowV' : vs > 36 ? 'opHighV' : null; },
      },
      readings: (c, r) => [[{ pl: 'Zasilanie V+ − V−', en: 'Supply V+ − V−' }, si(r.vs || 0, 'V')], ...(r.outs || []).map((x, i) => [(secs.length > 1 ? 'OUT ' + (kind === 'dual' ? 'AB'[i] : i + 1) : 'OUT') + ' ' + t('vsNeg'), si(x, 'V')])],
    },
  });
}
const opInfo = { pl: 'Wzmacniacz operacyjny wzmacnia różnicę napięć między wejściami IN+ i IN−. Z ujemnym sprzężeniem zwrotnym (rezystor z OUT do IN−) wzmocnienie ustalają rezystory, np. G = 1 + R2/R1.', en: 'An op-amp amplifies the voltage difference between IN+ and IN−. With negative feedback (a resistor from OUT to IN−) the gain is set by resistors, e.g. G = 1 + R2/R1.' };
opampIC('op_ua741', 'uA741', 'single', 'ua741', { sub: { pl: 'Pojedynczy, klasyczny', en: 'Single, classic' }, kw: 'ua741 lm741 741 wzmacniacz operacyjny op-amp opamp', info: { pl: opInfo.pl + ' Historyczny standard; wymaga zasilania symetrycznego (np. ±12 V), wyjście nie dochodzi do szyn zasilania.', en: opInfo.en + ' The historical standard; needs a split supply (e.g. ±12 V); the output does not reach the rails.' } });
opampIC('op_ne5534', 'NE5534', 'single', 'ne5534', { sub: { pl: 'Pojedynczy, niskoszumowy audio', en: 'Single, low-noise audio' }, kw: 'ne5534 wzmacniacz operacyjny audio niskoszumowy low noise', info: opInfo });
opampIC('op_lm358', 'LM358', 'dual', 'lm358', { sub: { pl: 'Podwójny, zasilanie jednobiegunowe', en: 'Dual, single supply' }, kw: 'lm358 wzmacniacz operacyjny podwojny dual op-amp', info: { pl: opInfo.pl + ' Pracuje z jednego napięcia (np. 5 V), a wyjście schodzi do masy.', en: opInfo.en + ' Works from a single supply (e.g. 5 V) and its output swings down to ground.' } });
opampIC('op_tl072', 'TL072', 'dual', 'tl072', { sub: { pl: 'Podwójny, wejścia JFET (audio)', en: 'Dual, JFET inputs (audio)' }, kw: 'tl072 wzmacniacz operacyjny jfet audio', info: opInfo });
opampIC('op_lm324', 'LM324', 'quad', 'lm358', { sub: { pl: 'Poczwórny, jednobiegunowy', en: 'Quad, single supply' }, kw: 'lm324 wzmacniacz operacyjny poczworny quad', info: opInfo });
opampIC('op_tl074', 'TL074', 'quad', 'tl072', { sub: { pl: 'Poczwórny, wejścia JFET', en: 'Quad, JFET inputs' }, kw: 'tl074 wzmacniacz operacyjny poczworny quad jfet', info: opInfo });
const cmpInfo = { pl: 'Komparator porównuje napięcia: gdy IN+ > IN−, wyjście jest „puste” (otwarty kolektor), a gdy IN+ < IN− – zwiera wyjście do masy. Na wyjściu potrzebny rezystor podciągający (np. 10 kΩ do plusa).', en: 'A comparator compares voltages: when IN+ > IN− the output floats (open collector); when IN+ < IN− it pulls the output to ground. The output needs a pull-up resistor (e.g. 10 kΩ to plus).' };
icPart('cmp_lm393', {
  cat: 'opamp', n: 8, name: 'LM393', label: 'LM393', sub: { pl: 'Podwójny komparator', en: 'Dual comparator' }, kw: 'lm393 komparator comparator', info: cmpInfo,
  names: ['OUT A', 'IN− A', 'IN+ A', 'GND', 'IN+ B', 'IN− B', 'OUT B', 'VCC'],
  more: { sim: { supply: [7, 3], nl(d, v) { const o = new Array(v.length).fill(0); if (v[7] - v[3] > 1.5) { cmpSection(v, o, 2, 1, 0, 3); cmpSection(v, o, 4, 5, 6, 3); } const iq = 0.4e-3 * Math.tanh(Math.max(0, v[7] - v[3])); o[7] += iq; o[3] -= iq; return o; } } },
});
icPart('cmp_lm339', {
  cat: 'opamp', n: 14, name: 'LM339', label: 'LM339', sub: { pl: 'Poczwórny komparator', en: 'Quad comparator' }, kw: 'lm339 komparator comparator quad', info: cmpInfo,
  names: ['OUT 2', 'OUT 1', 'VCC', 'IN− 1', 'IN+ 1', 'IN− 2', 'IN+ 2', 'IN− 3', 'IN+ 3', 'IN− 4', 'IN+ 4', 'GND', 'OUT 4', 'OUT 3'],
  more: { sim: { supply: [2, 11], nl(d, v) { const o = new Array(v.length).fill(0); if (v[2] - v[11] > 1.5) for (const [p, n, out] of [[5, 4, 2], [7, 6, 1], [9, 8, 14], [11, 10, 13]]) cmpSection(v, o, P(p), P(n), P(out), 11); const iq = 0.8e-3 * Math.tanh(Math.max(0, v[2] - v[11])); o[2] += iq; o[11] -= iq; return o; } } },
});

/* ====== STABILIZATORY ====== */
const smin = (a, b, s) => a - softplus(a - b, s || 0.05);
function regPart(id, o) {
  const pk = pkgTO220(o.order);
  const ix = r => o.order.indexOf(r);
  def(id, {
    cat: 'reg', name: o.name, sub: o.sub, kw: o.kw, info: o.info, props: o.props || {}, ui: o.ui,
    pins: pk.pins.map((p, i) => ({ ...p, n: o.pn[i] })), bbox: pk.bbox,
    draw(c, r) { return pk.body(o.label(c), o.sub2 ? L(o.sub2) : '') + (r.hot ? smoke(20, -96) : ''); },
    sim: {
      // tryby: 'reg' – źródło Thevenina na wyjściu + pobór tego samego prądu z wejścia; 'lim' – ograniczenie prądu; 'drop' – za niskie wejście
      lin(d, S) {
        const s = o.neg ? -1 : 1, iI = ix('IN'), iO = ix('OUT'), iR = ix(o.ref), m = d.s.mode || 'reg';
        const vin = s * dVp(d, iI, iR);
        const g = 1 / 0.05, tgt = o.adj ? o.vref : o.vnom(d.c);
        if (vin < 1.5) { S.G(iO, iR, 1e-3); return; }
        if (o.adj) { S.I(iR, s * 5e-5); S.I(iI, -s * 5e-5); }
        else { S.I(iI, -s * o.iq); S.I(iR, s * o.iq); }
        if (m === 'drop') { S.V(iO, iI, -s * o.drop, 0.05); return; }
        if (m === 'lim') { S.I(iO, s * o.ilim); S.I(iI, -s * o.ilim); return; }
        S.V(iO, iR, s * tgt, 0.05);
        // pobór z wejścia równy prądowi wyjścia: I = g·(s·tgt − (vO − vR)) wpływa do IN, wypływa przy REF
        S.T(iI, iO, -g); S.T(iI, iR, g); S.I(iI, -g * s * tgt); S.T(iR, iO, g); S.T(iR, iR, -g); S.I(iR, g * s * tgt);
      },
      post(d) {
        const s = o.neg ? -1 : 1, iI = ix('IN'), iO = ix('OUT'), iR = ix(o.ref), m = d.s.mode || 'reg';
        const vin = s * dVp(d, iI, iR), vo = s * dVp(d, iO, iR), head = s * dVp(d, iI, iO), tgt = o.adj ? o.vref : o.vnom(d.c);
        const iout = m === 'lim' ? o.ilim : m === 'drop' ? (head + o.drop) / 0.05 * 0 : (tgt - vo) / 0.05;
        let nm = m;
        if (m === 'reg') { if (head < o.drop - 0.02 && vin > 1.5) nm = 'drop'; else if (iout > o.ilim) nm = 'lim'; }
        else if (m === 'lim') { if (vo > tgt) nm = 'reg'; }
        else if (m === 'drop') { if (vin - o.drop > tgt + (o.adj ? s * dVp(d, iO, iR) * 0 : 0) + 0.02 && !o.adj) nm = 'reg'; else if (o.adj && head > o.drop + 0.05) nm = 'reg'; }
        if (nm !== m) { d.s.mode = nm; d.s.flips = (d.s.flips || 0) + 1; return d.s.flips < 6; }
        return false;
      },
      commit(d) {
        d.s.flips = 0;
        const s = o.neg ? -1 : 1, iI = ix('IN'), iO = ix('OUT'), iR = ix(o.ref), m = d.s.mode || 'reg';
        d.s.Vin = dVp(d, iI, iR); d.s.Vout = dVp(d, iO, iR); d.s.U = d.s.Vout;
        d.s.I = m === 'lim' ? s * o.ilim : m === 'drop' ? s * (s * dVp(d, iI, iO) - o.drop) * 0 : s * ((o.adj ? o.vref : o.vnom(d.c)) - s * d.s.Vout) / 0.05;
        if (m === 'drop') d.s.I = 0;
        d.s.P = Math.abs(dVp(d, iI, iO) * d.s.I); d.s.hot = d.s.P > 2;
        d.s.warn = d.s.P > 2 ? 'regHot' : (m === 'drop' && Math.abs(d.s.Vin) > 1.5) ? 'regDrop' : null;
      },
    },
    readings: (c, r) => [['U<sub>IN</sub>', si(r.Vin || 0, 'V')], ['U<sub>OUT</sub>', si(r.Vout || 0, 'V')], ['I<sub>OUT</sub>', si(r.I || 0, 'A')], [{ pl: 'Moc strat', en: 'Power loss' }, si(r.P || 0, 'W')]],
  });
}
const IN = { pl: 'IN – wejście', en: 'IN – input' }, OUTn = { pl: 'OUT – wyjście', en: 'OUT – output' }, GNDn = { pl: 'GND – masa', en: 'GND – ground' }, ADJn = { pl: 'ADJ – regulacja', en: 'ADJ – adjust' };
regPart('reg_78xx', {
  name: { pl: 'Stabilizator 78xx (dodatni)', en: '78xx regulator (positive)' }, sub: '7805, 7809, 7812', kw: '7805 7812 7809 78xx stabilizator regulator lm7805', props: { v: 5 },
  ui: [{ k: 'v', type: 'seg', l: { pl: 'Typ', en: 'Type' }, opts: [[5, '7805 (5 V)'], [6, '7806 (6 V)'], [9, '7809 (9 V)'], [12, '7812 (12 V)'], [15, '7815 (15 V)']] }],
  order: ['IN', 'GND', 'OUT'], pn: [IN, GNDn, OUTn], ref: 'GND', vnom: c => c.props.v, drop: 2.0, ilim: 1.5, iq: 5e-3, label: c => '78' + String(c.props.v).padStart(2, '0'),
  info: { pl: 'Daje stałe napięcie (np. 5 V) z wyższego, niestabilnego. Wejście musi być co najmniej ok. 2 V wyższe niż wyjście. Nadmiar zamienia na ciepło: P = (U_IN − U_OUT) · I – przy większej mocy potrzebny radiator. Dodaj kondensatory 330 nF na wejściu i 100 nF na wyjściu.', en: 'Gives a fixed voltage (e.g. 5 V) from a higher, unstable one. The input must be at least about 2 V above the output. The excess becomes heat: P = (U_IN − U_OUT) · I – at higher power you need a heatsink. Add 330 nF at the input and 100 nF at the output.' },
});
regPart('reg_79xx', {
  name: { pl: 'Stabilizator 79xx (ujemny)', en: '79xx regulator (negative)' }, sub: '7905, 7912', kw: '7905 7912 79xx stabilizator ujemny negative regulator', props: { v: 5 },
  ui: [{ k: 'v', type: 'seg', l: { pl: 'Typ', en: 'Type' }, opts: [[5, '7905 (−5 V)'], [9, '7909 (−9 V)'], [12, '7912 (−12 V)'], [15, '7915 (−15 V)']] }],
  order: ['GND', 'IN', 'OUT'], pn: [GNDn, IN, OUTn], ref: 'GND', neg: true, vnom: c => c.props.v, drop: 2.0, ilim: 1.5, iq: 3e-3, label: c => '79' + String(c.props.v).padStart(2, '0'),
  info: { pl: 'Ujemny odpowiednik 78xx – daje np. −5 V. Uwaga: inny układ nóżek niż 78xx (1 – masa, 2 – wejście, 3 – wyjście).', en: 'The negative counterpart of 78xx – gives e.g. −5 V. Note the different pin order from 78xx (1 – ground, 2 – input, 3 – output).' },
});
regPart('reg_lm317', {
  name: 'LM317', sub: { pl: 'Regulowany dodatni 1,25–37 V', en: 'Adjustable positive 1.25–37 V' }, kw: 'lm317 stabilizator regulowany adjustable regulator',
  order: ['ADJ', 'OUT', 'IN'], pn: [ADJn, OUTn, IN], ref: 'ADJ', adj: true, vref: 1.25, drop: 1.8, label: () => 'LM317',
  info: { pl: 'Utrzymuje 1,25 V między OUT a ADJ. Dzielnik R1 (OUT–ADJ, zwykle 240 Ω) i R2 (ADJ–masa) ustala wyjście: U = 1,25 V · (1 + R2/R1).', en: 'Keeps 1.25 V between OUT and ADJ. A divider R1 (OUT–ADJ, usually 240 Ω) and R2 (ADJ–ground) sets the output: U = 1.25 V · (1 + R2/R1).' },
});
regPart('reg_lm337', {
  name: 'LM337', sub: { pl: 'Regulowany ujemny', en: 'Adjustable negative' }, kw: 'lm337 stabilizator regulowany ujemny negative adjustable',
  order: ['ADJ', 'IN', 'OUT'], pn: [ADJn, IN, OUTn], ref: 'ADJ', adj: true, neg: true, vref: 1.25, drop: 1.8, label: () => 'LM337',
  info: { pl: 'Ujemny odpowiednik LM317: utrzymuje −1,25 V między OUT a ADJ. Uwaga na inny układ nóżek (ADJ, IN, OUT).', en: 'Negative counterpart of LM317: keeps −1.25 V between OUT and ADJ. Note the different pin order (ADJ, IN, OUT).' },
});
// przetwornice impulsowe (model uśredniony)
function dcdcPart(id, o) {
  const pk = pkgModule(['IN+', 'IN−', 'OUT+', 'OUT−'], 120, 70);
  def(id, {
    cat: 'reg', name: o.name, sub: o.sub, kw: o.kw, info: o.info, props: o.props, ui: o.ui, bridges: () => [[1, 3]],
    pins: pk.pins, bbox: pk.bbox,
    draw(c, r) { return pk.body(o.title, o.col, `<rect x="0" y="-52" width="22" height="22" rx="2" fill="#2a2a2a"/><circle cx="50" cy="-40" r="12" fill="#3b3b3b" stroke="#777"/><rect x="${pk.x0 + pk.W - 26}" y="-58" width="12" height="18" fill="#2f5fb3"/>` + tx(30, -24, dec(c.props.vset, 1) + ' V', { s: 7, c: '#ffe08a', f: FONT_M })); },
    sim: {
      lin(d, S) {
        const p = d.c.props, vin = dVp(d, 0, 1), m = d.s.mode || 'reg';
        if (vin < o.minIn) { S.G(2, 3, 1e-3); d.s.iout = 0; return; }
        let tgt = o.boost && p.mode === 'boost' ? Math.max(p.vset, vin - 0.6) : Math.min(p.vset, vin - o.drop);
        if (m === 'lim') { S.I(2, o.ilim); S.I(3, -o.ilim); } else S.V(2, 3, tgt, 0.05);
        // pobór mocy z wejścia (bilans mocy, z poprzedniej iteracji)
        const io = m === 'lim' ? o.ilim : (tgt - dVp(d, 2, 3)) / 0.05, pin = Math.max(0, dVp(d, 2, 3) * io) / o.eta + 0.015;
        const iin = pin / Math.max(1, vin); S.I(0, -iin); S.I(1, iin); d.s.iinL = iin; d.s.tgt = tgt;
      },
      post(d) { const m = d.s.mode || 'reg', vo = dVp(d, 2, 3), io = (d.s.tgt - vo) / 0.05; let nm = m; if (m === 'reg' && io > o.ilim) nm = 'lim'; else if (m === 'lim' && vo > d.s.tgt) nm = 'reg'; if (nm !== m) { d.s.mode = nm; d.s.flips = (d.s.flips || 0) + 1; return d.s.flips < 6; } return false; },
      commit(d) { d.s.flips = 0; d.s.Vin = dVp(d, 0, 1); d.s.Vout = dVp(d, 2, 3); d.s.Iout = (d.s.mode === 'lim') ? o.ilim : Math.max(0, ((d.s.tgt || 0) - d.s.Vout) / 0.05); d.s.Iin = d.s.iinL || 0; d.s.eff = d.s.Iin * d.s.Vin > 0.02 ? d.s.Vout * d.s.Iout / (d.s.Vin * d.s.Iin) : 0; },
    },
    readings: (c, r) => [['U<sub>IN</sub>', si(r.Vin || 0, 'V')], ['I<sub>IN</sub>', si(r.Iin || 0, 'A')], ['U<sub>OUT</sub>', si(r.Vout || 0, 'V')], ['I<sub>OUT</sub>', si(r.Iout || 0, 'A')], [{ pl: 'Sprawność', en: 'Efficiency' }, Math.round((r.eff || 0) * 100) + ' %']],
  });
}
dcdcPart('dcdc_lm2596', {
  name: { pl: 'Przetwornica LM2596 (step-down)', en: 'LM2596 buck converter' }, sub: { pl: 'Moduł obniżający, 3 A', en: 'Step-down module, 3 A' }, kw: 'lm2596 przetwornica step-down buck dcdc impulsowa', title: 'LM2596', col: '#1f4f9e',
  props: { vset: 5 }, ui: [{ k: 'vset', type: 'range', live: true, l: { pl: 'Napięcie wyjściowe (potencjometr)', en: 'Output voltage (trimmer)' }, min: 1.25, max: 30, step: 0.05, fmt: v => dec(v, 2) + ' V' }],
  drop: 1.5, minIn: 4.5, ilim: 3, eta: 0.88,
  info: { pl: 'Przetwornica impulsowa obniża napięcie z dużą sprawnością (ok. 88%) – zamiast grzać się jak 7805, przelicza moc: prąd z wejścia jest mniejszy niż na wyjściu. Model uśredniony (bez tętnień).', en: 'A switching converter steps voltage down with high efficiency (about 88%) – instead of heating up like a 7805 it converts power: the input current is lower than the output current. Averaged model (no ripple).' },
});
dcdcPart('dcdc_mc34063', {
  name: { pl: 'Przetwornica MC34063', en: 'MC34063 converter' }, sub: { pl: 'Moduł step-down / step-up', en: 'Step-down / step-up module' }, kw: 'mc34063 przetwornica step-up boost step-down buck', title: 'MC34063', col: '#6b2f8f', boost: true,
  props: { vset: 12, mode: 'boost' }, ui: [{ k: 'mode', type: 'seg', l: { pl: 'Tryb', en: 'Mode' }, opts: [['buck', { pl: 'Obniżanie', en: 'Step-down' }], ['boost', { pl: 'Podwyższanie', en: 'Step-up' }]] },
    { k: 'vset', type: 'range', live: true, l: { pl: 'Napięcie wyjściowe', en: 'Output voltage' }, min: 1.25, max: 36, step: 0.05, fmt: v => dec(v, 2) + ' V' }],
  drop: 1.5, minIn: 3, ilim: 0.75, eta: 0.78,
  info: { pl: 'Tania uniwersalna przetwornica: w trybie podwyższania (step-up) z 5 V zrobi np. 12 V – kosztem większego prądu pobieranego z wejścia. Model uśredniony.', en: 'A cheap universal converter: in step-up mode it makes e.g. 12 V from 5 V – at the cost of a higher input current. Averaged model.' },
});

/* ====== NE555 ====== */
icPart('ic_555', {
  cat: 'timer', n: 8, name: { pl: 'Timer NE555 / LM555', en: 'NE555 / LM555 timer' }, label: 'NE555', sub: { pl: 'Generator impulsów', en: 'Pulse generator' }, kw: 'ne555 lm555 555 timer generator astabilny monostabilny astable monostable miganie',
  names: ['GND', 'TRIG', 'OUT', 'RESET', 'CTRL', 'THR', 'DIS', 'VCC'],
  info: { pl: 'Timer 555: gdy TRIG spadnie poniżej ⅓ VCC, wyjście przechodzi w stan wysoki; gdy THR przekroczy ⅔ VCC – w niski i rozładowuje kondensator przez DIS. W układzie astabilnym miga z częstotliwością f ≈ 1,44 / ((R1 + 2·R2)·C). RESET (4) połącz z VCC.', en: '555 timer: when TRIG falls below ⅓ VCC the output goes high; when THR rises above ⅔ VCC it goes low and discharges the capacitor through DIS. In astable mode it blinks at f ≈ 1.44 / ((R1 + 2·R2)·C). Tie RESET (4) to VCC.' },
  extra: (c, r) => r.q ? `<circle cx="50" cy="-30" r="3.5" fill="#5ef08a"/>` : '',
  more: {
    sim: {
      maxDt: () => 5e-5, supply: [7, 0],
      lin(d, S) {
        S.G(7, 4, 1 / 5000); S.G(4, 0, 1 / 10000); S.G(3, 7, 1 / 100000); S.G(1, 0, 1e-9); S.G(5, 0, 1e-9);
        const pw = dVp(d, 7, 0) > 3;
        if (pw && d.s.q) S.V(2, 7, -1.6, 8); else S.G(2, 0, pw ? 1 / 8 : 1e-9);
        if (pw && !d.s.q) S.G(6, 0, 1 / 12);
        S.I(7, -(pw ? 6e-3 : 0)); S.I(0, pw ? 6e-3 : 0);
      },
      post(d) {
        const vcc = dVp(d, 7, 0); if (vcc < 3) { if (d.s.q) { d.s.q = false; return true; } return false; }
        const vc = dVp(d, 4, 0), tr = dVp(d, 1, 0), th = dVp(d, 5, 0), rs = dVp(d, 3, 0);
        let q = d.s.q;
        if (rs < 0.7) q = false; else if (tr < vc / 2) q = true; else if (th > vc) q = false;
        if (q !== d.s.q) { d.s.q = q; return true; } return false;
      },
      commit(d) { d.s.U = dVp(d, 2, 0); d.s.I = 0; d.s.warn = dVp(d, 7, 0) > 3 && dVp(d, 3, 0) < 0.7 ? 'reset555' : null; },
    },
    readings: (c, r) => [['OUT', si(r.U || 0, 'V')], [{ pl: 'Stan', en: 'State' }, r.q ? { pl: 'wysoki', en: 'high' } : { pl: 'niski', en: 'low' }]],
  },
});
// TL431 – regulowane źródło odniesienia
(function () {
  const pk = pkgTO92(['REF', 'A', 'K']);
  def('ref_tl431', {
    cat: 'timer', name: 'TL431', sub: { pl: 'Regulowane źródło odniesienia', en: 'Adjustable shunt reference' }, kw: 'tl431 zrodlo odniesienia reference zener regulowany', props: {},
    pins: [{ ...pk.pins[0], n: { pl: 'REF – wejście odniesienia', en: 'REF – reference input' } }, { ...pk.pins[1], n: ROLE.A }, { ...pk.pins[2], n: ROLE.K }], bbox: pk.bbox,
    info: { pl: 'Precyzyjna „regulowana dioda Zenera”: przewodzi z K do A tak, by napięcie REF–A wynosiło 2,495 V. Dzielnikiem z wyjścia na REF ustawisz dowolne napięcie 2,5–36 V. Potrzebny rezystor szeregowy.', en: 'A precise “adjustable Zener diode”: it conducts from K to A to keep REF–A at 2.495 V. A divider from the output to REF sets any voltage from 2.5 to 36 V. Needs a series resistor.' },
    draw: () => pk.body('TL431'),
    sim: {
      nl(d, v) { const vr = v[0] - v[1], vka = v[2] - v[1]; const ik = 0.15 * Math.tanh(softplus(vr - 2.495, 0.0004) * 120) * sigm((vka - 1.2) * 15) + 4e-4 * Math.tanh(Math.max(0, vka) / 0.5) + vka * 1e-9; const ir = 2e-6 * sigm(vr * 4); return [ir, -ik - ir, ik]; },
      commit(d) { d.s.U = dVp(d, 2, 1); d.s.I = d.ip[2]; d.s.Vref = dVp(d, 0, 1); },
    },
    readings: (c, r) => [['U<sub>KA</sub>', si(r.U || 0, 'V')], ['U<sub>REF</sub>', si(r.Vref || 0, 'V')], ['I<sub>K</sub>', si(r.I || 0, 'A')]],
  });
})();
def('ref_lm385', {
  cat: 'timer', name: 'LM385-1.2', sub: { pl: 'Źródło odniesienia 1,235 V', en: '1.235 V reference' }, kw: 'lm385 zrodlo odniesienia reference 1.2', props: {},
  pins: [{ x: 0, y: 0, n: '+' }, { x: 20, y: 0, n: '−' }], bbox: [-10, -44, 30, 4],
  info: { pl: 'Mikromocowe źródło napięcia odniesienia 1,235 V. Pracuje jak dioda Zenera (plus do plusa) już od 15 µA – idealne do zasilania bateryjnego.', en: 'A micropower 1.235 V reference. Works like a Zener diode (plus to plus) from just 15 µA – ideal for battery devices.' },
  draw: () => leg('M0 0V-10') + leg('M20 0V-10') + `<path d="M-8 -8V-24Q-8 -42 10 -42Q28 -42 28 -24V-8Z" fill="#1d1f22" stroke="#000"/>` + tx(10, -28, 'LM385', { s: 6, c: '#d9dde2', f: FONT_M }) + tx(10, -19, '1.2', { s: 6, c: '#d9dde2', f: FONT_M }) + tx(0, -11, '+', { s: 7, c: '#ff9a90' }) + tx(20, -11, '−', { s: 7, c: '#9ecbff' }),
  sim: { nl(d, v) { const u = v[0] - v[1]; const i = 1.2e-5 * sigm((u - 0.9) * 20) + softplus(u - 1.235, 0.002) / 1.0 - diodeI(-u, 1e-12, 1.5); return [i, -i]; }, commit(d) { d.s.U = dVp(d, 0, 1); d.s.I = d.ip[0]; } },
  readings: (c, r) => [['U', si(r.U || 0, 'V')], ['I', si(r.I || 0, 'A')]],
});
