// Prekompilacja środowiska C++ (Arduino API) dla płytek ESP32-C3-Zero, ESP32 DevKit, NodeMCU i Pico W (WebAssembly).
// Wynik: build/cpp/<płytka>/{libct.a, ct_board.h}, build/cpp/core (nagłówki), build/cpp/libsrc (uogólnione biblioteki – wspólne ze STM32)
import fs from 'node:fs';
import path from 'node:path';
import { WASM_BOARDS, PORTABLE_LIBS, ARCH_MACROS } from './config.mjs';
import { P, HOST, toolsDir, run, pool, walk, rm, mkdir, log, die, bin, CPUS, copy, isMain } from './lib.mjs';

const SKIP = ['examples', 'extras', 'test', 'tests', 'docs', '.git', '.github', 'fontconvert', 'samd', 'sam', 'stm32f4', 'nrf52', 'megaavr', 'mbed', 'renesas', 'avr'];
const CORE = path.join(P.src, 'cpp-wasm', 'core'), OUT = path.join(P.build, 'cpp');

// kopia biblioteki z ukrytymi (push/pop) makrami architektur
function vendorLib(name, srcDir) {
  const dst = path.join(OUT, 'libsrc', name); rm(dst);
  const pre = ARCH_MACROS.map(m => `#pragma push_macro("${m}")\n#undef ${m}\n`).join(''), post = ARCH_MACROS.map(m => `#pragma pop_macro("${m}")\n`).join('');
  for (const f of walk(srcDir, SKIP, f => /\.(h|hpp|c|cpp)$/.test(f))) {
    const o = path.join(dst, path.relative(srcDir, f)); mkdir(path.dirname(o));
    let s = fs.readFileSync(f, 'latin1');
    if ((/\.(h|hpp)$/.test(f) && name !== 'ArduinoJson') || /\.(c|cpp)$/.test(f)) s = pre + s + '\n' + post;
    fs.writeFileSync(o, s, 'latin1');
  }
  return dst;
}
function boardHeader(name, b) {
  const d = [`// ${name} – wygenerowane przez scripts/build-wasm-cores.mjs`, '#pragma once', '#include <stdint.h>', `#define CT_BOARD_${name.toUpperCase()} 1`, `#define CT_ARCH_${b.arch} 1`, `#define ARDUINO_ARCH_${b.arch} 1`, `#define ${b.arch} 1`,
    `#define F_CPU ${b.f}000000L`, `#define CT_COST_SCALE ${b.cost}`, '#define CT_LOOP_US 0.3', `#define CT_ADC_BITS ${b.adc_bits}`, `#define CT_ADC_FS_MV ${b.adc_mv}`,
    `#define CT_PWM_FREQ ${b.pwm_f}`, `#define CT_PWM_RANGE ${b.pwm_r}`, `#define CT_CHIP_MODEL "${b.chip}"`, `#define CT_CHIP_CORES ${b.cores}`, '#define RGB_BRIGHTNESS 64',
    `#define CT_I2C_SDA ${b.pins.SDA}`, `#define CT_I2C_SCL ${b.pins.SCL}`, `#define CT_I2C1_SDA ${b.i2c1[0]}`, `#define CT_I2C1_SCL ${b.i2c1[1]}`,
    `#define CT_SPI_SCK ${b.pins.SCK}`, `#define CT_SPI_MOSI ${b.pins.MOSI}`, `#define CT_SPI_MISO ${b.pins.MISO}`, `#define CT_SPI_SS ${b.pins.SS}`,
    `#define CT_UART1_TX ${b.uart1[0]}`, `#define CT_UART1_RX ${b.uart1[1]}`, `#define CT_UART2_TX ${b.uart2[0]}`, `#define CT_UART2_RX ${b.uart2[1]}`];
  if (b.arch === 'ESP32') d.push('#define ESP_PLATFORM 1', '#define ARDUINO_RUNNING_CORE 1');
  if (b.arch === 'ESP8266') d.push('#define ARDUINO_ESP8266_RELEASE "3.1.2"');
  for (const x of b.extra || []) { const [k, v] = x.split('='); d.push(`#define ${k} ${v}`); }
  for (const [k, v] of Object.entries(b.pins)) d.push(/^(LED_|RGB_|BOOT|PIN_)/.test(k) ? `#define ${k} ${v}` : `static const uint8_t ${k} = ${v};`);
  return d.join('\n') + '\n';
}
export function vendorPortableLibs() {
  const out = {}; for (const [name, rel] of Object.entries(PORTABLE_LIBS)) { const d = path.join(P.arduinoSrc, rel); if (!fs.existsSync(d)) die('brak źródeł ' + rel + ' – uruchom: node scripts/fetch-deps.mjs --only=src'); out[name] = vendorLib(name, d); }
  return out;
}
export async function buildWasmCores() {
  const W = toolsDir(HOST, 'wasi'); if (!fs.existsSync(bin(W, 'clang'))) die('brak wasi-sdk – uruchom: node scripts/fetch-deps.mjs');
  mkdir(OUT); const libs = vendorPortableLibs();
  rm(path.join(OUT, 'core')); copy(CORE, path.join(OUT, 'core'), s => !/\.(c|cpp)$/.test(s));
  const incAll = [CORE, ...Object.values(libs)];
  for (const [name, b] of Object.entries(WASM_BOARDS)) {
    const bd = mkdir(path.join(OUT, name)), objDir = mkdir(path.join(bd, 'obj'));
    fs.writeFileSync(path.join(bd, 'ct_board.h'), boardHeader(name, b));
    const jobs = walk(CORE, SKIP, f => /\.(c|cpp)$/.test(f)).map(s => [s, 'core_' + path.basename(s)]);
    for (const [lib, d] of Object.entries(libs)) walk(d, SKIP, f => /\.(c|cpp)$/.test(f)).forEach((s, i) => jobs.push([s, `${lib}_${String(i).padStart(3, '0')}_${path.basename(s)}`]));
    const res = await pool(jobs, CPUS, async ([s, n]) => {
      const o = path.join(objDir, n + '.o'), cxx = s.endsWith('.cpp');
      const a = ['--target=wasm32-wasip1', '-c', '-O2', '-w', '-ffunction-sections', '-fdata-sections', '-I' + bd, '-I' + CORE, ...incAll.map(i => '-I' + i),
        ...(cxx ? ['-std=gnu++17', '-fno-exceptions', '-fno-rtti', '-include', 'Arduino.h'] : ['-std=gnu11']), s, '-o', o];
      const r = await run(bin(W, cxx ? 'clang++' : 'clang'), a); return { o, ok: r.code === 0 && fs.existsSync(o), s, err: r.out };
    });
    const ok = res.filter(r => r.ok), bad = res.filter(r => !r.ok);
    const a = path.join(bd, 'libct.a'); rm(a);
    // listę obiektów przekazujemy w pliku odpowiedzi (Windows ma limit długości wiersza poleceń)
    const rsp = path.join(bd, 'objs.rsp'); fs.writeFileSync(rsp, ok.map(x => '"' + x.o.split(path.sep).join('/') + '"').join('\n'));
    const r = await run(bin(W, 'llvm-ar'), ['rcs', a, '@' + rsp]); if (r.code !== 0) die('llvm-ar: ' + r.out);
    rm(objDir); rm(rsp);
    log(`C++/WebAssembly ${name}: obiektów ${ok.length}, błędów ${bad.length}`);
    for (const x of bad.slice(0, 5)) log('  ', path.basename(x.s), (x.err.split('\n').find(l => /error/.test(l)) || '').slice(0, 200));
  }
}
if (isMain(import.meta.url)) await buildWasmCores();
