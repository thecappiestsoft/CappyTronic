const {sc,P,pw,ev,errs}=require('./periph_h.js');
(async()=>{await new Promise(r=>setTimeout(r,300));
const W=[['g','GND','u','GND'],['g','VCC','u','5V'],['g','PSB','u','5V'],['g','RST','u','5V'],['g','RS','u','D12'],['g','R/W','u','GND'],['g','E','u','D11']]; for(let k=0;k<8;k++) W.push(['g','DB'+k,'u','D'+(2+k)]);
await sc('ST7920 równolegle 8-bit, tryb tekstowy',{parts:[['g','st7920']],wires:W,
 code:`void wr(bool rs,uint8_t v){digitalWrite(12,rs);for(int i=0;i<8;i++)digitalWrite(2+i,(v>>i)&1);digitalWrite(11,HIGH);delayMicroseconds(1);digitalWrite(11,LOW);delayMicroseconds(80);}\nvoid txt(uint8_t a,const char*s){wr(0,a);while(*s)wr(1,*s++);}\nvoid setup(){for(int i=2;i<=12;i++)pinMode(i,OUTPUT);delay(50);wr(0,0x30);wr(0,0x30);wr(0,0x0C);wr(0,0x01);delay(2);txt(0x80,"CappyTronic");txt(0x90,"ST7920 OK");txt(0x98,"Linia 4");}\nvoid loop(){}`,secs:0.3,
 check:`(()=>{const l=${P('g')}.s.lcd;let n=0;for(let y=0;y<64;y++)for(let x=0;x<128;x++)n+=l.px(x,y);const t=a=>Array.from(l.dd.slice(a,a+6)).map(w=>String.fromCharCode(w>>8,w&255)).join('');return t(0)+'|'+t(16)+'|'+t(24)+' px='+n})()`,ok:r=>r.startsWith('CappyTronic |ST7920 OK   |Linia 4')});
console.log('errs',errs);process.exit(0)})();
