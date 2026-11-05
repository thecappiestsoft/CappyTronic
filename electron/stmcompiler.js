// Kompilacja programów Arduino (C++) dla STM32F103 (Blue Pill) – arm-none-eabi-gcc, offline.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { preprocess } = require('./compiler.js');
function run(cmd, args, opts) {
  return new Promise(res => {
    let p; try { p = spawn(cmd, args, Object.assign({ windowsHide: true }, opts)); } catch (e) { return res({ code: -1, out: String(e) }); }
    let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
    p.on('error', e => res({ code: -1, out: out + String(e) })); p.on('close', code => res({ code, out }));
  });
}
function parseDiagnostics(log) {
  const diags = []; const re = /sketch\.ino:(\d+):(?:(\d+):)?\s*(fatal error|error|warning):\s*(.*)/g; let m;
  while ((m = re.exec(log))) diags.push({ line: +m[1], col: +(m[2] || 1), type: m[3] === 'fatal error' ? 'error' : m[3], msg: m[4] });
  if (!diags.some(d => d.type === 'error')) {
    const u = log.match(/undefined reference to `([^']+)'/); if (u) diags.push({ line: 0, col: 0, type: 'error', msg: 'undefined reference to ' + u[1], link: true });
    else if (/region `FLASH' overflowed/.test(log)) diags.push({ line: 0, col: 0, type: 'error', msg: 'program too big (64 KB Flash)' });
    else if (/region `RAM' overflowed/.test(log)) diags.push({ line: 0, col: 0, type: 'error', msg: 'program too big (20 KB RAM)' });
    else if (/error/.test(log)) diags.push({ line: 0, col: 0, type: 'error', msg: log.split('\n').find(l => /error/.test(l)) || log.slice(0, 300), link: true });
  }
  return diags;
}
function makeStmCompiler({ gccBin, stmDir, libsrcDir, tmpBase }) {
  const exe = n => path.join(gccBin, 'arm-none-eabi-' + n + (process.platform === 'win32' ? '.exe' : ''));
  const incs = () => { const out = [path.join(stmDir, 'core')]; const f = path.join(stmDir, 'libdirs.txt'); if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split('\n')) if (l.trim()) out.push(path.join(libsrcDir, l.trim())); return out; };
  return async function compile({ code }) {
    const dir = fs.mkdtempSync(path.join(tmpBase || os.tmpdir(), 'cappystm-'));
    try {
      const cpp = path.join(dir, 'sketch.cpp'), elf = path.join(dir, 'sketch.elf'), hex = path.join(dir, 'sketch.hex');
      fs.writeFileSync(cpp, preprocess(code));
      const flags = ['-DARDUINO=10819', '-mcpu=cortex-m3', '-mthumb', '-Os', '-g0', '-std=gnu++17', '-fno-exceptions', '-fno-rtti', '-fno-threadsafe-statics', '-fno-use-cxa-atexit', '-ffunction-sections', '-fdata-sections', '-Wall', '-Wno-unused-variable', '-Wno-unused-function', '-Wno-sign-compare'];
      const r = await run(exe('g++'), [...flags, ...incs().map(d => '-I' + d), cpp, path.join(stmDir, 'startup.o'), path.join(stmDir, 'libct.a'), '-T', path.join(stmDir, 'core', 'stm32f103c8.ld'),
        '-nostartfiles', '--specs=nano.specs', '-u', '_printf_float', '-Wl,--gc-sections', '-Wl,--no-warn-rwx-segments', '-lm', '-o', elf], { cwd: dir });
      if (r.code !== 0 || !fs.existsSync(elf)) return { ok: false, diags: parseDiagnostics(r.out), log: r.out };
      await run(exe('objcopy'), ['-O', 'ihex', elf, hex], { cwd: dir });
      const sz = await run(exe('size'), ['-A', elf], { cwd: dir }); const sec = n => { const m = new RegExp('^\\' + n + '\\s+(\\d+)', 'm').exec(sz.out); return m ? +m[1] : 0; };
      const flash = sec('.isr_vector') + sec('.text') + sec('.rodata') + sec('.data') + sec('.init_array') + sec('.ARM'), ram = sec('.data') + sec('.bss');
      return { ok: true, hex: fs.readFileSync(hex, 'utf8'), flash, ram, diags: parseDiagnostics(r.out), log: r.out };
    } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { } }
  };
}
module.exports = { makeStmCompiler };
