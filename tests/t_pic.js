// testy układów z własnym emulatorem (PIC16F84A, PIC18F4550, STM32)
const {w,ev,errs}=require('./test.js');
function chip(name,o){
  const spec=JSON.stringify(o);
  const r=ev(`(()=>{if(running)toggleSim();S={name:'T',comps:[],wires:[],mats:[]};const sp=${spec};const M={};let x=0;
    const mk=(k,type,props)=>{x+=300;M[k]={id:newId(),type,x,y:400,rot:0,props:Object.assign(JSON.parse(JSON.stringify(PARTS[type].props||{})),props||{})};S.comps.push(M[k]);};
    mk('u',sp.type,sp.props||{}); mk('ps','dcsupply',{v:sp.v||5}); for(const [k,type,props] of sp.parts||[]) mk(k,type,props);
    for(const [a,pa,b,pb] of sp.wires){const ia=resolvePin(M[a],pa), ib=resolvePin(M[b],pb); if(ia<0||ib<0||ia===undefined||ib===undefined) throw new Error('pin '+a+':'+pa+' / '+b+':'+pb); S.wires.push({id:newId(),a:{c:M[a].id,t:ia},b:{c:M[b].id,t:ib},pts:[],color:'#f00'});}
    window.M=M; codeBind(M.u); M.u.props.code=sp.code; doCompile(); const res=compileState.res; if(!res.ok) return 'ASM '+JSON.stringify(res.diags.filter(d=>d.type==='error').slice(0,4));
    changed(); toggleSim(); return 'ok '+res.words;})()`);
  if(!r.startsWith('ok')){console.log('✗',name,r);return;}
  const tr=[]; const t0=Date.now();
  if(o.trace) ev(`window.TR=[];window.TRl=null`);
  for(const [t,js] of (o.at||[])){ ev(`while(E.t<${t})simStep(E.dt)`); ev(js); }
  if(o.trace) ev(`while(E.t<${o.secs}){simStep(E.dt); const v=(${o.trace}); if(v!==TRl){TR.push([+E.t.toFixed(4),v]);TRl=v;}}`); else ev(`while(E.t<${o.secs})simStep(E.dt)`);
  let res; try{res=ev(o.check);}catch(e){res='EXC '+e.message}
  const ser=ev(`(devOf(M.u).mcu&&devOf(M.u).mcu.serial||'').slice(-160)`);
  console.log((o.ok?o.ok(res,ser):true)?'✓':'?',name,'→',typeof res==='string'?res.slice(0,400):res,ser?'| serial: '+JSON.stringify(ser.slice(-100)):'',(Date.now()-t0)+'ms');
}
module.exports={chip,ev,errs};
if(require.main===module) setTimeout(()=>{
  const fs=require('fs');
  const P16=ev(`PARTS.mcu_pic16f84a.props.code`);
  const pw16=[['ps','+','u','VDD'],['ps','−','u','VSS'],['r','1','u','RB0'],['r','2','l',0],['l',1,'ps','−'],['m','1','ps','+'],['m','2','u','MCLR']];
  chip('PIC16F84A: miganie (domyślny program)',{type:'mcu_pic16f84a',code:P16,parts:[['r','resistor',{r:330}],['l','led'],['m','resistor',{r:10000}]],wires:pw16,secs:1.3,
    trace:`dV(devOf(M.u),resolvePin(M.u,'RB0'))>2.5?1:0`, check:`JSON.stringify(TR)`, ok:r=>{const a=JSON.parse(r);return a.length>=4 && Math.abs((a[2][0]-a[1][0])-0.2515)<0.01;}});
  chip('PIC16F84A: bez MCLR → reset',{type:'mcu_pic16f84a',code:P16,parts:[['r','resistor',{r:330}],['l','led']],wires:pw16.slice(0,5),secs:0.3,check:`devOf(M.u).s.warn`,ok:r=>r==='picMclr'});
  // TMR0 + przerwanie, RB4 zmiana (przycisk), EEPROM zapis/odczyt, tablica DT (RETLW), adresowanie pośrednie
  const T=fs.readFileSync(__dirname+'/pic16_test.asm','utf8');
  chip('PIC16F84A: TMR0, przerwania, EEPROM, DT, FSR',{type:'mcu_pic16f84a',code:T,parts:[['b','button'],['m','resistor',{r:10000}]],wires:[['ps','+','u','VDD'],['ps','−','u','VSS'],['m','1','ps','+'],['m','2','u','MCLR'],['b','1','u','RB4'],['b','2','ps','−']],
    at:[[0.3,`M.b.props.pressed=true;E.dirty=true`],[0.35,`M.b.props.pressed=false;E.dirty=true`],[0.45,`M.b.props.pressed=true;E.dirty=true`],[0.5,`M.b.props.pressed=false;E.dirty=true`]],secs:0.7,
    check:`(()=>{const k=devOf(M.u).mcu.core;return JSON.stringify({ticks:k.ram[0x0c],rbch:k.ram[0x0d],ee:k.ee[5],eerd:k.ram[0x0e],tab:k.ram[0x0f],sum:k.ram[0x10],porta:k.latA});})()`,
    ok:r=>{const o=JSON.parse(r);return o.ticks>=165&&o.ticks<=172&&o.rbch>=4&&o.ee===0x5A&&o.eerd===0x5A&&o.tab===0x37&&o.sum===36;}});
  module.exports.p18(); console.log('errors:',errs);process.exit(0);
},300);
module.exports.p18=()=>{
  const fs=require('fs');
  const P18=ev(`PARTS.mcu_pic18f4550.props.code`);
  const pw=[['ps','+','u','VDD'],['ps','−','u','VSS'],['m','1','ps','+'],['m','2','u','MCLR']];
  chip('PIC18F4550: miganie RD0 + UART (domyślny program)',{type:'mcu_pic18f4550',code:P18,parts:[['m','resistor',{r:10000}]],wires:pw,secs:0.9,
    trace:`dV(devOf(M.u),resolvePin(M.u,'RD0'))>2.5?1:0`, check:`JSON.stringify(TR)`, ok:(r,s)=>{const a=JSON.parse(r);return a.length>=3 && Math.abs((a[2][0]-a[1][0])-0.25)<0.003 && s.includes('Witaj z PIC18F4550!');}});
  chip('PIC18F4550: ADC, PWM, przerwanie niskiego priorytetu, I2C, MULLW, FSR',{type:'mcu_pic18f4550',code:fs.readFileSync(__dirname+'/pic18_test.asm','utf8'),
    parts:[['m','resistor',{r:10000}],['p','pot',{r:10000,pos:0.3}],['x','io_pcf8574'],['r1','resistor',{r:4700}],['r2','resistor',{r:4700}]],
    wires:[...pw,['p',0,'ps','−'],['p',2,'ps','+'],['p',1,'u','RA0'],['x','VCC','ps','+'],['x','GND','ps','−'],['x','SDA','u','RB0'],['x','SCL','u','RB1'],['r1','1','ps','+'],['r1','2','u','RB0'],['r2','1','ps','+'],['r2','2','u','RB1'],['x','A0','ps','−'],['x','A1','ps','−'],['x','A2','ps','−']],
    secs:0.3,
    check:`(()=>{const k=devOf(M.u).mcu.core;let on=0;for(let i=0;i<5000;i++){k.run(k.cycles+1);if(k.pwm[1])on++;}return JSON.stringify({adch:k.m[0x21],latd:k.m[0xF8C],cnt1:k.m[0x20],tmp:k.m[0x22],x:devOf(M.x).s.out!==undefined?devOf(M.x).s.out:devOf(M.x).s,duty:on/5000});})()`,
    ok:r=>{const o=JSON.parse(r);return Math.abs(o.adch-Math.round(0.3*1023)/4)<3&&o.latd===o.adch&&o.cnt1>=20&&o.cnt1<=23&&o.tmp===223&&Math.abs(o.duty-0.25)<0.03;}});
};
