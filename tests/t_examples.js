const {w,ev,errs}=require('./test.js');
function run(i, secs, setup){
  ev(`loadExample(${i})`); if(setup) ev(setup);
  ev('toggleSim()'); const t0=Date.now();
  ev(`(()=>{let n=0;const T=${secs};while(E.t<T){simStep(E.dt);n++;}return n})()`);
  const ms=Date.now()-t0;
  const out=JSON.parse(ev(`JSON.stringify(CIR.devs.filter(d=>d.c.type!=='bb').map(d=>{const s=d.s;const o={t:d.c.type};for(const k of ['U','I','br','on','q','Ic','region','Vout','Vin','burnt','warn','ang','run','rs','rp'])if(s[k]!==undefined&&typeof s[k]!=='object')o[k]=typeof s[k]==='number'?+s[k].toFixed(4):s[k];if(s.lcd&&s.lcd.dd)o.lcd=String.fromCharCode(...s.lcd.dd.slice(0,16))+'|'+String.fromCharCode(...s.lcd.dd.slice(64,80));if(s.oled)o.oledPix=s.oled.ram.reduce((a,v)=>a+(v?1:0),0);if(d.mcu)o.serial=(d.mcu.serial||'').slice(-60);return o}))`));
  console.log(`\n=== ${i} ${ev(`L(EXAMPLES[${i}].n)`)} (${secs}s sym, ${ms} ms, dt=${ev('E.dt')})`); for(const o of out) console.log(' ',JSON.stringify(o));
  ev('toggleSim()');
}
setTimeout(()=>{try{
  run(0,0.5); run(1,0.3); run(2,1.0,"S.comps.find(c=>c.type==='button').props.pressed=true"); run(3,0.5);
  run(4,0.3); run(5,3.0); run(6,0.6); run(7,1.2); run(8,1.5); run(9,1.0); run(10,1.0);
}catch(e){console.log('EXC',e.stack)} console.log('errors:',errs.slice(0,5)); process.exit(0)},300);
