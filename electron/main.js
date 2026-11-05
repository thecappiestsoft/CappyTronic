// CappyTronic – proces główny (Electron). Działa offline; sieć tylko dla MQTT/HTTP płytek (domyślnie sieć lokalna).
const { app, BrowserWindow, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { makeCompiler } = require('./compiler.js');
const { makeCppCompiler } = require('./cppcompiler.js');
const { makeStmCompiler } = require('./stmcompiler.js');
const netx = require('./net.js');
// MicroPython działa w osobnym wątku i synchronizuje się przez SharedArrayBuffer
app.commandLine.appendSwitch('enable-features', 'SharedArrayBuffer');
// programy C++ (WebAssembly) mogą odwołać się poza pamięć – jawne sprawdzanie granic zamiast obsługi sygnałów (inaczej błąd programu zamyka okno)
app.commandLine.appendSwitch('js-flags', '--wasm-enforce-bounds-checks');
let mainWin = null;

app.setAppUserModelId('pl.infotech.cappytronic');
const ascii = p => /^[\x00-\x7F]*$/.test(p);

// GCC dla Windows nie obsługuje ścieżek z polskimi znakami – w razie potrzeby kopiujemy kompilator w bezpieczne miejsce
function toolRoot() {
  const res = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', 'dev-resources');
  if (ascii(res)) return res;
  const base = path.join(process.env.ProgramData || 'C:\\ProgramData', 'CappyTronic', app.getVersion());
  const alt = ascii(base) ? base : path.join('C:\\CappyTronicData', app.getVersion());
  const marker = path.join(alt, '.ok');
  if (!fs.existsSync(marker)) {
    fs.mkdirSync(alt, { recursive: true });
    for (const d of ['toolchain', 'arduino', 'wasi', 'cpp', 'armgcc', 'stm']) fs.cpSync(path.join(res, d), path.join(alt, d), { recursive: true });
    fs.writeFileSync(marker, 'ok');
  }
  return alt;
}
function tmpBase() {
  const cands = [os.tmpdir(), path.join(process.env.PUBLIC || 'C:\\Users\\Public', 'CappyTronic', 'tmp'), path.join(process.env.ProgramData || 'C:\\ProgramData', 'CappyTronic', 'tmp')];
  for (const c of cands) { if (!ascii(c)) continue; try { fs.mkdirSync(c, { recursive: true }); fs.accessSync(c, fs.constants.W_OK); return c; } catch (e) { } }
  return os.tmpdir();
}
let compiler = null;
function getCompiler() {
  if (compiler) return compiler;
  const root = toolRoot();
  const base = tmpBase();
  compiler = makeCompiler({ gccBin: path.join(root, 'toolchain', 'bin'), arduinoDir: path.join(root, 'arduino'), tmpBase: base });
  return compiler;
}

// Wgrywanie do urządzeń: Web Serial w oknie aplikacji. Electron prosi o wybór portu – listę pokazujemy w oknie CappyTronic.
let serialPick = null;
function serialSetup(w) {
  const ses = w.webContents.session;
  ses.setPermissionCheckHandler(() => true); // jak domyślnie, w tym dostęp do portów szeregowych
  ses.setDevicePermissionHandler(d => d.deviceType === 'serial');
  ses.on('select-serial-port', (event, list, wc, callback) => {
    event.preventDefault();
    if (serialPick) { try { serialPick(''); } catch (e) { } }
    serialPick = callback;
    wc.send('serial:ports', list.map(p => ({ portId: p.portId, portName: p.portName, displayName: p.displayName, vendorId: p.vendorId, productId: p.productId, serialNumber: p.serialNumber })));
  });
}
ipcMain.on('serial:choose', (e, id) => { const cb = serialPick; serialPick = null; if (cb) cb(id || ''); });
function create() {
  const w = new BrowserWindow({
    width: 1440, height: 880, minWidth: 980, minHeight: 620, title: 'CappyTronic', backgroundColor: '#12181d',
    icon: path.join(__dirname, 'icon.png'), autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false },
  });
  mainWin = w;
  w.on('closed', () => { mainWin = null; netx.endAll(); });
  Menu.setApplicationMenu(null);
  // strona aplikacji nie łączy się z siecią (MQTT/HTTP płytek idzie przez proces główny z kontrolą adresów)
  w.webContents.session.webRequest.onBeforeRequest((d, cb) => cb({ cancel: /^(https?|wss?|ftp):/i.test(d.url) }));
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  serialSetup(w);
  w.webContents.on('will-navigate', e => e.preventDefault());
  w.loadFile(path.join(__dirname, 'index.html'));
}
ipcMain.handle('compile', async (e, o) => {
  try { return await getCompiler()({ code: String(o.code || ''), target: String(o.target || 'uno') }); }
  catch (err) { return { ok: false, diags: [{ line: 0, col: 0, type: 'error', msg: 'Kompilator: ' + (err && err.message || err) }], log: String(err && err.stack || err) }; }
});
// C++ (Arduino) dla płytek ESP32 / ESP8266 / Pico W: clang (wasi-sdk) -> WebAssembly
let cppc = null;
function getCppCompiler() {
  if (cppc) return cppc;
  const root = toolRoot();
  cppc = makeCppCompiler({ clangBin: path.join(root, 'wasi', 'bin'), cppDir: path.join(root, 'cpp'), tmpBase: tmpBase() });
  return cppc;
}
ipcMain.handle('compileCpp', async (e, o) => {
  try { return await getCppCompiler()({ code: String(o.code || ''), board: String(o.board || 'esp32c3zero') }); }
  catch (err) { return { ok: false, diags: [{ line: 0, col: 0, type: 'error', msg: 'Kompilator C++: ' + (err && err.message || err) }], log: String(err && err.stack || err) }; }
});
// STM32F103 (Blue Pill): arm-none-eabi-gcc + rdzeń Arduino CappyTronic
let stmc = null;
function getStmCompiler() {
  if (stmc) return stmc;
  const root = toolRoot();
  stmc = makeStmCompiler({ gccBin: path.join(root, 'armgcc', 'bin'), stmDir: path.join(root, 'stm'), libsrcDir: path.join(root, 'cpp', 'libsrc'), tmpBase: tmpBase() });
  return stmc;
}
ipcMain.handle('compileStm', async (e, o) => {
  try { return await getStmCompiler()({ code: String(o.code || '') }); }
  catch (err) { return { ok: false, diags: [{ line: 0, col: 0, type: 'error', msg: 'Kompilator STM32: ' + (err && err.message || err) }], log: String(err && err.stack || err) }; }
});
const FILTERS = { cappy: [{ name: 'CappyTronic', extensions: ['cappy'] }], json: [{ name: 'JSON', extensions: ['json'] }], kicad_sch: [{ name: 'KiCad – schemat', extensions: ['kicad_sch'] }], net: [{ name: 'KiCad – netlista', extensions: ['net'] }], py: [{ name: 'MicroPython', extensions: ['py'] }], cpp: [{ name: 'C++ (Arduino)', extensions: ['ino', 'cpp'] }], asm: [{ name: 'Asembler PIC', extensions: ['asm', 'inc', 's'] }], hex: [{ name: 'Intel HEX', extensions: ['hex'] }], ino: [{ name: 'Arduino', extensions: ['ino'] }] };
ipcMain.handle('saveFile', async (e, name, data, kind) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), String(name)), filters: FILTERS[kind || 'cappy'] || FILTERS.cappy });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, String(data), 'utf8');
  return path.basename(r.filePath);
});
netx.setup(ipcMain, () => mainWin);
app.whenReady().then(() => { create(); netx.startBroker().catch(() => { }); });
app.on('window-all-closed', () => app.quit());
