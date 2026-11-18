'use strict';
/* ================= PALETA: BIBLIOTEKA ZEWNĘTRZNA (LCSC) =================
   Druga zakładka palety. Pozycje z LCSC_CATALOG (lcsc_catalog.js) wstawia się jak zwykłe elementy:
   typ z pola type, właściwości z props, a numer LCSC trafia do c.props.lcsc (panel właściwości, eksport KiCad).
   Wyszukiwanie: każde słowo zapytania musi pasować. Słowo w postaci klucz<op>wartość (op: = : < <= > >=)
   porównuje parametr z karty (klucze w LCSC_PARAMS, wartości z przedrostkami SI: 10k, 100n, 3.3).
   Pozostałe słowa szukają w numerze LCSC, numerze producenta, producencie, nazwie, kategorii, obudowie i parametrach. */
var palTab = 'parts'; // var: buildPalette (ui.js) czyta ją także przed wykonaniem tego modułu
const palQ = { parts: '', ext: '' };
const LCSC_BY = new Map(LCSC_CATALOG.map(e => [e.lcsc.toUpperCase(), e]));
function lcscEntry(id) { return LCSC_BY.get(String(id || '').toUpperCase()); }
// właściwości elementu wstawianego z katalogu (z numerem LCSC)
function lcscProps(id) { const e = lcscEntry(id); return e ? Object.assign(JSON.parse(JSON.stringify(e.props)), { lcsc: e.lcsc }) : undefined; }

// zapis wartości w postaciach, których ktoś może szukać: 10k, 10kΩ, 4k7, 4.7k, 4,7k, 100n, 100nf, 0.1u
const SI_PFX = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'u'], [1e-9, 'n'], [1e-12, 'p']];
function siForms(v, u) {
  if (!isFinite(v) || v === 0) return [String(v)];
  const out = []; let first = true;
  for (const [m, p] of SI_PFX) {
    const x = +(v / m).toPrecision(4); if (Math.abs(x) < 0.1 || Math.abs(x) >= 1000) continue;
    const s = String(x); const forms = [s, s.replace('.', ',')]; if (p && s.includes('.')) forms.push(s.replace('.', p));
    for (const f of forms) { out.push(f + p, f + p + u); if (p === 'u') out.push(f + 'µ' + u); if (p === 'M' && u === 'Ω') out.push(f + 'meg'); }
    if (!first) break; first = false; // postać główna + jedna sąsiednia (np. 0.1u i 100n)
  }
  return out;
}
const lcscCatName = e => { const c = CATS.find(x => x[0] === e.cat); return c ? c[1] : { pl: e.cat, en: e.cat }; };
let lcscHayLang = null; const lcscHay = new Map();
function lcscHaystack(e) {
  if (lcscHayLang !== LANG) { lcscHay.clear(); lcscHayLang = LANG; }
  let h = lcscHay.get(e); if (h) return h;
  const P = PARTS[e.type], cn = lcscCatName(e);
  const parts = [e.lcsc, e.mpn, e.mfr, e.pkg, e.kw || '', P ? L(P.name) + ' ' + (P.name.pl || '') + ' ' + (P.name.en || '') + ' ' + (P.sub ? L(P.sub) : '') : '', cn.pl, cn.en,
    e.sim === 'full' ? 'pelny full' : 'zastepczy approx substitute', e.props && e.props.model || '', e.props && e.props.color || ''];
  for (const k in e.p || {}) { const u = (LCSC_PARAMS[k] || {}).u || ''; parts.push(...siForms(e.p[k], u)); }
  h = norm(parts.join(' ')); lcscHay.set(e, h); return h;
}
// filtr parametru: klucz, operator, wartość (z rozróżnieniem M/m – na surowym tekście)
const LCSC_ALIAS = { u: 'v', vo: 'vout', uout: 'vout', iout: 'i', cap: 'c', res: 'r', p: 'pw', vbr: 'vr', vgs: 'vth', vceo: 'vce', ids: 'id' };
function lcscParamFilter(tok) {
  const m = tok.match(/^([a-z_]+)\s*(>=|<=|=|>|<|:)\s*(-?[0-9.,]+.*)$/i); if (!m) return null;
  let k = m[1].toLowerCase(); k = LCSC_ALIAS[k] || k; if (!LCSC_PARAMS[k]) return null;
  const v = parseSI(m[3]); if (!isFinite(v)) return null;
  const op = m[2];
  return e => { const x = e.p && e.p[k]; if (typeof x !== 'number') return false; const eq = Math.abs(x - v) <= 1e-3 * Math.max(Math.abs(x), Math.abs(v));
    return op === '>' ? x > v && !eq : op === '<' ? x < v && !eq : op === '>=' ? x >= v || eq : op === '<=' ? x <= v || eq : eq; };
}
function lcscSearch(q, cat, fullOnly) {
  const toks = String(q || '').trim().split(/\s+/).filter(Boolean);
  const tests = toks.map(tk => {
    const f = lcscParamFilter(tk); if (f) return f; const w = norm(tk);
    if (/^c\d+$/.test(w)) return e => e.lcsc.toLowerCase().startsWith(w);          // numer LCSC: od początku (C25 → C25804, C25803…)
    if (w.length === 1) return e => (' ' + lcscHaystack(e) + ' ').split(/[\s,·()]+/).includes(w); // jedna litera („p”, „n”) – całe słowo
    return e => lcscHaystack(e).includes(w);
  });
  const hits = LCSC_CATALOG.filter(e => PARTS[e.type] && (!cat || e.cat === cat) && (!fullOnly || e.sim === 'full') && tests.every(f => f(e)));
  // dokładny numer LCSC lub producenta na początku listy
  const exact = e => toks.some(tk => tk.toUpperCase() === e.lcsc.toUpperCase() || tk.toUpperCase() === e.mpn.toUpperCase());
  return hits.filter(exact).concat(hits.filter(e => !exact(e)));
}
function lcscSummary(e) {
  const keys = Object.keys(e.p || {}).slice(0, 2);
  return keys.map(k => { const u = LCSC_PARAMS[k].u; return u && u !== '%' && u !== 'b' && u !== 'bd' ? siT(e.p[k], u) : String(e.p[k]) + (u ? ' ' + u : ''); }).join(' · ');
}
const lcscItemHtml = e => {
  const P = PARTS[e.type], props = Object.assign({}, P.props, e.props), sm = lcscSummary(e);
  return `<div class="pal-item" data-type="${e.type}" data-lcsc="${esc(e.lcsc)}" tabindex="0" role="button" title="${esc(e.lcsc + ' · ' + e.mpn + ' · ' + e.mfr + ' · ' + e.pkg)}"><div class="pal-thumb">${mini(e.type, props)}</div>` +
    `<span class="nm">${esc(e.mpn)}</span><span class="sb">${esc(e.lcsc)}${sm ? ' · ' + esc(sm) : ''} · ${esc(e.pkg)}</span><span class="lv${e.sim === 'full' ? ' full' : ''}">${t(e.sim === 'full' ? 'extFull' : 'extApprox')}</span></div>`;
};
function buildExtPalette() {
  const catSel = $('#extCat'), cat = catSel.value, cats = [...new Set(LCSC_CATALOG.map(e => e.cat))].filter(c => CATS.some(x => x[0] === c)).sort((a, b) => CATS.findIndex(x => x[0] === a) - CATS.findIndex(x => x[0] === b));
  catSel.innerHTML = `<option value="">${esc(t('extAllCats'))}</option>` + cats.map(c => `<option value="${c}"${c === cat ? ' selected' : ''}>${esc(L(lcscCatName({ cat: c })))} (${LCSC_CATALOG.filter(e => e.cat === c).length})</option>`).join('');
  const hits = lcscSearch($('#search').value, cat, $('#extFull').checked);
  let h = `<div class="ext-help">${esc(t('extHelp'))}</div><div class="ext-cnt">${esc(t('extCount', { n: hits.length, m: LCSC_CATALOG.length }))}</div>`;
  if (!hits.length) h += `<div class="empty-s">${t('noResults')}</div>`;
  else if ($('#search').value.trim()) h += `<div class="pal-grid">${hits.map(lcscItemHtml).join('')}</div>`;
  else for (const c of cats) { const g = hits.filter(e => e.cat === c); if (g.length) h += `<div class="ext-h">${esc(L(lcscCatName({ cat: c })))}</div><div class="pal-grid">${g.map(lcscItemHtml).join('')}</div>`; }
  $('#plist').innerHTML = h;
}
function setPalTab(tb) {
  if (tb === palTab) return;
  palQ[palTab] = $('#search').value; palTab = tb; $('#search').value = palQ[tb] || '';
  document.querySelectorAll('.ptab').forEach(b => b.setAttribute('aria-selected', b.dataset.ptab === tb));
  $('#extFilters').hidden = tb !== 'ext';
  const inp = $('#search'); inp.dataset.i18nPh = tb === 'ext' ? 'searchExt' : 'search'; inp.placeholder = t(inp.dataset.i18nPh);
  LS.set('cappytronic.palTab', tb); buildPalette();
}
document.querySelectorAll('.ptab').forEach(b => b.onclick = () => setPalTab(b.dataset.ptab));
$('#extCat').addEventListener('change', buildPalette);
$('#extFull').addEventListener('change', buildPalette);
if (LS.get('cappytronic.palTab') === 'ext') setPalTab('ext');

// panel właściwości: dane pozycji katalogu przy wstawionym elemencie
function lcscInfoHtml(c) {
  const e = lcscEntry(c.props.lcsc);
  if (!e) return `<div class="warnbox">${esc(t('extUnknown', { n: c.props.lcsc }))}</div>`;
  const changed = e.type !== c.type || Object.keys(e.props).some(k => String(e.props[k]) !== String(c.props[k]));
  const rows = [['LCSC', e.lcsc], [t('extMpn'), e.mpn], [t('extMfr'), e.mfr], [t('extPkg'), e.pkg], [t('extSim'), t(e.sim === 'full' ? 'extFull' : 'extApprox')]];
  for (const k in e.p || {}) { const d = LCSC_PARAMS[k]; if (!d) continue; const u = d.u; rows.push([L(d.n), u && u !== '%' && u !== 'b' && u !== 'bd' ? siT(e.p[k], u) : e.p[k] + (u ? ' ' + u : '')]); }
  return `<div><span class="lbl">${t('extLib')}</span><div class="read">${rows.map(r => `<div class="row"><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join('')}</div>` +
    (e.note && (L(e.note) || '').trim() ? `<p class="info">${esc(L(e.note))}</p>` : '') + (changed ? `<div class="warnbox">${esc(t('extChanged', { n: e.lcsc }))}</div>` : '') + `</div>`;
}
