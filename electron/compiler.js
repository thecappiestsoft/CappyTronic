// Kompilacja szkiców Arduino offline: preprocesor .ino -> .cpp, avr-g++, linkowanie z prekompilowanym rdzeniem.
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

function stripCode(src) {
  // zastępuje komentarze i literały spacjami (zachowując długość i nowe linie)
  let out = '', i = 0, n = src.length;
  while (i < n) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') { out += ' '; i++; } }
    else if (c === '/' && d === '*') { out += '  '; i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++; } out += '  '; i += 2; }
    else if (c === '"' || c === "'") { const q = c; out += ' '; i++; while (i < n && src[i] !== q) { if (src[i] === '\\') { out += ' '; i++; } out += src[i] === '\n' ? '\n' : ' '; i++; } out += ' '; i++; }
    else if (c === '#' && /(^|\n)[ \t]*$/.test(out)) { while (i < n && src[i] !== '\n') { if (src[i] === '\\' && src[i + 1] === '\n') { out += ' \n'; i += 2; continue; } out += ' '; i++; } }
    else { out += c; i++; }
  }
  return out;
}

function findPrototypes(src) {
  const s = stripCode(src);
  const protos = []; let depth = 0, segStart = 0, firstLine = null, paren = 0;
  const KW = /^(if|for|while|switch|return|else|do|struct|class|enum|union|namespace|typedef|template)\b/;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === '(') paren++; else if (c === ')') paren--;
    if (c === '{') {
      if (depth === 0) {
        const seg = s.slice(segStart, i).trim().replace(/\s+/g, ' ');
        const m = seg.match(/^((?:[A-Za-z_][\w:<>,*&\s]*?[\s*&]+))([A-Za-z_]\w*)\s*\(([^()]*)\)\s*(const)?$/);
        if (m && !/^extern\b/.test(seg) && !KW.test(seg) && !/=/.test(seg) && !/\b(struct|class|enum|union|namespace)\b/.test(seg) && !/::/.test(m[2])) {
          const line = src.slice(0, segStart + (s.slice(segStart, i).length - s.slice(segStart, i).trimStart().length)).split('\n').length;
          protos.push(seg + ';');
          if (firstLine === null) firstLine = line;
        }
      }
      depth++;
    } else if (c === '}') { depth--; if (depth === 0) segStart = i + 1; }
    else if (c === ';' && depth === 0 && paren === 0) segStart = i + 1;
  }
  return { protos, firstLine };
}

function preprocess(code) {
  const { protos, firstLine } = findPrototypes(code);
  const lines = code.split('\n');
  let out = '#include <Arduino.h>\n#line 1 "sketch.ino"\n';
  if (firstLine && protos.length) {
    out += lines.slice(0, firstLine - 1).join('\n') + '\n' + protos.join('\n') + `\n#line ${firstLine} "sketch.ino"\n` + lines.slice(firstLine - 1).join('\n');
  } else out += code;
  return out + '\n';
}

function run(cmd, args, opts) {
  return new Promise(res => {
    let p; try { p = spawn(cmd, args, Object.assign({ windowsHide: true }, opts)); } catch (e) { return res({ code: -1, out: String(e) }); }
    let out = ''; p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
    p.on('error', e => res({ code: -1, out: out + String(e) }));
    p.on('close', code => res({ code, out }));
  });
}

function parseDiagnostics(log) {
  const diags = [];
  const re = /sketch\.ino:(\d+):(?:(\d+):)?\s*(fatal error|error|warning|note):\s*(.*)/g; let m;
  while ((m = re.exec(log))) diags.push({ line: +m[1], col: +(m[2] || 1), type: m[3] === 'fatal error' ? 'error' : m[3], msg: m[4] });
  if (!diags.some(d => d.type === 'error')) {
    const u = log.match(/undefined reference to [`'"]?([^'"`\n]+)/);
    if (u) diags.push({ line: 0, col: 0, type: 'error', msg: 'undefined reference to ' + u[1], link: true });
    const ov = log.match(/region [`']?(text|data)[`']? overflowed by (\d+) bytes/);
    if (ov) diags.push({ line: 0, col: 0, type: 'error', msg: `program too big: ${ov[1]} overflowed by ${ov[2]} bytes`, link: true });
  }
  return diags;
}

function makeCompiler({ gccBin, arduinoDir, tmpBase }) {
  const manifest = JSON.parse(fs.readFileSync(path.join(arduinoDir, 'manifest.json'), 'utf8'));
  const exe = n => path.join(gccBin, n + (process.platform === 'win32' ? '.exe' : ''));
  return async function compile({ code, target }) {
    const T = manifest.targets[target];
    if (!T) return { ok: false, diags: [{ line: 0, col: 0, type: 'error', msg: 'unknown board ' + target }], log: '' };
    const dir = fs.mkdtempSync(path.join(tmpBase || os.tmpdir(), 'cappytronic-'));
    try {
      const cpp = path.join(dir, 'sketch.cpp');
      fs.writeFileSync(cpp, preprocess(code));
      const inc = path.join(arduinoDir, 'include');
      const incs = ['core', T.variant, ...Object.values(manifest.libIncludes).flat()].map(d => '-I' + path.join(inc, d));
      const defs = [`-mmcu=${T.mcu}`, `-DF_CPU=${T.f}`, '-DARDUINO=10819', `-D${T.board}`, '-DARDUINO_ARCH_AVR'];
      const obj = path.join(dir, 'sketch.o');
      let r = await run(exe('avr-g++'), ['-c', '-g', '-Os', '-Wall', '-Wno-unused-variable', '-std=gnu++11', '-fpermissive', '-fno-exceptions', '-ffunction-sections', '-fdata-sections', '-fno-threadsafe-statics', '-Wno-error=narrowing', ...defs, ...incs, cpp, '-o', obj], { cwd: dir });
      let log = r.out;
      if (r.code !== 0) return { ok: false, diags: parseDiagnostics(log), log };
      const tdir = path.join(arduinoDir, target);
      const libs = T.libs.map(l => path.join(tdir, `lib${l}.a`));
      const elf = path.join(dir, 'sketch.elf');
      r = await run(exe('avr-gcc'), ['-w', '-Os', '-g', '-Wl,--gc-sections', `-mmcu=${T.mcu}`, '-o', elf, obj, '-Wl,--start-group', ...libs, path.join(tdir, 'libcore.a'), '-lm', '-Wl,--end-group'], { cwd: dir });
      log += r.out;
      if (r.code !== 0) return { ok: false, diags: parseDiagnostics(log), log };
      const hexf = path.join(dir, 'sketch.hex');
      r = await run(exe('avr-objcopy'), ['-O', 'ihex', '-R', '.eeprom', elf, hexf], { cwd: dir });
      if (r.code !== 0) return { ok: false, diags: [{ line: 0, col: 0, type: 'error', msg: r.out }], log: log + r.out };
      r = await run(exe('avr-size'), ['-A', elf], { cwd: dir });
      const sz = n => { const m = r.out.match(new RegExp('\\.' + n + '\\s+(\\d+)')); return m ? +m[1] : 0; };
      const hex = fs.readFileSync(hexf, 'utf8');
      return { ok: true, hex, flash: sz('text') + sz('data'), ram: sz('data') + sz('bss'), diags: parseDiagnostics(log), log };
    } finally { try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { } }
  };
}

module.exports = { makeCompiler, preprocess };
