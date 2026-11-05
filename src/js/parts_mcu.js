'use strict';
/* ====== płytki i układy z mikrokontrolerem ====== */
function hdrPins(names, x0, y, dir) { return names.map((nm, i) => { const fn = Array.isArray(nm) ? nm[0] : nm, label = Array.isArray(nm) ? nm[1] : nm; return { x: dir === 'v' ? x0 : x0 + i * 20, y: dir === 'v' ? y + i * 20 : y, fn, n: label, s: label.split(' ')[0] }; }); }
function boardDraw(spec) {
  return (c, r, pins) => {
    const [x0, y0, x1, y1] = spec.rect; let s = `<rect x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}" rx="14" fill="${spec.col}" stroke="${spec.edge}" stroke-width="2"/>`;
    for (const [hx, hy] of spec.holes || []) s += `<circle cx="${hx}" cy="${hy}" r="7" fill="none" stroke="#d4dee2" stroke-width="2.5"/>`;
    if (spec.usb) s += `<rect x="${spec.usb[0]}" y="${spec.usb[1]}" width="${spec.usb[2]}" height="${spec.usb[3]}" rx="3" fill="#c9cfd5" stroke="#6f777f" stroke-width="2"/>`;
    if (spec.jack) s += `<rect x="${spec.jack[0]}" y="${spec.jack[1]}" width="${spec.jack[2]}" height="${spec.jack[3]}" rx="3" fill="#1c1c1c"/>`;
    if (spec.chip) { const [cx, cy, w, h] = spec.chip; s += `<rect x="${cx}" y="${cy}" width="${w}" height="${h}" rx="3" fill="#1d1f22" stroke="#000"/>` + tx(cx + w / 2, cy + h / 2 + 3, spec.chipLabel, { s: 8.5, c: '#c7ccd2', f: FONT_M }); }
    // nagłówki
    for (const p of pins) s += `<rect x="${p.x - 9}" y="${p.y - 9}" width="18" height="18" fill="#141618"/><rect x="${p.x - 3.5}" y="${p.y - 3.5}" width="7" height="7" fill="#3c4146"/>`;
    for (const p of pins) { const up = spec.labelDir ? spec.labelDir(p) : (p.y < (y0 + y1) / 2 ? 1 : -1); const lbl = p.s.replace(/^D(\d+)$/, '$1');
      if (spec.vlabels && spec.vlabels(p)) s += tx(p.x + (p.x > (x0 + x1) / 2 ? -14 : 14), p.y + 2.5, lbl, { s: 6, w: 500, c: '#e6f1f2', f: FONT_M, a: p.x > (x0 + x1) / 2 ? 'end' : 'start' });
      else s += tx(p.x, p.y + up * 17, lbl, { s: 6, w: 500, c: '#e6f1f2', f: FONT_M, r: -90 * 0 }); }
    // diody i etykieta
    const on = r.run !== undefined ? true : false;
    if (spec.leds) { const [lx, ly] = spec.leds; s += `<rect x="${lx}" y="${ly}" width="10" height="6" rx="1" fill="${r.U !== undefined || r.run ? '#47e06b' : '#2d5236'}"/>` + tx(lx + 5, ly - 3, 'ON', { s: 5.5, c: '#e6f1f2' });
      const L = r.L; s += `<rect x="${lx}" y="${ly + 16}" width="10" height="6" rx="1" fill="${L ? '#ffb020' : '#5a4620'}"/>` + tx(lx + 5, ly + 13, 'L', { s: 5.5, c: '#e6f1f2' });
      const now = performance.now(), m = r.mcuRef; s += `<rect x="${lx}" y="${ly + 32}" width="10" height="6" rx="1" fill="${m && now - m.lastTx < 60 ? '#ffb020' : '#5a4620'}"/>` + tx(lx + 5, ly + 29, 'TX', { s: 5.5, c: '#e6f1f2' }); }
    if (spec.reset) { const [rx, ry] = spec.reset; s += `<rect x="${rx - 10}" y="${ry - 10}" width="20" height="20" rx="3" fill="#cfd5db"/><circle cx="${rx}" cy="${ry}" r="6" fill="#d6453d" class="hot"/>` + tx(rx, ry + 19, 'RESET', { s: 5.5, c: '#e6f1f2' }); }
    s += tx(spec.title[0], spec.title[1], spec.titleText, { s: spec.titleSize || 22, w: 800, c: 'rgba(255,255,255,.88)', f: FONT_D });
    if (!c.props.hex) s += `<rect x="${spec.title[0] - 70}" y="${spec.title[1] + 8}" width="140" height="18" rx="9" fill="#d6453d"/>` + tx(spec.title[0], spec.title[1] + 21, t('noProgramTag'), { s: 8.5, c: '#fff' });
    return s;
  };
}
const PWM328 = [3, 5, 6, 9, 10, 11];
const dn = (n, extra) => ['D' + n, (PWM328.includes(n) ? '~' : '') + n + (extra ? ' ' + extra : '')];
const mcuInfoTxt = (pl, en) => ({ pl: pl + ' Kliknij „Kod”, żeby napisać program w języku Arduino (C++). Program kompiluje się na Twoim komputerze bez internetu.', en: en + ' Click “Code” to write an Arduino (C++) program. It compiles on your computer without internet.' });
// --- UNO ---
(function () {
  const top = hdrPins([['D_SCL', 'SCL'], ['D_SDA', 'SDA'], ['AREF', 'AREF'], ['GND', 'GND'], dn(13, '(SCK)'), dn(12, '(MISO)'), dn(11, '(MOSI)'), dn(10, '(SS)'), dn(9), dn(8)], 140, -400)
    .concat(hdrPins([dn(7), dn(6), dn(5), dn(4), dn(3), dn(2), dn(1, '(TX)'), dn(0, '(RX)')], 360, -400));
  const bot = hdrPins([['NC', 'NC'], ['IOREF', 'IOREF'], ['RESET', 'RESET'], ['3V3', '3.3V'], ['5V', '5V'], ['GND', 'GND'], ['GND', 'GND'], ['VIN', 'VIN']], 180, -20)
    .concat(hdrPins([['A0', 'A0'], ['A1', 'A1'], ['A2', 'A2'], ['A3', 'A3'], ['A4', 'A4 (SDA)'], ['A5', 'A5 (SCL)']], 360, -20));
  const pins = top.concat(bot); pins.forEach(p => { if (p.fn === 'D_SCL') p.fn = 'PC5'; if (p.fn === 'D_SDA') p.fn = 'PC4'; if (p.fn === 'RESET') p.fn = 'RESET_B'; });
  pins.forEach(p => { if (p.fn === 'RESET_B') p.fn = 'RST'; });
  mcuPart('ard_uno', {
    kind: 'm328', f: 16e6, name: { pl: 'Arduino Uno (ATmega328P)', en: 'Arduino Uno (ATmega328P)' }, sub: { pl: 'Płytka z mikrokontrolerem, 16 MHz', en: 'Microcontroller board, 16 MHz' }, kw: 'arduino uno atmega328p mikrokontroler microcontroller avr plytka board',
    info: mcuInfoTxt('Najpopularniejsza płytka do nauki: 14 pinów cyfrowych (6 z PWM ~), 6 wejść analogowych A0–A5, zasilanie 5 V z USB. Wbudowana dioda „L” na pinie 13.', 'The most popular learning board: 14 digital pins (6 with PWM ~), 6 analog inputs A0–A5, 5 V powered from USB. Built-in “L” LED on pin 13.'),
    pins, bbox: [-30, -430, 530, 10], ledL: ['B', 5],
    draw: boardDraw({ rect: [-28, -428, 528, 8], col: '#0f7f8c', edge: '#0a5560', holes: [[0, -404], [500, -330], [500, -40], [10, -30]], usb: [-46, -380, 70, 56], jack: [-40, -150, 64, 52], chip: [240, -180, 230, 60], chipLabel: 'ATMEGA328P-PU', leds: [100, -372], reset: [40, -400], title: [300, -270], titleText: 'UNO' }),
  });
})();
// --- NANO ---
(function () {
  const bottom = hdrPins([dn(13, '(SCK)'), ['3V3', '3V3'], ['AREF', 'REF'], ['A0', 'A0'], ['A1', 'A1'], ['A2', 'A2'], ['A3', 'A3'], ['A4', 'A4'], ['A5', 'A5'], ['A6', 'A6'], ['A7', 'A7'], ['5V', '5V'], ['RST', 'RST'], ['GND', 'GND'], ['VIN', 'VIN']], 0, 0);
  const top = hdrPins([dn(12, '(MISO)'), dn(11, '(MOSI)'), dn(10), dn(9), dn(8), dn(7), dn(6), dn(5), dn(4), dn(3), dn(2), ['GND', 'GND'], ['RST', 'RST'], dn(0, 'RX'), dn(1, 'TX')], 0, -120);
  mcuPart('ard_nano', {
    kind: 'm328', f: 16e6, name: { pl: 'Arduino Nano (ATmega328P)', en: 'Arduino Nano (ATmega328P)' }, sub: { pl: 'Mała płytka do płytki stykowej', en: 'Small breadboard-friendly board' }, kw: 'arduino nano atmega328p mikrokontroler microcontroller',
    info: mcuInfoTxt('Ten sam mikrokontroler co Uno, ale w małej płytce, którą wpinasz w płytkę stykową (nad rowkiem, rzędy c i h). Ma dodatkowe wejścia analogowe A6 i A7 (tylko do odczytu napięcia).', 'The same microcontroller as the Uno in a small board you plug into the breadboard (across the channel, rows c and h). It has extra analog inputs A6 and A7 (voltage reading only).'),
    pins: bottom.concat(top), bbox: [-62, -142, 302, 22], ledL: ['B', 5],
    draw: boardDraw({ rect: [-30, -140, 300, 20], col: '#1557a8', edge: '#0d3870', usb: [-62, -82, 40, 44], chip: [100, -88, 60, 52], chipLabel: '328P', leds: [190, -96], reset: [250, -62], title: [60, -50], titleText: 'NANO', titleSize: 16, labelDir: p => p.y < -60 ? 1 : -1 }),
  });
})();
// --- MEGA 2560 ---
(function () {
  const PWM = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 44, 45, 46];
  const dm = (n, ex) => ['D' + n, (PWM.includes(n) ? '~' : '') + n + (ex ? ' ' + ex : '')];
  const top = hdrPins([['PD0', 'SCL'], ['PD1', 'SDA'], ['AREF', 'AREF'], ['GND', 'GND'], dm(13), dm(12), dm(11), dm(10), dm(9), dm(8)], 140, -400)
    .concat(hdrPins([dm(7), dm(6), dm(5), dm(4), dm(3), dm(2), dm(1, 'TX0'), dm(0, 'RX0')], 360, -400))
    .concat(hdrPins([dm(14, 'TX3'), dm(15, 'RX3'), dm(16, 'TX2'), dm(17, 'RX2'), dm(18, 'TX1'), dm(19, 'RX1'), dm(20, 'SDA'), dm(21, 'SCL')], 540, -400));
  const right = [];
  right.push({ x: 720, y: -360, fn: '5V', n: '5V', s: '5V' }, { x: 740, y: -360, fn: '5V', n: '5V', s: '5V' });
  for (let k = 0; k < 16; k++) { const a = 22 + k * 2, b = a + 1; right.push({ x: 720, y: -340 + k * 20, fn: 'D' + a, n: String(a) + (a >= 50 ? ['', ' MISO', ' SCK', ' SS'][0] : ''), s: String(a) }, { x: 740, y: -340 + k * 20, fn: 'D' + b, n: String(b), s: String(b) }); }
  right.push({ x: 720, y: -20, fn: 'GND', n: 'GND', s: 'GND' }, { x: 740, y: -20, fn: 'GND', n: 'GND', s: 'GND' });
  const bot = hdrPins([['NC', 'NC'], ['IOREF', 'IOREF'], ['RST', 'RESET'], ['3V3', '3.3V'], ['5V', '5V'], ['GND', 'GND'], ['GND', 'GND'], ['VIN', 'VIN']], 160, -20)
    .concat(hdrPins(Array.from({ length: 8 }, (_, i) => ['A' + i, 'A' + i]), 340, -20)).concat(hdrPins(Array.from({ length: 8 }, (_, i) => ['A' + (8 + i), 'A' + (8 + i)]), 520, -20));
  mcuPart('ard_mega', {
    kind: 'm2560', f: 16e6, name: { pl: 'Arduino Mega 2560 (ATmega2560)', en: 'Arduino Mega 2560 (ATmega2560)' }, sub: { pl: '54 piny cyfrowe, 16 analogowych', en: '54 digital pins, 16 analog' }, kw: 'arduino mega 2560 atmega2560 mikrokontroler microcontroller',
    info: mcuInfoTxt('Duża płytka z ATmega2560: 54 piny cyfrowe (15 z PWM), 16 wejść analogowych, 4 porty szeregowe i 256 KB pamięci programu. I2C na pinach 20 (SDA) i 21 (SCL).', 'A big board with the ATmega2560: 54 digital pins (15 PWM), 16 analog inputs, 4 serial ports and 256 KB of program memory. I2C on pins 20 (SDA) and 21 (SCL).'),
    pins: top.concat(right, bot), bbox: [-30, -430, 770, 10], ledL: ['B', 7],
    draw: boardDraw({ rect: [-28, -428, 768, 8], col: '#0f7f8c', edge: '#0a5560', holes: [[0, -404], [690, -404], [690, -30], [10, -30]], usb: [-46, -380, 70, 56], jack: [-40, -150, 64, 52], chip: [300, -230, 120, 120], chipLabel: 'ATMEGA2560', leds: [100, -372], reset: [40, -400], title: [180, -100], titleText: 'MEGA 2560', vlabels: p => p.x >= 720, labelDir: p => p.y < -200 ? 1 : -1 }),
  });
})();
// --- ATmega328P w DIP-28 ---
(function () {
  const N = [['RST', 'RESET (PC6)', 'RESET'], ['PD0', 'PD0 (D0, RX)', 'D0'], ['PD1', 'PD1 (D1, TX)', 'D1'], ['PD2', 'PD2 (D2)', 'D2'], ['PD3', 'PD3 (D3, PWM)', 'D3'], ['PD4', 'PD4 (D4)', 'D4'], ['VCC', 'VCC', 'VCC'], ['GND', 'GND', 'GND'], ['XTL1', 'PB6 (XTAL1)', 'XTAL'], ['XTL2', 'PB7 (XTAL2)', 'XTAL'],
    ['PD5', 'PD5 (D5, PWM)', 'D5'], ['PD6', 'PD6 (D6, PWM)', 'D6'], ['PD7', 'PD7 (D7)', 'D7'], ['PB0', 'PB0 (D8)', 'D8'], ['PB1', 'PB1 (D9, PWM)', 'D9'], ['PB2', 'PB2 (D10, SS)', 'D10'], ['PB3', 'PB3 (D11, MOSI)', 'D11'], ['PB4', 'PB4 (D12, MISO)', 'D12'], ['PB5', 'PB5 (D13, SCK)', 'D13'],
    ['AVCC', 'AVCC', 'AVCC'], ['AREF', 'AREF', 'AREF'], ['GND', 'GND', 'GND'], ['PC0', 'PC0 (A0)', 'A0'], ['PC1', 'PC1 (A1)', 'A1'], ['PC2', 'PC2 (A2)', 'A2'], ['PC3', 'PC3 (A3)', 'A3'], ['PC4', 'PC4 (A4, SDA)', 'A4'], ['PC5', 'PC5 (A5, SCL)', 'A5']];
  const pk = pkgDIP(28, N.map(x => [x[0], x[1]]));
  const pins = pk.pins.map((p, i) => ({ ...p, fn: N[i][2] === 'RESET' ? 'RESET' : N[i][2] === 'XTAL' ? 'NC' : N[i][2] }));
  mcuPart('mcu_m328p', {
    kind: 'm328', chip: true, f: 16e6, name: { pl: 'ATmega328P (DIP-28)', en: 'ATmega328P (DIP-28)' }, sub: { pl: 'Sam mikrokontroler, „Arduino na płytce stykowej”', en: 'Bare microcontroller, “Arduino on a breadboard”' }, kw: 'atmega328p atmega328 avr mikrokontroler microcontroller dip28',
    info: mcuInfoTxt('Mikrokontroler z Arduino Uno w obudowie DIP-28. Zasil VCC (7) i AVCC (20) z 5 V, oba GND (8, 22) do masy. Symulacja zakłada zegar 16 MHz (kwarc między pinami 9–10). Port szeregowy zobaczysz przez moduł USB-UART (FT232RL/CH340).', 'The Arduino Uno microcontroller in a DIP-28 package. Power VCC (7) and AVCC (20) from 5 V, both GND (8, 22) to ground. The simulation assumes a 16 MHz clock (crystal on pins 9–10). See the serial port through a USB-UART module (FT232RL/CH340).'),
    pins, bbox: pk.bbox, ledL: null, draw: (c, r) => pk.body('ATMEGA328P', '', '#24262a') + (!c.props.hex ? tx(130, -70, t('noProgramTag'), { s: 7, c: '#ff8a80' }) : ''),
  });
})();
// --- ATtiny85 w DIP-8 ---
(function () {
  const N = [['PB5', 'PB5 (RESET, A0)', 'RESET'], ['PB3', 'PB3 (D3, A3)', 'PB3'], ['PB4', 'PB4 (D4, A2, PWM)', 'PB4'], ['GND', 'GND', 'GND'], ['PB0', 'PB0 (D0, PWM)', 'PB0'], ['PB1', 'PB1 (D1, PWM)', 'PB1'], ['PB2', 'PB2 (D2, A1)', 'PB2'], ['VCC', 'VCC', 'VCC']];
  const pk = pkgDIP(8, N.map(x => [x[0], x[1]]));
  const pins = pk.pins.map((p, i) => ({ ...p, fn: N[i][2] }));
  mcuPart('mcu_t85', {
    kind: 't85', chip: true, f: 8e6, name: { pl: 'ATtiny85 (DIP-8)', en: 'ATtiny85 (DIP-8)' }, sub: { pl: 'Miniaturowy mikrokontroler, 8 MHz', en: 'Tiny microcontroller, 8 MHz' }, kw: 'attiny85 attiny avr mikrokontroler microcontroller dip8',
    info: mcuInfoTxt('Mały, 8-nóżkowy mikrokontroler: 5 użytecznych pinów (PB0–PB4), zegar wewnętrzny 8 MHz. W kodzie pin 0 to PB0 (nóżka 5), pin 1 to PB1 (nóżka 6) itd. Nie ma sprzętowego portu szeregowego.', 'A small 8-pin microcontroller: 5 usable pins (PB0–PB4), internal 8 MHz clock. In code, pin 0 is PB0 (leg 5), pin 1 is PB1 (leg 6) and so on. It has no hardware serial port.'),
    pins, bbox: pk.bbox, draw: (c, r) => pk.body('ATtiny85', '', '#24262a') + (!c.props.hex ? tx(30, -70, t('noProgramTag'), { s: 7, c: '#ff8a80' }) : ''),
  });
})();
// --- układy bez emulacji: widoczne w katalogu z wyjaśnieniem ---
[ ['lk_rp2040', 'RP2040 (Raspberry Pi Pico)', { pl: '2× ARM Cortex-M0+, 133 MHz', en: '2× ARM Cortex-M0+, 133 MHz' }, 'rp2040 raspberry pi pico arm'],
 ['lk_esp32', 'ESP32', { pl: 'Wi-Fi + Bluetooth, 240 MHz', en: 'Wi-Fi + Bluetooth, 240 MHz' }, 'esp32 espressif wifi bluetooth iot'],
 ['lk_esp8266', 'ESP8266 (NodeMCU)', { pl: 'Wi-Fi, 80 MHz', en: 'Wi-Fi, 80 MHz' }, 'esp8266 nodemcu wifi iot']].forEach(([id, name, sub, kw]) => def(id, {
  cat: 'mcu', name, sub, kw, locked: true, pins: [], bbox: [0, 0, 1, 1], draw: () => '',
  info: { pl: 'Ten układ nie jest jeszcze emulowany w CappyTronic – jego program wymaga innego procesora (ARM, PIC lub Xtensa) niż AVR, który symulujemy. Do nauki programowania użyj Arduino Uno, Nano, Mega, ATmega328P albo ATtiny85.', en: 'This chip is not emulated in CappyTronic yet – its program needs a different processor (ARM, PIC or Xtensa) from the AVR we simulate. To learn programming, use the Arduino Uno, Nano, Mega, ATmega328P or ATtiny85.' },
}));
