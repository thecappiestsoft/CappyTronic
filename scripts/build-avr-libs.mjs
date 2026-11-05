// Prekompilacja rdzenia Arduino AVR i bibliotek do archiwów .a dla każdej płytki (npm run toolchain).
// Wynik: build/arduino/<płytka>/{libcore.a, lib*.a}, build/arduino/include/…, build/arduino/manifest.json
import fs from 'node:fs';
import path from 'node:path';
import { AVR_TARGETS, AVR_LIBS } from './config.mjs';
import { P, HOST, toolsDir, run, pool, walk, rm, mkdir, log, die, bin, CPUS, isMain } from './lib.mjs';

const SKIP = ['examples', 'extras', 'test', 'tests', 'docs', '.git', '.github', 'fontconvert', 'Fonts', 'samd', 'sam', 'stm32f4', 'nrf52', 'megaavr', 'mbed', 'renesas', 'esp32', 'esp8266', 'stm32'];
export function avrDir() { return process.env.AVR_GCC_DIR || toolsDir(HOST, 'avr'); }

export async function buildAvrLibs() {
  const T = avrDir(), SRC = P.arduinoSrc, OUT = path.join(P.build, 'arduino');
  if (!fs.existsSync(bin(T, 'avr-gcc'))) die('brak avr-gcc – uruchom najpierw: node scripts/fetch-deps.mjs');
  const CORE = path.join(SRC, 'ArduinoCore-avr', 'cores', 'arduino');
  const ar = fs.existsSync(bin(T, 'avr-gcc-ar')) ? bin(T, 'avr-gcc-ar') : bin(T, 'avr-ar');
  rm(OUT); mkdir(OUT);
  const isSrc = f => /\.(c|cpp|S)$/.test(f), isHdr = f => /\.(h|hpp|inl|tcc)$/.test(f);
  const hdrDirs = d => [...new Set([d, ...walk(d, SKIP, isHdr).map(f => path.dirname(f))])].sort();
  const copyHeaders = (src, dst) => { for (const f of walk(src, SKIP, isHdr)) { const o = path.join(dst, path.relative(src, f)); mkdir(path.dirname(o)); fs.copyFileSync(f, o); } };
  const inc = path.join(OUT, 'include'), manifest = { targets: {}, libIncludes: {}, core: ['core'] };
  copyHeaders(CORE, path.join(inc, 'core'));
  for (const [t, d] of Object.entries(AVR_TARGETS)) copyHeaders(path.join(SRC, d.variant), path.join(inc, 'variant_' + t));
  copyHeaders(path.join(SRC, 'ArduinoCore-avr', 'variants', 'standard'), path.join(inc, 'standard')); // ../standard/pins_arduino.h (Nano)
  for (const [name, rel] of Object.entries(AVR_LIBS)) {
    const d = path.join(SRC, rel); copyHeaders(d, path.join(inc, 'lib_' + name));
    manifest.libIncludes[name] = hdrDirs(d).map(x => ('lib_' + name + '/' + path.relative(d, x).split(path.sep).join('/')).replace(/\/$/, ''));
  }
  const allInc = Object.values(AVR_LIBS).flatMap(rel => hdrDirs(path.join(SRC, rel)));
  for (const [t, d] of Object.entries(AVR_TARGETS)) {
    const od = mkdir(path.join(OUT, t)), incs = [CORE, path.join(SRC, d.variant), ...allInc].map(x => '-I' + x);
    const defs = [`-mmcu=${d.mcu}`, `-DF_CPU=${d.f}`, '-DARDUINO=10819', `-D${d.board}`, '-DARDUINO_ARCH_AVR'];
    const archive = async (name, srcs, partial) => {
      const objDir = mkdir(path.join(od, 'obj_' + name));
      const res = await pool(srcs, CPUS, async (s, i) => {
        const o = path.join(objDir, String(i).padStart(3, '0') + '_' + path.basename(s) + '.o');
        const common = ['-c', '-g', '-Os', '-w', '-ffunction-sections', '-fdata-sections', ...defs, ...incs];
        const cmd = s.endsWith('.c') ? [bin(T, 'avr-gcc'), '-std=gnu11', ...common] : s.endsWith('.S') ? [bin(T, 'avr-gcc'), '-x', 'assembler-with-cpp', ...common]
          : [bin(T, 'avr-g++'), '-std=gnu++11', '-fpermissive', '-fno-exceptions', '-fno-threadsafe-statics', '-Wno-error=narrowing', ...common];
        const r = await run(cmd[0], [...cmd.slice(1), s, '-o', o]); return { s, o, ok: r.code === 0, err: r.out };
      });
      const ok = res.filter(r => r.ok), bad = res.filter(r => !r.ok);
      if ((srcs.length && !ok.length) || (bad.length && !partial)) { rm(objDir); return { ok: false, bad }; } // biblioteka tylko z nagłówkami (np. EEPROM) – puste archiwum
      const r = await run(ar, ['rcs', path.join(od, `lib${name}.a`), ...ok.map(x => x.o)]); rm(objDir);
      if (r.code !== 0) die('avr-ar: ' + r.out);
      return { ok: true, bad };
    };
    const core = await archive('core', walk(CORE, SKIP, isSrc), t === 'tiny85');
    if (!core.ok) die(`rdzeń Arduino dla ${t} się nie kompiluje:\n${core.bad.slice(0, 2).map(b => b.s + '\n' + b.err.slice(-800)).join('\n')}`);
    const built = [];
    for (const [name, rel] of Object.entries(AVR_LIBS)) { const r = await archive(name, walk(path.join(SRC, rel), SKIP, isSrc), false); if (r.ok) built.push(name); }
    log(`AVR ${t}: rdzeń + biblioteki: ${built.join(' ')}`);
    manifest.targets[t] = { mcu: d.mcu, f: d.f, board: d.board, libs: built, variant: 'variant_' + t };
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 1));
}
if (isMain(import.meta.url)) await buildAvrLibs();
