'use strict';
/* ================= Wgrywanie programu do prawdziwego urządzenia przez USB (port szeregowy) =================
   Korzysta z Web Serial API (w aplikacji Electron i w przeglądarkach Chrome/Edge). Obsługiwane metody:
   • STK500v1  – Arduino Uno, Nano, ATmega328P z bootloaderem Optiboot (oraz stary bootloader Nano 57600 bd),
   • STK500v1 + polecenia ISP – ATtiny85 przez „Arduino as ISP” (szkic ArduinoISP na drugim Arduino),
   • STK500v2  – Arduino Mega 2560,
   • bootloader UART STM32 (AN3155) – Blue Pill przez konwerter USB-UART (BOOT0 = 1),
   • surowy REPL MicroPythona – zapis main.py na ESP32 / ESP8266 / Pico W z wgranym MicroPythonem.
   Protokoły działają na abstrakcyjnym „łączu” (open/close/write/read), dzięki czemu da się je testować bez sprzętu. */

/* ---------- łącze szeregowe (Web Serial) ---------- */
class SerialLink {
  constructor(port) { this.port = port; this.buf = []; this.waiters = []; this.reader = null; this.closed = false; }
  async open(opts) {
    await this.port.open(Object.assign({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', bufferSize: 4096 }, opts));
    this.closed = false; this.pump();
  }
  async pump() {
    while (!this.closed && this.port.readable) {
      this.reader = this.port.readable.getReader();
      try { for (; ;) { const { value, done } = await this.reader.read(); if (done) break; if (value) { for (const b of value) this.buf.push(b); this.wake(); } } }
      catch (e) { /* port zamknięty albo odłączony */ }
      finally { try { this.reader.releaseLock(); } catch (e) { } }
      if (this.closed) break;
    }
  }
  wake() { const w = this.waiters; this.waiters = []; for (const f of w) f(); }
  async write(bytes) { const w = this.port.writable.getWriter(); try { await w.write(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)); } finally { w.releaseLock(); } }
  async setSignals(s) { if (this.port.setSignals) await this.port.setSignals(s); }
  drain() { this.buf.length = 0; }
  // czeka na n bajtów (albo zgłasza błąd po czasie ms)
  async read(n, ms) {
    const until = performance.now() + (ms || 1000);
    while (this.buf.length < n) {
      const left = until - performance.now(); if (left <= 0) throw new UploadError('timeout');
      await new Promise(r => { const t = setTimeout(r, left); this.waiters.push(() => { clearTimeout(t); r(); }); });
    }
    return this.buf.splice(0, n);
  }
  // czeka na tekst kończący się podanym ciągiem
  async readUntil(str, ms) {
    const pat = Array.from(new TextEncoder().encode(str)), until = performance.now() + (ms || 2000);
    for (; ;) {
      const i = indexOfSeq(this.buf, pat); if (i >= 0) return this.buf.splice(0, i + pat.length);
      const left = until - performance.now(); if (left <= 0) throw new UploadError('timeout');
      await new Promise(r => { const t = setTimeout(r, left); this.waiters.push(() => { clearTimeout(t); r(); }); });
    }
  }
  async close() { this.closed = true; try { if (this.reader) await this.reader.cancel(); } catch (e) { } try { await this.port.close(); } catch (e) { } }
}
class UploadError extends Error { constructor(code, extra) { super(code); this.code = code; this.extra = extra; } }
const sleep = ms => new Promise(r => setTimeout(r, ms));
function indexOfSeq(a, p) { outer: for (let i = 0; i + p.length <= a.length; i++) { for (let k = 0; k < p.length; k++) if (a[i + k] !== p[k]) continue outer; return i; } return -1; }
// obraz pamięci z pliku Intel HEX: [bajty, najwyższy adres + 1] w zadanym zakresie
function hexImage(hex, base, size) {
  const m = parseIntelHex(hex), img = new Uint8Array(size).fill(0xFF); let top = 0;
  for (const [a, v] of m) { const o = a - base; if (o >= 0 && o < size) { img[o] = v; if (o + 1 > top) top = o + 1; } }
  return { img, top };
}

/* ---------- STK500v1 (Optiboot, ArduinoISP) ---------- */
const STK = { OK: 0x10, INSYNC: 0x14, CRC_EOP: 0x20, GET_SYNC: 0x30, SET_DEVICE: 0x42, SET_DEVICE_EXT: 0x45, ENTER: 0x50, LEAVE: 0x51, LOAD_ADDR: 0x55, UNIVERSAL: 0x56, PROG_PAGE: 0x64, READ_PAGE: 0x74, READ_SIGN: 0x75 };
async function stkCmd(L, bytes, nResp, ms) {
  await L.write([...bytes, STK.CRC_EOP]);
  const h = await L.read(1, ms || 1000); if (h[0] !== STK.INSYNC) throw new UploadError('nosync');
  const data = nResp ? await L.read(nResp, ms || 1000) : [];
  const t = await L.read(1, ms || 1000); if (t[0] !== STK.OK) throw new UploadError('nosync');
  return data;
}
async function stkSync(L, log, tries) {
  for (let i = 0; i < (tries || 10); i++) {
    L.drain(); await L.write([STK.GET_SYNC, STK.CRC_EOP]);
    try { const r = await L.read(2, 250); if (r[0] === STK.INSYNC && r[1] === STK.OK) { await sleep(20); L.drain(); return; } } catch (e) { }
  }
  throw new UploadError('nosync');
}
async function arduinoReset(L) { await L.setSignals({ dataTerminalReady: false, requestToSend: false }); await sleep(250); await L.setSignals({ dataTerminalReady: true, requestToSend: true }); await sleep(50); L.drain(); }
async function uploadStk500v1(L, hex, o, ui) {
  const { img, top } = hexImage(hex, 0, o.flash); const page = o.page;
  if (!top) throw new UploadError('empty');
  ui.step(t('upReset')); if (o.isp) await sleep(2000); else await arduinoReset(L); // ArduinoISP: otwarcie portu i tak resetuje płytkę-programator
  ui.step(t('upSync')); await stkSync(L, ui, o.isp ? 12 : 12);
  if (o.isp) { // ArduinoISP: parametry układu, wejście w programowanie przez ISP, kasowanie
    const p = new Array(20).fill(0); p[0] = 0x86; p[2] = 1; p[3] = 1; p[4] = 1; p[5] = 1; p[6] = 3; p[7] = 0xFF; p[8] = 0xFF; p[9] = 0xFF; p[10] = 0xFF; p[11] = 0; p[12] = page; p[13] = 0; p[14] = 4; p[15] = 0; p[16] = 0; p[17] = (o.flash >> 16) & 255; p[18] = (o.flash >> 8) & 255; p[19] = o.flash & 255;
    await stkCmd(L, [STK.SET_DEVICE, ...p]); await stkCmd(L, [STK.SET_DEVICE_EXT, 5, 4, 0xD7, 0xC2, 0]);
  }
  await stkCmd(L, [STK.ENTER], 0, 2000);
  const sig = await stkCmd(L, [STK.READ_SIGN], 3);
  ui.log(t('upSig', { s: sig.map(x => x.toString(16).padStart(2, '0').toUpperCase()).join(' ') }));
  if (o.sig && sig.join() !== o.sig.join()) { await stkCmd(L, [STK.LEAVE]).catch(() => { }); throw new UploadError('badsig', sig.map(x => x.toString(16).padStart(2, '0')).join(' ')); }
  if (o.isp) { await stkCmd(L, [STK.UNIVERSAL, 0xAC, 0x80, 0x00, 0x00], 1, 2000); await sleep(30); }
  const pages = Math.ceil(top / page);
  for (let i = 0; i < pages; i++) {
    const a = i * page; await stkCmd(L, [STK.LOAD_ADDR, (a >> 1) & 255, (a >> 9) & 255]);
    await stkCmd(L, [STK.PROG_PAGE, page >> 8, page & 255, 0x46, ...img.subarray(a, a + page)], 0, 2000);
    ui.progress((i + 1) / pages * 0.6, t('upWrite'));
  }
  for (let i = 0; i < pages; i++) {
    const a = i * page; await stkCmd(L, [STK.LOAD_ADDR, (a >> 1) & 255, (a >> 9) & 255]);
    const d = await stkCmd(L, [STK.READ_PAGE, page >> 8, page & 255, 0x46], page, 2000);
    for (let k = 0; k < page; k++) if (d[k] !== img[a + k]) throw new UploadError('verify', '0x' + (a + k).toString(16));
    ui.progress(0.6 + (i + 1) / pages * 0.4, t('upVerify'));
  }
  await stkCmd(L, [STK.LEAVE]);
  return { bytes: top };
}

/* ---------- STK500v2 (Arduino Mega 2560) ---------- */
async function stk2(L, st, body, ms) {
  const seq = st.seq = (st.seq + 1) & 255, n = body.length, msg = [0x1B, seq, n >> 8, n & 255, 0x0E, ...body];
  msg.push(msg.reduce((x, y) => x ^ y, 0)); await L.write(msg);
  const h = await L.read(5, ms || 1000); if (h[0] !== 0x1B || h[4] !== 0x0E) throw new UploadError('nosync');
  const len = (h[2] << 8) | h[3]; const rest = await L.read(len + 1, ms || 1000);
  const cs = [...h, ...rest].reduce((x, y) => x ^ y, 0); if (cs !== 0) throw new UploadError('nosync');
  const ans = rest.slice(0, len); if (ans[0] !== body[0] || ans[1] !== 0x00) throw new UploadError('nosync');
  return ans;
}
async function uploadStk500v2(L, hex, o, ui) {
  const { img, top } = hexImage(hex, 0, o.flash); const page = 256, st = { seq: 0 };
  if (!top) throw new UploadError('empty');
  ui.step(t('upReset')); await arduinoReset(L);
  ui.step(t('upSync')); let ok = false;
  for (let i = 0; i < 10 && !ok; i++) { try { L.drain(); await stk2(L, st, [0x01], 300); ok = true; } catch (e) { await sleep(50); } }
  if (!ok) throw new UploadError('nosync');
  await stk2(L, st, [0x10, 200, 100, 25, 32, 0, 0x53, 3, 0xAC, 0x53, 0, 0], 2000);
  const sig = []; for (let i = 0; i < 3; i++) sig.push((await stk2(L, st, [0x1B, 4, 0x30, 0, i, 0]))[2]);
  ui.log(t('upSig', { s: sig.map(x => x.toString(16).padStart(2, '0').toUpperCase()).join(' ') }));
  if (o.sig && sig.join() !== o.sig.join()) throw new UploadError('badsig', sig.map(x => x.toString(16).padStart(2, '0')).join(' '));
  const pages = Math.ceil(top / page), addr = a => { const w = a >> 1; return [0x06, ((w >> 24) & 255) | (a >= 0x20000 ? 0x80 : 0), (w >> 16) & 255, (w >> 8) & 255, w & 255]; };
  for (let i = 0; i < pages; i++) { const a = i * page; await stk2(L, st, addr(a)); await stk2(L, st, [0x13, page >> 8, page & 255, 0xC1, 10, 0x40, 0x4C, 0x20, 0, 0, ...img.subarray(a, a + page)], 2000); ui.progress((i + 1) / pages * 0.6, t('upWrite')); }
  for (let i = 0; i < pages; i++) { const a = i * page; await stk2(L, st, addr(a)); const d = await stk2(L, st, [0x14, page >> 8, page & 255, 0x20], 2000); for (let k = 0; k < page; k++) if (d[2 + k] !== img[a + k]) throw new UploadError('verify', '0x' + (a + k).toString(16)); ui.progress(0.6 + (i + 1) / pages * 0.4, t('upVerify')); }
  await stk2(L, st, [0x11, 1, 1]);
  return { bytes: top };
}

/* ---------- bootloader UART STM32 (AN3155) ---------- */
const ACK = 0x79, NACK = 0x1F;
async function stmAck(L, ms) { const r = await L.read(1, ms || 1000); if (r[0] === ACK) return; if (r[0] === NACK) throw new UploadError('nack'); throw new UploadError('nosync'); }
const xor = a => a.reduce((x, y) => x ^ y, 0);
async function stmCmd(L, c, ms) { await L.write([c, c ^ 0xFF]); await stmAck(L, ms); }
async function stmAddr(L, a) { const b = [(a >>> 24) & 255, (a >>> 16) & 255, (a >>> 8) & 255, a & 255]; await L.write([...b, xor(b)]); await stmAck(L); }
async function uploadStm32(L, hex, o, ui) {
  const base = 0x08000000, { img, top } = hexImage(hex, base, o.flash);
  if (!top) throw new UploadError('empty');
  ui.step(t('upSync')); let ok = false;
  for (let i = 0; i < 6 && !ok; i++) { L.drain(); await L.write([0x7F]); try { const r = await L.read(1, 300); if (r[0] === ACK || r[0] === NACK) ok = true; } catch (e) { } }
  if (!ok) throw new UploadError('stmboot');
  await stmCmd(L, 0x00); const n = (await L.read(1))[0]; const info = await L.read(n + 1); await stmAck(L);
  const cmds = info.slice(1); ui.log(t('upStmBl', { v: (info[0] >> 4) + '.' + (info[0] & 15) }));
  await stmCmd(L, 0x02); const m = (await L.read(1))[0]; const pid = await L.read(m + 1); await stmAck(L);
  const id = (pid[0] << 8) | pid[1]; ui.log(t('upSig', { s: '0x' + id.toString(16).padStart(4, '0') + (id === 0x410 ? ' (STM32F103 medium-density)' : '') }));
  ui.step(t('upErase'));
  if (cmds.includes(0x44)) { await stmCmd(L, 0x44); await L.write([0xFF, 0xFF, 0x00]); await stmAck(L, 30000); }
  else { await stmCmd(L, 0x43); await L.write([0xFF, 0x00]); await stmAck(L, 30000); }
  const len = (top + 3) & ~3, chunks = Math.ceil(len / 256);
  for (let i = 0; i < chunks; i++) {
    const a = i * 256, n2 = Math.min(256, len - a), d = Array.from(img.subarray(a, a + n2));
    await stmCmd(L, 0x31); await stmAddr(L, base + a); await L.write([n2 - 1, ...d, xor([n2 - 1, ...d])]); await stmAck(L, 2000);
    ui.progress((i + 1) / chunks * 0.6, t('upWrite'));
  }
  for (let i = 0; i < chunks; i++) {
    const a = i * 256, n2 = Math.min(256, len - a);
    await stmCmd(L, 0x11); await stmAddr(L, base + a); await L.write([n2 - 1, (n2 - 1) ^ 0xFF]); await stmAck(L); const d = await L.read(n2, 2000);
    for (let k = 0; k < n2; k++) if (d[k] !== img[a + k]) throw new UploadError('verify', '0x' + (base + a + k).toString(16));
    ui.progress(0.6 + (i + 1) / chunks * 0.4, t('upVerify'));
  }
  await stmCmd(L, 0x21); await stmAddr(L, base);
  return { bytes: top };
}

/* ---------- MicroPython: surowy REPL, zapis main.py ---------- */
// sterowniki napisane w czystym Pythonie, których nie ma we wbudowanym oprogramowaniu płytek – wgrywamy je razem z programem
const MP_DRIVERS = ['ssd1306', 'sh1106', 'i2c_lcd', 'lcd_api'];
async function mpExec(L, code, ms) {
  await L.write(new TextEncoder().encode(code)); await L.write([0x04]);
  const ok = await L.read(2, ms || 3000); if (String.fromCharCode(...ok) !== 'OK') throw new UploadError('mprepl');
  const out = await L.readUntil('\x04', ms || 5000); const err = await L.readUntil('\x04', ms || 5000); await L.readUntil('>', ms || 2000);
  const e = new TextDecoder().decode(new Uint8Array(err.slice(0, -1))).trim();
  if (e) throw new UploadError('mperr', e.split('\n').slice(-1)[0]);
  return new TextDecoder().decode(new Uint8Array(out.slice(0, -1)));
}
async function mpWriteFile(L, name, text, ui, p0, p1) {
  const data = new TextEncoder().encode(text);
  await mpExec(L, `f=open(${JSON.stringify(name)},'wb')\nw=f.write`);
  const CH = 192;
  for (let i = 0; i < data.length; i += CH) {
    const part = Array.from(data.subarray(i, i + CH)).map(b => '\\x' + b.toString(16).padStart(2, '0')).join('');
    await mpExec(L, `w(b'${part}')`);
    ui.progress(p0 + (p1 - p0) * Math.min(1, (i + CH) / data.length), t('upWrite'));
  }
  await mpExec(L, 'f.close()');
}
async function uploadMicroPython(L, code, o, ui) {
  ui.step(t('upMpStop'));
  await L.write([0x0D, 0x03, 0x03]); await sleep(200); L.drain();
  await L.write([0x0D, 0x01]);
  try { await L.readUntil('raw REPL; CTRL-B to exit\r\n>', 3000); } catch (e) { throw new UploadError('mprepl'); }
  const ver = (await mpExec(L, 'import sys\nprint(sys.implementation.name, sys.platform)')).trim();
  ui.log(t('upMpBoard', { v: ver }));
  const used = MP_DRIVERS.filter(m => new RegExp('^\\s*(from\\s+' + m + '\\s+import|import\\s+.*\\b' + m + '\\b)', 'm').test(code));
  const files = used.map(m => (PY_FILES.find(f => f[0] === '/lib/' + m + '.py') || [])[1]).filter(Boolean);
  const total = files.length + 1;
  for (let i = 0; i < files.length; i++) { ui.log(t('upMpLib', { f: used[i] + '.py' })); await mpWriteFile(L, used[i] + '.py', files[i], ui, i / total, (i + 1) / total); }
  await mpWriteFile(L, 'main.py', code, ui, files.length / total, 1);
  await L.write([0x02]); await sleep(100); await L.write([0x04]); // wyjście z surowego REPL i miękki reset – start main.py
  return { bytes: new TextEncoder().encode(code).length };
}

/* ---------- metody dla poszczególnych płytek ---------- */
function uploadMethod(c) {
  const P = PARTS[c.type];
  if (P.py) return c.props.lang === 'cpp' ? { kind: 'none', why: 'upCppSim' } : { kind: 'mpy', baud: 115200, info: c.type === 'picow' ? 'upInfoPico' : 'upInfoMpy' };
  switch (c.type) {
    case 'ard_uno': return { kind: 'stk1', baud: 115200, flash: 0x7E00, page: 128, sig: [0x1E, 0x95, 0x0F], info: 'upInfoUno' };
    case 'ard_nano': return { kind: 'stk1', baud: 115200, alt: 57600, flash: 0x7800, page: 128, sig: [0x1E, 0x95, 0x0F], info: 'upInfoNano' };
    case 'mcu_m328p': return { kind: 'stk1', baud: 115200, flash: 0x7E00, page: 128, sig: [0x1E, 0x95, 0x0F], info: 'upInfoM328' };
    case 'ard_mega': return { kind: 'stk2', baud: 115200, flash: 0x3E000, sig: [0x1E, 0x98, 0x01], info: 'upInfoMega' };
    case 'mcu_t85': return { kind: 'stk1', isp: true, baud: 19200, flash: 0x2000, page: 64, sig: [0x1E, 0x93, 0x0B], info: 'upInfoT85' };
    case 'mcu_bluepill': return { kind: 'stm32', baud: 115200, parity: 'even', flash: 0x10000, info: 'upInfoStm' };
  }
  if (P.asm) return { kind: 'none', why: 'upPicNo' };
  return { kind: 'none', why: 'upNoMethod' };
}
async function runUpload(port, c, m, ui, baud) {
  const L = new SerialLink(port);
  await L.open({ baudRate: baud || m.baud, parity: m.parity || 'none' });
  try {
    if (m.kind === 'stk1') return await uploadStk500v1(L, c.props.hex, m, ui);
    if (m.kind === 'stk2') return await uploadStk500v2(L, c.props.hex, m, ui);
    if (m.kind === 'stm32') return await uploadStm32(L, c.props.hex, m, ui);
    if (m.kind === 'mpy') return await uploadMicroPython(L, c.props.code || '', m, ui);
    throw new UploadError('nomethod');
  } finally { await L.close(); }
}

/* ---------- okno „Wgraj do urządzenia” ---------- */
let UP = null;
function openUpload() {
  const c = codeComp; if (!c) return;
  const m = uploadMethod(c), P = PARTS[c.type], hasSerial = typeof navigator !== 'undefined' && !!navigator.serial;
  UP = { c, m, busy: false };
  const opts = m.alt ? `<label class="upopt">${t('upBoot')} <select id="upBaud"><option value="${m.baud}">${t('upBootNew', { b: m.baud })}</option><option value="${m.alt}">${t('upBootOld', { b: m.alt })}</option></select></label>` : '';
  const canHex = c.props.hex && (P.asm || P.target || P.cpp === 'stm');
  $('#upBody').innerHTML = `<p><b>${esc(L(P.name))}</b></p>` +
    (m.kind === 'none' ? `<p class="imp-warn">${esc(t(m.why))}</p>` : !hasSerial ? `<p class="imp-warn">${esc(t('upNoSerial'))}</p>` : `<p class="hint">${esc(t(m.info))}</p>${opts}
      <div id="upPorts" class="upports" hidden></div>
      <div class="upbar"><div id="upFill"></div></div><div id="upStep" class="hint"></div><pre id="upLog" class="uplog"></pre>`);
  $('#upGo').hidden = m.kind === 'none' || !hasSerial; $('#upGo').disabled = false;
  $('#upHex').hidden = !canHex;
  $('#upModal').hidden = false;
}
function upUi() {
  return {
    step: s => { const e = $('#upStep'); if (e) e.textContent = s; upLog(s); },
    log: s => upLog(s),
    progress: (f, s) => { const e = $('#upFill'); if (e) e.style.width = Math.round(f * 100) + '%'; const st = $('#upStep'); if (st && s) st.textContent = s + ' ' + Math.round(f * 100) + '%'; },
  };
}
function upLog(s) { const e = $('#upLog'); if (e) { e.textContent += s + '\n'; e.scrollTop = e.scrollHeight; } }
async function upEnsureBuilt(c) {
  const P = PARTS[c.type];
  if (P.py) return true;
  if (c.props.hex && c.props.hexCode === c.props.code) return true;
  upLog(t('upCompiling')); await doCompile();
  return !!(c.props.hex && c.props.hexCode === c.props.code);
}
async function upStart() {
  if (!UP || UP.busy) return; const { c, m } = UP; UP.busy = true; $('#upGo').disabled = true;
  const ui = upUi();
  try {
    ui.step(t('upPickPort'));
    const port = await navigator.serial.requestPort({}); // najpierw port – wybór musi nastąpić zaraz po kliknięciu
    if (!(await upEnsureBuilt(c))) throw new UploadError('nobuild');
    const baud = $('#upBaud') ? +$('#upBaud').value : m.baud;
    const r = await runUpload(port, c, m, ui, baud);
    ui.progress(1, ''); ui.step(t('upDone', { n: r.bytes })); toast(t('upDone', { n: r.bytes }));
  } catch (e) {
    const code = e instanceof UploadError ? e.code : e && e.name === 'NotFoundError' ? 'noport' : e && (e.name === 'NetworkError' || e.name === 'InvalidStateError') ? 'busy' : 'other';
    ui.step(t('upErr_' + code, { x: e && e.extra || '' }) + (code === 'other' ? ' ' + (e && e.message || e) : ''));
  } finally { UP.busy = false; const g = $('#upGo'); if (g) g.disabled = false; const pp = $('#upPorts'); if (pp) pp.hidden = true; }
}
// w aplikacji Electron listę portów podaje proces główny – pokazujemy ją w oknie i odsyłamy wybór
if (typeof window !== 'undefined' && window.cappyNative && window.cappyNative.onSerialPorts) {
  window.cappyNative.onSerialPorts(list => {
    const box = $('#upPorts'); if (!box) { window.cappyNative.serialChoose(''); return; }
    box.hidden = false;
    box.innerHTML = list.length ? `<p class="hint">${esc(t('upChoose'))}</p>` + list.map(p => `<button class="btn upport" data-id="${esc(p.portId)}">${esc(p.displayName || p.portName)}<small>${esc(p.portName)}${p.vendorId ? ' · VID ' + (+p.vendorId).toString(16).padStart(4, '0') + ':' + (+p.productId).toString(16).padStart(4, '0') : ''}</small></button>`).join('') + `<button class="btn" data-id="">${esc(t('cancel'))}</button>`
      : `<p class="imp-warn">${esc(t('upNoPorts'))}</p><button class="btn" data-id="">${esc(t('close'))}</button>`;
    box.querySelectorAll('button').forEach(b => b.onclick = () => { box.hidden = true; window.cappyNative.serialChoose(b.dataset.id); });
  });
}
if (typeof document !== 'undefined' && $('#upModal')) {
  $('#upGo').onclick = upStart;
  $('#upClose').onclick = () => { if (UP && UP.busy) return; $('#upModal').hidden = true; };
  $('#upHex').onclick = () => { const c = UP && UP.c; if (c && c.props.hex) saveData((S.name || 'program').replace(/[\\/:*?"<>|]/g, '_') + '.hex', c.props.hex, 'hex', 'text/plain'); };
}
