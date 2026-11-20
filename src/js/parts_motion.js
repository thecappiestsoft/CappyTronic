'use strict';
/* ================= NAPĘDY: silniki krokowe NEMA, sterowniki A4988 / DRV8825, enkoder magnetyczny AS5600 ================= */

/* ---------- Hybrydowy silnik krokowy (dwufazowy, bipolarny, 200 kroków/obrót) ----------
   Model elektromechaniczny (typowy model dq silnika hybrydowego):
   każda faza: u = R·i + L·di/dt + e,  e_A = −k·ω·sin(p·θ),  e_B = k·ω·cos(p·θ)   (p = 50 zębów wirnika)
   moment:     M = k·(−i_A·sin(p·θ) + i_B·cos(p·θ)) − M_z·sin(4·p·θ) − tarcie − obciążenie
   k wynika z momentu trzymającego M_h (obie fazy, prąd znamionowy I_n): k = M_h / (√2 · I_n).
   M_z – moment zaczepowy (ok. 5 % M_h), okres 1,8°. Mechanika liczona w podkrokach po 5 µs.
   Parametry: typowe wartości z kart katalogowych popularnych silników (w nawiasie przykładowy typ). */
const STEP_P = 50;
const STEPPERS = {
  nema11: { n: 'NEMA 11', mm: 28, ex: '11HS18-0674S', I: 0.67, R: 4.8, L: 3.8e-3, T: 0.095, J: 9e-7 },
  nema14: { n: 'NEMA 14', mm: 35, ex: '14HS13-0804S', I: 0.8, R: 2.7, L: 4.5e-3, T: 0.18, J: 2e-6 },
  nema17: { n: 'NEMA 17', mm: 42, ex: '17HS4401', I: 1.7, R: 1.5, L: 2.8e-3, T: 0.40, J: 5.4e-6 },
  nema23: { n: 'NEMA 23', mm: 57, ex: '23HS22-2804S', I: 2.8, R: 0.8, L: 2.4e-3, T: 1.26, J: 3e-5 },
};
const stepM = c => {
  const m = STEPPERS[c.props.model] || STEPPERS.nema17; if (m.k) return m;
  m.k = m.T / (Math.SQRT2 * m.I); m.Td = 0.05 * m.T; m.Tf = 0.01 * m.T;
  m.b = 0.06 * Math.sqrt(m.J * STEP_P * m.k * m.I); // tłumienie lepkie (współczynnik tłumienia rezonansu ok. 3 %)
  return m;
};
const stepPx = c => Math.round((STEPPERS[c.props.model] || STEPPERS.nema17).mm * 2.4);
const STEP_WIRES = [['#26282b', { pl: 'A+ (czarny)', en: 'A+ (black)' }], ['#2f9e44', { pl: 'A− (zielony)', en: 'A− (green)' }], ['#e5484d', { pl: 'B+ (czerwony)', en: 'B+ (red)' }], ['#2f6bd8', { pl: 'B− (niebieski)', en: 'B− (blue)' }]];
def('stepper', {
  cat: 'act', name: { pl: 'Silnik krokowy NEMA', en: 'NEMA stepper motor' }, sub: { pl: 'bipolarny, 1,8° (200 kroków/obrót)', en: 'bipolar, 1.8° (200 steps/rev)' },
  kw: 'silnik krokowy stepper motor nema nema17 nema 17 nema11 nema14 nema23 17hs4401 bipolarny bipolar krok step 3d drukarka printer cnc',
  props: { model: 'nema17', load: 0 },
  pins: STEP_WIRES.map((w, i) => ({ x: i * 20, y: 0, n: w[1] })),
  bbox: c => { const W = stepPx(c); return [30 - W / 2 - 4, -22 - W - 4, 30 + W / 2 + 4, 6]; },
  ui: [{ k: 'model', type: 'select', l: { pl: 'Rozmiar', en: 'Size' }, opts: Object.entries(STEPPERS).map(([k, m]) => [k, `${m.n} – ${m.I} A, ${Math.round(m.T * 100)} N·cm (${m.ex})`]) },
    { k: 'load', type: 'seg', l: { pl: 'Obciążenie wału (moment tarcia)', en: 'Shaft load (friction torque)' }, opts: [[0, { pl: 'brak', en: 'none' }], [0.25, '25 %'], [0.5, '50 %'], [0.9, '90 %']], live: true }],
  info: { pl: 'Bipolarny silnik krokowy w rozmiarze NEMA (11, 14, 17 lub 23 – to szerokość kołnierza: 1,1″…2,3″). Ma dwie cewki (fazy A i B) i wirnik z 50 zębami, więc jeden pełny krok to 1,8° (200 kroków na obrót). Kolejność pełnych kroków A+, B+, A−, B− obraca wał w prawo (patrząc od strony wału). Prąd w cewkach narasta ze stałą czasową L/R, a wirujący wirnik indukuje SEM – przy dużych prędkościach prąd i moment maleją, a za szybki start lub za duże obciążenie gubi kroki. Steruj nim przez sterownik A4988 lub DRV8825 (STEP/DIR) albo mostek H. Model: uzwojenia R + L, SEM, moment zaczepowy, tarcie i bezwładność wirnika (typowe parametry z kart katalogowych).', en: 'A bipolar stepper motor in a NEMA size (11, 14, 17 or 23 – the flange width: 1.1″…2.3″). It has two coils (phases A and B) and a 50-tooth rotor, so one full step is 1.8° (200 steps per revolution). The full-step sequence A+, B+, A−, B− turns the shaft clockwise (seen from the shaft end). Coil current rises with the L/R time constant and the spinning rotor induces a back-EMF – at high speed current and torque fall, and starting too fast or a too heavy load makes it lose steps. Drive it with an A4988 or DRV8825 driver (STEP/DIR) or an H-bridge. Model: R + L windings, back-EMF, detent torque, friction and rotor inertia (typical datasheet parameters).' },
  draw(c, r) {
    const W = stepPx(c), cx = 30, cy = -22 - W / 2, h = W / 2, ch = W * 0.13, a = ((r.th || 0) * 180 / Math.PI) % 360;
    let s = STEP_WIRES.map((w, i) => leg(`M${i * 20} 0V-12Q${i * 20} -18 ${cx + (i - 1.5) * 4} -22`, w[0], 2.4)).join('');
    s += `<path d="M${cx - h + ch} ${cy - h}H${cx + h - ch}L${cx + h} ${cy - h + ch}V${cy + h - ch}L${cx + h - ch} ${cy + h}H${cx - h + ch}L${cx - h} ${cy + h - ch}V${cy - h + ch}Z" fill="#2c2f34" stroke="#121315" stroke-width="1.5"/>`;
    const ho = h - W * 0.115; for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s += `<circle cx="${cx + dx * ho}" cy="${cy + dy * ho}" r="${(W * 0.04).toFixed(1)}" fill="#0e0f11" stroke="#555a61"/>`;
    s += `<circle cx="${cx}" cy="${cy}" r="${(W * 0.26).toFixed(1)}" fill="#8e969f" stroke="#5d646b"/><circle cx="${cx}" cy="${cy}" r="${(W * 0.2).toFixed(1)}" fill="#a9b0b8"/>`;
    const rs = W * 0.07;
    s += `<g transform="translate(${cx} ${cy}) rotate(${a.toFixed(2)})"><path d="M${-rs} ${-rs * 0.3}A${rs} ${rs} 0 1 1 ${rs} ${-rs * 0.3}Z" fill="#d7dce1" stroke="#6b737b"/><path d="M0 ${-W * 0.19}V${-rs * 1.2}" stroke="#f4a51c" stroke-width="3" stroke-linecap="round"/></g>`;
    s += tx(cx, cy - h + 12, (STEPPERS[c.props.model] || STEPPERS.nema17).n, { s: 8, c: '#dfe4ea', w: 700 }) + tx(cx, cy + h - 6, (Math.round(((a % 360) + 360) % 360 * 10) / 10).toFixed(1) + '°', { s: 7.5, c: '#ffe08a', f: FONT_M });
    return s;
  },
  sim: {
    dyn: true, maxDt: () => 1e-4, iso: () => [[0, 1], [2, 3]],
    init(d) { d.s.th = d.s.th || 0; d.s.w = 0; d.s.ia = 0; d.s.ib = 0; d.s.i2 = 0; },
    lin(d, S, dt) {
      const m = stepM(d.c), g = 1 / (m.R + m.L / dt), pt = STEP_P * (d.s.th || 0), kw = m.k * (d.s.w || 0);
      const ea = -kw * Math.sin(pt), eb = kw * Math.cos(pt);
      const Ja = g * (-ea + m.L / dt * (d.s.ia || 0)), Jb = g * (-eb + m.L / dt * (d.s.ib || 0));
      S.G(0, 1, g); S.I(0, -Ja); S.I(1, Ja); S.G(2, 3, g); S.I(2, -Jb); S.I(3, Jb);
    },
    commit(d, dt) {
      const m = stepM(d.c), s = d.s, g = 1 / (m.R + m.L / dt), pt = STEP_P * s.th, kw = m.k * s.w;
      s.ia = g * (dVp(d, 0, 1) + kw * Math.sin(pt)) + g * m.L / dt * s.ia;
      s.ib = g * (dVp(d, 2, 3) - kw * Math.cos(pt)) + g * m.L / dt * s.ib;
      const fr = m.Tf + (+d.c.props.load || 0) * m.T, n = Math.max(1, Math.ceil(dt / 5e-6)), h = dt / n;
      let th = s.th, w = s.w;
      for (let k = 0; k < n; k++) {
        const q = STEP_P * th, Tm = m.k * (-s.ia * Math.sin(q) + s.ib * Math.cos(q)) - m.Td * Math.sin(4 * q) - m.b * w;
        if (w === 0) { if (Math.abs(Tm) > fr) w = h / m.J * (Tm - Math.sign(Tm) * fr); }
        else { const w2 = w + h / m.J * (Tm - Math.sign(w) * fr); w = w2 * w <= 0 ? 0 : w2; }
        th += w * h;
      }
      s.th = th; s.w = w; s.rpm = w * 60 / (2 * Math.PI); s.steps = th / (2 * Math.PI / (4 * STEP_P));
      // nagrzewanie: średni kwadrat prądu (stała czasowa ok. 3 s) porównany z prądem znamionowym
      s.i2 += (s.ia * s.ia + s.ib * s.ib - s.i2) * Math.min(1, dt / 3);
      s.U = dVp(d, 0, 1); s.I = s.ia;
      s.warn = s.i2 > 2 * Math.pow(1.3 * m.I, 2) ? 'stepOver' : null;
    },
  },
  readings: (c, r) => [[{ pl: 'Kąt wału', en: 'Shaft angle' }, ((((r.th || 0) * 180 / Math.PI) % 360 + 360) % 360).toFixed(1) + '°'], [{ pl: 'Pełne kroki', en: 'Full steps' }, (r.steps || 0).toFixed(2)],
    [{ pl: 'Obroty', en: 'Speed' }, (r.rpm || 0).toFixed(1) + ' ' + ({ pl: 'obr./min', en: 'rpm' })[LANG]], ['I A', si(r.ia || 0, 'A')], ['I B', si(r.ib || 0, 'A')]],
});

/* ---------- Sterowniki STEP/DIR: A4988 (Allegro) i DRV8825 (TI), moduły w układzie Pololu ----------
   Wyjścia mostków: model uśredniony regulatora prądu (chopper), liniowy odcinkowo.
   Tryb 'I': mostek wymusza w cewce prąd zadany I = I_max · cos/sin(kąta elektrycznego);
   tryby '+'/'−': brakuje mu napięcia, więc daje ±VMOT przez R_DS(on) (np. przy dużej SEM albo bez obciążenia).
   Wyłączony mostek: prąd zadany 0, przewodzą tylko diody (|u| > VMOT + 1,4 V). Tryb wybiera hak post po rozwiązaniu. */
function bridgeStamp(S, p, q, br, I, lim, Ron) {
  if (br.m === 'I') { S.I(p, I); S.I(q, -I); S.G(p, q, 1e-6); }
  else S.V(p, q, br.m === '+' ? lim : -lim, Ron);
}
function bridgeCur(br, v, I, lim, Ron) { return br.m === 'I' ? I - v * 1e-6 : ((br.m === '+' ? lim : -lim) - v) / Ron; }
function bridgePost(br, v, I, lim, Ron) {
  let m = br.m;
  if (m === 'I') { if (v > lim + 1e-6) m = '+'; else if (v < -lim - 1e-6) m = '−'; }
  else { const i = ((m === '+' ? lim : -lim) - v) / Ron; if (m === '+' ? i > I : i < I) m = 'I'; }
  if (m === br.m) return false; br.m = m; return true;
}
function stepDriver(id, o) {
  const pin = n => pidx(o, n);
  const A = [pin(o.a[0]), pin(o.a[1])], B = [pin(o.b[0]), pin(o.b[1])], VM = pin('VMOT'), G = o.pins.indexOf('GND'), G2 = o.pins.lastIndexOf('GND');
  const STEP = pin('STEP'), DIR = pin('DIR'), EN = pin('EN̅'), SLP = pin('SLP̅'), RST = pin('RST̅'), MS = o.ms.map(pin), VDD = o.vdd ? pin(o.vdd) : -1;
  const lvl = (d, p) => { const l = netLevel(d.n[p]); if (l !== undefined) return l; const th = VDD >= 0 ? 0.5 * Math.max(2, dVp(d, VDD, G)) : 1.5; return dVp(d, p, G) > th ? 1 : 0; };
  // stan wyjść liczony raz na krok; kąt elektryczny w jednostkach 90°/32 (pozycja „home” = 45°)
  function update(d) {
    const s = d.s, vm = dVp(d, VM, G); s.vm = vm;
    const logicOk = VDD < 0 || dVp(d, VDD, G) > 2.8;
    const rst = !lvl(d, RST), slp = !lvl(d, SLP), en = !lvl(d, EN);
    if (rst) s.k = 16;
    if (slp || !logicOk) s.wake = null; else if (s.wake == null) s.wake = E.t + 1e-3;
    s.awake = !slp && logicOk && s.wake != null && E.t >= s.wake;
    s.uvlo = vm < o.vmin;
    s.on = s.awake && !rst && en && !s.uvlo;
    let code = 0; MS.forEach((p, i) => code |= lvl(d, p) << i); s.div = o.msTable[code] || 1;
    const ang = s.k * Math.PI / 64, Im = +d.c.props.ilim || 1;
    s.ta = Im * Math.cos(ang); s.tb = Im * Math.sin(ang);
    if (Math.abs(s.ta) < 1e-9) s.ta = 0; if (Math.abs(s.tb) < 1e-9) s.tb = 0;
    s.warn = vm > o.vmax ? 'drvVmax' : (!slp && rst && logicOk) ? 'drvReset' : (s.awake && en && !rst && s.uvlo && vm > 1) ? 'drvUvlo' : !logicOk && vm > o.vmin ? 'drvVdd' : s.pd > 1.2 ? 'drvHot' : null;
  }
  const P = modPart(id, {
    cat: 'act', name: o.name, sub: o.sub, kw: o.kw, info: o.info, pins: o.pins, w: 320, h: 92, title: o.title, col: o.col, props: { ilim: o.idef },
    ui: [{ k: 'ilim', type: 'select', l: { pl: 'Ograniczenie prądu fazy (potencjometr Vref)', en: 'Phase current limit (Vref trimmer)' }, opts: o.ilims.map(v => [v, `${String(v).replace('.', LANG === 'pl' ? ',' : '.')} A  (Vref ≈ ${(v * o.vrefK).toFixed(2)} V)`]) }],
    inner: (c, r) => `<rect x="120" y="-72" width="60" height="38" rx="3" fill="#1b1d20"/><circle cx="150" cy="-53" r="9" fill="#d9c9a0" stroke="#7d6d48"/><path d="M144 -53H156M150 -59V-47" stroke="#7d6d48" stroke-width="2"/>` +
      tx(150, -26, r.on ? `1/${r.div} · ${r.on ? 'ON' : ''}` : 'OFF', { s: 6.5, c: r.on ? '#7dff9a' : '#ffb4b4', f: FONT_M }),
    extra: {
      bridges: () => [[G, G2]],
      sim: {
        dyn: true, supply: VDD >= 0 ? [VDD, G] : [VM, G], maxDt: () => 1e-4,
        init(d) { d.s.k = 16; d.s.pd = 0; d.s.isup = 0; d.s.brA = { m: 'I' }; d.s.brB = { m: 'I' }; eListen(d, STEP); update(d); },
        lin(d, S) {
          for (const [p, kind, R] of o.pulls) { if (kind === 'd') S.G(p, G, 1 / R); else S.G(p, VDD >= 0 ? VDD : VM, 1 / R); }
          const vm = Math.max(0, d.s.vm || 0);
          for (const p of [...A, ...B]) S.V(p, G, vm / 2, 2e4); // poziom wspólny wyjść
          S.I(VM, -(d.s.isup || 0)); S.I(G, d.s.isup || 0);
          if (VDD >= 0) S.G(VDD, G, 1 / 1000);
          const s = d.s, lim = vm + (s.on ? 0 : 1.4);
          bridgeStamp(S, A[0], A[1], s.brA, s.on ? s.ta : 0, lim, o.ron); bridgeStamp(S, B[0], B[1], s.brB, s.on ? s.tb : 0, lim, o.ron);
        },
        post(d) {
          const s = d.s, lim = Math.max(0, s.vm || 0) + (s.on ? 0 : 1.4);
          const a = bridgePost(s.brA, dVp(d, A[0], A[1]), s.on ? s.ta : 0, lim, o.ron), b = bridgePost(s.brB, dVp(d, B[0], B[1]), s.on ? s.tb : 0, lim, o.ron);
          return a || b;
        },
        onIn(d, p, l, old) {
          if (p !== STEP || l !== 1 || old !== 0) return; const s = d.s;
          if (!s.awake || !lvl(d, RST)) return;
          let code = 0; MS.forEach((q, i) => code |= lvl(d, q) << i); const div = o.msTable[code] || 1, inc = 32 / div;
          // pełny krok i półkrok startują z położeń nieparzystych (45°, 135°…) – wyrównanie jak w tablicach translatora
          if (div === 1 && s.k % 32 !== 16) s.k = Math.round((s.k - 16) / 32) * 32 + 16;
          s.k = (s.k + (lvl(d, DIR) ? inc : -inc) + 128) % 128; s.cnt = (s.cnt || 0) + (lvl(d, DIR) ? 1 : -1);
          update(d); E.dirty = true;
        },
        commit(d, dt) {
          const s = d.s, ua = dVp(d, A[0], A[1]), ub = dVp(d, B[0], B[1]), vm = Math.max(1, s.vm || 0), lim = Math.max(0, s.vm || 0) + (s.on ? 0 : 1.4);
          s.ia = bridgeCur(s.brA, ua, s.on ? s.ta : 0, lim, o.ron); s.ib = bridgeCur(s.brB, ub, s.on ? s.tb : 0, lim, o.ron);
          const pc = o.ron * (s.ia * s.ia + s.ib * s.ib);
          s.isup = s.vm > 1 ? (ua * s.ia + ub * s.ib + pc) / vm + (s.awake ? o.iq : 0) : 0;
          s.pd += (pc - s.pd) * Math.min(1, dt / 2);
          update(d);
        },
      },
      readings: (c, r) => [[{ pl: 'Stan', en: 'State' }, r.on ? { pl: 'włączony', en: 'enabled' } : r.uvlo ? { pl: 'za niskie VMOT', en: 'VMOT too low' } : { pl: 'wyjścia wyłączone', en: 'outputs off' }],
        [{ pl: 'Mikrokrok', en: 'Microstep' }, '1/' + (r.div || 1)], [{ pl: 'Kroki (licznik)', en: 'Steps (count)' }, String(r.cnt || 0)],
        [{ pl: 'Prąd faz A / B', en: 'Phase current A / B' }, si(r.ia || 0, 'A') + ' / ' + si(r.ib || 0, 'A')], ['VMOT', si(r.vm || 0, 'V')], [{ pl: 'Straty mocy', en: 'Power loss' }, si(r.pd || 0, 'W')]],
    },
  });
  P.drv = o;
  return P;
}
stepDriver('drv_a4988', {
  name: { pl: 'A4988 (sterownik silnika krokowego)', en: 'A4988 (stepper driver)' }, sub: { pl: 'STEP/DIR, do 1/16 kroku, 8–35 V', en: 'STEP/DIR, up to 1/16 step, 8–35 V' }, title: 'A4988', col: '#2a7a3b',
  kw: 'a4988 sterownik driver silnika krokowego stepper step dir pololu mikrokrok microstep nema',
  pins: ['EN̅', 'MS1', 'MS2', 'MS3', 'RST̅', 'SLP̅', 'STEP', 'DIR', 'VMOT', 'GND', '2B', '2A', '1A', '1B', 'VDD', 'GND'],
  a: ['1A', '1B'], b: ['2A', '2B'], vdd: 'VDD', ms: ['MS1', 'MS2', 'MS3'], msTable: { 0: 1, 1: 2, 2: 4, 3: 8, 7: 16 },
  pulls: [[0, 'd', 1e5], [1, 'd', 1e5], [2, 'd', 5e4], [3, 'd', 1e5], [5, 'u', 1e4]],
  vmin: 8, vmax: 35, ron: 0.75, iq: 0.004, idef: 1, ilims: [0.3, 0.5, 0.7, 1, 1.2, 1.5, 1.7, 2], vrefK: 8 * 0.068,
  info: { pl: 'Sterownik bipolarnego silnika krokowego. Każde zbocze narastające na STEP przesuwa wał o jeden (mikro)krok, kierunek wybiera DIR. MS1–MS3 ustalają podział: 000 – pełny krok, 100 – 1/2, 010 – 1/4, 110 – 1/8, 111 – 1/16 (wewnętrzne rezystory ściągające: niepodłączone = 0). Układ sam reguluje prąd cewek (chopper): ograniczenie I = Vref / (8 · R_s), R_s = 0,068 Ω – ustawia się je potencjometrem. EN̅ (aktywne niskie) wyłącza wyjścia. Pin RST̅ „wisi” – połącz go z SLP̅ (podciągniętym na płytce), inaczej sterownik stoi w stanie resetu. Po wybudzeniu (SLP̅ = 1) odczekaj 1 ms. Zasilanie: VMOT 8–35 V (kondensator 100 µF przy VMOT!), logika VDD 3–5,5 V. Bez radiatora ok. 1 A na fazę. Podłącz cewkę A silnika do 1A/1B, a cewkę B do 2A/2B.', en: 'A bipolar stepper motor driver. Each rising edge on STEP moves the shaft by one (micro)step; DIR selects the direction. MS1–MS3 set the resolution: 000 – full step, 100 – 1/2, 010 – 1/4, 110 – 1/8, 111 – 1/16 (internal pull-downs: unconnected = 0). The chip regulates the coil current itself (chopper): limit I = Vref / (8 · R_s), R_s = 0.068 Ω – set with the trimmer. EN̅ (active low) turns the outputs off. The RST̅ pin floats – connect it to SLP̅ (pulled up on the board), otherwise the driver stays in reset. After waking (SLP̅ = 1) wait 1 ms. Supply: VMOT 8–35 V (100 µF capacitor at VMOT!), logic VDD 3–5.5 V. About 1 A per phase without a heatsink. Connect motor coil A to 1A/1B and coil B to 2A/2B.' },
});
stepDriver('drv_drv8825', {
  name: { pl: 'DRV8825 (sterownik silnika krokowego)', en: 'DRV8825 (stepper driver)' }, sub: { pl: 'STEP/DIR, do 1/32 kroku, 8,2–45 V', en: 'STEP/DIR, up to 1/32 step, 8.2–45 V' }, title: 'DRV8825', col: '#6a3fa0',
  kw: 'drv8825 sterownik driver silnika krokowego stepper step dir pololu mikrokrok microstep nema ti',
  pins: ['EN̅', 'M0', 'M1', 'M2', 'RST̅', 'SLP̅', 'STEP', 'DIR', 'VMOT', 'GND', 'B2', 'B1', 'A1', 'A2', 'FLT̅', 'GND'],
  a: ['A1', 'A2'], b: ['B1', 'B2'], ms: ['M0', 'M1', 'M2'], msTable: { 0: 1, 1: 2, 2: 4, 3: 8, 4: 16, 5: 32, 6: 32, 7: 32 },
  pulls: [[0, 'd', 1e5], [1, 'd', 1e5], [2, 'd', 1e5], [3, 'd', 1e5], [4, 'd', 1e5], [5, 'd', 1e5], [6, 'd', 1e5], [7, 'd', 1e5]],
  vmin: 8.2, vmax: 45, ron: 0.4, iq: 0.005, idef: 1, ilims: [0.3, 0.5, 0.7, 1, 1.2, 1.5, 1.7, 2, 2.2], vrefK: 5 * 0.1,
  info: { pl: 'Sterownik bipolarnego silnika krokowego, mocniejszy od A4988 (do 2,2 A na fazę z radiatorem, VMOT 8,2–45 V) i z podziałem do 1/32 kroku. M0–M2: 000 – pełny krok, 100 – 1/2, 010 – 1/4, 110 – 1/8, 001 – 1/16, pozostałe – 1/32. Ograniczenie prądu I = 2 · Vref (R_s = 0,1 Ω). Wszystkie wejścia mają wewnętrzne rezystory ściągające, dlatego RST̅ i SLP̅ trzeba podać na stan wysoki (np. 5 V lub pin mikrokontrolera). Logika zasilana z wewnętrznego stabilizatora – osobne VDD nie jest potrzebne. FLT̅ (otwarty dren) nie jest symulowane. Podłącz cewkę A silnika do A1/A2, a cewkę B do B1/B2.', en: 'A bipolar stepper motor driver, stronger than the A4988 (up to 2.2 A per phase with a heatsink, VMOT 8.2–45 V) with up to 1/32 microstepping. M0–M2: 000 – full step, 100 – 1/2, 010 – 1/4, 110 – 1/8, 001 – 1/16, others – 1/32. Current limit I = 2 · Vref (R_s = 0.1 Ω). All inputs have internal pull-downs, so RST̅ and SLP̅ must be driven high (e.g. 5 V or a microcontroller pin). Logic runs from an internal regulator – no separate VDD. FLT̅ (open drain) is not simulated. Connect motor coil A to A1/A2 and coil B to B1/B2.' },
});

/* ---------- AS5600 (ams OSRAM): 12-bitowy magnetyczny czujnik kąta, I2C 0x36, wyjście analogowe/PWM ----------
   Rejestry wg karty katalogowej: ZMCO 0x00, ZPOS 0x01–02, MPOS 0x03–04, MANG 0x05–06, CONF 0x07–08,
   STATUS 0x0B, RAW ANGLE 0x0C–0D, ANGLE 0x0E–0F, AGC 0x1A, MAGNITUDE 0x1B–1C, BURN 0xFF.
   Magnes może siedzieć na wale wybranego silnika krokowego (lub DC) albo być obracany ręcznie suwakiem. */
const ENC_SHAFT = { stepper: s => (s.th || 0) * 180 / Math.PI, motor: s => s.ang || 0 };
function encSources() {
  const o = [['auto', { pl: 'Wał pierwszego silnika w projekcie', en: 'Shaft of the first motor in the project' }], ['manual', { pl: 'Ręcznie (suwak)', en: 'Manual (slider)' }]];
  if (typeof S !== 'undefined' && S.comps) S.comps.filter(c => ENC_SHAFT[c.type]).forEach((c, i) => o.push([c.id, `${L(PARTS[c.type].name)} #${i + 1}` + (c.type === 'stepper' ? ` (${(STEPPERS[c.props.model] || STEPPERS.nema17).n})` : '')]));
  return o;
}
function encShaftDeg(x) {
  const src = x.c.props.src;
  if (src === 'manual') return { deg: -(+x.c.props.ang || 0), ok: true }; // suwak: kąt w prawo patrząc od góry na układ
  const m = CIR.devs.find(d => ENC_SHAFT[d.c.type] && (src === 'auto' || d.c.id === src));
  if (!m) return { deg: 0, ok: false };
  return { deg: ENC_SHAFT[m.c.type](m.s), ok: true };
}
const AS_MAG = { ok: [1800, 0.5, 0x20], weak: [600, 1, 0x30], strong: [3800, 0, 0x28], none: [0, 1, 0] };
function asRegs(x) {
  const s = x.s, r = s.r; if (!r) return;
  const p = x.c.props, mg = AS_MAG[p.mag] || AS_MAG.ok, sh = encShaftDeg(x); s.linked = sh.ok;
  // patrząc na układ od góry (od strony magnesu) obrót wału widziany od jego końca jest odwrócony
  let deg = -sh.deg + (+p.off || 0); if (pinLevel(x, 3)) deg = -deg;
  let raw = Math.floor((((deg % 360) + 360) % 360) / 360 * 4096) & 4095;
  if (p.mag === 'none') raw = Math.floor(Math.random() * 4096);
  const zpos = ((r[1] & 15) << 8) | r[2], mpos = ((r[3] & 15) << 8) | r[4], mang = ((r[5] & 15) << 8) | r[6];
  let range = mpos ? (mpos - zpos + 4096) % 4096 : mang; if (!range) range = 4096;
  const rel = (raw - zpos + 4096) % 4096;
  let ang = range >= 4096 ? rel : rel <= range ? Math.round(rel * 4095 / range) : (rel > range + (4096 - range) / 2 ? 0 : 4095);
  const hyst = (r[8] >> 2) & 3; if (s.ang != null && Math.abs(ang - s.ang) <= hyst && Math.abs(ang - s.ang) < 2048) ang = s.ang;
  s.raw = raw; s.ang = ang; s.deg = ((deg % 360) + 360) % 360;
  r[0x0b] = mg[2]; r[0x1a] = Math.round(mg[1] * (dVp(x, 0, 2) > 4 ? 255 : 128)); s.mag = mg[0];
}
modPart('enc_as5600', {
  cat: 'adc', name: { pl: 'AS5600 (magnetyczny enkoder kąta)', en: 'AS5600 (magnetic angle encoder)' }, sub: { pl: '12 bitów (4096/obrót), I2C 0x36, wyjście analogowe/PWM', en: '12-bit (4096/rev), I2C 0x36, analog/PWM output' },
  kw: 'as5600 am5600 am6500 as6500 enkoder encoder magnetyczny magnetic kat angle obrot rotation czujnik sensor hall i2c 0x36 ams silnik krokowy nema stepper',
  pins: ['VCC', 'OUT', 'GND', 'DIR', 'SCL', 'SDA', 'GPO'], w: 150, h: 96, title: 'AS5600', col: '#7a2a8c',
  props: { src: 'auto', ang: 0, mag: 'ok', off: 0 },
  ui: [{ k: 'src', type: 'select', l: { pl: 'Magnes na wale', en: 'Magnet on the shaft of' }, get opts() { return encSources(); } },
    { k: 'ang', type: 'range', l: { pl: 'Kąt magnesu (tryb ręczny)', en: 'Magnet angle (manual mode)' }, min: 0, max: 359, step: 1, fmt: v => v + '°' },
    { k: 'mag', type: 'seg', l: { pl: 'Pole magnesu', en: 'Magnet field' }, opts: [['ok', { pl: 'dobre', en: 'good' }], ['weak', { pl: 'za słabe', en: 'too weak' }], ['strong', { pl: 'za silne', en: 'too strong' }], ['none', { pl: 'brak', en: 'none' }]], live: true },
    { k: 'off', type: 'seg', l: { pl: 'Obrót magnesu na wale', en: 'Magnet orientation on the shaft' }, opts: [[0, '0°'], [90, '90°'], [180, '180°'], [270, '270°']], live: true }],
  info: { pl: 'Bezstykowy czujnik kąta: mierzy kierunek pola magnesu diametralnego (np. 6×2 mm) zamocowanego na końcu wału 0,5–3 mm nad układem. Rozdzielczość 12 bitów – 4096 pozycji na obrót (0,088°). Odczyt przez I2C (adres 0x36): RAW ANGLE (0x0C–0x0D) to kąt surowy, ANGLE (0x0E–0x0F) – po przeskalowaniu do zakresu ZPOS–MPOS/MANG. STATUS (0x0B): MD (bit 5) – magnes wykryty, ML (bit 4) – pole za słabe, MH (bit 3) – za silne. Pin OUT daje napięcie proporcjonalne do kąta (CONF.OUTS = 00: 0–100 % VCC, 01: 10–90 %) albo PWM (10, 115–920 Hz). DIR = GND: wartość rośnie przy obrocie w prawo patrząc na układ od góry (czyli w lewo patrząc od strony końca wału); DIR = VCC odwraca kierunek. W symulacji wybierz silnik, na którego wale jest magnes, albo obracaj magnes suwakiem. Programowanie OTP (BURN) jest zapamiętywane w projekcie. Filtr, tryby oszczędzania energii i pin GPO nie są symulowane; PWM ma rozdzielczość kroku symulacji.', en: 'A contactless angle sensor: measures the direction of the field of a diametric magnet (e.g. 6×2 mm) fixed to the end of a shaft 0.5–3 mm above the chip. 12-bit resolution – 4096 positions per revolution (0.088°). Read over I2C (address 0x36): RAW ANGLE (0x0C–0x0D) is the raw angle, ANGLE (0x0E–0x0F) is scaled to the ZPOS–MPOS/MANG range. STATUS (0x0B): MD (bit 5) – magnet detected, ML (bit 4) – field too weak, MH (bit 3) – too strong. The OUT pin gives a voltage proportional to the angle (CONF.OUTS = 00: 0–100 % VCC, 01: 10–90 %) or PWM (10, 115–920 Hz). DIR = GND: the value grows when turning clockwise seen from above the chip (i.e. counter-clockwise seen from the shaft end); DIR = VCC reverses it. In the simulation pick the motor whose shaft carries the magnet, or turn the magnet with the slider. OTP programming (BURN) is stored in the project. The filter, power-saving modes and the GPO pin are not simulated; PWM has the resolution of the simulation step.' },
  inner: (c, r) => { const a = r.deg == null ? 0 : r.deg; return `<rect x="35" y="-70" width="50" height="40" rx="3" fill="#1b1d20"/><g transform="translate(60 -50) rotate(${(-a).toFixed(1)})"><path d="M-14 0A14 14 0 0 1 14 0Z" fill="#d8453b"/><path d="M-14 0A14 14 0 0 0 14 0Z" fill="#2f6bd8"/></g>` +
    tx(60, -24, r.ang == null ? '—' : String(r.ang), { s: 7, c: '#ffe08a', f: FONT_M }); },
  extra: {
    i2c: {
      sda: 5, scl: 4, addr: () => 0x36,
      start(x, w) { x.s.first = w; },
      write(x, v) {
        const s = x.s; if (s.first) { s.ptr = v & 255; s.first = false; return; }
        const a = s.ptr; s.ptr = (s.ptr + 1) & 255;
        if (a >= 1 && a <= 8) { s.r[a] = v & ([1, 3, 5].includes(a) ? 15 : a === 7 ? 0x3f : 255); return; }
        if (a === 0xff) {
          const o = x.c.props.otp = x.c.props.otp || { zmco: 0 };
          if (v === 0x80 && o.zmco < 3 && (s.r[0x0b] & 0x20)) { o.zmco++; o.zpos = [s.r[1], s.r[2]]; o.mpos = [s.r[3], s.r[4]]; s.r[0] = o.zmco; }
          else if (v === 0x40 && !o.zmco) { o.mang = [s.r[5], s.r[6]]; o.conf = [s.r[7], s.r[8]]; o.set = 1; }
          if (typeof saveSoon === 'function') saveSoon();
        }
      },
      read(x) {
        const s = x.s, a = s.ptr; asRegs(x);
        let v;
        if (a === 0x0c || a === 0x0e || a === 0x1b) { s.latch = a === 0x0c ? s.raw : a === 0x0e ? s.ang : s.mag; v = (s.latch >> 8) & 15; }
        else if (a === 0x0d || a === 0x0f || a === 0x1c) { const cur = a === 0x0d ? s.raw : a === 0x0f ? s.ang : s.mag; v = (s.latch != null ? s.latch : cur) & 255; s.latch = null; }
        else v = s.r[a] || 0;
        s.ptr = (a === 0x0d || a === 0x0f || a === 0x1c) ? a - 1 : (a + 1) & 255;
        return v;
      },
    },
    sim: {
      supply: [0, 2],
      init(d) {
        const s = d.s; s.r = new Uint8Array(256); s.ptr = 0; s.ang = null; eListen(d, 3);
        const o = d.c.props.otp; if (o) { s.r[0] = o.zmco || 0; if (o.zpos) [s.r[1], s.r[2]] = o.zpos; if (o.mpos) [s.r[3], s.r[4]] = o.mpos; if (o.mang) [s.r[5], s.r[6]] = o.mang; if (o.conf) [s.r[7], s.r[8]] = o.conf; }
        asRegs(d);
      },
      lin(d, S) {
        S.G(0, 2, 1 / 750); // ok. 6,5 mA przy 5 V
        const outs = (d.s.r ? d.s.r[8] >> 4 : 0) & 3, vcc = dVp(d, 0, 2);
        if (outs < 2 && vcc > 2.4) { const f = (d.s.ang || 0) / 4096; S.V(1, 2, vcc * (outs === 1 ? 0.1 + 0.8 * f : f), 100); }
      },
      commit(d) {
        const s = d.s; if (!devPowered(d)) { s.ang = null; if (s.pwm != null) { s.pwm = null; eDrive(d, 1, null, 50, 0, 2); } return; }
        asRegs(d);
        const outs = (s.r[8] >> 4) & 3;
        if (outs === 2) {
          const T = 1 / [115, 230, 460, 920][(s.r[8] >> 6) & 3], ph = (E.t % T) / T, hi = ph < (128 + s.ang) / 4351 ? 1 : 0;
          if (s.pwm !== hi) { s.pwm = hi; eDrive(d, 1, hi, 50, 0, 2); }
        } else if (s.pwm != null) { s.pwm = null; eDrive(d, 1, null, 50, 0, 2); }
        s.U = dVp(d, 1, 2);
        s.warn = s.r[0x0b] & 0x20 ? (s.linked ? null : 'encNoShaft') : 'encNoMag';
      },
    },
    readings: (c, r) => [[{ pl: 'Kąt magnesu', en: 'Magnet angle' }, r.deg == null ? '—' : r.deg.toFixed(1) + '°'], ['RAW ANGLE', r.raw == null ? '—' : String(r.raw)], ['ANGLE', r.ang == null ? '—' : String(r.ang)], ['OUT', si(r.U || 0, 'V')]],
  },
});
