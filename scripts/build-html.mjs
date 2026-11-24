// Składa całą aplikację w jeden samowystarczalny plik dist/CappyTronic.html (działa offline w przeglądarce;
// ten sam plik jest stroną aplikacji desktopowej). Użycie: node scripts/build-html.mjs
import fs from 'node:fs';
import path from 'node:path';
import { MODULES, APP } from './config.mjs';
import { P, mkdir, log, die, walk, readJson, isMain } from './lib.mjs';

const read = (p, enc = 'utf8') => fs.readFileSync(p, enc);
const b64 = p => fs.readFileSync(p).toString('base64');
const nm = (...a) => path.join(P.nm, ...a);

// czcionki (Fontsource) osadzone jako data: URL
const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT = 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';
function fonts() {
  let css = '';
  for (const [fam, pkg, weights] of [['Baloo 2', 'baloo-2', [700, 800]], ['Lexend', 'lexend', [400, 500, 600]], ['JetBrains Mono', 'jetbrains-mono', [500]]])
    for (const w of weights) for (const [sub, rng] of [['latin', LATIN], ['latin-ext', LATIN_EXT]])
      css += `@font-face{font-family:'${fam}';font-style:normal;font-weight:${w};font-display:swap;src:url(data:font/woff2;base64,${b64(nm('@fontsource', pkg, 'files', `${pkg}-${sub}-${w}-normal.woff2`))}) format('woff2');unicode-range:${rng}}\n`;
  return css;
}
// emulator AVR (avr8js) jako jeden skrypt IIFE
async function avr8js() {
  const out = path.join(P.build, 'avr8js.iife.js');
  const { build } = await import('esbuild');
  await build({ entryPoints: [path.join(P.src, 'avr8js-entry.js')], bundle: true, format: 'iife', globalName: 'AVR8', outfile: out, minify: true, logLevel: 'warning' });
  return read(out);
}
export async function buildHtml() {
  mkdir(P.build); mkdir(P.dist);
  const MP = nm('@micropython', 'micropython-webassembly-pyscript');
  if (!fs.existsSync(MP)) die('brak pakietów npm – uruchom: npm install');
  const A = f => path.join(P.src, 'assets', f);
  // pliki MicroPythona (moduły symulatora i sterowniki) – wirtualny system plików
  const pyRoot = path.join(P.src, 'micropython', 'lib');
  const pyFiles = walk(pyRoot, ['__pycache__'], f => f.endsWith('.py')).map(f => ['/lib/' + path.relative(pyRoot, f).split(path.sep).join('/'), read(f)]).sort((a, b) => a[0] < b[0] ? -1 : 1);
  const hexes = readJson(path.join(P.build, 'hexes.json'), {});
  if (!Object.keys(hexes).length) log('uwaga: brak build/hexes.json – przykłady Arduino będą wymagały kompilacji (npm run examples)');
  let app = `const MP_WASM_B64=${JSON.stringify(b64(path.join(MP, 'micropython.wasm')))};\n` +
    `const MP_WORKER_SRC=${JSON.stringify(read(path.join(MP, 'micropython.mjs')) + '\n' + read(path.join(P.src, 'micropython', 'worker.js')))};\n` +
    `const CPP_WORKER_SRC=${JSON.stringify(read(path.join(P.src, 'cpp-wasm', 'worker.js')))};\n` +
    `const PY_FILES=${JSON.stringify(pyFiles)};\n` +
    `const HD_A00=new Uint8Array(${read(A('hd44780a00.json')).trim()});\nconst PINMAP=${read(A('pinmaps.json')).trim()};\nconst FONT5=${read(A('font5x7.json')).trim()};\n` +
    `const APP_VERSION=${JSON.stringify(APP.version)};\n`;
  for (const m of MODULES) app += `\n/* ===== ${m}.js ===== */\n` + read(path.join(P.src, 'js', m + '.js'));
  app = app.replace('/*HEXES*/{}', JSON.stringify(hexes)) + '\nboot();\n';
  const cm = ['lib/codemirror.js', 'mode/clike/clike.js', 'addon/edit/matchbrackets.js', 'addon/edit/closebrackets.js', 'mode/python/python.js'].map(f => read(nm('codemirror', f))).join('\n');
  const scripts = (await avr8js()) + '\n;\n' + cm + '\n;\n' + app;
  let html = read(path.join(P.src, 'shell.html'))
    .replace('/*FONTS*/', () => fonts()).replace('/*CMCSS*/', () => read(nm('codemirror', 'lib', 'codemirror.css')))
    .replaceAll('%%ICON%%', 'data:image/png;base64,' + b64(A('icon160.png'))).replaceAll('%%CAPPY%%', 'data:image/png;base64,' + b64(A('cappy.png')))
    .replace('<script>/*SCRIPTS*/</script>', () => '<script>' + scripts.replace(/<\/script/g, '<\\/script') + '</script>');
  const out = path.join(P.dist, 'CappyTronic.html'); fs.writeFileSync(out, html);
  log(`HTML: ${out} (${Math.round(html.length / 1024)} KB)`);
  return out;
}
if (isMain(import.meta.url)) await buildHtml();
