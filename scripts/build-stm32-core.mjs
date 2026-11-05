// Budowa rdzenia Arduino CappyTronic dla STM32F103 (Blue Pill) i bibliotek: build/stm/{libct.a, startup.o, core/, libdirs.txt}
import fs from 'node:fs';
import path from 'node:path';
import { STM_LIBS } from './config.mjs';
import { P, HOST, toolsDir, run, pool, walk, rm, mkdir, log, die, bin, CPUS, copy, isMain } from './lib.mjs';
import { vendorPortableLibs } from './build-wasm-cores.mjs';

const FLAGS = ['-DARDUINO=10819', '-mcpu=cortex-m3', '-mthumb', '-Os', '-g0', '-ffunction-sections', '-fdata-sections', '-w'];
const CXX = ['-std=gnu++17', '-fno-exceptions', '-fno-rtti', '-fno-threadsafe-statics', '-fno-use-cxa-atexit'];
export async function buildStm32Core() {
  const A = toolsDir(HOST, 'arm'); if (!fs.existsSync(bin(A, 'arm-none-eabi-gcc'))) die('brak arm-none-eabi-gcc – uruchom: node scripts/fetch-deps.mjs');
  const OUT = path.join(P.build, 'stm'), CORE = path.join(P.src, 'stm32', 'core'), LIBSRC = path.join(P.build, 'cpp', 'libsrc');
  if (!fs.existsSync(LIBSRC)) vendorPortableLibs();
  rm(OUT); const objDir = mkdir(path.join(OUT, 'obj')); copy(CORE, path.join(OUT, 'core'));
  const libdirs = STM_LIBS.map(l => path.join(LIBSRC, l)).filter(d => fs.existsSync(d));
  const sub = libdirs.flatMap(d => ['src', 'utility', 'clib'].map(s => path.join(d, s)).filter(x => fs.existsSync(x)));
  const incs = [path.join(OUT, 'core'), ...libdirs, ...sub].map(d => '-I' + d);
  const srcs = [...walk(CORE, [], f => /\.(c|cpp)$/.test(f) && !f.endsWith('startup.c')), ...libdirs.flatMap(d => walk(d, ['examples'], f => /\.(c|cpp)$/.test(f)))];
  const res = await pool(srcs, CPUS, async (s, i) => {
    const o = path.join(objDir, i + '_' + path.basename(s) + '.o'), cxx = s.endsWith('.cpp');
    const r = await run(bin(A, cxx ? 'arm-none-eabi-g++' : 'arm-none-eabi-gcc'), [...FLAGS, ...(cxx ? CXX : ['-std=gnu11']), ...incs, '-c', s, '-o', o]);
    return { o, s, ok: r.code === 0, err: r.out };
  });
  const ok = res.filter(r => r.ok), bad = res.filter(r => !r.ok);
  for (const x of bad.slice(0, 5)) log('  błąd:', path.basename(x.s), x.err.slice(-300));
  let r = await run(bin(A, 'arm-none-eabi-gcc'), [...FLAGS, '-std=gnu11', '-c', path.join(CORE, 'startup.c'), '-o', path.join(OUT, 'startup.o')]); if (r.code) die(r.out);
  const rsp = path.join(OUT, 'objs.rsp'); fs.writeFileSync(rsp, ok.map(x => '"' + x.o.split(path.sep).join('/') + '"').join('\n'));
  r = await run(bin(A, 'arm-none-eabi-ar'), ['rcs', path.join(OUT, 'libct.a'), '@' + rsp]); if (r.code) die(r.out);
  rm(objDir); rm(rsp);
  fs.writeFileSync(path.join(OUT, 'libdirs.txt'), [...libdirs, ...sub].map(d => path.relative(LIBSRC, d).split(path.sep).join('/')).join('\n'));
  log(`STM32: obiektów ${ok.length}, błędów ${bad.length}`);
  if (bad.length) die('rdzeń STM32 nie skompilował się w całości');
}
if (isMain(import.meta.url)) await buildStm32Core();
