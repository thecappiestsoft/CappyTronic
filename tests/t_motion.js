// Silniki krokowe NEMA, sterowniki A4988 / DRV8825 i enkoder AS5600 (Arduino Uno + szkice z avr-gcc).
const { sc, P, ev, errs } = require('./periph_h.js');
const near = (v, x, tol) => Math.abs(v - x) <= tol;
// wspólne połączenia: zasilacz 12 V (VMOT), STEP D3, DIR D4, silnik NEMA 17, AS5600 na I2C
const base = (drv, ms) => {
  const a4988 = drv === 'drv_a4988';
  return {
    parts: [['p', 'dcsupply', { v: 12, ilim: 3 }], ['d', drv, { ilim: 1 }], ['m', 'stepper', { model: 'nema17' }], ['e', 'enc_as5600', { src: 'auto' }]],
    wires: [['p', '+', 'd', 'VMOT'], ['p', '−', 'u', 'GND'], ['d', 'GND', 'u', 'GND'], ['d', 'STEP', 'u', 'D3'], ['d', 'DIR', 'u', 'D4'],
      ...(a4988 ? [['d', 'RST̅', 'd', 'SLP̅'], ['d', 'VDD', 'u', '5V'], ['d', '1A', 'm', 'A+'], ['d', '1B', 'm', 'A−'], ['d', '2A', 'm', 'B+'], ['d', '2B', 'm', 'B−']]
        : [['d', 'RST̅', 'u', '5V'], ['d', 'SLP̅', 'u', '5V'], ['d', 'A1', 'm', 'A+'], ['d', 'A2', 'm', 'A−'], ['d', 'B1', 'm', 'B+'], ['d', 'B2', 'm', 'B−']]),
      ...ms.map(p => ['d', p, 'u', '5V']),
      ['e', 'VCC', 'u', '5V'], ['e', 'GND', 'u', 'GND'], ['e', 'SDA', 'u', 'A4'], ['e', 'SCL', 'u', 'A5']],
  };
};
const SK = (steps, us, dir) => `#include <Wire.h>
uint16_t rd(uint8_t r){Wire.beginTransmission(0x36);Wire.write(r);Wire.endTransmission(false);Wire.requestFrom(0x36,2);uint16_t h=Wire.read();return (h<<8)|Wire.read();}
uint8_t st(){Wire.beginTransmission(0x36);Wire.write(0x0B);Wire.endTransmission(false);Wire.requestFrom(0x36,1);return Wire.read();}
void setup(){Serial.begin(115200);Wire.begin();pinMode(3,OUTPUT);pinMode(4,OUTPUT);digitalWrite(4,${dir});delay(20);
 for(int i=0;i<${steps};i++){digitalWrite(3,HIGH);delayMicroseconds(5);digitalWrite(3,LOW);delayMicroseconds(${us});}
 delay(150);Serial.print("RAW=");Serial.print(rd(0x0C));Serial.print(" ST=");Serial.println(st(),HEX);}
void loop(){}`;
const motorDeg = `${P('m')}.s.th*180/Math.PI`;
(async () => {
  await new Promise(r => setTimeout(r, 300));
  // 50 pełnych kroków = 90° w prawo; AS5600 patrzy od końca wału, więc RAW = (360 − 90) / 360 · 4096 = 3072
  await sc('A4988 pełny krok: 50 kroków → 90°, AS5600 RAW ≈ 3072', { ...base('drv_a4988', []), code: SK(50, 3000, 'HIGH'), secs: 0.6,
    check: `(()=>{const m=${P('m')};return (${motorDeg}).toFixed(2)+'° '+m.s.steps.toFixed(2)+' krok.'})()`,
    ok: (r, ser) => near(parseFloat(r), 90, 1.5) && /RAW=30[5-9]\d ST=20/.test(ser) });
  await sc('A4988 1/16 kroku, DIR=0: 400 mikrokroków → −45°', { ...base('drv_a4988', ['MS1', 'MS2', 'MS3']), code: SK(400, 300, 'LOW'), secs: 0.6,
    check: `(${motorDeg}).toFixed(2)`, ok: (r, ser) => near(parseFloat(r), -45, 1) && /RAW=5[01]\d ST=20/.test(ser) });
  await sc('DRV8825 1/32 kroku: 1600 mikrokroków → 90°', { ...base('drv_drv8825', ['M0', 'M2']), code: SK(1600, 100, 'HIGH'), secs: 0.8,
    check: `(${motorDeg}).toFixed(2)`, ok: r => near(parseFloat(r), 90, 1) });
  // prąd fazy przy postoju: pełny krok → obie fazy po 70,7 % ograniczenia (1 A)
  await sc('A4988: prąd faz w spoczynku 0,707 A', { ...base('drv_a4988', []), code: SK(1, 1000, 'HIGH'), secs: 0.4,
    check: `(()=>{const m=${P('m')}.s;return Math.abs(m.ia).toFixed(3)+' '+Math.abs(m.ib).toFixed(3)})()`, ok: r => r.split(' ').every(v => near(+v, 0.707, 0.02)) });
  // RST̅ niepodłączony → sterownik w resecie
  const nr = base('drv_a4988', []); nr.wires = nr.wires.filter(w => !(w[1] === 'RST̅'));
  await sc('A4988 bez połączenia RST̅–SLP̅: silnik stoi, ostrzeżenie', { ...nr, code: SK(50, 3000, 'HIGH'), secs: 0.4,
    check: `(${motorDeg}).toFixed(2)+' '+${P('d')}.s.warn`, ok: r => r === '0.00 drvReset' });
  // za szybki start bez rampy (1/1, 2000 kroków/s pod obciążeniem 90 %) – silnik gubi kroki
  const ls = base('drv_a4988', []); ls.parts[2][2].load = 0.9;
  await sc('Zbyt szybki start pod obciążeniem gubi kroki', { ...ls, code: SK(200, 495, 'HIGH'), secs: 0.6,
    check: `(${motorDeg}/1.8).toFixed(1)`, ok: r => Math.abs(parseFloat(r)) < 150 });
  // AS5600 ręcznie: magnes 90° w prawo (od góry), DIR=GND → RAW 1024; OUT analogowo 25 % VCC; ZPOS=1024, MPOS=2048 → ANGLE na pełnej skali
  await sc('AS5600: kąt ręczny, wyjście OUT, ZPOS/MPOS', { parts: [['e', 'enc_as5600', { src: 'manual', ang: 90 }]],
    wires: [['e', 'VCC', 'u', '5V'], ['e', 'GND', 'u', 'GND'], ['e', 'DIR', 'u', 'GND'], ['e', 'SDA', 'u', 'A4'], ['e', 'SCL', 'u', 'A5'], ['e', 'OUT', 'u', 'A0']],
    code: `#include <Wire.h>
uint16_t rd(uint8_t r){Wire.beginTransmission(0x36);Wire.write(r);Wire.endTransmission(false);Wire.requestFrom(0x36,2);uint16_t h=Wire.read();return (h<<8)|Wire.read();}
void wr(uint8_t r,uint16_t v){Wire.beginTransmission(0x36);Wire.write(r);Wire.write(v>>8);Wire.write(v&255);Wire.endTransmission();}
void setup(){Serial.begin(115200);Wire.begin();delay(10);Serial.print(rd(0x0C));Serial.print(' ');Serial.print(analogRead(A0));
 wr(0x01,768);wr(0x03,1280);delay(2);Serial.print(' ');Serial.println(rd(0x0E));}
void loop(){}`, secs: 0.3, check: `'ok'`, ok: (r, ser) => /^1024 25[4-7] 204[78]/.test(ser) });
  console.log('błędy okna:', errs.slice(0, 5)); process.exit(0);
})();
