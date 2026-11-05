// testy STM32F103 (Blue Pill): kompilacja arm-none-eabi-gcc w node, symulacja w jsdom
const comp=require('./tools.js').stm();
const {w,ev,errs}=require('./test.js');
async function st(name,o){
  const r=await comp({code:o.code}); if(!r.ok){console.log('✗',name,'KOMPILACJA',JSON.stringify(r.diags.filter(d=>d.type==='error').slice(0,3)));return;}
  const spec=JSON.stringify({parts:o.parts||[],wires:o.wires||[],hex:r.hex});
  ev(`(()=>{if(running)toggleSim();S={name:'T',comps:[],wires:[],mats:[]};const sp=${spec};const M={};let x=0;
    M.u={id:newId(),type:'mcu_bluepill',x:0,y:0,rot:0,props:Object.assign(JSON.parse(JSON.stringify(PARTS.mcu_bluepill.props)),{hex:sp.hex})};S.comps.push(M.u);
    for(const [k,type,props] of sp.parts){x+=500;M[k]={id:newId(),type,x,y:600,rot:0,props:Object.assign(JSON.parse(JSON.stringify(PARTS[type].props||{})),props||{})};S.comps.push(M[k]);}
    for(const [a,pa,b,pb] of sp.wires){const ia=resolvePin(M[a],pa), ib=resolvePin(M[b],pb); if(ia<0||ib<0||ia===undefined||ib===undefined) throw new Error('pin '+a+':'+pa+' / '+b+':'+pb); S.wires.push({id:newId(),a:{c:M[a].id,t:ia},b:{c:M[b].id,t:ib},pts:[],color:'#f00'});}
    window.M=M; changed(); toggleSim();})()`);
  const t0=Date.now();
  for(const [t,js] of (o.at||[])){ ev(`while(E.t<${t})simStep(E.dt)`); ev(js); }
  if(o.trace) ev(`window.TR=[];window.TRl=null;while(E.t<${o.secs}){simStep(E.dt); const v=(${o.trace}); if(v!==TRl){TR.push([+E.t.toFixed(4),v]);TRl=v;}}`); else ev(`while(E.t<${o.secs})simStep(E.dt)`);
  let res; try{res=ev(o.check);}catch(e){res='EXC '+e.message}
  const ser=ev(`(devOf(M.u).mcu&&devOf(M.u).mcu.serial||'')`);
  console.log((o.ok?o.ok(res,ser):true)?'✓':'?',name,'→',typeof res==='string'?res.slice(0,300):res,'| serial:',JSON.stringify(ser.slice(-120)),(Date.now()-t0)+'ms', r.flash+'B');
}
setTimeout(async()=>{
  const P=ev(`PARTS.mcu_bluepill.props.code`);
  await st('Blue Pill: miganie PC13 + Serial',{code:P,secs:1.3,trace:`devOf(M.u).s.L?1:0`,check:`JSON.stringify(TR)`,ok:(r,s)=>{const a=JSON.parse(r);return a.length>=3&&Math.abs(a[2][0]-a[1][0]-0.5)<0.01&&s.includes('Witaj z STM32F103!')&&s.includes('Czas pracy: 1 s');}});
  await st('Blue Pill: analogRead, PWM (PA8), przerwanie EXTI (PB12)',{code:`volatile int n=0; void isr(){ n++; }
void setup(){ Serial.begin(115200); pinMode(PB12, INPUT_PULLUP); attachInterrupt(digitalPinToInterrupt(PB12), isr, FALLING); analogWrite(PA8, 64); analogReadResolution(12); }
void loop(){ static unsigned long t=0; if(millis()-t>=100){ t=millis(); Serial.print("adc="); Serial.print(analogRead(PA0)); Serial.print(" n="); Serial.println(n); } }`,
    parts:[['p','pot',{r:10000,pos:0.25}],['b','button'],['r','resistor',{r:1000}],['l','led']],
    wires:[['p',0,'u','GND'],['p',2,'u','3V3'],['p',1,'u','PA0'],['b','1','u','PB12'],['b','2','u','GND'],['r','1','u','PA8'],['r','2','l',0],['l',1,'u','GND']],
    at:[[0.25,`M.b.props.pressed=true;E.dirty=true`],[0.3,`M.b.props.pressed=false;E.dirty=true`],[0.35,`M.b.props.pressed=true;E.dirty=true`],[0.4,`M.b.props.pressed=false;E.dirty=true`]],secs:0.6,
    check:`(()=>{const k=devOf(M.u).mcu.core;let on=0;for(let i=0;i<2000;i++){k.run(k.cycles+36);if(k.pinState('A',8)[0]===1)on++;}return JSON.stringify({duty:on/2000});})()`,
    ok:(r,s)=>{const o=JSON.parse(r);return Math.abs(o.duty-64/255)<0.03&&/adc=10[0-9][0-9] n=2/.test(s);}});
  await st('Blue Pill: Wire + Adafruit_SSD1306 (I2C1 PB6/PB7)',{code:`#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
Adafruit_SSD1306 oled(128, 64, &Wire, -1);
void setup(){ Serial.begin(115200); Wire.begin(); if(!oled.begin(SSD1306_SWITCHCAPVCC,0x3C)) Serial.println("brak OLED"); oled.clearDisplay(); oled.setTextSize(2); oled.setTextColor(SSD1306_WHITE); oled.setCursor(0,0); oled.println("STM32"); oled.display(); Serial.println("ok"); }
void loop(){}`, parts:[['o','oled_128x64']],wires:[['o','GND','u','GND'],['o','VCC','u','3V3'],['o','SCL','u','PB6'],['o','SDA','u','PB7']],secs:0.5,
    check:`(()=>{const o=devOf(M.o).s.oled;let n=0;for(let y=0;y<64;y++)for(let x=0;x<128;x++)n+=o.px(x,y);return 'px='+n+' on='+o.on;})()`, ok:(r,s)=>/px=[1-9]\d+ on=1/.test(r)&&s.includes('ok')});
  await st('Blue Pill: rejestry (bare-metal TIM2 przerwanie + GPIOA)',{code:`extern "C" void TIM2_IRQHandler(void){ TIM2->SR = 0; GPIOA->ODR ^= 1u<<1; }
void setup(){ RCC->APB1ENR |= 1; RCC->APB2ENR |= 1u<<2; GPIOA->CRL = (GPIOA->CRL & ~(15u<<4)) | (3u<<4); TIM2->PSC = 7199; TIM2->ARR = 99; TIM2->DIER = 1; TIM2->CR1 = 1; NVIC_EnableIRQ(TIM2_IRQn); }
void loop(){ __WFI(); }`, secs:0.25, trace:`dV(devOf(M.u),resolvePin(M.u,'PA1'))>1.6?1:0`, check:`JSON.stringify(TR.slice(0,5))`, ok:r=>{const a=JSON.parse(r);return a.length>=4&&Math.abs(a[3][0]-a[2][0]-0.01)<0.0005;}});
  console.log('errors:',errs); process.exit(0);
},300);
