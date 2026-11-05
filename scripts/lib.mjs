// Wspólne funkcje skryptów budowania: ścieżki, uruchamianie programów, pobieranie i rozpakowywanie archiwów.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const P = {
  src: path.join(ROOT, 'src'), electron: path.join(ROOT, 'electron'), packaging: path.join(ROOT, 'packaging'),
  vendor: path.join(ROOT, 'vendor'), downloads: path.join(ROOT, 'vendor', 'downloads'), arduinoSrc: path.join(ROOT, 'vendor', 'src'),
  build: path.join(ROOT, 'build'), dist: path.join(ROOT, 'dist'), nm: path.join(ROOT, 'node_modules'),
};
export const HOST = `${process.platform}-${process.arch}`;
export const toolsDir = (plat, name) => path.join(P.vendor, 'tools', plat, name);
export const exe = n => n + (process.platform === 'win32' ? '.exe' : '');

export function log(...a) { console.log('[cappytronic]', ...a); }
export function die(msg) { console.error('\n[cappytronic] BŁĄD: ' + msg + '\n'); process.exit(1); }
export function args() { const o = {}; for (const a of process.argv.slice(2)) { const m = /^--([^=]+)(?:=(.*))?$/.exec(a); if (m) o[m[1]] = m[2] === undefined ? true : m[2]; } return o; }
export function rm(p) { fs.rmSync(p, { recursive: true, force: true }); }
export function mkdir(p) { fs.mkdirSync(p, { recursive: true }); return p; }
export function copy(a, b, filter) { fs.cpSync(a, b, { recursive: true, dereference: false, verbatimSymlinks: true, filter }); }

// uruchomienie programu; zwraca { code, out } (stdout + stderr)
export function run(cmd, argv, opts = {}) {
  return new Promise(res => {
    let p; try { p = spawn(cmd, argv, { windowsHide: true, ...opts }); } catch (e) { return res({ code: -1, out: String(e) }); }
    let out = ''; if (p.stdout) p.stdout.on('data', d => out += d); if (p.stderr) p.stderr.on('data', d => out += d);
    p.on('error', e => res({ code: -1, out: out + String(e) })); p.on('close', code => res({ code, out }));
  });
}
export function runSync(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, { stdio: 'inherit', shell: process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd), ...opts });
  if (r.status !== 0) die(`polecenie nie powiodło się: ${cmd} ${argv.join(' ')}`);
}
// równoległe wykonanie zadań (kompilacja wielu plików)
export async function pool(items, n, fn) {
  const out = new Array(items.length); let i = 0;
  await Promise.all(Array.from({ length: Math.max(1, n) }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}
export const CPUS = Math.max(2, os.cpus().length);

// rekurencyjna lista plików z pominięciem katalogów
export function walk(dir, skip = [], filter = () => true) {
  const out = [];
  (function rec(d) { for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name < b.name ? -1 : 1)) { const p = path.join(d, e.name); if (e.isDirectory()) { if (!skip.includes(e.name)) rec(p); } else if (filter(p)) out.push(p); } })(dir);
  return out;
}

// pobranie pliku (z pamięcią podręczną w vendor/downloads)
export async function download(url, name) {
  mkdir(P.downloads);
  const file = path.join(P.downloads, name || decodeURIComponent(url.split('/').pop()));
  if (fs.existsSync(file) && fs.statSync(file).size > 0) return file;
  log('pobieranie', url);
  const r = await fetch(url, { redirect: 'follow' });
  if (!r.ok) die(`nie udało się pobrać ${url} (HTTP ${r.status})`);
  const total = +r.headers.get('content-length') || 0; let got = 0, last = 0;
  const tmp = file + '.part'; const ws = fs.createWriteStream(tmp);
  for await (const chunk of r.body) { ws.write(chunk); got += chunk.length; if (total && got - last > total / 20) { last = got; process.stdout.write(`  ${Math.round(got / total * 100)}%\r`); } }
  await new Promise(res => ws.end(res)); fs.renameSync(tmp, file); process.stdout.write('       \r');
  return file;
}
// rozpakowanie archiwum do katalogu; jeśli w środku jest jeden katalog główny – jego zawartość trafia bezpośrednio do dest
export async function extract(file, dest) {
  const tmp = dest + '.tmp'; rm(tmp); mkdir(tmp);
  if (/\.zip$/i.test(file)) {
    const { default: extractZip } = await import('extract-zip');
    await extractZip(file, { dir: path.resolve(tmp) });
  } else {
    const r = await run('tar', ['-xf', file, '-C', tmp]);
    if (r.code !== 0) die(`nie udało się rozpakować ${file}:\n${r.out}`);
  }
  const items = fs.readdirSync(tmp); rm(dest);
  if (items.length === 1 && fs.statSync(path.join(tmp, items[0])).isDirectory()) fs.renameSync(path.join(tmp, items[0]), dest);
  else fs.renameSync(tmp, dest);
  rm(tmp);
}
export function readJson(p, def) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (e) { return def; } }
// znajdź plik wykonywalny w katalogu bin narzędzia (uwzględnia .exe w Windows)
export function bin(dir, name) { for (const n of [name + '.exe', name]) { const p = path.join(dir, 'bin', n); if (fs.existsSync(p)) return p; } return path.join(dir, 'bin', exe(name)); }
// czy skrypt został uruchomiony bezpośrednio (a nie zaimportowany)
export const isMain = url => path.resolve(fileURLToPath(url)) === path.resolve(process.argv[1] || '');
