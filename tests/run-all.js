// Uruchamia wszystkie testy (wymaga zbudowanej strony: npm run build:html). Wynik: lista ✓ / ? / ✗ z każdego zestawu.
const { spawnSync } = require('child_process'); const path = require('path'); const fs = require('fs');
const order = ['test.js', 't_upload.js', 't_parts.js', 't_lcsc.js', 't_examples.js', 't_opamp.js', 't_pic.js', 't_stm.js', 't_periph.js', 't_periph2.js', 't_periph3.js', 't_periph4.js', 't_periph5.js', 't_periph6.js', 't_motion.js', 't_can2.js', 't_kicad.js'];
const only = process.argv.slice(2); let bad = 0;
for (const f of order) {
  if (only.length && !only.some(o => f.includes(o))) continue;
  process.stdout.write(`\n=== ${f}\n`);
  const r = spawnSync(process.execPath, [path.join(__dirname, f)], { encoding: 'utf8', timeout: 20 * 60 * 1000, cwd: __dirname });
  const out = (r.stdout || '') + (r.stderr || ''); const lines = out.split('\n');
  const fails = lines.filter(l => /^(✗|\?)\s/.test(l) || /^EXC|Error:/.test(l));
  console.log(lines.filter(l => /^(✓|✗|\?)\s|błędy|errors|bad/.test(l)).slice(-40).join('\n'));
  if (r.status !== 0 || fails.length) bad++;
}
console.log(bad ? `\nZestawy z problemami: ${bad}` : '\nWszystkie testy zaliczone.'); process.exit(bad ? 1 : 0);
