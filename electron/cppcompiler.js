// Kompilacja programów C++ (Arduino) dla płytek ESP32 / ESP8266 / RP2040 do WebAssembly (clang z wasi-sdk), offline.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { preprocess } = require('./compiler.js');

function run(cmd, args, opts) {
  return new Promise(res => {
    let p; try { p = spawn(cmd, args, Object.assign({ windowsHide: true }, opts)); } catch (e) { return res({ code: -1, out: String(e) }); }
    let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
    p.on('error', e => res({ code: -1, out: out + String(e) }));
    p.on('close', code => res({ code, out }));
  });
}
function parseDiagnostics(log) {
  const diags = []; const re = /sketch\.ino:(\d+):(?:(\d+):)?\s*(fatal error|error|warning):\s*(.*)/g; let m;
  while ((m = re.exec(log))) diags.push({ line: +m[1], col: +(m[2] || 1), type: m[3] === 'fatal error' ? 'error' : m[3], msg: m[4] });
  if (!diags.some(d => d.type === 'error')) {
    const u = log.match(/undefined symbol: ([^\n]+)/); if (u) diags.push({ line: 0, col: 0, type: 'error', msg: 'undefined reference to ' + u[1].trim(), link: true });
    else if (/error/.test(log)) diags.push({ line: 0, col: 0, type: 'error', msg: log.split('\n').find(l => /error/.test(l)) || log.slice(0, 300), link: true });
  }
  return diags;
}
function makeCppCompiler({ clangBin, cppDir, tmpBase }) {
  const exe = n => path.join(clangBin, n + (process.platform === 'win32' ? '.exe' : ''));
  const libsrc = path.join(cppDir, 'libsrc');
  const libIncs = () => fs.existsSync(libsrc) ? fs.readdirSync(libsrc).flatMap(l => { const d = path.join(libsrc, l); const out = [d]; for (const s of ['src', 'utility']) if (fs.existsSync(path.join(d, s))) out.push(path.join(d, s)); return out; }) : [];
  return async function compile({ code, board }) {
    const bdir = path.join(cppDir, String(board || '').replace(/[^a-z0-9_]/gi, ''));
    if (!board || !fs.existsSync(path.join(bdir, 'libct.a'))) return { ok: false, diags: [{ line: 0, col: 0, type: 'error', msg: 'unknown board ' + board }], log: '' };
    const dir = fs.mkdtempSync(path.join(tmpBase || os.tmpdir(), 'cappycpp-'));
    try {
      const cpp = path.join(dir, 'sketch.cpp'), wasm = path.join(dir, 'sketch.wasm');
      fs.writeFileSync(cpp, preprocess(code));
      const incs = [bdir, path.join(cppDir, 'core'), ...libIncs()].map(d => '-I' + d);
      const r = await run(exe('clang++'), ['--target=wasm32-wasip1', '-O2', '-g0', '-std=gnu++17', '-fno-exceptions', '-fno-rtti', '-Wall', '-Wno-unused-variable', '-Wno-unused-function', '-Wno-unused-but-set-variable',
        ...incs, cpp, path.join(bdir, 'libct.a'), '-o', wasm, '-Wl,--gc-sections', '-Wl,--strip-all', '-Wl,-z,stack-size=262144', '-Wl,--initial-memory=4194304'], { cwd: dir });
      const log = r.out;
      if (r.code !== 0 || !fs.existsSync(wasm)) return { ok: false, diags: parseDiagnostics(log), log };
      const buf = fs.readFileSync(wasm);
      return { ok: true, wasm: buf.toString('base64'), flash: buf.length, ram: 0, diags: parseDiagnostics(log), log };
    } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { } }
  };
}
module.exports = { makeCppCompiler };
