'use strict';
/* ===== płytki z MicroPythonem ===== */
const pyInfo = (pl, en) => ({ pl: pl + ' Program piszesz w MicroPythonie w zakładce „Kod”; uruchamia się razem z symulacją. Wbudowane moduły: machine, time, network, neopixel, umqtt, urequests, ssd1306, sh1106, i2c_lcd.', en: en + ' Write the program in MicroPython in the “Code” tab; it runs together with the simulation. Built-in modules: machine, time, network, neopixel, umqtt, urequests, ssd1306, sh1106, i2c_lcd.' });
function pyBoardDraw(spec) {
  return (c, r, pins) => {
    const [x0, y0, x1, y1] = spec.rect;
    let s = `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="${spec.radius || 8}" fill="${spec.col}" stroke="${spec.edge}" stroke-width="2"/>`;
    if (spec.usb) s += `<rect x="${spec.usb[0]}" y="${spec.usb[1]}" width="${spec.usb[2]}" height="${spec.usb[3]}" rx="4" fill="#c9cfd5" stroke="#6f777f" stroke-width="2"/><rect x="${spec.usb[0] + 6}" y="${spec.usb[1] + spec.usb[3] / 2 - 3}" width="${spec.usb[2] - 12}" height="6" rx="3" fill="#2b3036"/>`;
    if (spec.antenna) { const [ax, ay, aw, ah] = spec.antenna; s += `<rect x="${ax}" y="${ay}" width="${aw}" height="${ah}" fill="#1c3f7a" stroke="#0f2450"/><path d="M${ax + 6} ${ay + ah - 6}h${aw - 12}M${ax + 6} ${ay + ah - 6}v-${ah - 14}h12v${ah - 20}h12v${ah - 20}h12v${ah - 20}h12" stroke="#d4b14a" stroke-width="2" fill="none"/>`; }
    if (spec.shield) { const [cx, cy, w, h] = spec.shield; s += `<rect x="${cx}" y="${cy}" width="${w}" height="${h}" rx="3" fill="#b9c0c8" stroke="#7b838c"/>` + tx(cx + w / 2, cy + h / 2 + 3, spec.chipLabel, { s: 8, c: '#3a4048', f: FONT_M }); }
    if (spec.chip) { const [cx, cy, w, h] = spec.chip; s += `<rect x="${cx}" y="${cy}" width="${w}" height="${h}" rx="3" fill="#1d1f22" stroke="#000"/>` + tx(cx + w / 2, cy + h / 2 + 3, spec.chipLabel, { s: 7.5, c: '#c7ccd2', f: FONT_M }); }
    for (const p of pins) s += `<circle cx="${p.x}" cy="${p.y}" r="7.5" fill="#d4b14a"/><circle cx="${p.x}" cy="${p.y}" r="3.6" fill="#3c4146"/>`;
    for (const p of pins) { const side = spec.labelSide(p); const lbl = p.s; s += tx(p.x + side[0], p.y + side[1], lbl, { s: 6.2, w: 500, c: '#f1f4f7', f: FONT_M, a: side[2] || 'middle' }); }
    if (spec.np) { const [lx, ly] = spec.np, col = r.np && (r.np[0] + r.np[1] + r.np[2] > 6) ? `rgb(${Math.min(255, r.np[0] * 1.2 + 40)},${Math.min(255, r.np[1] * 1.2 + 40)},${Math.min(255, r.np[2] * 1.2 + 40)})` : null;
      if (col) s += `<circle cx="${lx + 7}" cy="${ly + 7}" r="34" fill="${glow(col.startsWith('rgb') ? '#ffffff' : col)}" opacity=".35"/><circle cx="${lx + 7}" cy="${ly + 7}" r="20" fill="${col}" opacity=".45"/>`;
      s += `<rect x="${lx}" y="${ly}" width="14" height="14" rx="2" fill="${col || '#f4f4f0'}" stroke="#888"/>` + tx(lx + 7, ly + 24, 'RGB', { s: 5.5, c: '#cfd5db' }); }
    if (spec.led) { const [lx, ly, colr] = spec.led; s += (r.L ? `<circle cx="${lx + 5}" cy="${ly + 3}" r="16" fill="${glow(colr)}" opacity=".9"/>` : '') + `<rect x="${lx}" y="${ly}" width="10" height="6" rx="1" fill="${r.L ? colr : '#40505a'}"/>` + tx(lx + 5, ly - 3, 'LED', { s: 5.5, c: '#e6f1f2' }); }
    if (spec.pwr && spec.pwr.length) { const [lx, ly] = spec.pwr; s += `<rect x="${lx}" y="${ly}" width="10" height="6" rx="1" fill="${r.run !== undefined ? '#e5484d' : '#5a2a2a'}"/>` + tx(lx + 5, ly - 3, 'PWR', { s: 5.5, c: '#e6f1f2' }); }
    for (const b of spec.buttons || []) s += `<rect x="${b[0] - 9}" y="${b[1] - 7}" width="18" height="14" rx="2" fill="#d9dde2" stroke="#7d858e"/><rect x="${b[0] - 5}" y="${b[1] - 4}" width="10" height="8" rx="1" fill="#30353b"/>` + tx(b[0], b[1] + 16, b[2], { s: 5.5, c: '#e6f1f2' });
    if (r.wifi) s += `<g transform="translate(${spec.wifiAt[0]} ${spec.wifiAt[1]})"><path d="M-9 -2a13 13 0 0 1 18 0M-6 2a8 8 0 0 1 12 0" stroke="#5ef08a" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="0" cy="5" r="2" fill="#5ef08a"/></g>`;
    s += tx(spec.title[0], spec.title[1], spec.titleText, { s: spec.titleSize || 11, w: 800, c: 'rgba(255,255,255,.9)', f: FONT_D, r: spec.titleRot || 0 });
    if (spec.sub) s += tx(spec.title[0], spec.title[1] + 11, spec.sub, { s: 6, w: 500, c: 'rgba(255,255,255,.6)' });
    return s;
  };
}
// ---------- ESP32-C3-Zero (Waveshare) ----------
(function () {
  const L1 = ['5V', '3V3', 'GND'];
  const left = [['5V', '5V'], ['GND', 'GND'], ['3V3', '3V3'], ['G4', 'GP4'], ['G3', 'GP3'], ['G2', 'GP2'], ['G1', 'GP1'], ['G0', 'GP0']];
  const right = [['G21', 'TX'], ['G20', 'RX'], ['G10', 'GP10'], ['G9', 'GP9'], ['G8', 'GP8'], ['G7', 'GP7'], ['G6', 'GP6'], ['G5', 'GP5']];
  const long = { G21: 'GPIO21 (TX)', G20: 'GPIO20 (RX)', G10: 'GPIO10 (WS2812)', G9: 'GPIO9 (BOOT, SCL)', G8: 'GPIO8 (SDA)', G4: 'GPIO4 (ADC)', G3: 'GPIO3 (ADC)', G2: 'GPIO2 (ADC)', G1: 'GPIO1 (ADC)', G0: 'GPIO0 (ADC)', G5: 'GPIO5', G6: 'GPIO6 (SCK)', G7: 'GPIO7 (MOSI)', G18: 'GPIO18 (USB D−)', G19: 'GPIO19 (USB D+)' };
  const pins = [];
  left.forEach(([fn, s], i) => pins.push({ x: 0, y: i * 20, fn, s, n: long[fn] || s }));
  right.forEach(([fn, s], i) => pins.push({ x: 140, y: i * 20, fn, s, n: long[fn] || s }));
  pins.push({ x: 40, y: 180, fn: 'G18', s: 'GP18', n: long.G18 }, { x: 100, y: 180, fn: 'G19', s: 'GP19', n: long.G19 });
  pyBoardPart('esp32c3zero', {
    name: 'ESP32-C3-Zero', sub: { pl: 'Waveshare, Wi-Fi + BLE, RISC-V 160 MHz', en: 'Waveshare, Wi-Fi + BLE, RISC-V 160 MHz' }, short: 'c3zero',
    kw: 'esp32 c3 esp32-c3 zero waveshare wifi bluetooth micropython python iot mqtt risc-v mikrokontroler microcontroller',
    info: pyInfo('Miniaturowa płytka Waveshare z układem ESP32-C3 (Wi-Fi, Bluetooth LE). Logika 3,3 V – nie podawaj 5 V na piny GPIO. Wbudowana dioda RGB WS2812 na GPIO10, przycisk BOOT na GPIO9, wejścia analogowe (ADC) na GPIO0–4. GPIO18/19 to linie USB.', 'A tiny Waveshare board with the ESP32-C3 chip (Wi-Fi, Bluetooth LE). 3.3 V logic – never apply 5 V to GPIO pins. Built-in WS2812 RGB LED on GPIO10, BOOT button on GPIO9, analog inputs (ADC) on GPIO0–4. GPIO18/19 are the USB lines.'),
    pins, bbox: [-16, -66, 156, 194], wifi: true, freq: 160000000,
    adc: [0, 1, 2, 3, 4], i2c: { 0: [9, 8] }, spi: { 1: [6, 7, 2] }, uart: { 0: [21, 20], 1: [21, 20] }, led: { np: 10 },
    code: `# ESP32-C3-Zero: wbudowana dioda RGB (WS2812) na GPIO10
from machine import Pin
import neopixel, time

np = neopixel.NeoPixel(Pin(10), 1)
kolory = [(255, 0, 0), (0, 255, 0), (0, 0, 255)]

while True:
    for k in kolory:
        np[0] = k
        np.write()
        print("Kolor:", k)
        time.sleep(0.5)
`,
    draw: pyBoardDraw({ rect: [-14, -48, 154, 192], col: '#16181b', edge: '#000', radius: 10, usb: [42, -64, 56, 30], chip: [36, 22, 68, 56], chipLabel: 'ESP32-C3', np: [63, 96], buttons: [[30, -30, 'BOOT'], [110, -30, 'RST']], wifiAt: [70, 140],
      title: [70, 132], titleText: 'C3-Zero', titleSize: 9, labelSide: p => p.y >= 180 ? [0, -12] : p.x === 0 ? [12, 2.5, 'start'] : [-12, 2.5, 'end'] }),
  });
})();
// ---------- ESP32 DevKit V1 (30 pin, DOIT) ----------
(function () {
  const left = [['NC', 'EN'], ['G36', 'VP'], ['G39', 'VN'], ['G34', 'D34'], ['G35', 'D35'], ['G32', 'D32'], ['G33', 'D33'], ['G25', 'D25'], ['G26', 'D26'], ['G27', 'D27'], ['G14', 'D14'], ['G12', 'D12'], ['G13', 'D13'], ['GND', 'GND'], ['5V', 'VIN']];
  const right = [['G23', 'D23'], ['G22', 'D22'], ['G1', 'TX0'], ['G3', 'RX0'], ['G21', 'D21'], ['G19', 'D19'], ['G18', 'D18'], ['G5', 'D5'], ['G17', 'TX2'], ['G16', 'RX2'], ['G4', 'D4'], ['G2', 'D2'], ['G15', 'D15'], ['GND', 'GND'], ['3V3', '3V3']];
  const pins = [];
  const nm = (fn, s) => fn.startsWith('G') && fn !== 'GND' ? `GPIO${fn.slice(1)} (${s})` : s;
  left.forEach(([fn, s], i) => pins.push({ x: 0, y: i * 20, fn, s, n: nm(fn, s) }));
  right.forEach(([fn, s], i) => pins.push({ x: 120, y: i * 20, fn, s, n: nm(fn, s) }));
  pyBoardPart('esp32devkit', {
    name: 'ESP32 DevKit V1', sub: { pl: '30 pinów, Wi-Fi + Bluetooth, 240 MHz', en: '30 pins, Wi-Fi + Bluetooth, 240 MHz' }, short: 'esp32',
    kw: 'esp32 devkit doit wroom wifi bluetooth micropython python iot mqtt mikrokontroler microcontroller',
    info: pyInfo('Popularna płytka z modułem ESP32-WROOM-32 (Wi-Fi, Bluetooth). Logika 3,3 V. Niebieska dioda na GPIO2. Wejścia analogowe: GPIO32–39 oraz 0, 2, 4, 12–15, 25–27. GPIO34–39 działają tylko jako wejścia.', 'A popular board with the ESP32-WROOM-32 module (Wi-Fi, Bluetooth). 3.3 V logic. Blue LED on GPIO2. Analog inputs: GPIO32–39 and 0, 2, 4, 12–15, 25–27. GPIO34–39 are input-only.'),
    pins, bbox: [-16, -76, 136, 302], wifi: true, freq: 240000000,
    adc: [32, 33, 34, 35, 36, 39, 0, 2, 4, 12, 13, 14, 15, 25, 26, 27], i2c: { 0: [18, 19], 1: [25, 26] }, spi: { 1: [14, 13, 12], 2: [18, 23, 19] }, uart: { 0: [1, 3], 1: [17, 16], 2: [17, 16] }, led: { pin: 2 },
    code: `# ESP32 DevKit: miganie wbudowaną diodą (GPIO2)
from machine import Pin
import time

led = Pin(2, Pin.OUT)
while True:
    led.toggle()
    print("LED:", led.value())
    time.sleep(0.5)
`,
    draw: pyBoardDraw({ rect: [-14, -74, 134, 300], col: '#1c3048', edge: '#0d1a2a', radius: 6, antenna: [12, -72, 96, 40], shield: [14, -28, 92, 96], chipLabel: 'ESP32-WROOM', usb: [32, 284, 56, 26], led: [94, 248, '#3b82ff'], pwr: [16, 248], buttons: [[16, 270, 'EN'], [104, 270, 'BOOT']], wifiAt: [60, 100],
      title: [60, 140], titleText: 'ESP32', titleSize: 12, labelSide: p => p.x === 0 ? [12, 2.5, 'start'] : [-12, 2.5, 'end'] }),
  });
})();
// ---------- Raspberry Pi Pico W ----------
(function () {
  const left = ['G0', 'G1', 'GND', 'G2', 'G3', 'G4', 'G5', 'GND', 'G6', 'G7', 'G8', 'G9', 'GND', 'G10', 'G11', 'G12', 'G13', 'GND', 'G14', 'G15'];
  const right = [['5V', 'VBUS'], ['5V', 'VSYS'], ['GND', 'GND'], ['NC', '3V3_EN'], ['3V3', '3V3'], ['NC', 'ADC_VREF'], ['G28', 'GP28'], ['GND', 'AGND'], ['G27', 'GP27'], ['G26', 'GP26'], ['NC', 'RUN'], ['G22', 'GP22'], ['GND', 'GND'], ['G21', 'GP21'], ['G20', 'GP20'], ['G19', 'GP19'], ['G18', 'GP18'], ['GND', 'GND'], ['G17', 'GP17'], ['G16', 'GP16']];
  const pins = [];
  left.forEach((fn, i) => { const s = fn === 'GND' ? 'GND' : 'GP' + fn.slice(1); pins.push({ x: 0, y: i * 20, fn, s, n: `${i + 1}: ${s}`, num: i + 1 }); });
  right.forEach(([fn, s], i) => pins.push({ x: 140, y: i * 20, fn, s, n: `${40 - i}: ${s}${['G26', 'G27', 'G28'].includes(fn) ? ' (ADC' + (+fn.slice(1) - 26) + ')' : ''}`, num: 40 - i }));
  pyBoardPart('picow', {
    name: 'Raspberry Pi Pico W', sub: { pl: 'RP2040, Wi-Fi, 133 MHz', en: 'RP2040, Wi-Fi, 133 MHz' }, short: 'picow',
    kw: 'raspberry pi pico w rp2040 wifi micropython python iot mqtt mikrokontroler microcontroller',
    info: pyInfo('Płytka Raspberry Pi z układem RP2040 i modułem Wi-Fi. Logika 3,3 V. Wbudowana dioda: Pin("LED"). Wejścia analogowe ADC0–2 na GP26–28. Domyślne I2C(0): SDA=GP8, SCL=GP9.', 'A Raspberry Pi board with the RP2040 chip and Wi-Fi. 3.3 V logic. Built-in LED: Pin("LED"). Analog inputs ADC0–2 on GP26–28. Default I2C(0): SDA=GP8, SCL=GP9.'),
    pins, bbox: [-16, -46, 156, 396], wifi: true, freq: 133000000, names: { LED: 64 }, hidden: [64],
    adc: [26, 27, 28], i2c: { 0: [9, 8], 1: [7, 6] }, spi: { 0: [18, 19, 16], 1: [10, 11, 12] }, uart: { 0: [0, 1], 1: [4, 5] }, led: { pin: 64 },
    code: `# Raspberry Pi Pico W: miganie wbudowaną diodą
from machine import Pin
import time

led = Pin("LED", Pin.OUT)
while True:
    led.toggle()
    time.sleep(0.5)
`,
    draw: pyBoardDraw({ rect: [-14, -30, 154, 394], col: '#1f7a3a', edge: '#0f4a22', radius: 6, usb: [42, -46, 56, 26], chip: [40, 150, 60, 60], chipLabel: 'RP2040', shield: [34, 300, 72, 60], led: [26, -14, '#3ddc63'], buttons: [[104, 24, 'BOOTSEL']], wifiAt: [70, 270],
      title: [70, 250], titleText: 'Pico W', titleSize: 11, labelSide: p => p.x === 0 ? [12, 2.5, 'start'] : [-12, 2.5, 'end'] }),
  });
})();
// ---------- NodeMCU v2 (ESP-12E, ESP8266) ----------
(function () {
  // układ pinów NodeMCU „Amica” (30 pinów), antena u góry
  const left = [['G17', 'A0'], ['NC', 'RSV'], ['NC', 'RSV'], ['G10', 'SD3'], ['G9', 'SD2'], ['NC', 'SD1'], ['NC', 'CMD'], ['NC', 'SD0'], ['NC', 'CLK'], ['GND', 'GND'], ['3V3', '3V3'], ['NC', 'EN'], ['NC', 'RST'], ['GND', 'GND'], ['5V', 'Vin']];
  const right = [['G16', 'D0'], ['G5', 'D1'], ['G4', 'D2'], ['G0', 'D3'], ['G2', 'D4'], ['3V3', '3V3'], ['GND', 'GND'], ['G14', 'D5'], ['G12', 'D6'], ['G13', 'D7'], ['G15', 'D8'], ['G3', 'RX'], ['G1', 'TX'], ['GND', 'GND'], ['3V3', '3V3']];
  const extra = { G17: 'A0 (ADC, 0–3,2 V)', G16: 'GPIO16 (D0, WAKE)', G5: 'GPIO5 (D1, SCL)', G4: 'GPIO4 (D2, SDA)', G0: 'GPIO0 (D3, FLASH)', G2: 'GPIO2 (D4, LED)', G14: 'GPIO14 (D5, SCK)', G12: 'GPIO12 (D6, MISO)', G13: 'GPIO13 (D7, MOSI)', G15: 'GPIO15 (D8, CS)', G3: 'GPIO3 (RX)', G1: 'GPIO1 (TX)', G10: 'GPIO10 (SD3)', G9: 'GPIO9 (SD2)' };
  const pins = [];
  left.forEach(([fn, s], i) => pins.push({ x: 0, y: i * 20, fn, s, n: extra[fn] || s }));
  right.forEach(([fn, s], i) => pins.push({ x: 160, y: i * 20, fn, s, n: extra[fn] || s }));
  pyBoardPart('nodemcu', {
    name: 'NodeMCU (ESP8266)', sub: { pl: 'ESP-12E, Wi-Fi, 80 MHz', en: 'ESP-12E, Wi-Fi, 80 MHz' }, short: 'esp8266', port: 'esp8266',
    kw: 'esp8266 nodemcu esp-12e esp12 lolin amica wifi micropython python iot mqtt mikrokontroler microcontroller',
    info: pyInfo('Płytka NodeMCU z modułem ESP-12E (układ ESP8266, Wi-Fi 2,4 GHz). Logika 3,3 V. W kodzie używasz numerów GPIO, nie napisów D1–D8 (np. D1 = Pin(5), D4 = Pin(2)). Niebieska dioda na GPIO2 świeci przy stanie niskim. Jedno wejście analogowe A0: ADC(0).read() daje 0–1024 dla 0–3,2 V. PWM do 1 kHz, GPIO16 bez przerwań i PWM.',
      'A NodeMCU board with the ESP-12E module (ESP8266 chip, 2.4 GHz Wi-Fi). 3.3 V logic. In code use GPIO numbers, not the D1–D8 labels (e.g. D1 = Pin(5), D4 = Pin(2)). The blue LED on GPIO2 lights when the pin is low. One analog input A0: ADC(0).read() gives 0–1024 for 0–3.2 V. PWM up to 1 kHz; GPIO16 has no interrupts or PWM.'),
    pins, bbox: [-16, -76, 176, 334], wifi: true, freq: 80000000,
    adc: [17], adcOnly: [17], adcId: { 0: 17 }, adcLoad: [[17, 320000]], pwmMax: 1000, pwmDef: 500,
    i2c: { 0: [5, 4] }, spi: { 1: [14, 13, 12] }, uart: { 0: [1, 3], 1: [2, 3] }, led: { pin: 2, inv: true },
    code: `# NodeMCU (ESP8266): miganie wbudowaną diodą (GPIO2, świeci przy 0)
from machine import Pin, ADC
import time

led = Pin(2, Pin.OUT)
a0 = ADC(0)
while True:
    led.value(not led.value())
    print("A0 =", a0.read())
    time.sleep(0.5)
`,
    draw: pyBoardDraw({ rect: [-14, -74, 174, 324], col: '#1e1f22', edge: '#000', radius: 6, antenna: [32, -72, 96, 40], shield: [36, -28, 88, 84], chipLabel: 'ESP-12E', usb: [52, 306, 56, 26], led: [75, 72, '#3b82ff', true], pwr: null, buttons: [[34, 300, 'RST'], [126, 300, 'FLASH']], wifiAt: [80, 130],
      title: [80, 170], titleText: 'NodeMCU', titleSize: 12, sub: 'ESP8266', labelSide: p => p.x === 0 ? [12, 2.5, 'start'] : [-12, 2.5, 'end'] }),
  });
})();
// odblokowane: usuwamy wpisy „bez emulacji”, które teraz działają w MicroPythonie
delete PARTS.lk_esp32; delete PARTS.lk_rp2040; delete PARTS.lk_esp8266;

/* ===== pasek diod WS2812 (NeoPixel) ===== */
function wsLatch(d) { const w = d.s.ws, px = []; for (let i = 0; i + 23 < w.bits.length; i += 24) { const v = k => { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | w.bits[i + k * 8 + j]; return b; }; px.push([v(1), v(0), v(2)]); }
  if (px.length) { const old = d.s.px || []; d.s.px = px.concat(old.slice(px.length)).slice(0, 8); d.s.pxOn = true; E.dirty = true; } w.bits = []; w.pass = false; w.tr = null; w.tf = null; eDrive(d, 3, 0, 100, 0, 2); }
// MicroPython (neopixel.write): strumień bajtów GRB podawany od razu, nadmiar przechodzi przez DOUT do kolejnych pasków
function wsFeedBytes(x, grb, seen) {
  seen = seen || new Set(); if (seen.has(x)) return; seen.add(x);
  const n = x.P.ws2812.n, px = []; for (let i = 0; i + 2 < Math.min(grb.length, n * 3); i += 3) px.push([grb[i + 1], grb[i], grb[i + 2]]);
  if (px.length) { const old = x.s.px || []; x.s.px = px.concat(old.slice(px.length)).slice(0, n); x.s.pxOn = devPowered(x); }
  const rest = grb.slice(n * 3); if (!rest.length) return;
  for (const y of CIR.devs) if (y.P.ws2812 && y !== x && y.n[y.P.ws2812.din] === x.n[x.P.ws2812.dout]) wsFeedBytes(y, rest, seen);
}
def('ws2812', {
  cat: 'opto', name: { pl: 'Pasek LED WS2812 (8 diod)', en: 'WS2812 LED strip (8 LEDs)' }, sub: { pl: 'adresowalne diody RGB, NeoPixel', en: 'addressable RGB LEDs, NeoPixel' }, kw: 'ws2812 neopixel pasek led rgb adresowalne addressable strip stick',
  props: {}, pins: [{ x: 0, y: 0, n: '5V' }, { x: 20, y: 0, n: 'DIN' }, { x: 40, y: 0, n: 'GND' }, { x: 60, y: 0, n: { pl: 'DOUT (do następnego paska)', en: 'DOUT (to the next strip)' } }], bbox: [-90, -46, 130, 4],
  info: { pl: 'Osiem diod RGB sterowanych jednym przewodem danych (DIN, protokół 800 kHz: bit 0 ≈ 0,35 µs stanu wysokiego, bit 1 ≈ 0,7 µs, przerwa > 50 µs zatwierdza kolory). Kolejne paski łączysz z wyjściem DOUT. W Arduino: biblioteka Adafruit_NeoPixel (NEO_GRB + NEO_KHZ800), w MicroPythonie moduł neopixel: np = neopixel.NeoPixel(Pin(5), 8). Zasilanie 5 V; każda dioda przy pełnej bieli pobiera do ok. 50 mA.', en: 'Eight RGB LEDs controlled through one data wire (DIN, 800 kHz protocol: bit 0 ≈ 0.35 µs high, bit 1 ≈ 0.7 µs, a gap > 50 µs latches the colours). Chain further strips from DOUT. In Arduino: the Adafruit_NeoPixel library (NEO_GRB + NEO_KHZ800); in MicroPython the neopixel module: np = neopixel.NeoPixel(Pin(5), 8). 5 V supply; each LED draws up to about 50 mA at full white.' },
  ws2812: { din: 1, dout: 3, n: 8 },
  draw(c, r) {
    let s = leg('M0 0V-10') + leg('M20 0V-10') + leg('M40 0V-10') + `<rect x="-88" y="-44" width="216" height="34" rx="4" fill="#1a1a1a" stroke="#000"/>`;
    for (let i = 0; i < 8; i++) { const x = -78 + i * 26, px = r.px && r.pxOn ? r.px[i] : null, on = px && px[0] + px[1] + px[2] > 6, col = on ? `rgb(${Math.min(255, px[0] + 40)},${Math.min(255, px[1] + 40)},${Math.min(255, px[2] + 40)})` : '#f2f2ee';
      if (on) s += `<circle cx="${x + 8}" cy="-27" r="18" fill="${col}" opacity=".35"/>`;
      s += `<rect x="${x}" y="-35" width="16" height="16" rx="2" fill="${col}" stroke="#777"/><circle cx="${x + 8}" cy="-27" r="4" fill="${on ? '#fff' : '#ddd'}" opacity="${on ? 0.8 : 0.6}"/>`; }
    return s + leg('M60 0V-10') + tx(0, -13, '5V', { s: 5.5, c: '#ccc' }) + tx(20, -13, 'DIN', { s: 5.5, c: '#ccc' }) + tx(40, -13, 'GND', { s: 5.5, c: '#ccc' }) + tx(60, -13, 'DO', { s: 5.5, c: '#ccc' });
  },
  sim: {
    supply: [0, 2],
    init(d) { eListen(d, 1); eDrive(d, 3, 0, 100, 0, 2); d.s.ws = { bits: [], tr: null, tf: null, pass: false }; },
    // dekodowanie protokołu po czasie trwania stanu wysokiego: T0H ≈ 0,35 µs, T1H ≈ 0,7 µs, reset: stan niski > 50 µs
    onIn(d, p, lvl, old) {
      if (p !== 1) return; const w = d.s.ws, t = eNow();
      if (lvl === 1) { if (w.tf !== null && t - w.tf > 50e-6) wsLatch(d); w.tr = t; }
      else if (old === 1 && w.tr !== null) { const h = t - w.tr; w.tf = t; if (h >= 0.15e-6) { if (w.bits.length < 24 * 8) w.bits.push(h > 0.55e-6 ? 1 : 0); else w.pass = true; } }
      if (w.pass) eDrive(d, 3, lvl, 100, 0, 2);
      else if (lvl === 0 && w.bits.length >= 24 * 8) w.pass = true;
    },
    commit(d) { const w = d.s.ws; if (w && w.tf !== null && w.bits.length && eNow() - w.tf > 50e-6) wsLatch(d); },
    lin(d, S) { const n = d.s.px ? d.s.px.reduce((a, p) => a + (p[0] + p[1] + p[2]) / 765, 0) : 0; if (dVp(d, 0, 2) > 2.5) S.G(0, 2, (0.006 + n * 0.05) / 5); } },
  readings: (c, r) => [[{ pl: 'Diody świecą', en: 'LEDs on' }, String(r.px ? r.px.filter(p => p[0] + p[1] + p[2] > 6).length : 0) + ' / 8']],
});
