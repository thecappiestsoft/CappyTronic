'use strict';
/* ================= MATY Z PODPISEM MODUŁU =================
   Kolorowy prostokąt pod elementami, z nazwą modułu i notatką. Grupuje elementy jednego modułu
   (np. „Zasilacz”, „Czujnik temperatury”); przesuwanie maty przesuwa też elementy, które na niej leżą. */
const MAT_COLS = [['#3d7bf2', { pl: 'niebieski', en: 'blue' }], ['#2fb15f', { pl: 'zielony', en: 'green' }], ['#f2c12e', { pl: 'żółty', en: 'yellow' }], ['#f08a24', { pl: 'pomarańczowy', en: 'orange' }],
  ['#e5484d', { pl: 'czerwony', en: 'red' }], ['#9b59b6', { pl: 'fioletowy', en: 'purple' }], ['#14b8a6', { pl: 'morski', en: 'teal' }], ['#8a94a3', { pl: 'szary', en: 'grey' }]];
let matMode = false;
const lyMats = $('#lyMats');
const matById = id => (S.mats || []).find(m => m.id === id);
const MAT_TAB_H = 28;
const matTabW = m => Math.max(70, Math.min(m.w, 30 + matTextW(m.title || t('matDefault'), 13, true)));
function matTextW(s, size, bold) { let w = 0; for (const ch of String(s)) w += /[ilj.,:;'!|]/.test(ch) ? 0.3 : /[mwMW@]/.test(ch) ? 0.85 : /[A-ZĄĆĘŁŃÓŚŹŻ0-9]/.test(ch) ? 0.66 : 0.55; return w * size * (bold ? 1.06 : 1); }
function sanitizeMats(list) {
  return (Array.isArray(list) ? list : []).filter(m => m && isFinite(m.x) && isFinite(m.y) && m.w > 0 && m.h > 0).map(m => ({
    id: m.id, x: Math.round(m.x), y: Math.round(m.y), w: Math.max(60, Math.round(m.w)), h: Math.max(60, Math.round(m.h)),
    col: MAT_COLS.some(c => c[0] === m.col) ? m.col : MAT_COLS[0][0], title: String(m.title || '').slice(0, 80), note: String(m.note || '').slice(0, 600), carry: m.carry !== false }));
}
function matSvg(m) {
  const col = m.col, title = m.title || t('matDefault'), tw = matTabW(m);
  let s = `<g data-mat="${m.id}"><rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="14" fill="${col}" fill-opacity=".12" stroke="${col}" stroke-opacity=".85" stroke-width="2.5" stroke-dasharray="12 7"/>`;
  s += `<path d="M${m.x + 14} ${m.y}V${m.y - MAT_TAB_H + 8}Q${m.x + 14} ${m.y - MAT_TAB_H} ${m.x + 22} ${m.y - MAT_TAB_H}H${m.x + 6 + tw}Q${m.x + 14 + tw} ${m.y - MAT_TAB_H} ${m.x + 14 + tw} ${m.y - MAT_TAB_H + 8}V${m.y}Z" fill="${col}"/>`;
  s += `<text x="${m.x + 26}" y="${m.y - 9}" font-size="13" font-weight="700" fill="#fff" font-family="${FONT_D}">${esc(fitText(title, tw - 20, 13))}</text>`;
  if (m.note) {
    const lines = wrapText(m.note, m.w - 28, 11).slice(0, Math.max(1, Math.floor((m.h - 16) / 15)));
    s += `<text x="${m.x + 14}" y="${m.y + 20}" font-size="11" fill="#eef5f3" fill-opacity=".9" font-family="${FONT_UI}" class="matnote">${lines.map((l, i) => `<tspan x="${m.x + 14}" dy="${i ? 15 : 0}">${esc(l)}</tspan>`).join('')}</text>`;
  }
  return s + '</g>';
}
function fitText(s, w, size) { if (matTextW(s, size, true) <= w) return s; let r = s; while (r.length > 1 && matTextW(r + '…', size, true) > w) r = r.slice(0, -1); return r + '…'; }
function wrapText(s, w, size) {
  const out = [];
  for (const para of String(s).split(/\r?\n/)) {
    let line = '';
    for (const word of para.split(/\s+/)) { const tryL = line ? line + ' ' + word : word; if (matTextW(tryL, size) > w && line) { out.push(line); line = word; } else line = tryL; }
    out.push(line);
  }
  return out;
}
function renderMats() { lyMats.innerHTML = (S.mats || []).map(matSvg).join(''); }
function matTopSvg() {
  if (!sel || sel.k !== 'm') return ''; const m = matById(sel.id); if (!m) return '';
  let s = `<rect x="${m.x - 4}" y="${m.y - 4}" width="${m.w + 8}" height="${m.h + 8}" rx="16" class="selbox"/>`;
  for (const [x, y] of matCorners(m)) s += `<rect x="${x - 7}" y="${y - 7}" width="14" height="14" rx="3" class="mathandle"/>`;
  return s;
}
const matCorners = m => [[m.x, m.y], [m.x + m.w, m.y], [m.x, m.y + m.h], [m.x + m.w, m.y + m.h]];
function hitMatHandle(wx, wy) {
  if (!sel || sel.k !== 'm') return null; const m = matById(sel.id); if (!m) return null; const r = Math.max(8, 10 / view.k);
  const i = matCorners(m).findIndex(([x, y]) => Math.abs(x - wx) < r && Math.abs(y - wy) < r); return i < 0 ? null : { m, corner: i };
}
// mata „łapie się” za zakładkę z nazwą albo za krawędź; środek pozostaje do przesuwania widoku
function hitMat(wx, wy) {
  const tol = Math.max(6, 8 / view.k), list = S.mats || [];
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i], tw = matTabW(m);
    if (wx >= m.x + 14 && wx <= m.x + 14 + tw && wy >= m.y - MAT_TAB_H && wy <= m.y + 2) return m;
    const inOuter = wx >= m.x - tol && wx <= m.x + m.w + tol && wy >= m.y - tol && wy <= m.y + m.h + tol;
    const inInner = wx > m.x + tol && wx < m.x + m.w - tol && wy > m.y + tol && wy < m.y + m.h - tol;
    if (inOuter && !inInner) return m;
  }
  return null;
}
function matContents(m) {
  const inside = c => { const b = worldBox(c), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2; return cx >= m.x && cx <= m.x + m.w && cy >= m.y && cy <= m.y + m.h; };
  return S.comps.filter(inside);
}
function matOf(c) { const list = S.mats || []; for (let i = list.length - 1; i >= 0; i--) if (matContents(list[i]).includes(c)) return list[i]; return null; }
function addMat(x, y, w, h) {
  const m = { id: newId(), x: Math.round(x / 10) * 10, y: Math.round(y / 10) * 10, w: Math.max(60, Math.round(w / 10) * 10), h: Math.max(60, Math.round(h / 10) * 10), col: MAT_COLS[((S.mats || []).length) % MAT_COLS.length][0], title: t('matDefault') + ' ' + ((S.mats || []).length + 1), note: '', carry: true };
  (S.mats = S.mats || []).push(m); return m;
}
function matFit(m) {
  const cs = matContents(m); if (!cs.length) return toast(t('matEmpty'));
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const c of cs) { const b = worldBox(c); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
  pushHist(); const pad = 30, top = m.note ? 20 + Math.min(4, wrapText(m.note, x1 - x0 + 2 * pad - 28, 11).length) * 15 : 0;
  m.x = Math.floor((x0 - pad) / 10) * 10; m.y = Math.floor((y0 - pad - top) / 10) * 10; m.w = Math.ceil((x1 + pad) / 10) * 10 - m.x; m.h = Math.ceil((y1 + pad) / 10) * 10 - m.y; changed();
}
function setMatMode(on) { matMode = on; $('#stage').classList.toggle('matmode', on); $('#btnMat').setAttribute('aria-pressed', String(on)); if (on) toast(t('matHint')); }
$('#btnMat').onclick = () => { if (running) return toast(t('stopToEdit')); setMatMode(!matMode); };
// obsługa wskaźnika (wywoływana z ui.js przed domyślną logiką); zwraca true, gdy zdarzenie zostało obsłużone
function matPointerDown(wx, wy) {
  if (matMode) { pushHist(); const m = addMat(wx, wy, 10, 10); act = { t: 'matnew', m, x0: m.x, y0: m.y, moved: false }; select('m', m.id); return true; }
  const h = hitMatHandle(wx, wy); if (h) { act = { t: 'matrs', m: h.m, corner: h.corner, moved: false, o: { ...h.m } }; return true; }
  return false;
}
function matPointerDownBody(wx, wy) {
  const m = hitMat(wx, wy); if (!m) return false;
  select('m', m.id); act = { t: 'matdrag', m, ox: wx - m.x, oy: wy - m.y, moved: false, carry: m.carry ? matContents(m) : [] }; return true;
}
function matPointerMove(wx, wy) {
  if (!act) return false;
  if (act.t === 'matnew') { const m = act.m, x1 = Math.round(wx / 10) * 10, y1 = Math.round(wy / 10) * 10; m.x = Math.min(act.x0, x1); m.y = Math.min(act.y0, y1); m.w = Math.max(10, Math.abs(x1 - act.x0)); m.h = Math.max(10, Math.abs(y1 - act.y0)); act.moved = true; dirty = true; return true; }
  if (act.t === 'matrs') {
    const m = act.m, o = act.o, x = Math.round(wx / 10) * 10, y = Math.round(wy / 10) * 10; if (!act.moved) { pushHist(); act.moved = true; }
    const left = act.corner === 0 || act.corner === 2, top = act.corner === 0 || act.corner === 1;
    if (left) { m.x = Math.min(x, o.x + o.w - 60); m.w = o.x + o.w - m.x; } else m.w = Math.max(60, x - o.x);
    if (top) { m.y = Math.min(y, o.y + o.h - 60); m.h = o.y + o.h - m.y; } else m.h = Math.max(60, y - o.y);
    dirty = true; return true;
  }
  if (act.t === 'matdrag') {
    const m = act.m, nx = Math.round((wx - act.ox) / G) * G, ny = Math.round((wy - act.oy) / G) * G;
    if (nx !== m.x || ny !== m.y) {
      if (!act.moved) { pushHist(); act.moved = true; }
      const dx = nx - m.x, dy = ny - m.y, set = new Set(act.carry.map(c => c.id)); m.x = nx; m.y = ny;
      for (const c of act.carry) { c.x += dx; c.y += dy; }
      // zagięcia przewodów leżące na macie jadą razem z nią (także przewodów wychodzących poza matę)
      if (set.size) for (const w of S.wires) { const ina = set.has(w.a.c), inb = set.has(w.b.c); if (!ina && !inb) continue;
        w.pts = w.pts.map(p => (ina && inb) || (p[0] >= m.x - dx && p[0] <= m.x - dx + m.w && p[1] >= m.y - dy && p[1] <= m.y - dy + m.h) ? [p[0] + dx, p[1] + dy] : p); }
      if (set.size) CIR = null; dirty = true;
    }
    return true;
  }
  return false;
}
function matPointerUp() {
  if (!act) return false;
  if (act.t === 'matnew') { const m = act.m; if (!act.moved || m.w < 40 || m.h < 40) { m.w = 320; m.h = 220; } else { m.w = Math.max(60, m.w); m.h = Math.max(60, m.h); } setMatMode(false); act = null; changed(); return true; }
  if (act.t === 'matrs' || act.t === 'matdrag') { const mv = act.moved; act = null; if (mv) changed(); return true; }
  return false;
}
function matPropsHtml(m) {
  const n = matContents(m).filter(c => c.type !== 'bb').length;
  return `<div class="ph"><div class="ic"><svg viewBox="0 0 40 40"><rect x="4" y="9" width="32" height="26" rx="5" fill="${m.col}" fill-opacity=".18" stroke="${m.col}" stroke-width="2" stroke-dasharray="5 3"/><rect x="7" y="4" width="18" height="8" rx="2.5" fill="${m.col}"/></svg></div><div><h2>${t('mat')}</h2><div class="sb">${t('matOnIt', { n })}</div></div></div>
  <p class="info">${t('matInfo')}</p>
  <div><span class="lbl">${t('matTitle')}</span><input class="inp" id="matTitle" maxlength="80" value="${esc(m.title)}" placeholder="${esc(t('matDefault'))}"></div>
  <div><span class="lbl">${t('matNote')}</span><textarea class="inp" id="matNote" rows="4" maxlength="600" placeholder="${esc(t('matNotePh'))}">${esc(m.note)}</textarea></div>
  <div><span class="lbl">${t('colour')}</span><div class="sw">${MAT_COLS.map(c => `<button data-mcol="${c[0]}" title="${esc(L(c[1]))}" style="background:${c[0]}" aria-pressed="${c[0] === m.col}"></button>`).join('')}</div></div>
  <label class="sw2"><input type="checkbox" id="matCarry"${m.carry ? ' checked' : ''}><span>${t('matCarry')}</span></label>
  <div class="acts"><button class="btn" data-act="matfit">${t('matFit')}</button><button class="btn" data-act="dup">${t('duplicate')}</button><button class="btn danger" data-act="del">${t('del')}</button></div>`;
}
$('#pbody').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !sel || sel.k !== 'm') return; const m = matById(sel.id); if (!m) return;
  if (b.dataset.mcol) { pushHist(); m.col = b.dataset.mcol; changed(); }
  else if (b.dataset.act === 'matfit') matFit(m);
});
$('#pbody').addEventListener('input', e => {
  if (!sel || sel.k !== 'm') return; const m = matById(sel.id); if (!m) return;
  if (e.target.id === 'matTitle' || e.target.id === 'matNote') {
    if (!m._edit) { pushHist(); m._edit = true; } m[e.target.id === 'matTitle' ? 'title' : 'note'] = e.target.value; dirty = true; saveSoon();
    const sb = $('#projName'); if (sb) { } // nazwa projektu bez zmian
  }
});
$('#pbody').addEventListener('change', e => {
  if (!sel || sel.k !== 'm') return; const m = matById(sel.id); if (!m) return;
  if (e.target.id === 'matCarry') { pushHist(); m.carry = e.target.checked; saveSoon(); }
  if (e.target.id === 'matTitle' || e.target.id === 'matNote') delete m._edit;
});
