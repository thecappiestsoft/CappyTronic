const comp=require('./tools.js').avr();
const {w,ev,errs}=require('./test.js');
async function sc(name, o){
  const r=await comp({code:o.code,target:'uno'}); if(!r.ok){console.log('✗',name,'KOMPILACJA',JSON.stringify(r.diags.filter(d=>d.type==='error').slice(0,3)));return;}
  const spec=JSON.stringify({parts:o.parts,wires:o.wires,hex:r.hex});
  ev(`(()=>{if(running)toggleSim();S.comps=[];S.wires=[];const sp=${spec};const M={};let x=0;
    M.u={id:newId(),type:'ard_uno',x:0,y:0,rot:0,props:Object.assign(JSON.parse(JSON.stringify(PARTS.ard_uno.props)),{hex:sp.hex})};S.comps.push(M.u);
    for(const [k,type,props] of sp.parts){x+=600;M[k]={id:newId(),type,x,y:600,rot:0,props:Object.assign(JSON.parse(JSON.stringify(PARTS[type].props||{})),props||{})};S.comps.push(M[k]);}
    for(const [a,pa,b,pb] of sp.wires){const ia=resolvePin(M[a],pa), ib=resolvePin(M[b],pb); if(ia<0||ib<0||ia===undefined||ib===undefined) throw new Error('pin '+a+':'+pa+' / '+b+':'+pb); S.wires.push({id:newId(),a:{c:M[a].id,t:ia},b:{c:M[b].id,t:ib},pts:[],color:'#f00'});}
    window.M=M; changed(); toggleSim();})()`);
  ev(`while(E.t<${o.secs||1})simStep(E.dt)`);
  let res; try{res=ev(o.check);}catch(e){res='EXC '+e.message}
  const ser=ev(`(CIR.mcus[0].mcu.serial||'').slice(-120)`);
  console.log((o.ok&&o.ok(res,ser))?'✓':'?',name,'→',typeof res==='string'?res.slice(0,200):res,'| serial:',JSON.stringify(ser.slice(-80)));
}
const P=(k,t)=>`CIR.devs.find(d=>d.c===M.${k})`;
const pw=k=>[[k,'GND','u','GND'],[k,'VCC','u','5V']];
(async()=>{await new Promise(r=>setTimeout(r,300));
await sc('LCD 16x2 równoległy (LiquidCrystal, 4-bit)',{parts:[['l','lcd1602']],wires:[['l','VSS','u','GND'],['l','VDD','u','5V'],['l','V0','u','GND'],['l','RW','u','GND'],['l','RS','u','D12'],['l','E','u','D11'],['l','D4','u','D5'],['l','D5','u','D4'],['l','D6','u','D3'],['l','D7','u','D2']],
 code:`#include <LiquidCrystal.h>\nLiquidCrystal lcd(12,11,5,4,3,2);\nvoid setup(){lcd.begin(16,2);lcd.print("Rownolegle OK");lcd.setCursor(0,1);lcd.print(42);}\nvoid loop(){}`,secs:0.6,
 check:`(()=>{const l=${P('l')}.s.lcd;return String.fromCharCode(...l.dd.slice(0,16))+'|'+String.fromCharCode(...l.dd.slice(64,68))})()`,ok:r=>r.startsWith('Rownolegle OK')});
await sc('OLED SH1106 (Adafruit_SH110X)',{parts:[['o','oled_sh1106']],wires:[...pw('o'),['o','SDA','u','A4'],['o','SCL','u','A5']],
 code:`#include <Wire.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_SH110X.h>\nAdafruit_SH1106G d(128,64,&Wire,-1);\nvoid setup(){d.begin(0x3C,true);d.clearDisplay();d.setTextColor(SH110X_WHITE);d.setCursor(0,0);d.print("SH1106");d.fillRect(0,40,64,10,SH110X_WHITE);d.display();}\nvoid loop(){}`,secs:0.8,
 check:`(()=>{const o=${P('o')}.s.oled;let n=0;for(let y=0;y<64;y++)for(let x=0;x<128;x++)n+=o.px(x,y);return 'piksele '+n+', on='+o.on})()`,ok:r=>/piksele [5-9]\d\d/.test(r)});
await sc('OLED SSD1306 przez U8g2',{parts:[['o','oled_128x64']],wires:[...pw('o'),['o','SDA','u','A4'],['o','SCL','u','A5']],
 code:`#include <U8g2lib.h>\n#include <Wire.h>\nU8G2_SSD1306_128X64_NONAME_1_HW_I2C u8g2(U8G2_R0);\nvoid setup(){u8g2.begin();}\nvoid loop(){u8g2.firstPage();do{u8g2.setFont(u8g2_font_ncenB10_tr);u8g2.drawStr(0,24,"U8g2!");u8g2.drawBox(0,40,40,10);}while(u8g2.nextPage());delay(500);}`,secs:1.2,
 check:`(()=>{const o=${P('o')}.s.oled;let n=0;for(let y=0;y<64;y++)for(let x=0;x<128;x++)n+=o.px(x,y);let box=0;for(let y=40;y<50;y++)for(let x=0;x<40;x++)box+=o.px(x,y);return 'piksele '+n+' prostokat '+box+'/400'})()`,ok:r=>/prostokat 400/.test(r)});
await sc('Nokia 5110 programowe SPI',{parts:[['n','nokia5110']],wires:[['n','GND','u','GND'],['n','VCC','u','5V'],['n','CLK','u','D7'],['n','DIN','u','D6'],['n','DC','u','D5'],['n','CE','u','D4'],['n','RST','u','D3']],
 code:`#include <Adafruit_GFX.h>\n#include <Adafruit_PCD8544.h>\nAdafruit_PCD8544 d=Adafruit_PCD8544(7,6,5,4,3);\nvoid setup(){d.begin();d.setContrast(50);d.clearDisplay();d.fillRect(10,10,20,20,BLACK);d.setCursor(0,0);d.print("Nokia");d.display();}\nvoid loop(){}`,secs:1.0,
 check:`(()=>{const l=${P('n')}.s.lcd;let n=0,b=0;for(let y=0;y<48;y++)for(let x=0;x<84;x++){n+=l.ram[(y>>3)*84+x]>>(y&7)&1;}for(let y=10;y<30;y++)for(let x=10;x<30;x++)b+=l.ram[(y>>3)*84+x]>>(y&7)&1;return 'piksele '+n+' kwadrat '+b+'/400 tryb '+l.mode})()`,ok:r=>/kwadrat 400/.test(r)});
await sc('Nokia 5110 sprzętowe SPI',{parts:[['n','nokia5110']],wires:[['n','GND','u','GND'],['n','VCC','u','5V'],['n','CLK','u','D13'],['n','DIN','u','D11'],['n','DC','u','D5'],['n','CE','u','D4'],['n','RST','u','D3']],
 code:`#include <SPI.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_PCD8544.h>\nAdafruit_PCD8544 d=Adafruit_PCD8544(5,4,3);\nvoid setup(){d.begin();d.clearDisplay();d.fillRect(10,10,20,20,BLACK);d.display();}\nvoid loop(){}`,secs:1.0,
 check:`(()=>{const l=${P('n')}.s.lcd;let b=0;for(let y=10;y<30;y++)for(let x=10;x<30;x++)b+=l.ram[(y>>3)*84+x]>>(y&7)&1;return 'kwadrat '+b+'/400'})()`,ok:r=>/kwadrat 400/.test(r)});
await sc('ST7920 128x64 przez U8g2 (SW SPI)',{parts:[['g','st7920']],wires:[['g','GND','u','GND'],['g','VCC','u','5V'],['g','PSB','u','GND'],['g','E','u','D13'],['g','R/W','u','D11'],['g','RS','u','D10'],['g','RST','u','D8']],
 code:`#include <U8g2lib.h>\nU8G2_ST7920_128X64_1_SW_SPI u8g2(U8G2_R0,13,11,10,8);\nvoid setup(){u8g2.begin();}\nvoid loop(){u8g2.firstPage();do{u8g2.drawBox(10,10,30,20);u8g2.drawBox(80,40,20,20);}while(u8g2.nextPage());delay(1000);}`,secs:2.5,
 check:`(()=>{const l=${P('g')}.s.lcd;let a=0,b=0;for(let y=10;y<30;y++)for(let x=10;x<40;x++)a+=l.px(x,y);for(let y=40;y<60;y++)for(let x=80;x<100;x++)b+=l.px(x,y);return 'prostokaty '+a+'/600 '+b+'/400'})()`,ok:r=>/600\/600 400\/400/.test(r)});
await sc('TFT ST7735 (Adafruit, sprzętowe SPI)',{parts:[['t','tft_st7735']],wires:[...pw('t'),['t','CS','u','D10'],['t','RESET','u','D9'],['t','A0','u','D8'],['t','SDA','u','D11'],['t','SCK','u','D13']],
 code:`#include <Adafruit_GFX.h>\n#include <Adafruit_ST7735.h>\n#include <SPI.h>\nAdafruit_ST7735 tft(10,8,9);\nvoid setup(){tft.initR(INITR_BLACKTAB);tft.fillScreen(ST77XX_BLACK);tft.fillRect(0,0,40,20,ST77XX_RED);tft.fillRect(100,140,28,20,ST77XX_BLUE);}\nvoid loop(){}`,secs:2.0,
 check:`(()=>{const t=${P('t')}.s.tft;const g=(x,y)=>t.fb[y*t.W+x].toString(16);return 'on='+t.on+' (5,5)='+g(5,5)+' (110,150)='+g(110,150)+' (60,60)='+g(60,60)})()`,ok:r=>/\(5,5\)=f800 \(110,150\)=1f \(60,60\)=0/.test(r)});
await sc('TFT ILI9341 + dotyk XPT2046',{parts:[['t','tft_ili9341']],wires:[...pw('t'),['t','CS','u','D10'],['t','RESET','u','D8'],['t','DC','u','D9'],['t','SDI','u','D11'],['t','SCK','u','D13'],['t','SDO','u','D12'],['t','T_CLK','u','D13'],['t','T_DIN','u','D11'],['t','T_DO','u','D12'],['t','T_CS','u','D4']],
 code:`#include <SPI.h>\n#include <Adafruit_GFX.h>\n#include <Adafruit_ILI9341.h>\n#include <XPT2046_Touchscreen.h>\nAdafruit_ILI9341 tft(10,9,8);\nXPT2046_Touchscreen ts(4);\nvoid setup(){Serial.begin(9600);tft.begin();ts.begin();tft.fillScreen(ILI9341_BLACK);tft.fillRect(0,0,50,30,ILI9341_GREEN);}\nvoid loop(){if(ts.touched()){TS_Point p=ts.getPoint();Serial.print("T ");Serial.print(p.x);Serial.print(",");Serial.println(p.y);}delay(50);}`,secs:3.0,
 check:`(()=>{const d=${P('t')};const t=d.s.tft;d.s.touch={x:1234,y:2345};return 'on='+t.on+' (10,10)='+t.fb[10*t.W+(t.W-1-10)].toString(16)+'/'+t.fb[10*t.W+10].toString(16)})()`,ok:r=>/7e0/.test(r)});
ev('for(let i=0;i<3000;i++)simStep(E.dt)'); console.log('   dotyk → serial:',JSON.stringify(ev('CIR.mcus[0].mcu.serial.slice(-40)')));
await sc('MCP3008 (Adafruit) + napięcie z potencjometru',{parts:[['a','adc_mcp3008'],['p','pot',{r:10000,pos:0.25}]],wires:[['a','VDD','u','5V'],['a','VREF','u','5V'],['a','AGND','u','GND'],['a','DGND','u','GND'],['a','CLK','u','D13'],['a','DOUT','u','D12'],['a','DIN','u','D11'],['a','CS̅/SHDN','u','D10'],['p','A','u','GND'],['p','B','u','5V'],['p',1,'a','CH0']],
 code:`#include <Adafruit_MCP3008.h>\nAdafruit_MCP3008 adc;\nvoid setup(){Serial.begin(9600);adc.begin(10);}\nvoid loop(){Serial.println(adc.readADC(0));delay(100);}`,secs:0.6,
 check:`'oczekiwane ok. 256'`,ok:(r,s)=>/\b25[0-9]\b|\b26[0-2]\b/.test(s)});
await sc('MCP4725 DAC + ADS1115 ADC',{parts:[['d','dac_mcp4725'],['a','adc_ads1115']],wires:[...pw('d'),['d','SDA','u','A4'],['d','SCL','u','A5'],['d','A0','u','GND'],['a','VDD','u','5V'],['a','GND','u','GND'],['a','SDA','u','A4'],['a','SCL','u','A5'],['a','ADDR','u','GND'],['d','VOUT','a','A0']],
 code:`#include <Wire.h>\n#include <Adafruit_MCP4725.h>\n#include <Adafruit_ADS1X15.h>\nAdafruit_MCP4725 dac; Adafruit_ADS1115 ads;\nvoid setup(){Serial.begin(9600);dac.begin(0x60);ads.begin(0x48);dac.setVoltage(2048,false);}\nvoid loop(){int16_t v=ads.readADC_SingleEnded(0);Serial.print(ads.computeVolts(v),3);Serial.println(" V");delay(200);}`,secs:1.0,
 check:`(()=>si(${P('d')}.s.U,'V'))()`,ok:(r,s)=>/2\.49\d V|2\.50\d V/.test(s)});
await sc('RTC DS1307 (RTClib) + EEPROM 24C256',{parts:[['r','rtc_ds1307'],['e','ee_24c256']],wires:[['r','VCC','u','5V'],['r','GND','u','GND'],['r','SDA','u','A4'],['r','SCL','u','A5'],['e','VCC','u','5V'],['e','GND','u','GND'],['e','SDA','u','A4'],['e','SCL','u','A5'],['e','A0','u','GND'],['e','A1','u','GND'],['e','A2','u','GND'],['e','WP','u','GND']],
 code:`#include <Wire.h>\n#include <RTClib.h>\nRTC_DS1307 rtc;\nvoid setup(){Serial.begin(9600);rtc.begin();DateTime n=rtc.now();Serial.print(n.year());Serial.print("-");Serial.println(n.month());\nWire.beginTransmission(0x50);Wire.write(0);Wire.write(0x10);Wire.write(0xAB);Wire.endTransmission();delay(10);\nWire.beginTransmission(0x50);Wire.write(0);Wire.write(0x10);Wire.endTransmission();Wire.requestFrom(0x50,1);Serial.print("EE=");Serial.println(Wire.read(),HEX);}\nvoid loop(){}`,secs:0.4,
 check:`'rok/miesiąc + EE=AB'`,ok:(r,s)=>/20\d\d-\d+\r\nEE=AB/.test(s)});
await sc('W25Q32 JEDEC ID przez SPI',{parts:[['f','fl_w25q32']],wires:[['f','VCC','u','5V'],['f','GND','u','GND'],['f','CLK','u','D13'],['f','DI','u','D11'],['f','DO','u','D12'],['f','CS̅','u','D10']],
 code:`#include <SPI.h>\nvoid setup(){Serial.begin(9600);pinMode(10,OUTPUT);digitalWrite(10,HIGH);SPI.begin();digitalWrite(10,LOW);SPI.transfer(0x9F);byte a=SPI.transfer(0),b=SPI.transfer(0),c=SPI.transfer(0);digitalWrite(10,HIGH);Serial.print(a,HEX);Serial.print(" ");Serial.print(b,HEX);Serial.print(" ");Serial.println(c,HEX);}\nvoid loop(){}`,secs:0.2,
 check:`'EF 40 16'`,ok:(r,s)=>/EF 40 16/.test(s)});
await sc('MCP23017 (Adafruit) miga diodą na GPA0',{parts:[['x','io_mcp23017'],['r','resistor',{r:330}],['l','led']],wires:[['x','VDD','u','5V'],['x','VSS','u','GND'],['x','SDA','u','A4'],['x','SCL','u','A5'],['x','A0','u','GND'],['x','A1','u','GND'],['x','A2','u','GND'],['x','RESET̅','u','5V'],['x','GPA0','r',0],['r',1,'l',0],['l',1,'u','GND']],
 code:`#include <Adafruit_MCP23X17.h>\nAdafruit_MCP23X17 m;\nvoid setup(){Serial.begin(9600);if(!m.begin_I2C())Serial.println("brak");else Serial.println("ok");m.pinMode(0,OUTPUT);}\nvoid loop(){m.digitalWrite(0,HIGH);delay(100);m.digitalWrite(0,LOW);delay(100);}`,secs:0.7,
 check:`(()=>si(${P('l')}.s.I,'A'))()`,ok:(r,s)=>/ok/.test(s)});
await sc('74HC595 + shiftOut',{parts:[['s','lg_74hc595']],wires:[['s','VCC','u','5V'],['s','GND','u','GND'],['s','OE̅','u','GND'],['s','SRCLR̅','u','5V'],['s','SER','u','D11'],['s','SRCLK','u','D12'],['s','RCLK','u','D8']],
 code:`void setup(){pinMode(11,OUTPUT);pinMode(12,OUTPUT);pinMode(8,OUTPUT);digitalWrite(8,LOW);shiftOut(11,12,MSBFIRST,0b10110001);digitalWrite(8,HIGH);}\nvoid loop(){}`,secs:0.2,
 check:`(()=>{const d=${P('s')};const Q=[15,1,2,3,4,5,6,7];return Q.map(p=>d.drv[p-1]?d.drv[p-1].lvl:'-').join('')})()`,ok:r=>r==='10110001'});
await sc('CAN loopback (arduino-CAN)',{parts:[['c','can_mcp2515']],wires:[['c','VCC','u','5V'],['c','GND','u','GND'],['c','SCK','u','D13'],['c','SI','u','D11'],['c','SO','u','D12'],['c','CS','u','D10'],['c','INT','u','D2']],
 code:`#include <CAN.h>\nvoid setup(){Serial.begin(9600);CAN.setClockFrequency(8E6);if(!CAN.begin(500E3)){Serial.println("CAN fail");return;}CAN.loopback();CAN.beginPacket(0x12);CAN.write('h');CAN.write('i');CAN.endPacket();}\nvoid loop(){int n=CAN.parsePacket();if(n){Serial.print("id=");Serial.print(CAN.packetId(),HEX);Serial.print(" ");while(CAN.available())Serial.print((char)CAN.read());Serial.println();}}`,secs:0.5,
 check:`'id=12 hi'`,ok:(r,s)=>/id=12 hi/.test(s)});
await sc('ENC28J60 (EtherCard) inicjalizacja',{parts:[['e','eth_enc28j60']],wires:[['e','VCC','u','3.3V'],['e','GND','u','GND'],['e','SCK','u','D13'],['e','SI','u','D11'],['e','SO','u','D12'],['e','CS','u','D10']],
 code:`#include <EtherCard.h>\nbyte Ethernet::buffer[300];\nstatic byte mac[]={0x74,0x69,0x69,0x2D,0x30,0x31};\nvoid setup(){Serial.begin(9600);byte v=ether.begin(sizeof Ethernet::buffer,mac,10);Serial.print("rev=");Serial.println(v);Serial.print("link=");Serial.println(ether.isLinkUp());}\nvoid loop(){}`,secs:0.6,
 check:`'rev=7, link=1'`,ok:(r,s)=>/rev=7/.test(s)&&/link=1/.test(s)});
console.log('błędy okna:',errs.slice(0,3)); process.exit(0);})();
