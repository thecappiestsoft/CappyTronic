// Pakowanie aplikacji desktopowej (Electron) z kompilatorami dla wybranej platformy.
// Użycie: node scripts/package-desktop.mjs --platform=linux|win32|darwin [--arch=x64|arm64]
// Wynik: dist/CappyTronic-<wersja>-<Linux|Windows|macOS>-<arch>.(tar.gz|zip)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { APP } from './config.mjs';
import { P, HOST, toolsDir, run, runSync, rm, mkdir, copy, log, die, args, walk, readJson, isMain } from './lib.mjs';
import { fetchToolchains } from './fetch-deps.mjs';

const has = p => fs.existsSync(p);
const W = s => s.split(path.sep).join('/');
function rmGlob(dir, test) { if (!has(dir)) return; for (const e of fs.readdirSync(dir)) if (test(e)) rm(path.join(dir, e)); }

/* ---------- odchudzanie kompilatorów (tylko to, czego używa CappyTronic) ---------- */
function pruneAvr(root) {
  const gccLib = path.join(root, 'lib', 'gcc', 'avr'); if (!has(gccLib)) return;
  const ver = fs.readdirSync(gccLib)[0], G = path.join(gccLib, ver), keep = new Set(['avr25', 'avr5', 'avr6']);
  rmGlob(G, e => (e.startsWith('avr') || ['tiny-stack', 'double64', 'long-double32'].includes(e)) && !keep.has(e) && fs.statSync(path.join(G, e)).isDirectory());
  for (const d of ['plugin', 'install-tools']) rm(path.join(G, d));
  for (const d of ['share', 'include', 'doc', 'man', 'info']) rm(path.join(root, d)); rm(path.join(root, 'lib', 'libavr-sim.a'));
  const L = path.join(root, 'libexec', 'gcc', 'avr', ver); rmGlob(L, e => /^(lto1|g\+\+-mapper-server)(\.exe)?$/.test(e) || e === 'plugin' || e === 'install-tools');
  const AL = path.join(root, 'avr', 'lib'); rmGlob(AL, e => (e.startsWith('avr') && !keep.has(e) && fs.statSync(path.join(AL, e)).isDirectory()) || e === 'double64' || e === 'long-double32');
  rmGlob(path.join(root, 'bin'), e => /^avr-(gdb|lto-dump|run|gcov|gcov-dump|gcov-tool|gprof|gdb-add-index|addr2line|strings|elfedit|readelf|objdump|c\+\+filt|cpp|man)(\.exe)?$/.test(e) || /^(avrdude|make)(\.exe|\.conf)?$/.test(e));
}
function pruneWasi(src, dst, win) {
  const e = win ? '.exe' : '';
  mkdir(path.join(dst, 'bin'));
  for (const b of ['clang', 'clang++', 'clang-19', 'lld', 'wasm-ld', 'llvm-ar']) { const p = path.join(src, 'bin', b + e); if (has(p)) fs.cpSync(p, path.join(dst, 'bin', b + e), { verbatimSymlinks: true }); }
  for (const f of fs.readdirSync(path.join(src, 'bin'))) if (/\.dll$/i.test(f)) fs.copyFileSync(path.join(src, 'bin', f), path.join(dst, 'bin', f));
  if (has(path.join(src, 'lib'))) for (const f of fs.readdirSync(path.join(src, 'lib'))) if (/^lib(LLVM|clang-cpp).*\.(so|dylib)/.test(f)) fs.cpSync(path.join(src, 'lib', f), path.join(dst, 'lib', f), { verbatimSymlinks: true });
  copy(path.join(src, 'lib', 'clang'), path.join(dst, 'lib', 'clang'));
  const SR = path.join(src, 'share', 'wasi-sysroot'), DR = path.join(dst, 'share', 'wasi-sysroot');
  copy(path.join(SR, 'include', 'wasm32-wasip1'), path.join(DR, 'include', 'wasm32-wasip1')); if (has(path.join(SR, 'include', 'c++'))) copy(path.join(SR, 'include', 'c++'), path.join(DR, 'include', 'c++'));
  copy(path.join(SR, 'lib', 'wasm32-wasip1'), path.join(DR, 'lib', 'wasm32-wasip1')); if (has(path.join(SR, 'share'))) copy(path.join(SR, 'share'), path.join(DR, 'share'));
}
function pruneArm(src, dst, win) {
  const e = win ? '.exe' : '', ver = fs.readdirSync(path.join(src, 'lib', 'gcc', 'arm-none-eabi'))[0];
  mkdir(path.join(dst, 'bin'));
  for (const t of ['gcc', 'g++', 'objcopy', 'size', 'ar', 'as', 'ld']) fs.copyFileSync(path.join(src, 'bin', `arm-none-eabi-${t}${e}`), path.join(dst, 'bin', `arm-none-eabi-${t}${e}`));
  for (const f of fs.readdirSync(path.join(src, 'bin'))) if (/\.dll$/i.test(f)) fs.copyFileSync(path.join(src, 'bin', f), path.join(dst, 'bin', f));
  if (has(path.join(src, 'libexec'))) for (const f of fs.readdirSync(path.join(src, 'libexec'))) if (f !== 'gcc') fs.cpSync(path.join(src, 'libexec', f), path.join(dst, 'libexec', f), { recursive: true, verbatimSymlinks: true });
  const LX = path.join(src, 'libexec', 'gcc', 'arm-none-eabi', ver), DLX = mkdir(path.join(dst, 'libexec', 'gcc', 'arm-none-eabi', ver));
  for (const f of fs.readdirSync(LX)) if (/^(cc1|cc1plus|collect2|lto-wrapper)(\.exe)?$|^liblto_plugin|\.dll$/i.test(f)) fs.cpSync(path.join(LX, f), path.join(DLX, f), { verbatimSymlinks: true });
  const G = path.join(src, 'lib', 'gcc', 'arm-none-eabi', ver), DG = path.join(dst, 'lib', 'gcc', 'arm-none-eabi', ver);
  copy(path.join(G, 'include'), path.join(DG, 'include')); copy(path.join(G, 'include-fixed'), path.join(DG, 'include-fixed')); copy(path.join(G, 'thumb', 'v7-m', 'nofp'), path.join(DG, 'thumb', 'v7-m', 'nofp'));
  const AB = path.join(src, 'arm-none-eabi'), DAB = path.join(dst, 'arm-none-eabi'); mkdir(path.join(DAB, 'bin'));
  for (const t of ['as', 'ld', 'ld.bfd', 'ar', 'objcopy']) if (has(path.join(AB, 'bin', t + e))) fs.copyFileSync(path.join(AB, 'bin', t + e), path.join(DAB, 'bin', t + e));
  copy(path.join(AB, 'include'), path.join(DAB, 'include')); copy(path.join(AB, 'lib', 'thumb', 'v7-m', 'nofp'), path.join(DAB, 'lib', 'thumb', 'v7-m', 'nofp'));
  for (const f of fs.readdirSync(path.join(AB, 'lib'))) if (f.endsWith('.specs')) fs.copyFileSync(path.join(AB, 'lib', f), path.join(DAB, 'lib', f));
}
// Linux: avr-gcc 14 (Zak Kemble) wymaga glibc 2.36 – dołączamy glibc komputera budującego i uruchamiamy programy przez nią,
// dzięki czemu pakiet działa także na starszych dystrybucjach (Ubuntu 20.04+). Wymaga budowania na systemie z glibc ≥ 2.36.
async function bundleGlibc(root) {
  const r = await run('ldd', ['--version']); const m = /(\d+)\.(\d+)/.exec(r.out || ''); if (!m || +m[1] * 100 + +m[2] < 236) { log('uwaga: glibc komputera budującego < 2.36 – pomijam dołączanie glibc'); return; }
  const libs = { 'ld-linux-x86-64.so.2': null, 'libc.so.6': null, 'libm.so.6': null };
  for (const d of ['/lib/x86_64-linux-gnu', '/lib64', '/usr/lib64', '/usr/lib/x86_64-linux-gnu']) for (const n of Object.keys(libs)) if (!libs[n] && has(path.join(d, n))) libs[n] = fs.realpathSync(path.join(d, n));
  if (Object.values(libs).some(x => !x)) { log('uwaga: nie znaleziono bibliotek glibc – pomijam'); return; }
  const G = mkdir(path.join(root, 'glibc')); for (const [n, p] of Object.entries(libs)) fs.copyFileSync(p, path.join(G, n));
  const elf = p => { try { const b = Buffer.alloc(4); const fd = fs.openSync(p, 'r'); fs.readSync(fd, b, 0, 4, 0); fs.closeSync(fd); return b.toString('latin1') === '\x7fELF'; } catch (e) { return false; } };
  const files = walk(root, ['glibc', 'lib'], f => (/[/\\](bin|libexec)[/\\]/.test(f)) && !fs.lstatSync(f).isSymbolicLink() && elf(f) && (fs.statSync(f).mode & 0o111) && !/\.so/.test(f));
  for (const f of files) {
    const rel = W(path.relative(path.dirname(f), G));
    fs.renameSync(f, f + '.real');
    fs.writeFileSync(f, `#!/bin/sh\n# uruchomienie z dołączoną glibc (pakiet działa też na starszych dystrybucjach)\nD=$(dirname "$(readlink -f "$0")")\nexec "$D/${rel}/ld-linux-x86-64.so.2" --library-path "$D/${rel}" --argv0 "$0" "$D/${path.basename(f)}.real" "$@"\n`, { mode: 0o755 });
  }
  log(`glibc dołączona, opakowanych programów: ${files.length}`);
}

export async function packageDesktop(platform, arch) {
  const plat = `${platform}-${arch}`, win = platform === 'win32', mac = platform === 'darwin';
  const html = path.join(P.dist, 'CappyTronic.html'); if (!has(html)) die('brak dist/CappyTronic.html – najpierw: node scripts/build-html.mjs');
  for (const d of ['arduino', 'cpp', 'stm']) if (!has(path.join(P.build, d))) die(`brak build/${d} – najpierw zbuduj rdzenie (node scripts/build-all.mjs)`);
  await fetchToolchains(plat);
  const STAGE = path.join(P.build, 'stage', plat); rm(STAGE);
  // 1) aplikacja: proces główny Electron + strona + zależności (serwer MQTT)
  const APPD = mkdir(path.join(STAGE, 'app'));
  for (const f of fs.readdirSync(P.electron)) if (f.endsWith('.js')) fs.copyFileSync(path.join(P.electron, f), path.join(APPD, f));
  fs.copyFileSync(html, path.join(APPD, 'index.html')); fs.copyFileSync(path.join(P.src, 'assets', 'icon-app.png'), path.join(APPD, 'icon.png'));
  const root = readJson(path.join(P.nm, '..', 'package.json'), {});
  fs.writeFileSync(path.join(APPD, 'package.json'), JSON.stringify({ name: 'cappytronic', productName: APP.name, version: APP.version, description: 'CappyTronic – symulator obwodów elektronicznych', main: 'main.js', author: 'CappySoft.pl', license: 'MIT', dependencies: root.dependencies }, null, 2));
  log('instalowanie zależności aplikacji (aedes, mqtt)…');
  runSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--no-package-lock'], { cwd: APPD });
  // 2) zasoby: kompilatory dla platformy docelowej + prekompilowane rdzenie
  const RES = mkdir(path.join(STAGE, 'resources'));
  log('kopiowanie i odchudzanie kompilatorów…');
  const avrSrc = process.env.AVR_GCC_DIR && plat === HOST ? process.env.AVR_GCC_DIR : toolsDir(plat, 'avr');
  copy(avrSrc, path.join(RES, 'toolchain')); pruneAvr(path.join(RES, 'toolchain'));
  pruneWasi(toolsDir(plat, 'wasi'), path.join(RES, 'wasi'), win);
  pruneArm(toolsDir(plat, 'arm'), path.join(RES, 'armgcc'), win);
  copy(path.join(P.build, 'arduino'), path.join(RES, 'arduino')); copy(path.join(P.build, 'cpp'), path.join(RES, 'cpp')); copy(path.join(P.build, 'stm'), path.join(RES, 'stm'));
  if (platform === 'linux' && HOST.startsWith('linux') && !args()['no-glibc']) await bundleGlibc(path.join(RES, 'toolchain'));
  // 3) Electron Packager
  const { packager } = await import('@electron/packager');
  const icon = path.join(P.src, 'assets', win ? 'icon.ico' : mac ? 'icon.icns' : 'icon-app.png');
  const outDir = mkdir(path.join(STAGE, 'out'));
  const [appPath] = await packager({ dir: APPD, name: APP.name, executableName: mac ? APP.name : 'cappytronic', platform, arch, electronVersion: APP.electron, out: outDir, overwrite: true, asar: true, icon,
    appVersion: APP.version, buildVersion: APP.version, appCopyright: APP.copyright, appBundleId: APP.id, appCategoryType: 'public.app-category.education',
    extraResource: ['toolchain', 'arduino', 'wasi', 'cpp', 'armgcc', 'stm'].map(d => path.join(RES, d)), prune: false,
    win32metadata: { CompanyName: 'CappySoft.pl', FileDescription: 'CappyTronic', ProductName: 'CappyTronic' } });
  // 4) pliki dodatkowe i archiwum
  const label = win ? 'Windows' : mac ? 'macOS' : 'Linux', name = `${APP.name}-${APP.version}-${label}-${arch}`, final = path.join(STAGE, name);
  fs.renameSync(appPath, final);
  const extra = path.join(P.packaging, win ? 'windows' : mac ? 'mac' : 'linux');
  for (const f of fs.readdirSync(extra)) fs.copyFileSync(path.join(extra, f), path.join(final, f));
  if (!win && !mac) { fs.copyFileSync(path.join(P.src, 'assets', 'icon-app.png'), path.join(final, 'cappytronic.png')); for (const f of ['CappyTronic.sh', 'install.sh', 'uninstall.sh']) fs.chmodSync(path.join(final, f), 0o755); }
  if (mac && process.platform === 'darwin') { const r = await run('codesign', ['--force', '--deep', '--sign', '-', path.join(final, APP.name + '.app')]); if (r.code) log('uwaga: podpis ad-hoc nie powiódł się:', r.out.slice(0, 300)); }
  mkdir(P.dist);
  const archive = path.join(P.dist, name + (win || mac ? '.zip' : '.tar.gz')); rm(archive);
  log('tworzenie archiwum', archive);
  let r;
  if (!win && !mac) r = await run('tar', ['-czf', archive, '-C', STAGE, name]);
  else if (process.platform === 'darwin') r = await run('ditto', ['-c', '-k', '--keepParent', '--sequesterRsrc', final, archive]);
  else if (process.platform === 'win32') r = await run('tar', ['-a', '-c', '-f', archive, '-C', STAGE, name]);
  else r = await run('zip', ['-qry', archive, name], { cwd: STAGE });
  if (r.code !== 0) die('nie udało się utworzyć archiwum: ' + r.out);
  log('GOTOWE:', archive);
  return archive;
}
if (isMain(import.meta.url)) {
  const a = args(); const platform = a.platform || process.platform; const arch = a.arch || (platform === 'darwin' && process.arch === 'arm64' ? 'arm64' : 'x64');
  await packageDesktop(platform, arch);
}
