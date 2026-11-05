// Ładuje zbudowaną stronę dist/CappyTronic.html do jsdom – testy działają bez przeglądarki.
const { JSDOM } = require('jsdom'); const fs = require('fs'); const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'dist', 'CappyTronic.html'), 'utf8');
const errs = [];
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/', beforeParse(w) {
  w.TextDecoder = TextDecoder; w.TextEncoder = TextEncoder; w.requestAnimationFrame = () => 0; w.addEventListener('error', e => errs.push(e.message));
  w.SVGElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 700, right: 1000, bottom: 700 });
  w.HTMLElement.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 200, right: 300, bottom: 200 });
  w.Range.prototype.getBoundingClientRect = () => ({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 }); w.Range.prototype.getClientRects = () => [];
} });
const w = dom.window; const ev = s => w.eval(s);
module.exports = { w, ev, errs };
if (require.main === module) setTimeout(() => { console.log('błędy ładowania:', errs); process.exit(errs.length ? 1 : 0); }, 500);
