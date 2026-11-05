// Uruchomienie aplikacji desktopowej z kodu źródłowego (npm start): przygotowuje build/dev-app i build/dev-resources
// (dowiązania do kompilatorów z vendor/ i zbudowanych rdzeni) i startuje Electron.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { P, HOST, toolsDir, rm, mkdir, log, die, isMain } from './lib.mjs';
import { buildHtml } from './build-html.mjs';
import { avrDir } from './build-avr-libs.mjs';

if (isMain(import.meta.url)) {
  await buildHtml();
  const APPD = path.join(P.build, 'dev-app'); rm(APPD); mkdir(APPD);
  for (const f of fs.readdirSync(P.electron)) if (f.endsWith('.js')) fs.copyFileSync(path.join(P.electron, f), path.join(APPD, f));
  fs.copyFileSync(path.join(P.dist, 'CappyTronic.html'), path.join(APPD, 'index.html')); fs.copyFileSync(path.join(P.src, 'assets', 'icon-app.png'), path.join(APPD, 'icon.png'));
  fs.writeFileSync(path.join(APPD, 'package.json'), JSON.stringify({ name: 'cappytronic-dev', main: 'main.js', version: '0.0.0-dev' }));
  const RES = path.join(P.build, 'dev-resources'); rm(RES); mkdir(RES);
  const links = { toolchain: avrDir(), wasi: toolsDir(HOST, 'wasi'), armgcc: toolsDir(HOST, 'arm'), arduino: path.join(P.build, 'arduino'), cpp: path.join(P.build, 'cpp'), stm: path.join(P.build, 'stm') };
  for (const [k, v] of Object.entries(links)) { if (!fs.existsSync(v)) { log(`uwaga: brak ${v} – kompilacja dla tej grupy płytek nie zadziała (node scripts/build-all.mjs)`); continue; } fs.symlinkSync(v, path.join(RES, k), process.platform === 'win32' ? 'junction' : 'dir'); }
  const electron = (await import('electron')).default; // ścieżka do pliku wykonywalnego Electron
  const p = spawn(electron, [APPD, ...process.argv.slice(2)], { stdio: 'inherit' });
  p.on('close', c => process.exit(c || 0));
}
