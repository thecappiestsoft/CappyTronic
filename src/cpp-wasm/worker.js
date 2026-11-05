/* ===== CappyTronic: wątek programu C++ (WebAssembly) dla płytek ESP32 / ESP8266 / RP2040 =====
   Ten sam protokół wymiany (SharedArrayBuffer + Atomics) co wątek MicroPythona. */
const PYL = NG => { const M = 16; return { WAKE: 0, REQ: 1, SLEEPING: 2, EVH: 3, DIRTY: 4, EVRD: 5, REQLEN: 6, RESPLEN: 7, EXITED: 8,
  MODE: M, PULL: M + NG, OUTV: M + 2 * NG, INV: M + 3 * NG, ADC: M + 4 * NG, IRQ: M + 5 * NG, EVR: M + 6 * NG, EVN: 64,
  T: 0, SLEEPTO: 1, WALL0: 2, PWMF: 8, PWMD: 8 + NG }; };
let I, F, BUF, O, inst = null, mem = null;
const tdec = new TextDecoder(), tenc = new TextEncoder();
let outBuf = [];
function flush() { if (outBuf.length) { postMessage({ t: 'out', s: tdec.decode(new Uint8Array(outBuf)) }); outBuf = []; } }
function outc(c) { outBuf.push(c); if (c === 10 || outBuf.length > 512) flush(); }
function req(s) {
  flush();
  const b = tenc.encode(s); BUF.set(b, 0); I[O.REQLEN] = b.length;
  Atomics.store(I, O.REQ, 1); postMessage({ t: 'req' });
  while (Atomics.load(I, O.REQ) !== 2) Atomics.wait(I, O.REQ, 1, 250);
  const out = BUF.slice(0, I[O.RESPLEN]); Atomics.store(I, O.REQ, 0); return out;
}
const U8 = () => new Uint8Array(mem.buffer), DV = () => new DataView(mem.buffer);
const str = (p, n) => tdec.decode(U8().slice(p, p + n));
function put(bytes, p, max) { const n = Math.min(bytes.length, max); U8().set(bytes.subarray(0, n), p); return n; }
class Exit { constructor(c) { this.code = c; } }
function sleepUntil(t) { flush(); F[O.SLEEPTO] = t; Atomics.store(I, O.SLEEPING, 1); while (Atomics.load(I, O.SLEEPING) === 1) Atomics.wait(I, O.SLEEPING, 1, 250); }
function makeHW(board) {
  const bj = tenc.encode(board);
  return {
    now: () => F[O.T],
    wall: () => F[O.WALL0] + F[O.T],
    sleep_until: t => sleepUntil(t),
    pin_mode: (g, mode, pull) => { I[O.MODE + g] = mode; I[O.PULL + g] = pull; Atomics.store(I, O.DIRTY, 1); },
    pin_set: (g, v) => { I[O.OUTV + g] = v; Atomics.store(I, O.DIRTY, 1); },
    pin_get: g => Atomics.load(I, O.INV + g),
    pin_out: g => I[O.OUTV + g],
    pin_irq: (g, trig) => { I[O.IRQ + g] = trig; },
    pwm: (g, f, d) => { F[O.PWMF + g] = f; F[O.PWMD + g] = d; if (f > 0) I[O.MODE + g] = 10; else { I[O.MODE + g] = 3; I[O.OUTV + g] = 0; } Atomics.store(I, O.DIRTY, 1); },
    adc: g => Atomics.load(I, O.ADC + g),
    events: (p, max) => {
      const h = Atomics.load(I, O.EVH); let r = Atomics.load(I, O.EVRD); if (h === r) return 0;
      if (h - r > O.EVN) r = h - O.EVN; const dv = DV(); let n = 0;
      for (; r < h && n < max; r++, n++) { const v = I[O.EVR + (r % O.EVN)]; dv.setInt32(p + n * 8, v >> 4, true); dv.setInt32(p + n * 8 + 4, v & 15, true); }
      Atomics.store(I, O.EVRD, r); return n;
    },
    req: (qp, qn, op, omax) => put(req(str(qp, qn)), op, omax),
    out: (p, n) => { const b = U8(); for (let i = 0; i < n; i++) outc(b[p + i]); },
    board: (p, max) => put(bj, p, max),
    rx: (p, max) => { const r = JSON.parse(tdec.decode(req('{"op":"rx"}'))); const s = r.d || ''; const b = new Uint8Array(s.length / 2); for (let i = 0; i < b.length; i++) b[i] = parseInt(s.substr(i * 2, 2), 16); return put(b, p, max); },
  };
}
// minimalne WASI: wyjście na port szeregowy, zegary, liczby losowe, uśpienie
function makeWASI() {
  const ENOSYS = 52, EBADF = 8;
  const w = {
    fd_write: (fd, iovs, n, nw) => { const dv = DV(), b = U8(); let tot = 0; for (let i = 0; i < n; i++) { const p = dv.getUint32(iovs + i * 8, true), l = dv.getUint32(iovs + i * 8 + 4, true); if (fd === 1 || fd === 2) for (let k = 0; k < l; k++) outc(b[p + k]); tot += l; } dv.setUint32(nw, tot, true); return 0; },
    fd_read: (fd, iovs, n, nr) => { DV().setUint32(nr, 0, true); return 0; },
    fd_close: () => 0, fd_seek: () => ESPIPE_(), fd_sync: () => 0,
    fd_fdstat_get: (fd, p) => { const dv = DV(); dv.setUint8(p, fd <= 2 ? 2 : 0); dv.setUint16(p + 2, 0, true); dv.setBigUint64(p + 8, 0n, true); dv.setBigUint64(p + 16, 0n, true); return fd <= 2 ? 0 : EBADF; },
    fd_fdstat_set_flags: () => 0, fd_prestat_get: () => EBADF, fd_prestat_dir_name: () => EBADF,
    environ_sizes_get: (c, s) => { const dv = DV(); dv.setUint32(c, 0, true); dv.setUint32(s, 0, true); return 0; }, environ_get: () => 0,
    args_sizes_get: (c, s) => { const dv = DV(); dv.setUint32(c, 0, true); dv.setUint32(s, 0, true); return 0; }, args_get: () => 0,
    clock_time_get: (id, prec, p) => { const t = id === 0 ? (F[O.WALL0] + F[O.T]) : F[O.T]; DV().setBigUint64(p, BigInt(Math.round(t * 1e9)), true); return 0; },
    clock_res_get: (id, p) => { DV().setBigUint64(p, 1000n, true); return 0; },
    random_get: (p, n) => { const b = new Uint8Array(n); crypto.getRandomValues(b); U8().set(b, p); return 0; },
    proc_exit: c => { throw new Exit(c); },
    sched_yield: () => 0,
    poll_oneoff: (inp, out, n, ne) => { const dv = DV(); let t = F[O.T]; for (let i = 0; i < n; i++) { const b = inp + i * 48; if (dv.getUint8(b + 8) === 0) { const to = Number(dv.getBigUint64(b + 24, true)) / 1e9, flags = dv.getUint16(b + 40, true); const tgt = (flags & 1) ? to : F[O.T] + to; if (tgt > t) t = tgt; } } sleepUntil(t); for (let i = 0; i < n; i++) { const b = inp + i * 48, e = out + i * 32; dv.setBigUint64(e, dv.getBigUint64(b, true), true); dv.setUint16(e + 8, 0, true); dv.setUint8(e + 10, dv.getUint8(b + 8)); } dv.setUint32(ne, n, true); return 0; },
  };
  function ESPIPE_() { return 70; }
  return new Proxy(w, { get: (o, k) => o[k] || (() => ENOSYS) });
}
self.onmessage = async (ev) => {
  const m = ev.data; if (m.t !== 'start') return;
  O = PYL(m.ng); I = new Int32Array(m.sab, 0, 1024); F = new Float64Array(m.sab, 4096, 512); BUF = new Uint8Array(m.sab, 8192);
  let bytes; try { bytes = Uint8Array.from(atob(m.wasm), c => c.charCodeAt(0)); } catch (e) { postMessage({ t: 'fatal', s: 'bad program' }); return; }
  try {
    const r = await WebAssembly.instantiate(bytes, { hw: makeHW(m.board), wasi_snapshot_preview1: makeWASI() });
    inst = r.instance; mem = inst.exports.memory;
  } catch (e) { postMessage({ t: 'fatal', s: String(e && e.message || e) }); return; }
  postMessage({ t: 'ready' });
  try { inst.exports._start(); }
  catch (e) {
    flush();
    if (!(e instanceof Exit)) {
      const msg = String(e && e.message || e);
      const kind = /unreachable/.test(msg) ? 'abort' : /out of bounds/.test(msg) ? 'oob' : /stack/i.test(msg) ? 'stack' : /divide by zero|integer divide/i.test(msg) ? 'div0' : 'other';
      postMessage({ t: 'exc', s: msg, cpp: kind });
    }
  }
  flush(); Atomics.store(I, O.EXITED, 1); postMessage({ t: 'exit' });
};
