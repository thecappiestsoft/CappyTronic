const comp=require('./tools.js').avr();
const {w,ev,errs}=require('./test.js');
const TX=`#include <CAN.h>\nvoid setup(){Serial.begin(115200);CAN.setClockFrequency(8E6);CAN.begin(500E3);}\nvoid loop(){static int i=0;CAN.beginPacket(0x12);CAN.write('A'+i%26);int r=CAN.endPacket();Serial.print("tx");Serial.println(r);CAN.beginPacket(0x7A1);CAN.write('Z');CAN.endPacket();i++;delay(100);}`;
const RX=(br,filt)=>`#include <CAN.h>\nvoid setup(){Serial.begin(115200);CAN.setClockFrequency(8E6);CAN.begin(${br});${filt?'CAN.filter(0x12,0x7ff);':''}}\nvoid loop(){int n=CAN.parsePacket();if(n){Serial.print("rx ");Serial.print(CAN.packetId(),HEX);Serial.print(' ');Serial.println((char)CAN.read());}}`;
async function run(name, rxCode, connectRx){
  const a=await comp({code:TX,target:'uno'}), b=await comp({code:rxCode,target:'uno'}); if(!a.ok||!b.ok){console.log('compile fail',JSON.stringify((a.ok?b:a).diags.slice(0,2)));return;}
  ev(`(()=>{if(running)toggleSim();S.comps=[];S.wires=[];const mk=(type,x,props)=>{const c={id:newId(),type,x,y:0,rot:0,props:Object.assign(JSON.parse(JSON.stringify(PARTS[type].props||{})),props||{})};S.comps.push(c);return c};
   const u1=mk('ard_uno',0,{hex:${JSON.stringify(a.hex)}}),u2=mk('ard_uno',1000,{hex:${JSON.stringify(b.hex)}}),c1=mk('can_mcp2515',0,{}),c2=mk('can_mcp2515',1000,{});c1.y=600;c2.y=600;
   const W=(c,p,d,q)=>S.wires.push({id:newId(),a:{c:c.id,t:resolvePin(c,p)},b:{c:d.id,t:resolvePin(d,q)},pts:[],color:'#f00'});
   for(const [u,c] of [[u1,c1],[u2,c2]]){W(c,'VCC',u,'5V');W(c,'GND',u,'GND');W(c,'CS',u,'D10');W(c,'SO',u,'D12');W(c,'SI',u,'D11');W(c,'SCK',u,'D13');W(c,'INT',u,'D2');}
   ${connectRx?"W(c1,'CANH',c2,'CANH');W(c1,'CANL',c2,'CANL');":''}
   window.U=[u1,u2]; changed(); toggleSim(); })()`);
  ev('while(E.t<0.5)simStep(E.dt)');
  console.log(name,'| TX:',JSON.stringify(ev('CIR.devs.find(d=>d.c===U[0]).mcu.serial.slice(-40)')),'| RX:',JSON.stringify(ev('CIR.devs.find(d=>d.c===U[1]).mcu.serial.slice(-60)')));
}
(async()=>{await new Promise(r=>setTimeout(r,300));
 await run('2 węzły 500k, bez filtra',RX('500E3',false),true);
 await run('filtr 0x12',RX('500E3',true),true);
 await run('różne prędkości 250k',RX('250E3',false),true);
 await run('brak drugiego węzła',RX('500E3',false),false);
 console.log(errs);process.exit(0)})();
