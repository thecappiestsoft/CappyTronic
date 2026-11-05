'use strict';
const $ = s => document.querySelector(s);
const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } } };
let LANG = LS.get('cappytronic.lang') || ((navigator.language || 'pl').startsWith('pl') ? 'pl' : 'en');
const L = o => o == null ? '' : typeof o === 'string' ? o : (o[LANG] != null ? o[LANG] : o.pl);
function t(key, vars) { const e = I18N[key]; let s = e ? (e[LANG] != null ? e[LANG] : e.pl) : key; if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]); return s; }
const DEC = () => LANG === 'pl' ? ',' : '.';
function dec(x, d) { return x.toFixed(d).replace('.', DEC()); }
function si(v, u) {
  const a = Math.abs(v); if (!isFinite(v)) return '∞ ' + u; if (a < 1e-12) return '0 ' + u;
  for (const [m, p] of [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']]) {
    if (a >= m * .9995) { const x = v / m, ax = Math.abs(x); return dec(x, ax >= 100 ? 0 : ax >= 10 ? 1 : 2) + ' ' + p + u; }
  }
  return '0 ' + u;
}
function siT(v, u) {
  for (const [m, p] of [[1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']]) {
    if (Math.abs(v) >= m * 0.9999) return String(+(v / m).toFixed(3)).replace('.', DEC()) + ' ' + p + u;
  }
  return String(v) + ' ' + u;
}
function parseSI(str) {
  const m = String(str).trim().replace(',', '.').match(/^([0-9]*\.?[0-9]+)\s*([pnuµmkKMG]?)/);
  if (!m) return NaN; const mul = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, k: 1e3, K: 1e3, M: 1e6, G: 1e9, '': 1 }[m[2]];
  return parseFloat(m[1]) * mul;
}
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const E24 = [1, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2, 2.2, 2.4, 2.7, 3, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1];
const BANDS = [['#1b1b1b', 'czarny', 'black'], ['#7a4a22', 'brązowy', 'brown'], ['#d0312d', 'czerwony', 'red'], ['#f07f1a', 'pomarańczowy', 'orange'], ['#f4d21f', 'żółty', 'yellow'], ['#2f9e44', 'zielony', 'green'], ['#2d63d6', 'niebieski', 'blue'], ['#8a3fd1', 'fioletowy', 'violet'], ['#8c8c8c', 'szary', 'grey'], ['#f3f3f3', 'biały', 'white']];
function bandsFor(R) {
  if (R < 1) return [0, 0, 0];
  let e = Math.floor(Math.log10(R) + 1e-9) - 1; let d = Math.round(R / Math.pow(10, e));
  if (d >= 100) { d = Math.round(d / 10); e++; }
  if (e < 0) { return [Math.floor(d / 10), d % 10, 0]; }
  return [Math.floor(d / 10), d % 10, Math.min(9, e)];
}
function toast(m) { const el = $('#toast'); el.textContent = m; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => el.hidden = true, 3400); }
