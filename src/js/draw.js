'use strict';
/* ====== Pomocnicze rysowanie elementów (współrzędne lokalne, raster 20 px = 2,54 mm) ====== */
const FONT_UI = 'Lexend,Segoe UI,sans-serif', FONT_D = 'Baloo 2,Segoe UI,sans-serif', FONT_M = 'JetBrains Mono,Consolas,monospace';
const legC = '#c7ccd2';
const leg = (d, c, w) => `<path d="${d}" stroke="${c || legC}" stroke-width="${w || 2.6}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
const tx = (x, y, s, o) => { o = o || {}; return `<text x="${x}" y="${y}" text-anchor="${o.a || 'middle'}" font-size="${o.s || 10}" font-weight="${o.w || 600}" fill="${o.c || '#fff'}" font-family="${o.f || FONT_UI}"${o.r ? ` transform="rotate(${o.r} ${x} ${y})"` : ''}>${esc(String(s))}</text>`; };
const GLOWS = new Set();
function glow(hex) {
  const id = 'g' + hex.replace('#', '');
  if (!GLOWS.has(id)) {
    GLOWS.add(id);
    const defs = document.getElementById('gdefs');
    if (defs) defs.insertAdjacentHTML('beforeend', `<radialGradient id="${id}"><stop offset="0" stop-color="${hex}" stop-opacity=".9"/><stop offset=".45" stop-color="${hex}" stop-opacity=".35"/><stop offset="1" stop-color="${hex}" stop-opacity="0"/></radialGradient>`);
  }
  return `url(#${id})`;
}
const smoke = (x, y) => `<g class="smoke"><circle cx="${x}" cy="${y}" r="6" fill="#9a9a9a" opacity=".55"/><circle cx="${x + 8}" cy="${y - 9}" r="8" fill="#9a9a9a" opacity=".4"/><circle cx="${x - 2}" cy="${y - 18}" r="9" fill="#9a9a9a" opacity=".25"/></g>`;
function mixColor(r, g, b) { const m = Math.max(r, g, b, 1e-9); const k = Math.min(1, m); return `rgb(${Math.round(255 * Math.min(1, r / m * k + 0.15 * k))},${Math.round(255 * Math.min(1, g / m * k + 0.15 * k))},${Math.round(255 * Math.min(1, b / m * k + 0.15 * k))})`; }

/* ---- DIP ---- pin 1 lewy dolny, numeracja przeciwnie do ruchu wskazówek */
function pkgDIP(n, names, opt) {
  opt = opt || {}; const h = n / 2, rowGap = opt.wide ? 120 : 60;
  const pins = [];
  for (let i = 1; i <= n; i++) { const nm = names[i - 1], ln = Array.isArray(nm) ? nm[1] : nm, sh = Array.isArray(nm) ? nm[0] : (typeof nm === 'string' ? nm : L(nm)); pins.push(i <= h ? { x: (i - 1) * 20, y: 0, n: ln, s: sh, num: i } : { x: (n - i) * 20, y: -rowGap, n: ln, s: sh, num: i }); }
  const x0 = -10, x1 = (h - 1) * 20 + 10, yT = -rowGap + 10, yB = -10;
  const bbox = [x0 - 4, -rowGap - 4, x1 + 4, 4];
  const body = (label, sub, col) => {
    let s = '';
    for (const p of pins) s += `<rect x="${p.x - 3}" y="${p.y === 0 ? -10 : -rowGap}" width="6" height="10" rx="1" fill="#b9c0c8"/>`;
    s += `<rect x="${x0}" y="${yT}" width="${x1 - x0}" height="${yB - yT}" rx="3" fill="${col || '#24262a'}" stroke="#0c0d0f"/>`;
    s += `<path d="M${x0} ${(yT + yB) / 2 - 6} a6 6 0 0 1 0 12" fill="#0f1012"/><circle cx="${x0 + 7}" cy="${yB - 7}" r="2.2" fill="#55595f"/>`;
    for (const p of pins) {
      const nm = p.s.length > 5 ? p.s.slice(0, 5) : p.s;
      s += tx(p.x, p.y === 0 ? yB - 3 : yT + 8, nm, { s: 5.2, w: 500, c: '#aab0b8', f: FONT_M });
    }
    const my = (yT + yB) / 2;
    s += tx((x0 + x1) / 2, my + (sub ? 0 : 3), label, { s: n <= 8 ? 8 : 9.5, w: 700, c: '#e8eaed', f: FONT_M });
    if (sub) s += tx((x0 + x1) / 2, my + 9, sub, { s: 5.5, w: 500, c: '#9aa0a8' });
    return s;
  };
  return { pins, bbox, body };
}
/* ---- TO-92 ---- 3 nóżki, płaska strona do patrzącego */
function pkgTO92(names) {
  const pins = names.map((n, i) => ({ x: i * 20, y: 0, n }));
  const body = (label, col) => leg('M0 0V-10') + leg('M20 0V-10') + leg('M40 0V-10') +
    `<path d="M-6 -8V-24Q-6 -42 20 -42Q46 -42 46 -24V-8Z" fill="${col || '#1d1f22'}" stroke="#000"/>` +
    tx(20, -26, label, { s: label.length > 6 ? 6 : 7, w: 700, c: '#d9dde2', f: FONT_M }) +
    names.map((n, i) => tx(i * 20, -12, n, { s: 6, c: '#9aa3ad', f: FONT_M })).join('');
  return { pins, bbox: [-8, -44, 48, 4], body };
}
/* ---- TO-220 ---- */
function pkgTO220(names) {
  const pins = names.map((n, i) => ({ x: i * 20, y: 0, n }));
  const body = (label, sub) => leg('M0 0V-20', legC, 3) + leg('M20 0V-20', legC, 3) + leg('M40 0V-20', legC, 3) +
    `<rect x="-12" y="-88" width="64" height="32" rx="2" fill="#b9c0c8" stroke="#7b838c"/><circle cx="20" cy="-74" r="7" fill="#2b3036"/>` +
    `<rect x="-12" y="-60" width="64" height="42" rx="2" fill="#1d1f22" stroke="#000"/>` +
    tx(20, -40, label, { s: label.length > 7 ? 7 : 8.5, w: 700, c: '#e3e6ea', f: FONT_M }) + (sub ? tx(20, -31, sub, { s: 5.5, c: '#9aa0a8' }) : '') +
    names.map((n, i) => tx(i * 20, -22, n, { s: 6, c: '#aab0b8', f: FONT_M })).join('');
  return { pins, bbox: [-14, -90, 54, 4], body };
}
/* ---- osiowy (dioda) ---- */
function pkgAxial(names, len) {
  len = len || 60;
  const pins = [{ x: 0, y: 0, n: names[0] }, { x: len, y: 0, n: names[1] }];
  const body = (bodyCol, bandCol, label, glass) => leg(`M0 0H${len}`) +
    `<rect x="${len / 2 - 13}" y="-6.5" width="26" height="13" rx="${glass ? 6 : 2}" fill="${bodyCol}" stroke="rgba(0,0,0,.4)"${glass ? ' opacity=".9"' : ''}/>` +
    `<rect x="${len / 2 + 6}" y="-6.5" width="4.5" height="13" fill="${bandCol}"/>` + (label ? tx(len / 2, -10, label, { s: 6, c: '#dfe5ea', f: FONT_M, w: 500 }) : '');
  return { pins, bbox: [-4, -16, len + 4, 8], body };
}
/* ---- moduł PCB ze złączem na dole ---- */
function pkgModule(names, w, h, opt) {
  opt = opt || {};
  const n = names.length, span = (n - 1) * 20;
  const W = Math.max(w || 0, span + 20), x0 = span / 2 - W / 2;
  const pins = names.map((nm, i) => ({ x: i * 20, y: 0, n: nm }));
  const body = (title, col, inner) => {
    let s = `<rect x="${x0}" y="${-h}" width="${W}" height="${h - 4}" rx="5" fill="${col || '#1f4f9e'}" stroke="rgba(0,0,0,.45)"/>`;
    s += `<rect x="-8" y="-16" width="${span + 16}" height="12" rx="2" fill="#1b1b1b"/>`;
    for (const p of pins) s += `<rect x="${p.x - 2.5}" y="-12" width="5" height="12" fill="#d4b14a"/>`;
    for (const p of pins) s += tx(p.x, -20, p.n, { s: 5.5, w: 500, c: '#e7ecf2', f: FONT_M });
    for (const [cx, cy] of [[x0 + 6, -h + 6], [x0 + W - 6, -h + 6]]) s += `<circle cx="${cx}" cy="${cy}" r="3" fill="none" stroke="#c9c9c9" stroke-width="1.2"/>`;
    if (title) s += tx(span / 2, -h + 14, title, { s: 7.5, w: 700, c: '#f2f5f8' });
    return s + (inner || '');
  };
  return { pins, bbox: [x0 - 2, -h - 2, x0 + W + 2, 4], body, x0, W, h };
}
// bitmapa wyświetlacza -> obraz SVG (z pamięcią podręczną)
const FBC = new Map();
function fbImage(key, ver, w, h, painter) {
  let e = FBC.get(key);
  if (!e || e.ver !== ver) {
    const cv = (e && e.cv) || document.createElement('canvas'); cv.width = w; cv.height = h;
    let ctx = null; try { ctx = cv.getContext('2d'); } catch (er) { } if (!ctx) { const data = new Uint8ClampedArray(w * h * 4); painter(data); e = { ver, cv, url: '' }; FBC.set(key, e); return ''; }
    const img = ctx.createImageData(w, h); painter(img.data); ctx.putImageData(img, 0, 0);
    e = { ver, cv, url: cv.toDataURL() }; FBC.set(key, e);
  }
  return e.url;
}
