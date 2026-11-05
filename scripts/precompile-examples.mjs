// Kompiluje szkice przykładów (Arduino AVR i STM32) do build/hexes.json – dzięki temu przykłady działają od razu,
// także w wersji HTML bez kompilatora. Użycie: node scripts/precompile-examples.mjs (wymaga zbudowanych rdzeni)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { P, HOST, toolsDir, log, die, bin, isMain } from './lib.mjs';
import { avrDir } from './build-avr-libs.mjs';
const require = createRequire(import.meta.url);

export async function precompileExamples() {
  const { makeCompiler } = require(path.join(P.electron, 'compiler.js'));
  const { makeStmCompiler } = require(path.join(P.electron, 'stmcompiler.js'));
  const src = fs.readFileSync(path.join(P.src, 'js', 'examples.js'), 'utf8');
  // obiekt SKETCH jest zwykłym literałem z szablonami – wycinamy go i wyliczamy
  const a = src.indexOf('const SKETCH'), b = src.indexOf('\nconst G', a + 10);
  const SKETCH = new Function(src.slice(a, b) + '\nreturn SKETCH;')();
  const avr = makeCompiler({ gccBin: path.dirname(bin(avrDir(), 'avr-gcc')), arduinoDir: path.join(P.build, 'arduino') });
  const stm = makeStmCompiler({ gccBin: path.dirname(bin(toolsDir(HOST, 'arm'), 'arm-none-eabi-gcc')), stmDir: path.join(P.build, 'stm'), libsrcDir: path.join(P.build, 'cpp', 'libsrc') });
  const out = {}; let bad = 0;
  for (const [k, code] of Object.entries(SKETCH)) {
    const r = k.startsWith('stm_') ? await stm({ code }) : await avr({ code, target: 'uno' });
    if (r.ok) out[k] = r.hex; else { bad++; log('BŁĄD kompilacji przykładu', k, JSON.stringify(r.diags).slice(0, 300)); }
  }
  fs.writeFileSync(path.join(P.build, 'hexes.json'), JSON.stringify(out));
  log(`przykłady: ${Object.keys(out).length} skompilowanych, ${bad} błędów`);
  if (bad) die('nie wszystkie przykłady się kompilują');
}
if (isMain(import.meta.url)) await precompileExamples();
