// Pobiera kompilatory (avr-gcc, wasi-sdk/clang, arm-none-eabi-gcc) i źródła bibliotek Arduino.
// Użycie: node scripts/fetch-deps.mjs [--platform=linux-x64|win32-x64|darwin-x64|darwin-arm64] [--only=avr,wasi,arm,src]
import fs from 'node:fs';
import path from 'node:path';
import { TOOLCHAINS, ARDUINO_SOURCES } from './config.mjs';
import { P, HOST, toolsDir, download, extract, log, die, args, mkdir, isMain } from './lib.mjs';

export async function fetchToolchains(plat, only) {
  for (const [name, urls] of Object.entries(TOOLCHAINS)) {
    if (only && !only.includes(name)) continue;
    const url = urls[plat]; if (!url) die(`brak narzędzia ${name} dla platformy ${plat}`);
    const dest = toolsDir(plat, name), stamp = path.join(dest, '.source');
    if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === url) { log(`${name} (${plat}) – już jest`); continue; }
    // macOS: można użyć avr-gcc z Homebrew (brew tap osx-cross/avr && brew install avr-gcc) przez zmienną AVR_GCC_DIR
    if (name === 'avr' && process.env.AVR_GCC_DIR) { log('avr-gcc z AVR_GCC_DIR:', process.env.AVR_GCC_DIR); continue; }
    const file = await download(url);
    log(`rozpakowywanie ${name} (${plat})…`); await extract(file, dest);
    fs.writeFileSync(stamp, url);
  }
}
export async function fetchArduinoSources() {
  mkdir(P.arduinoSrc);
  for (const [dir, [repo, commit]] of Object.entries(ARDUINO_SOURCES)) {
    const dest = path.join(P.arduinoSrc, dir), stamp = path.join(dest, '.commit');
    if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8') === commit) continue;
    const url = `https://codeload.github.com/${repo}/tar.gz/${commit}`;
    const file = await download(url, `${dir}-${commit.slice(0, 10)}.tar.gz`);
    await extract(file, dest); fs.writeFileSync(stamp, commit); log('źródła', dir);
  }
}
if (isMain(import.meta.url)) {
  const a = args(); const plat = a.platform || HOST; const only = a.only ? String(a.only).split(',') : null;
  if (!only || only.some(x => x !== 'src')) await fetchToolchains(plat, only && only.filter(x => x !== 'src'));
  if (!only || only.includes('src')) await fetchArduinoSources();
  log('gotowe');
}
