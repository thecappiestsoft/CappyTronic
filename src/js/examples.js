'use strict';
const HEXES = /*HEXES*/{};
const SKETCH = {
  stm_blink: `// STM32F103C8T6 (Blue Pill) – miganie wbudowaną diodą PC13 i komunikaty w monitorze portu szeregowego
void setup() {
  Serial.begin(115200);              // USART1: PA9 (TX), PA10 (RX)
  pinMode(LED_BUILTIN, OUTPUT);      // LED_BUILTIN = PC13
  Serial.println("Witaj z STM32F103!");
}

void loop() {
  digitalWrite(LED_BUILTIN, LOW);    // dioda na Blue Pill świeci przy stanie niskim
  delay(500);
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  Serial.print("Czas pracy: ");
  Serial.print(millis() / 1000);
  Serial.println(" s");
}
`,
  stm_oled: `// Blue Pill + OLED SSD1306 (I2C1: SCL = PB6, SDA = PB7) + potencjometr na PA0 + dioda PWM na PA8
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 oled(128, 64, &Wire, -1);

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);          // przetwornik STM32 ma 12 bitów: 0…4095
  if (!oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)) Serial.println("Brak ekranu OLED");
  oled.setTextColor(SSD1306_WHITE);
}

void loop() {
  int v = analogRead(PA0);
  float u = v * 3.3 / 4095;
  analogWrite(PA8, v / 16);          // jasność diody (PWM 1 kHz z timera TIM1)
  oled.clearDisplay();
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.println("STM32F103 + OLED");
  oled.setTextSize(2);
  oled.setCursor(0, 20);
  oled.print(u, 2);
  oled.println(" V");
  oled.fillRect(0, 50, map(v, 0, 4095, 0, 128), 10, SSD1306_WHITE);
  oled.display();
  Serial.printf("ADC = %d (%.2f V)\\n", v, u);
  delay(200);
}
`,
  enc_web: `// Arduino + ENC28J60: strona WWW z odczytem potencjometru i sterowaniem diodą
// Moduł dostaje adres z DHCP wirtualnego routera CappyTronic (192.168.50.1).
// Po starcie otwórz w przeglądarce adres z właściwości modułu: http://127.0.0.1:8090/
#include <EtherCard.h>

static byte mymac[] = { 0x74, 0x69, 0x69, 0x2D, 0x30, 0x31 };
byte Ethernet::buffer[600];
BufferFiller bfill;
bool led = false;

void setup() {
  Serial.begin(9600);
  pinMode(13, OUTPUT);
  if (ether.begin(sizeof Ethernet::buffer, mymac, 10) == 0) Serial.println("Brak odpowiedzi ENC28J60 - sprawdz SPI");
  if (!ether.dhcpSetup()) Serial.println("DHCP nie odpowiada");
  ether.printIp("Adres IP: ", ether.myip);
}

void loop() {
  word pos = ether.packetLoop(ether.packetReceive());
  if (pos) {
    char *req = (char *) Ethernet::buffer + pos;
    if (strncmp("GET /on", req, 7) == 0) led = true;
    if (strncmp("GET /off", req, 8) == 0) led = false;
    digitalWrite(13, led);
    bfill = ether.tcpOffset();
    bfill.emit_p(PSTR("HTTP/1.0 200 OK\\r\\nContent-Type: text/html\\r\\n\\r\\n"
      "<meta name=viewport content='width=device-width'><h1>Arduino + ENC28J60</h1>"
      "<p>Potencjometr (A0): <b>$D</b></p><p>Dioda: <b>$S</b></p>"
      "<p><a href='/on'>wlacz</a> | <a href='/off'>wylacz</a></p><p>Czas pracy: $L s</p>"),
      analogRead(A0), led ? "ON" : "OFF", millis() / 1000);
    ether.httpServerReply(bfill.position());
    Serial.println("Wyslano strone");
  }
}
`,
  pwm: `// Płynne rozjaśnianie diody LED (PWM) na pinie 9
const int LED = 9;

void setup() {
  pinMode(LED, OUTPUT);
  Serial.begin(9600);
  Serial.println("Start: PWM na pinie 9");
}

void loop() {
  for (int j = 0; j <= 255; j += 5) {   // rozjaśnianie
    analogWrite(LED, j);
    delay(20);
  }
  Serial.println("Maksymalna jasnosc");
  for (int j = 255; j >= 0; j -= 5) {   // ściemnianie
    analogWrite(LED, j);
    delay(20);
  }
  Serial.println("Zgaszona");
}
`,
  lcd: `// Wyświetlacz LCD 16x2 z konwerterem I2C (adres 0x27)
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

LiquidCrystal_I2C lcd(0x27, 16, 2);

void setup() {
  lcd.init();
  lcd.backlight();
  lcd.print("Hej, CappyTronic");
}

void loop() {
  lcd.setCursor(0, 1);
  lcd.print("Czas: ");
  lcd.print(millis() / 1000);
  lcd.print(" s   ");
  delay(200);
}
`,
  oled: `// Animacja na ekranie OLED SSD1306 128x64 (I2C, adres 0x3C)
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 oled(128, 64, &Wire, -1);
int x = 0;

void setup() {
  oled.begin(SSD1306_SWITCHCAPVCC, 0x3C);
}

void loop() {
  oled.clearDisplay();
  oled.setTextColor(SSD1306_WHITE);
  oled.setTextSize(2);
  oled.setCursor(4, 0);
  oled.print("Cappy");
  oled.setTextSize(1);
  oled.setCursor(4, 20);
  oled.print("OLED 128x64");
  oled.drawCircle(x, 46, 12, SSD1306_WHITE);
  oled.fillCircle(x, 46, 5, SSD1306_WHITE);
  oled.display();
  x = (x + 4) % 128;
}
`,
  stepper: `// Silnik krokowy NEMA 17 + sterownik A4988 + enkoder AS5600
// STEP -> pin 3, DIR -> pin 4, AS5600 na I2C (A4 = SDA, A5 = SCL)
// Rampa przyspieszania: bez niej silnik ruszający od razu z dużą prędkością gubi kroki.
#include <Wire.h>

const int STEP = 3, DIR = 4;

uint16_t as5600(uint8_t reg) {          // odczyt 12-bitowego rejestru (RAW ANGLE = 0x0C)
  Wire.beginTransmission(0x36);
  Wire.write(reg);
  Wire.endTransmission(false);
  Wire.requestFrom(0x36, 2);
  uint16_t h = Wire.read();
  return (h << 8) | Wire.read();
}

void obrot(int kroki, bool wPrawo) {
  digitalWrite(DIR, wPrawo ? HIGH : LOW);
  for (int i = 0; i < kroki; i++) {
    int odl = min(i, kroki - 1 - i);               // odległość od początku/końca ruchu
    int przerwa = max(1200, 4000 - odl * 60);      // rampa: 4 ms -> 1,2 ms na krok
    digitalWrite(STEP, HIGH);
    delayMicroseconds(5);
    digitalWrite(STEP, LOW);
    delayMicroseconds(przerwa);
  }
}

void setup() {
  Serial.begin(9600);
  Wire.begin();
  pinMode(STEP, OUTPUT);
  pinMode(DIR, OUTPUT);
}

void loop() {
  obrot(200, true);                              // 200 pełnych kroków = 1 obrót
  Serial.print("Kat AS5600: ");
  Serial.println(as5600(0x0C) * 360.0 / 4096, 1);
  delay(500);
  obrot(100, false);                             // pół obrotu z powrotem
  Serial.print("Kat AS5600: ");
  Serial.println(as5600(0x0C) * 360.0 / 4096, 1);
  delay(500);
}
`,
  servo: `// Serwo sterowane potencjometrem (A0 -> pin 9)
#include <Servo.h>

Servo serwo;

void setup() {
  serwo.attach(9);
  Serial.begin(9600);
}

void loop() {
  int v = analogRead(A0);              // 0..1023
  int kat = map(v, 0, 1023, 0, 180);   // 0..180 stopni
  serwo.write(kat);
  Serial.print("Potencjometr: ");
  Serial.print(v);
  Serial.print("  kat: ");
  Serial.println(kat);
  delay(100);
}
`,
};
const GSTM = { pl: 'STM32 (ARM Cortex-M3)', en: 'STM32 (ARM Cortex-M3)' };
const GPIC = { pl: 'Mikrokontrolery PIC (asembler)', en: 'PIC microcontrollers (assembly)' };
const GP = { pl: 'Płytki Wi-Fi: MicroPython i C++', en: 'Wi-Fi boards: MicroPython and C++' };
const GB = { pl: 'Podstawy', en: 'Basics' }, GA = { pl: 'Elektronika analogowa', en: 'Analog electronics' }, GM = { pl: 'Arduino', en: 'Arduino' };
const EXAMPLES = [
  { g: GB, n: { pl: 'Pierwsza dioda LED', en: 'First LED' }, d: { pl: 'Płytka stykowa, bateria, przełącznik, rezystor i dioda', en: 'Breadboard, battery, switch, resistor and LED' },
    comps: [['bb', 200, 160], ['battery', 60, 300, 0, { v: 9 }], ['switch', 120, 100, 0, { closed: true }], ['resistor', 280, 300, 0, { r: 470 }], ['led', 360, 260, 0, { color: 'red' }]],
    wires: [[1, 0, 2, 0, [[60, 280], [30, 280], [30, 100]], 0], [2, 1, 0, 'h:0,0', [[200, 100]], 0], [1, 1, 0, 'h:20,1', [[100, 280], [150, 280], [150, 180]], 1], [0, 'h:0,4', 0, 'h:60,4', [], 0], [0, 'h:60,9', 0, 'h:20,9', [], 1]] },
  { g: GB, n: { pl: 'Dzielnik napięcia', en: 'Voltage divider' }, d: { pl: 'Dwa rezystory i woltomierz: gdzie podziało się 9 V?', en: 'Two resistors and a voltmeter: where did the 9 V go?' },
    comps: [['battery', 80, 320, 0, { v: 9 }], ['resistor', 200, 120, 0, { r: 1000 }], ['resistor', 320, 120, 0, { r: 1000 }], ['mm', 500, 320, 0, { mode: 'V' }]],
    wires: [[0, 0, 1, 0, [[80, 300], [40, 300], [40, 120]], 0], [1, 1, 2, 0, [], 4], [2, 1, 0, 1, [[440, 120], [440, 400], [150, 400], [150, 300], [120, 300]], 1], [3, 0, 2, 0, [[500, 360], [300, 360], [300, 120]], 0], [3, 1, 0, 1, [[540, 420], [150, 420], [150, 300], [120, 300]], 1]] },
  { g: GB, n: { pl: 'Gasnąca dioda (kondensator)', en: 'Fading LED (capacitor)' }, d: { pl: 'Przytrzymaj przycisk, puść i patrz, jak dioda powoli gaśnie', en: 'Hold the button, release it and watch the LED fade' },
    comps: [['battery', 80, 320, 0, { v: 9 }], ['button', 160, 120], ['resistor', 260, 120, 0, { r: 100 }], ['capacitor', 400, 240, 0, { c: 2200e-6 }], ['resistor', 460, 120, 0, { r: 470 }], ['led', 600, 240, 0, { color: 'green' }]],
    wires: [[0, 0, 1, 0, [[80, 300], [40, 300], [40, 120]], 0], [1, 1, 2, 0, [], 0], [2, 1, 3, 0, [[370, 120], [370, 240]], 4], [2, 1, 4, 0, [], 4], [4, 1, 5, 0, [[570, 120], [570, 240]], 4], [3, 1, 0, 1, [[420, 380], [150, 380], [150, 300], [120, 300]], 1], [5, 1, 0, 1, [[620, 400], [150, 400], [150, 300], [120, 300]], 1]] },
  { g: GB, n: { pl: 'Silnik z regulacją obrotów', en: 'Motor speed control' }, d: { pl: 'Potencjometr reguluje prąd, amperomierz go mierzy', en: 'A potentiometer sets the current, an ammeter measures it' },
    comps: [['battery', 80, 320, 0, { v: 9 }], ['pot', 200, 120, 0, { r: 100, pos: 0.3 }], ['motor', 340, 160], ['mm', 500, 320, 0, { mode: 'A' }]],
    wires: [[0, 0, 1, 0, [[80, 300], [40, 300], [40, 140], [200, 140]], 0], [1, 1, 2, 0, [[220, 180], [340, 180]], 0], [2, 1, 3, 0, [[380, 190], [460, 190], [460, 350], [500, 350]], 5], [3, 1, 0, 1, [[540, 380], [150, 380], [150, 300], [120, 300]], 1]] },
  { g: GA, n: { pl: 'Tranzystor jako przełącznik', en: 'Transistor as a switch' }, d: { pl: 'Mały prąd bazy włącza duży prąd diody – przełącz i zobacz', en: 'A small base current switches the LED current – toggle it' },
    comps: [['battery', 60, 300, 0, { v: 9 }], ['switch', 120, 100, 0, { closed: true }], ['resistor', 260, 100, 0, { r: 10000 }], ['q_bc547', 400, 300], ['resistor', 200, 200, 0, { r: 470 }], ['led', 320, 200, 0, { color: 'yellow' }]],
    wires: [[0, 0, 1, 0, [[60, 280], [30, 280], [30, 100]], 0], [1, 1, 2, 0, [], 0], [2, 1, 3, 1, [[420, 100]], 4], [0, 0, 4, 0, [[60, 280], [30, 280], [30, 170], [200, 170]], 0], [4, 1, 5, 0, [], 0], [5, 1, 3, 0, [[340, 240], [400, 240]], 5], [3, 2, 0, 1, [[440, 360], [130, 360], [130, 280], [100, 280]], 1]] },
  { g: GA, n: { pl: 'Migacz na NE555', en: 'NE555 blinker' }, d: { pl: 'Timer 555 w trybie astabilnym miga diodą ok. 1,4 razy na sekundę', en: 'A 555 in astable mode blinks an LED about 1.4 times a second' },
    comps: [['battery', 60, 320, 0, { v: 9 }], ['ic_555', 300, 240], ['resistor', 200, 100, 0, { r: 10000 }], ['resistor', 440, 100, 1, { r: 47000 }], ['capacitor', 480, 300, 0, { c: 10e-6 }], ['resistor', 340, 400, 0, { r: 470 }], ['led', 460, 400, 0, { color: 'red' }]],
    wires: [[0, 0, 2, 0, [[60, 300], [30, 300], [30, 100]], 0], [1, 7, 2, 0, [[300, 140], [200, 140]], 0], [1, 3, 1, 7, [[360, 260], [390, 260], [390, 160], [300, 160]], 0], [2, 1, 1, 6, [[320, 100]], 4], [2, 1, 3, 0, [], 4], [3, 1, 1, 5, [[440, 150], [340, 150]], 4],
      [3, 1, 4, 0, [[480, 180]], 4], [1, 1, 4, 0, [[320, 280], [480, 280]], 4], [4, 1, 0, 1, [[500, 360], [130, 360], [130, 300], [100, 300]], 1], [1, 0, 0, 1, [[300, 345], [130, 345], [130, 300], [100, 300]], 1], [1, 2, 5, 0, [], 2], [5, 1, 6, 0, [], 2], [6, 1, 0, 1, [[480, 430], [130, 430], [130, 300], [100, 300]], 1]] },
  { g: GA, n: { pl: 'Zasilacz 5 V z sieci', en: '5 V mains power supply' }, d: { pl: 'Transformator, mostek, kondensator i 7805 – z oscyloskopem', en: 'Transformer, bridge, capacitor and 7805 – with an oscilloscope' },
    comps: [['mains', 60, 300], ['transformer', 200, 300, 0, { type: '230-12' }], ['br_df04m', 380, 300], ['capacitor', 500, 300, 0, { c: 1000e-6, vmax: 25 }], ['reg_78xx', 580, 300, 0, { v: 5 }], ['resistor', 680, 300, 0, { r: 330 }], ['led', 800, 300, 0, { color: 'green' }], ['scope', 700, 620, 0, { tb: 0.005, v1: 5, v2: 5 }]],
    wires: [[0, 0, 1, 0, [[60, 330], [200, 330]], 5], [0, 1, 1, 1, [[100, 320], [160, 320], [160, 220]], 2], [1, 2, 2, 0, [], 4], [1, 3, 2, 3, [[460, 220], [460, 300]], 4], [2, 1, 3, 0, [[400, 340], [500, 340]], 0], [2, 2, 3, 1, [[420, 360], [520, 360]], 1],
      [2, 1, 4, 0, [[400, 340], [580, 340]], 0], [3, 1, 4, 1, [[520, 360], [600, 360]], 1], [4, 2, 5, 0, [], 0], [5, 1, 6, 0, [], 0], [6, 1, 4, 1, [[820, 360], [600, 360]], 1], [7, 0, 2, 0, [[700, 640], [380, 640]], 4], [7, 1, 4, 2, [[740, 650], [620, 650]], 3], [7, 2, 2, 2, [[780, 660], [420, 660]], 1]] },
  { g: GM, n: { pl: 'Płynne rozjaśnianie (PWM)', en: 'Fading LED (PWM)' }, d: { pl: 'Arduino Uno, analogWrite() i monitor portu szeregowego', en: 'Arduino Uno, analogWrite() and the serial monitor' },
    comps: [['ard_uno', 0, 0], ['resistor', 300, -480, 0, { r: 220 }], ['led', 420, -480, 0, { color: 'blue' }]],
    wires: [[0, 'D9', 1, 0, [], 4], [1, 1, 2, 0, [], 4], [2, 1, 0, 'GND', [[440, -450], [200, -450]], 1]], code: [0, SKETCH.pwm, 'pwm'] },
  { g: GM, n: { pl: 'Arduino + LCD I2C', en: 'Arduino + I2C LCD' }, d: { pl: 'Napis i licznik sekund na wyświetlaczu 16×2', en: 'Text and a seconds counter on a 16×2 display' },
    comps: [['ard_uno', 0, 0], ['lcd1602i2c', 520, -560, 0, { color: 'blue', addr: 0x27 }]],
    wires: [[1, 0, 0, 'GND', [[520, -480], [200, -480]], 1], [1, 1, 0, '5V', [[540, -460], [600, -460], [600, 30], [260, 30]], 0], [1, 2, 0, 'PC4', [[560, -450], [160, -450]], 2], [1, 3, 0, 'PC5', [[580, -440], [140, -440]], 4]], code: [0, SKETCH.lcd, 'lcd'] },
  { g: GM, n: { pl: 'Arduino + OLED', en: 'Arduino + OLED' }, d: { pl: 'Tekst i animacja na ekranie SSD1306', en: 'Text and animation on an SSD1306 screen' },
    comps: [['ard_uno', 0, 0], ['oled_128x64', 560, -560, 0, { color: 'white' }]],
    wires: [[1, 0, 0, 'GND', [[560, -480], [200, -480]], 1], [1, 1, 0, '5V', [[580, -470], [620, -470], [620, 30], [260, 30]], 0], [1, 2, 0, 'PC5', [[600, -440], [140, -440]], 4], [1, 3, 0, 'PC4', [[620, -450], [160, -450]], 2]], code: [0, SKETCH.oled, 'oled'] },
  { g: GM, n: { pl: 'Ethernet: strona WWW (ENC28J60)', en: 'Ethernet: web page (ENC28J60)' }, d: { pl: 'EtherCard, DHCP i serwer WWW otwierany w przeglądarce komputera', en: 'EtherCard, DHCP and a web server opened in the computer’s browser' },
    comps: [['ard_uno', 0, 0], ['eth_enc28j60', 600, -420], ['pot', 360, 160, 0, { r: 10000, pos: 0.5 }]],
    wires: [[1, 'SO', 0, 'D12', [], 4], [1, 'SI', 0, 'D11', [], 2], [1, 'SCK', 0, 'D13', [], 5], [1, 'CS', 0, 'D10', [], 3], [1, 'VCC', 0, '3.3V', [], 0], [1, 'GND', 0, 'GND', [], 1],
      [2, 0, 0, '5V', [], 0], [2, 2, 0, 'GND', [], 1], [2, 1, 0, 'A0', [], 4]], code: [0, SKETCH.enc_web, 'enc_web'] },
  { g: GM, n: { pl: 'Silnik krokowy NEMA 17 i enkoder AS5600', en: 'NEMA 17 stepper and AS5600 encoder' }, d: { pl: 'A4988 (STEP/DIR) obraca silnik z rampą, AS5600 mierzy kąt wału', en: 'An A4988 (STEP/DIR) turns the motor with a ramp, an AS5600 measures the shaft angle' },
    comps: [['ard_uno', 0, 0], ['drv_a4988', 520, -260], ['stepper', 1000, -200, 0, { model: 'nema17' }], ['enc_as5600', 1000, -520], ['dcsupply', 560, 160, 0, { v: 12, ilim: 2 }]],
    wires: [[1, 'STEP', 0, 'D3', [], 4], [1, 'DIR', 0, 'D4', [], 5], [1, 'RST̅', 1, 'SLP̅', [], 3], [1, 'VDD', 0, '5V', [], 0], [1, 15, 0, 'GND', [], 1], [1, 9, 4, 1, [], 1], [1, 'VMOT', 4, 0, [], 0],
      [1, '1A', 2, 0, [], 1], [1, '1B', 2, 1, [], 3], [1, '2A', 2, 2, [], 0], [1, '2B', 2, 3, [], 2], [4, 1, 0, 'GND', [], 1],
      [3, 'VCC', 0, '5V', [], 0], [3, 'GND', 0, 'GND', [], 1], [3, 'SDA', 0, 'A4', [], 2], [3, 'SCL', 0, 'A5', [], 4]], code: [0, SKETCH.stepper, 'stepper'] },
  { g: GM, n: { pl: 'Serwo i potencjometr', en: 'Servo and potentiometer' }, d: { pl: 'analogRead() z potencjometru ustawia kąt serwa', en: 'analogRead() from a potentiometer sets the servo angle' },
    comps: [['ard_uno', 0, 0], ['pot', 360, 120, 0, { r: 10000, pos: 0.5 }], ['servo', 620, -480]],
    wires: [[1, 0, 0, '5V', [[360, 140], [260, 140]], 0], [1, 2, 0, 'GND', [[400, 150], [280, 150]], 1], [1, 1, 0, 'A0', [[380, 160], [440, 160], [440, 40], [360, 40]], 4], [2, 2, 0, 'D9', [[660, -440], [300, -440]], 5], [2, 1, 0, '5V', [[640, -460], [720, -460], [720, 60], [260, 60]], 0], [2, 0, 0, 'GND', [[620, -470], [200, -470]], 1]], code: [0, SKETCH.servo, 'servo'] },
  { g: GSTM, n: { pl: 'STM32 Blue Pill: miganie i port szeregowy', en: 'STM32 Blue Pill: blink and serial port' }, d: { pl: 'Cortex-M3 72 MHz, dioda PC13, Serial', en: 'Cortex-M3 72 MHz, PC13 LED, Serial' },
    comps: [['mcu_bluepill', 0, 0]], wires: [], code: [0, SKETCH.stm_blink, 'stm_blink'] },
  { g: GSTM, n: { pl: 'STM32: OLED, potencjometr i PWM', en: 'STM32: OLED, potentiometer and PWM' }, d: { pl: 'Wire (I2C1), ADC 12 bit, analogWrite na timerze', en: 'Wire (I2C1), 12-bit ADC, analogWrite on a timer' },
    comps: [['mcu_bluepill', 0, 0], ['oled_128x64', 400, -260], ['pot', 80, 240, 0, { r: 10000, pos: 0.6 }], ['resistor', 120, -120, 1, { r: 100 }], ['led', 160, -200, 0, { color: 'red' }]],
    wires: [[1, 'GND', 0, 'GND', [], 1], [1, 'VCC', 0, '3V3', [], 0], [1, 'SCL', 0, 'PB6', [], 4], [1, 'SDA', 0, 'PB7', [], 2],
      [2, 0, 0, 'GND', [], 1], [2, 2, 0, '3V3', [], 0], [2, 1, 0, 'PA0', [], 4], [3, 0, 0, 'PA8', [], 4], [3, 1, 4, 0, [], 4], [4, 1, 0, 'GND', [], 1]],
    code: [0, SKETCH.stm_oled, 'stm_oled'] },
  { g: GPIC, n: { pl: 'PIC16F84A: miganie diodą', en: 'PIC16F84A: blinking LED' }, d: { pl: 'Asembler MPASM, pętle opóźniające, MCLR z rezystorem', en: 'MPASM assembly, delay loops, MCLR with a resistor' },
    comps: [['mcu_pic16f84a', 0, 0], ['dcsupply', -260, 120, 0, { v: 5, ilim: 0.2 }], ['resistor', -60, 120, 0, { r: 10000 }], ['resistor', 140, 80, 1, { r: 330 }], ['led', 200, 200, 0, { color: 'red' }]],
    wires: [[1, 0, 0, 'VDD', [], 0], [1, 1, 0, 'VSS', [], 1], [2, 0, 1, 0, [], 0], [2, 1, 0, 'MCLR', [], 3], [3, 0, 0, 'RB0', [], 4], [3, 1, 4, 0, [], 4], [4, 1, 1, 1, [], 1]],
    code: [0, PARTS.mcu_pic16f84a.props.code, null] },
  { g: GPIC, n: { pl: 'PIC18F4550: dioda i port szeregowy', en: 'PIC18F4550: LED and serial port' }, d: { pl: 'Timer0, EUSART, odczyt tekstu z pamięci programu (TBLRD)', en: 'Timer0, EUSART, reading text from program memory (TBLRD)' },
    comps: [['mcu_pic18f4550', 0, 0], ['dcsupply', -260, 160, 0, { v: 5, ilim: 0.2 }], ['resistor', -60, 160, 0, { r: 10000 }], ['resistor', 340, 80, 1, { r: 330 }], ['led', 400, 200, 0, { color: 'green' }]],
    wires: [[1, 0, 0, 'VDD', [], 0], [1, 1, 0, 'VSS', [], 1], [2, 0, 1, 0, [], 0], [2, 1, 0, 'MCLR', [], 3], [3, 0, 0, 'RD0', [], 4], [3, 1, 4, 0, [], 4], [4, 1, 1, 1, [], 1]],
    code: [0, PARTS.mcu_pic18f4550.props.code, null] },
  { g: GP, n: { pl: 'ESP32-C3-Zero: tęcza na diodzie RGB', en: 'ESP32-C3-Zero: rainbow on the RGB LED' }, d: { pl: 'MicroPython, moduł neopixel, wbudowana dioda WS2812', en: 'MicroPython, neopixel module, built-in WS2812 LED' },
    comps: [['esp32c3zero', 0, 0]], wires: [], code: [0, PARTS.esp32c3zero.props.code, null] },
  { g: GP, n: { pl: 'ESP32-C3: przycisk i dioda (przerwanie)', en: 'ESP32-C3: button and LED (interrupt)' }, d: { pl: 'Pin.irq() reaguje na naciśnięcie przycisku', en: 'Pin.irq() reacts to a button press' },
    comps: [['esp32c3zero', 0, 0], ['button', -120, 100], ['resistor', 180, 140, 0, { r: 220 }], ['led', 280, 140, 0, { color: 'yellow' }]],
    wires: [[1, 1, 0, 'G3', [[-40, 100], [-40, 80]], 4], [1, 0, 0, 'GND', [[-140, 100], [-140, 20]], 1], [0, 'G5', 2, 0, [], 2], [2, 1, 3, 0, [], 2], [3, 1, 0, 'GND', [[300, 220], [-160, 220], [-160, 20]], 1]],
    code: [0, `# Przycisk (GP3) przełącza diodę LED (GP5) – obsługa przerwania
from machine import Pin
import time

led = Pin(5, Pin.OUT)
przycisk = Pin(3, Pin.IN, Pin.PULL_UP)
licznik = 0

def nacisniety(pin):
    global licznik
    licznik += 1
    led.toggle()
    print("Naciśnięto", licznik, "raz(y), dioda:", led.value())

przycisk.irq(trigger=Pin.IRQ_FALLING, handler=nacisniety)
print("Przytrzymaj przycisk kursorem")
while True:
    time.sleep(1)
`, null] },
  { g: GP, n: { pl: 'ESP32-C3: czujnik → MQTT', en: 'ESP32-C3: sensor → MQTT' }, d: { pl: 'Wi-Fi, wysyłanie pomiarów i odbiór komend przez serwer MQTT', en: 'Wi-Fi, sending readings and receiving commands via the MQTT server' },
    comps: [['esp32c3zero', 0, 0], ['pot', -60, 80, 3, { r: 10000, pos: 0.4 }]],
    wires: [[1, 2, 0, '3V3', [], 0], [1, 1, 0, 'G0', [[-40, 60], [-40, 140]], 4], [1, 0, 0, 'GND', [[-60, 100], [-120, 100], [-120, 20]], 1]],
    code: [0, `# ESP32-C3-Zero: potencjometr -> MQTT, komendy MQTT -> dioda RGB
# Podgląd wiadomości i wysyłanie komend: zakładka MQTT
import network, time
from machine import Pin, ADC
from umqtt.simple import MQTTClient
import neopixel

pot = ADC(Pin(0))
np = neopixel.NeoPixel(Pin(10), 1)

wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect("CappyNet", "haslo123")
print("Łączę z Wi-Fi...")
while not wlan.isconnected():
    time.sleep(0.2)
print("Wi-Fi OK, IP:", wlan.ifconfig()[0])

KOLORY = {"czerwony": (255, 0, 0), "zielony": (0, 255, 0),
          "niebieski": (0, 0, 255), "off": (0, 0, 0)}

def wiadomosc(temat, tresc):
    tresc = tresc.decode()
    print("Odebrano", temat.decode(), "=", tresc)
    np[0] = KOLORY.get(tresc, (255, 255, 255))
    np.write()

# "localhost" = serwer MQTT wbudowany w CappyTronic
klient = MQTTClient("esp32c3-zero", "localhost")
klient.set_callback(wiadomosc)
klient.connect()
klient.subscribe("cappy/led")
print("Połączono z MQTT. Wyślij na temat cappy/led: czerwony, zielony, niebieski albo off")

while True:
    procent = round(pot.read() * 100 / 4095)
    klient.publish("cappy/potencjometr", str(procent))
    print("Wysłano:", procent, "%")
    for _ in range(10):
        klient.check_msg()
        time.sleep(0.1)
`, null] },
  { g: GP, n: { pl: 'ESP32-C3: ekran OLED', en: 'ESP32-C3: OLED screen' }, d: { pl: 'I2C, sterownik ssd1306 i pomiar napięcia', en: 'I2C, the ssd1306 driver and a voltage reading' },
    comps: [['esp32c3zero', 0, 0], ['pot', -60, 80, 3, { r: 10000, pos: 0.6 }], ['oled_128x64', 0, -120]],
    wires: [[1, 2, 0, '3V3', [], 0], [1, 1, 0, 'G0', [[-40, 60], [-40, 140]], 4], [1, 0, 0, 'GND', [[-60, 100], [-120, 100], [-120, 20]], 1],
      [2, 'GND', 0, 'GND', [[-20, -120], [-20, 20]], 1], [2, 'VCC', 0, '3V3', [[20, -100], [-40, -100], [-40, 40]], 0], [2, 'SCL', 0, 'G9', [[40, -90], [180, -90], [180, 60]], 4], [2, 'SDA', 0, 'G8', [[60, -100], [200, -100], [200, 80]], 2]],
    code: [0, `# ESP32-C3-Zero + OLED SSD1306 (I2C: SCL=GP9, SDA=GP8)
from machine import Pin, I2C, ADC
import ssd1306, time

i2c = I2C(0, scl=Pin(9), sda=Pin(8))
print("Urządzenia I2C:", [hex(a) for a in i2c.scan()])
oled = ssd1306.SSD1306_I2C(128, 64, i2c)
pot = ADC(Pin(0))

while True:
    u = pot.read() * 3.3 / 4095
    oled.fill(0)
    oled.text("CappyTronic", 20, 0)
    oled.text("ESP32-C3-Zero", 12, 14)
    oled.text("U = %.2f V" % u, 20, 32)
    oled.rect(0, 50, 128, 12, 1)
    oled.fill_rect(2, 52, int(124 * u / 3.3), 8, 1)
    oled.show()
    time.sleep(0.2)
`, null] },
  { g: GP, n: { pl: 'ESP32-C3 w C++: ekran OLED', en: 'ESP32-C3 in C++: OLED screen' }, d: { pl: 'Arduino C++: Adafruit_SSD1306, analogReadMilliVolts()', en: 'Arduino C++: Adafruit_SSD1306, analogReadMilliVolts()' },
    comps: [['esp32c3zero', 0, 0], ['pot', -60, 80, 3, { r: 10000, pos: 0.6 }], ['oled_128x64', 0, -120]],
    wires: [[1, 2, 0, '3V3', [], 0], [1, 1, 0, 'G0', [[-40, 60], [-40, 140]], 4], [1, 0, 0, 'GND', [[-60, 100], [-120, 100], [-120, 20]], 1],
      [2, 'GND', 0, 'GND', [[-20, -120], [-20, 20]], 1], [2, 'VCC', 0, '3V3', [[20, -100], [-40, -100], [-40, 40]], 0], [2, 'SCL', 0, 'G9', [[40, -90], [180, -90], [180, 60]], 4], [2, 'SDA', 0, 'G8', [[60, -100], [200, -100], [200, 80]], 2]],
    code: [0, `// ESP32-C3-Zero + OLED SSD1306 w C++ (Arduino). I2C: SDA=GPIO8, SCL=GPIO9
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

Adafruit_SSD1306 oled(128, 64, &Wire, -1);
const int POT = 0;   // GPIO0 = ADC1_CH0

void setup() {
  Serial.begin(115200);
  Wire.begin(8, 9);
  if (!oled.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("Nie znaleziono ekranu OLED – sprawdź połączenia!");
    while (true) delay(100);
  }
  oled.setTextColor(SSD1306_WHITE);
}

void loop() {
  uint32_t mv = analogReadMilliVolts(POT);
  oled.clearDisplay();
  oled.setTextSize(1);
  oled.setCursor(0, 0);
  oled.println("CappyTronic C++");
  oled.setTextSize(2);
  oled.setCursor(0, 22);
  oled.printf("%.2f V", mv / 1000.0);
  oled.drawRect(0, 50, 128, 12, SSD1306_WHITE);
  oled.fillRect(2, 52, 124 * mv / 3300, 8, SSD1306_WHITE);
  oled.display();
  Serial.printf("Napięcie: %u mV\\n", mv);
  delay(200);
}
`, null, 'cpp'] },
  { g: GP, n: { pl: 'ESP32-C3 w C++: MQTT', en: 'ESP32-C3 in C++: MQTT' }, d: { pl: 'WiFi, PubSubClient i ArduinoJson – pomiary do serwera MQTT, komendy z powrotem', en: 'WiFi, PubSubClient and ArduinoJson – readings to the MQTT server, commands back' },
    comps: [['esp32c3zero', 0, 0], ['pot', -60, 80, 3, { r: 10000, pos: 0.4 }]],
    wires: [[1, 2, 0, '3V3', [], 0], [1, 1, 0, 'G0', [[-40, 60], [-40, 140]], 4], [1, 0, 0, 'GND', [[-60, 100], [-120, 100], [-120, 20]], 1]],
    code: [0, `// ESP32-C3-Zero: pomiar -> MQTT (C++ / Arduino)
// Serwer MQTT CappyTronic działa na tym komputerze (zakładka MQTT).
// Wyślij "on" albo "off" na temat cappy/led, aby sterować diodą RGB.
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char *SSID = "CappyNet";
const char *PASS = "haslo1234";
const char *BROKER = "127.0.0.1";   // ten komputer

WiFiClient net;
PubSubClient mqtt(net);

void onMessage(char *topic, byte *payload, unsigned int len) {
  String msg;
  for (unsigned i = 0; i < len; i++) msg += (char)payload[i];
  Serial.printf("Odebrano %s: %s\\n", topic, msg.c_str());
  if (msg == "on") rgbLedWrite(RGB_BUILTIN, 0, 0, 60);
  if (msg == "off") rgbLedWrite(RGB_BUILTIN, 0, 0, 0);
}

void connectMqtt() {
  while (!mqtt.connected()) {
    Serial.print("Łączę z MQTT… ");
    if (mqtt.connect("esp32c3-cpp")) {
      Serial.println("OK");
      mqtt.subscribe("cappy/led");
    } else {
      Serial.printf("błąd %d, ponawiam za 2 s\\n", mqtt.state());
      delay(2000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  WiFi.begin(SSID, PASS);
  Serial.print("Wi-Fi");
  while (WiFi.status() != WL_CONNECTED) { delay(250); Serial.print("."); }
  Serial.print(" połączono, IP: ");
  Serial.println(WiFi.localIP());
  mqtt.setServer(BROKER, 1883);
  mqtt.setCallback(onMessage);
}

void loop() {
  connectMqtt();
  mqtt.loop();
  static unsigned long last = 0;
  if (millis() - last >= 2000) {
    last = millis();
    JsonDocument doc;
    doc["napiecie"] = analogReadMilliVolts(0) / 1000.0;
    doc["czas"] = millis() / 1000;
    char buf[96];
    serializeJson(doc, buf);
    mqtt.publish("cappy/pomiar", buf);
    Serial.printf("Wysłano: %s\\n", buf);
  }
}
`, null, 'cpp'] },
  { g: GP, n: { pl: 'ESP32 w C++: strona WWW', en: 'ESP32 in C++: web page' }, d: { pl: 'WebServer – włączanie diody z przeglądarki na tym komputerze', en: 'WebServer – switch the LED from a browser on this computer' },
    comps: [['esp32devkit', 0, 0]], wires: [],
    code: [0, `// ESP32 DevKit: serwer WWW (C++ / Arduino)
// Po starcie symulacji otwórz w przeglądarce adres podany w monitorze portu szeregowego.
#include <WiFi.h>
#include <WebServer.h>

WebServer server(80);
bool led = false;

String page() {
  String h = "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>";
  h += "<title>ESP32</title><body style='font-family:sans-serif;text-align:center'>";
  h += "<h1>Dioda jest ";
  h += led ? "WŁĄCZONA" : "wyłączona";
  h += "</h1><p><a href='/on'><button>Włącz</button></a> <a href='/off'><button>Wyłącz</button></a></p>";
  h += "<p>Czas pracy: " + String(millis() / 1000) + " s</p></body>";
  return h;
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  WiFi.begin("CappyNet", "haslo1234");
  while (WiFi.status() != WL_CONNECTED) delay(200);
  server.on("/", []() { server.send(200, "text/html", page()); });
  server.on("/on", []() { led = true; digitalWrite(LED_BUILTIN, HIGH); server.send(200, "text/html", page()); });
  server.on("/off", []() { led = false; digitalWrite(LED_BUILTIN, LOW); server.send(200, "text/html", page()); });
  server.begin();
  Serial.println("Serwer WWW uruchomiony.");
}

void loop() {
  server.handleClient();
}
`, null, 'cpp'] },
];
