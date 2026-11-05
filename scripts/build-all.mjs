// Pełne budowanie CappyTronic z kodu źródłowego.
// Użycie: node scripts/build-all.mjs --target=html|linux|win|mac [--arch=x64|arm64] [--skip-fetch] [--skip-cores]
//  html  – pojedynczy plik dist/CappyTronic.html (działa offline w przeglądarce)
//  linux / win / mac – aplikacja desktopowa z kompilatorami (archiwum w dist/)
import { args, log, die, HOST } from './lib.mjs';
import { fetchToolchains, fetchArduinoSources } from './fetch-deps.mjs';
import { buildAvrLibs } from './build-avr-libs.mjs';
import { buildWasmCores } from './build-wasm-cores.mjs';
import { buildStm32Core } from './build-stm32-core.mjs';
import { precompileExamples } from './precompile-examples.mjs';
import { buildHtml } from './build-html.mjs';
import { packageDesktop } from './package-desktop.mjs';

const a = args(); const target = a.target || 'html';
const map = { linux: 'linux', win: 'win32', windows: 'win32', win32: 'win32', mac: 'darwin', macos: 'darwin', darwin: 'darwin' };
if (target !== 'html' && !map[target]) die('nieznany cel: ' + target + ' (html, linux, win, mac)');
const t0 = Date.now();
log(`cel: ${target}, komputer budujący: ${HOST}`);
if (!a['skip-fetch']) { log('1/5 pobieranie kompilatorów i bibliotek Arduino'); await fetchToolchains(HOST); await fetchArduinoSources(); }
if (!a['skip-cores']) {
  log('2/5 prekompilacja rdzenia Arduino AVR i bibliotek'); await buildAvrLibs();
  log('3/5 rdzeń C++ (WebAssembly) dla ESP32/ESP8266/Pico i rdzeń STM32'); await buildWasmCores(); await buildStm32Core();
  log('4/5 kompilacja przykładów'); await precompileExamples();
}
log('5/5 składanie strony'); await buildHtml();
if (target !== 'html') {
  const platform = map[target]; const arch = a.arch || (platform === 'darwin' && process.arch === 'arm64' ? 'arm64' : 'x64');
  log(`pakowanie aplikacji: ${platform}-${arch}`); await packageDesktop(platform, arch);
}
log(`zakończono w ${Math.round((Date.now() - t0) / 1000)} s`);
