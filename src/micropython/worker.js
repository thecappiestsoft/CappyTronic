
/* ===== CappyTronic: wątek MicroPythona (doklejany za micropython.mjs) ===== */
const PYL = NG => { const M = 16; return { WAKE: 0, REQ: 1, SLEEPING: 2, EVH: 3, DIRTY: 4, EVRD: 5, REQLEN: 6, RESPLEN: 7, EXITED: 8,
  MODE: M, PULL: M + NG, OUTV: M + 2 * NG, INV: M + 3 * NG, ADC: M + 4 * NG, IRQ: M + 5 * NG, EVR: M + 6 * NG, EVN: 64,
  T: 0, SLEEPTO: 1, WALL0: 2, PWMF: 8, PWMD: 8 + NG }; };
let I, F, BUF, O, mp = null;
const tdec = new TextDecoder(), tenc = new TextEncoder();
let outBuf = [];
function flush() { if (outBuf.length) { postMessage({ t: 'out', s: tdec.decode(new Uint8Array(outBuf)) }); outBuf = []; } }
function outc(c) { outBuf.push(c); if (c === 10 || outBuf.length > 512) flush(); }
function req(s) {
  flush();
  const b = tenc.encode(s); BUF.set(b, 0); I[O.REQLEN] = b.length;
  Atomics.store(I, O.REQ, 1); postMessage({ t: 'req' });
  while (Atomics.load(I, O.REQ) !== 2) Atomics.wait(I, O.REQ, 1, 250);
  const out = tdec.decode(BUF.slice(0, I[O.RESPLEN])); Atomics.store(I, O.REQ, 0); return out;
}
const pad2 = n => n;
function ltime(secs, local) {
  const ms = (secs < 0 ? (F[O.WALL0] + F[O.T]) : secs) * 1000; const d = new Date(ms);
  const g = local ? ['getFullYear', 'getMonth', 'getDate', 'getHours', 'getMinutes', 'getSeconds', 'getDay'] : ['getUTCFullYear', 'getUTCMonth', 'getUTCDate', 'getUTCHours', 'getUTCMinutes', 'getUTCSeconds', 'getUTCDay'];
  const y = d[g[0]](), mo = d[g[1]](), dd = d[g[2]]();
  const yd = Math.round((Date.UTC(y, mo, dd) - Date.UTC(y, 0, 1)) / 864e5) + 1;
  return [y, mo + 1, dd, d[g[3]](), d[g[4]](), d[g[5]](), (d[g[6]]() + 6) % 7, yd].join(',');
}
function makeHW(board) {
  return {
    board: () => board,
    now: () => F[O.T],
    wall: () => F[O.WALL0] + F[O.T],
    localtime: (secs, local) => ltime(secs, local),
    mktime: (y, mo, d, h, mi, s) => new Date(y, mo - 1, d, h, mi, s).getTime() / 1000,
    set_wall: (y, mo, d, h, mi, s) => { F[O.WALL0] = new Date(y, mo - 1, d, h, mi, s).getTime() / 1000 - F[O.T]; return 0; },
    sleep_until: (t) => {
      flush(); F[O.SLEEPTO] = t; Atomics.store(I, O.SLEEPING, 1);
      while (Atomics.load(I, O.SLEEPING) === 1) Atomics.wait(I, O.SLEEPING, 1, 250);
      return 0;
    },
    evpending: () => (Atomics.load(I, O.EVH) !== Atomics.load(I, O.EVRD) ? 1 : 0),
    events: () => {
      const h = Atomics.load(I, O.EVH); let r = Atomics.load(I, O.EVRD); if (h === r) return '';
      if (h - r > O.EVN) r = h - O.EVN;
      const out = []; for (; r < h; r++) { const v = I[O.EVR + (r % O.EVN)]; out.push((v >> 4) + ':' + (v & 15)); }
      Atomics.store(I, O.EVRD, h); return out.join(',');
    },
    pin_mode: (g, mode, pull) => { I[O.MODE + g] = mode; I[O.PULL + g] = pull; Atomics.store(I, O.DIRTY, 1); return 0; },
    pin_mode_get: g => I[O.MODE + g],
    pin_pull_get: g => I[O.PULL + g],
    pin_set: (g, v) => { I[O.OUTV + g] = v; Atomics.store(I, O.DIRTY, 1); return 0; },
    pin_out: g => I[O.OUTV + g],
    pin_get: g => Atomics.load(I, O.INV + g),
    pin_irq: (g, trig) => { I[O.IRQ + g] = trig; return 0; },
    pwm: (g, f, d) => { F[O.PWMF + g] = f; F[O.PWMD + g] = d; if (f > 0) I[O.MODE + g] = 10; else { I[O.MODE + g] = 3; I[O.OUTV + g] = 0; } Atomics.store(I, O.DIRTY, 1); return 0; },
    adc: g => Atomics.load(I, O.ADC + g),
    req: s => req(s),
    exc: s => { flush(); postMessage({ t: 'exc', s }); return 0; },
  };
}
let stdinBuf = [];
self.onmessage = async (ev) => {
  const m = ev.data; if (m.t !== 'start') return;
  O = PYL(m.ng); I = new Int32Array(m.sab, 0, 1024); F = new Float64Array(m.sab, 4096, 512); BUF = new Uint8Array(m.sab, 8192);
  try {
    mp = await loadMicroPython({ url: m.wasmUrl, heapsize: 2 * 1024 * 1024, linebuffer: false,
      stdout: u => outc(u[0]), stderr: u => outc(u[0]),
      stdin: () => { if (!stdinBuf.length) { const r = JSON.parse(req('{"op":"stdin"}')); stdinBuf = Array.from(tenc.encode(r.s || '\n')); } return stdinBuf.shift(); } });
  } catch (e) { postMessage({ t: 'fatal', s: String(e && e.message || e) }); return; }
  mp.registerJsModule('_hw', makeHW(m.board));
  const mk = p => { const parts = p.split('/').filter(Boolean); let cur = ''; for (const x of parts) { cur += '/' + x; try { mp.FS.mkdir(cur); } catch (e) { } } };
  for (const [p, src] of m.files) { mk(p.slice(0, p.lastIndexOf('/'))); mp.FS.writeFile(p, src); }
  mp.FS.writeFile('/main.py', m.code);
  postMessage({ t: 'ready' });
  try { mp.runPython('import _boot'); } catch (e) { flush(); postMessage({ t: 'exc', s: String(e && e.message || e) }); }
  flush(); Atomics.store(I, O.EXITED, 1); postMessage({ t: 'exit' });
};
