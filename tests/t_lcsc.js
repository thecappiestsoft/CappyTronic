// Biblioteka zewnętrzna (LCSC): katalog, wyszukiwarka, wstawianie pozycji i wartości z kart katalogowych w symulacji.
const { ev, errs } = require('./test.js');
let bad = 0;
const ok = (cond, msg) => { console.log((cond ? '✓ ' : '✗ ') + msg); if (!cond) bad++; };
const props = lcsc => JSON.parse(ev(`JSON.stringify(lcscProps(${JSON.stringify(lcsc)}))`));
const typeOf = lcsc => ev(`lcscEntry(${JSON.stringify(lcsc)}).type`);
// obwód: comps = [[typ lub numer LCSC, właściwości]], wires = [[elA, pinA, elB, pinB]] (piny od 0); elementy rozstawione co 300, by piny się nie stykały
function circuit(comps, wires) {
  const cs = comps.map(([ty, pr], i) => /^C\d+$/.test(ty) ? [typeOf(ty), i * 300, 0, 0, Object.assign(props(ty), pr || {})] : [ty, i * 300, 0, 0, pr || {}]);
  ev(`EXAMPLES.push({g:{pl:'T',en:'T'},n:{pl:'T',en:'T'},d:{pl:'',en:''},comps:${JSON.stringify(cs)},wires:${JSON.stringify(wires.map(w => [w[0], w[1], w[2], w[3], [], 0]))}}); loadExample(EXAMPLES.length-1); toggleSim(); for(let i=0;i<400;i++) simStep(E.dt);`);
}
const V = (i, p) => +ev(`CIR.V[CIR.nodeOfKey(S.comps[${i}].id+':${p}')]`);
const stop = () => ev('if(running)toggleSim()');
const f3 = x => x.toFixed(3);

setTimeout(() => {
  // ---- katalog ----
  const n = +ev('LCSC_CATALOG.length'); ok(n >= 60, `katalog: ${n} pozycji`);
  ok(ev(`LCSC_CATALOG.filter(e=>!PARTS[e.type]).length`) === 0, 'każda pozycja wskazuje istniejący typ elementu');
  ok(ev(`new Set(LCSC_CATALOG.map(e=>e.lcsc)).size`) === n, 'numery LCSC są unikalne');
  ok(ev(`LCSC_CATALOG.every(e=>/^C\\d+$/.test(e.lcsc)&&e.mpn&&e.mfr&&e.pkg&&CATS.some(c=>c[0]===e.cat)&&(e.sim==='full'||e.sim==='approx'))`), 'pola pozycji są kompletne');
  ok(ev(`LCSC_CATALOG.every(e=>Object.keys(e.p||{}).every(k=>LCSC_PARAMS[k]))`), 'parametry mają opis w LCSC_PARAMS');
  ok(ev(`LCSC_CATALOG.every(e=>e.sim==='full'||(e.note&&e.note.pl))`), 'modele zastępcze mają opis różnic');

  // ---- wyszukiwarka ----
  ev(`setPalTab('ext')`);
  const find = q => ev(`$('#search').value=${JSON.stringify(q)}; buildPalette(); [...document.querySelectorAll('#plist .pal-item')].map(e=>e.dataset.lcsc).join(',')`).split(',').filter(Boolean);
  ok(find('C25804').join() === 'C25804', 'numer LCSC C25804 → jedna pozycja');
  ok(find('c25804').join() === 'C25804', 'numer LCSC bez rozróżniania wielkości liter');
  ok(find('0603WAF1002T5E').join() === 'C25804', 'numer producenta');
  ok(find('AMS1117').length === 3, 'nazwa rodziny AMS1117 → 3 pozycje');
  ok(find('r=10k').length === 3 && find('r=10k').includes('C25804'), 'parametr r=10k');
  ok(find('rezystor 0402').length === 2, 'kategoria + obudowa');
  ok(find('vds>=30').every(id => ['C8545', 'C52895', 'C20917', 'C15127'].includes(id)) && find('vds>=30').length === 4, 'parametr vds>=30');
  ok(find('c<=100n').length === 3, 'parametr c<=100n (22 pF, 2× 100 nF)');
  ok(find('mosfet p').join() === 'C15127,C10487', 'słowo jednoliterowe „p” dopasowuje całe słowo');
  ok(find('zzzz-brak').length === 0 && ev(`!!document.querySelector('#plist .empty-s')`), 'brak wyników → komunikat');
  ev(`$('#search').value=''; $('#extCat').value='fet'; buildPalette()`); ok(+ev(`document.querySelectorAll('#plist .pal-item').length`) === 5, 'filtr kategorii (FET)');
  ev(`$('#extCat').value=''; $('#extFull').checked=true; buildPalette()`); ok(+ev(`document.querySelectorAll('#plist .pal-item').length`) === +ev(`LCSC_CATALOG.filter(e=>e.sim==='full').length`), 'filtr „pełny model”');
  ev(`$('#extFull').checked=false; setPalTab('parts'); $('#search').value='ams1117'; buildPalette()`);
  ok(+ev(`document.querySelectorAll('#plist .pal-item').length`) === 0, 'rodziny modeli nie pojawiają się w zakładce „Części”');
  ev(`$('#search').value=''; buildPalette()`);

  // ---- każda pozycja daje się wstawić i zasymulować (jak t_parts.js) ----
  const nan = [];
  for (const id of JSON.parse(ev('JSON.stringify(LCSC_CATALOG.map(e=>e.lcsc))'))) {
    try {
      ev(`(()=>{if(running)toggleSim();S.comps=[];S.wires=[];changed(); addComp(lcscEntry('${id}').type,300,300,lcscProps('${id}')); const c=S.comps[S.comps.length-1];
        addComp('battery',100,500); const bat=S.comps[S.comps.length-1]; const np=pinsOf(c).length;
        if(np>=2){S.wires.push({id:newId(),a:{c:bat.id,t:0},b:{c:c.id,t:0},pts:[],color:'#f00'});S.wires.push({id:newId(),a:{c:bat.id,t:1},b:{c:c.id,t:np-1},pts:[],color:'#000'});}
        changed(); toggleSim(); for(let i=0;i<100;i++)simStep(E.dt); select('c',c.id); renderProps(); toggleSim();})()`);
      if (ev('CIR!==null&&Array.from(CIR.V).some(v=>!isFinite(v))')) nan.push(id);
    } catch (e) { nan.push(id + ': ' + e.message.split('\n')[0]); }
  }
  ok(!nan.length, 'wszystkie pozycje katalogu: wstawienie i symulacja bez błędów' + (nan.length ? ' ' + nan.join('; ') : ''));

  // ---- panel właściwości i eksport KiCad ----
  circuit([['C25804'], ['C17414'], ['dcsupply', { v: 5, ilim: 1 }]], [[2, 0, 0, 0], [0, 1, 1, 0], [1, 1, 2, 1]]);
  ok(Math.abs(V(0, 1) - 2.5) < 0.01, `dzielnik 2× 10 kΩ (C25804 + C17414): ${f3(V(0, 1))} V (2,5 V)`);
  stop(); ev(`select('c',S.comps[0].id); renderProps()`);
  const pb = ev(`$('#pbody').textContent`); ok(pb.includes('C25804') && pb.includes('0603WAF1002T5E') && pb.includes('UNI-ROYAL'), 'panel właściwości pokazuje dane pozycji LCSC');
  ok(ev(`kiExportSch().text`).includes('(property "LCSC" "C25804"'), 'eksport KiCad zawiera pole LCSC');
  ev(`S.comps[0].props.r=4700; renderProps()`); ok(ev(`!!$('#pbody .warnbox')`), 'zmiana wartości → ostrzeżenie o niezgodności z pozycją');

  // ---- LDO: napięcie wyjściowe i dropout ----
  // 0 zasilacz, 1 LDO (IN, GND, OUT), 2 obciążenie
  const ldo = (id, vin, rl) => { circuit([['dcsupply', { v: vin, ilim: 3 }], [id], ['resistor', { r: rl, w: 5 }]], [[0, 0, 1, 0], [0, 1, 1, 1], [1, 2, 2, 0], [2, 1, 0, 1]]); const v = V(1, 2) - V(1, 1); stop(); return v; };
  let v = ldo('C6186', 5, 33); ok(Math.abs(v - 3.3) < 0.05, `AMS1117-3.3 (C6186), 5 V → 100 mA: ${f3(v)} V`);
  v = ldo('C6186', 4, 33); ok(Math.abs(v - 2.9) < 0.1, `AMS1117-3.3 przy 4 V wejścia – dropout 1,1 V: ${f3(v)} V (≈ 2,9 V)`);
  v = ldo('C6187', 7, 50); ok(Math.abs(v - 5) < 0.06, `AMS1117-5.0 (C6187), 7 V → 100 mA: ${f3(v)} V`);
  v = ldo('C5446', 5, 33); ok(Math.abs(v - 3.3) < 0.05, `XC6206 3,3 V (C5446): ${f3(v)} V`);
  v = ldo('C5446', 3.4, 33); ok(Math.abs(v - 3.15) < 0.1, `XC6206 przy 3,4 V wejścia – dropout 0,25 V: ${f3(v)} V`);
  v = ldo('C5446', 5, 3.3); ok(v < 1.2, `XC6206 – ograniczenie prądu (obciążenie 3,3 Ω): ${f3(v)} V`);
  v = ldo('C82942', 3.5, 33); ok(Math.abs(v - 3.3) < 0.05, `ME6211 (C82942) przy 3,5 V wejścia nadal stabilizuje: ${f3(v)} V`);

  // ---- MOSFET-y ----
  // 0 zasilanie 5 V, 1 MOSFET (G, S, D), 2 obciążenie 10 Ω, 3 zasilanie bramki
  const nmos = (id, vg) => { circuit([['dcsupply', { v: 5, ilim: 3 }], [id], ['resistor', { r: 10, w: 5 }], ['dcsupply', { v: vg, ilim: 1 }]], [[0, 0, 2, 0], [2, 1, 1, 2], [1, 1, 0, 1], [3, 0, 1, 0], [3, 1, 0, 1]]); const v = V(1, 2) - V(1, 1); stop(); return v; };
  v = nmos('C20917', 3.3); ok(v < 0.1, `AO3400A (C20917), U_GS = 3,3 V: U_DS = ${f3(v)} V (przewodzi)`);
  v = nmos('C20917', 0.3); ok(v > 4.9, `AO3400A, U_GS = 0,3 V: U_DS = ${f3(v)} V (zatkany)`);
  v = nmos('C8545', 10); ok(v > 0.8 && v < 3.5, `2N7002 (C8545) – R_DS(on) ok. 5 Ω przy 10 Ω obciążenia: U_DS = ${f3(v)} V`);
  // P-MOSFET po stronie plusa: S do +, D przez 10 Ω do masy, G do masy
  circuit([['dcsupply', { v: 5, ilim: 3 }], ['C15127'], ['resistor', { r: 10, w: 5 }]], [[0, 0, 1, 1], [1, 2, 2, 0], [2, 1, 0, 1], [1, 0, 0, 1]]);
  v = V(1, 2) - V(0, 1); stop(); ok(v > 4.8, `AO3401A (C15127) jako klucz górny: wyjście ${f3(v)} V`);

  // ---- diody ----
  const diode = (id, vs, r) => { circuit([['dcsupply', { v: vs, ilim: 5 }], [id], ['resistor', { r, w: 10 }]], [[0, 0, 2, 0], [2, 1, 1, 0], [1, 1, 0, 1]]); const v = V(1, 0) - V(1, 1); stop(); return v; };
  v = diode('C8678', 5, 4.5); ok(v > 0.3 && v < 0.55, `SS34 (C8678) przy ok. 1 A: U_F = ${f3(v)} V`);
  v = diode('C95872', 5, 4.5); ok(v > 0.8 && v < 1.15, `M7 / 1N4007 (C95872) przy ok. 1 A: U_F = ${f3(v)} V`);
  // Zener odwrotnie: + → 1 kΩ → katoda, anoda → masa
  circuit([['dcsupply', { v: 12, ilim: 1 }], ['C8062'], ['resistor', { r: 1000 }]], [[0, 0, 2, 0], [2, 1, 1, 1], [1, 0, 0, 1]]);
  v = V(1, 1) - V(1, 0); stop(); ok(Math.abs(v - 5.6) < 0.35, `ZMM5V6 (C8062): U_Z = ${f3(v)} V (5,6 V)`);

  // ---- BJT ----
  // 0 zasilanie 5 V, 1 tranzystor, 2 R_C 1 kΩ, 3 R_B; kolejność nóżek B/E/C odczytana z definicji (SOT-23 i TO-92 się różnią)
  const npn = (id, rb) => { const o = JSON.parse(ev(`JSON.stringify(PARTS[lcscEntry('${id}').type].pins.map(p=>p.n.pl[0]))`)), B = o.indexOf('B'), Em = o.indexOf('E'), C = o.indexOf('C');
    circuit([['dcsupply', { v: 5, ilim: 1 }], [id], ['resistor', { r: 1000 }], ['resistor', { r: rb }]], [[0, 0, 2, 0], [2, 1, 1, C], [0, 0, 3, 0], [3, 1, 1, B], [1, Em, 0, 1]]);
    const r = [V(1, C) - V(1, Em), (V(0, 0) - V(1, C)) / 1000, (V(0, 0) - V(1, B)) / rb]; stop(); return r; };
  let q = npn('C2146', 10e3); ok(q[0] < 0.3, `S8050 (C2146) w nasyceniu: U_CE = ${f3(q[0])} V`);
  q = npn('C2146', 2.2e6); const beta = q[1] / q[2]; ok(beta > 200 && beta < 380, `S8050 w stanie aktywnym: β = ${beta.toFixed(0)} (h_FE 200–350)`);
  q = npn('C20526', 1e6); const b2 = q[1] / q[2]; ok(b2 > 120 && b2 < 300, `MMBT3904 (C20526): β = ${b2.toFixed(0)}`);

  // PNP jako klucz górny: E do +, C przez 100 Ω do masy, B przez 1 kΩ do masy
  for (const id of ['C8542', 'C2143']) { const o = JSON.parse(ev(`JSON.stringify(PARTS[lcscEntry('${id}').type].pins.map(p=>p.n.pl[0]))`)), B = o.indexOf('B'), Em = o.indexOf('E'), C = o.indexOf('C');
    circuit([['dcsupply', { v: 5, ilim: 1 }], [id], ['resistor', { r: 100 }], ['resistor', { r: 1000 }]], [[0, 0, 1, Em], [1, C, 2, 0], [2, 1, 0, 1], [1, B, 3, 0], [3, 1, 0, 1]]);
    const vc = V(1, C) - V(0, 1); stop(); ok(vc > 4.6 && vc < 5.01, `${id} (${ev(`lcscEntry('${id}').mpn`)}) jako klucz górny PNP: U_C = ${f3(vc)} V`); }

  // ---- wzmacniacze: wyjście rail-to-rail LMV324 vs LM324 (wtórnik, wejście ≈ 4,95 V przy 5 V) ----
  const follower = id => { circuit([['dcsupply', { v: 5, ilim: 1 }], [id], ['resistor', { r: 100 }], ['resistor', { r: 10000 }], ['resistor', { r: 10000 }]],
    [[0, 0, 1, 3], [0, 1, 1, 10], [0, 0, 2, 0], [2, 1, 1, 2], [3, 0, 2, 1], [3, 1, 0, 1], [1, 0, 1, 1], [1, 0, 4, 0], [4, 1, 0, 1]]);
    for (let i = 0; i < 2000; i++) ev('simStep(E.dt)'); const v = V(1, 0) - V(0, 1); stop(); return v; };
  const vr = follower('C7974'), vl = follower('C7943');
  ok(vr > 4.85, `LMV324 (C7974) – wyjście rail-to-rail: ${f3(vr)} V`);
  ok(vl < 3.8, `LM324 (C7943) – wyjście ok. 1,5 V poniżej zasilania: ${f3(vl)} V`);

  // ---- LED: napięcie przewodzenia z karty ----
  const led = id => { circuit([['dcsupply', { v: 5, ilim: 1 }], [id], ['resistor', { r: 330 }]], [[0, 0, 2, 0], [2, 1, 1, 0], [1, 1, 0, 1]]); const v = V(1, 0) - V(1, 1); stop(); return v; };
  const vb = led('C2293'), vrd = led('C2286');
  ok(vb > 2.9 && vb < 3.4 && vrd > 1.8 && vrd < 2.2, `LED niebieska KT-0805B: ${f3(vb)} V, czerwona KT-0603R: ${f3(vrd)} V`);

  console.log('błędy okna:', errs.slice(0, 5)); if (errs.length) bad++;
  console.log(bad ? `błędy: ${bad}` : 'bez błędów'); process.exit(bad ? 1 : 0);
}, 400);
