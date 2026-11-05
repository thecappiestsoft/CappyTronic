const {w,ev,errs}=require('./test.js');
setTimeout(()=>{
 const types=JSON.parse(ev('JSON.stringify(Object.keys(PARTS))')); const bad=[];
 console.log('liczba elementów:',types.length, ' zablokowane:', ev('Object.values(PARTS).filter(p=>p.locked).length'));
 for(const ty of types){
   try{
     ev(`(()=>{if(running)toggleSim();S.comps=[];S.wires=[];changed();addComp('${ty}',300,300);
       const c=S.comps[S.comps.length-1]; if(!c) return;
       const b=addComp('battery',100,500); const bat=S.comps[S.comps.length-1];
       // podłącz pierwsze dwa piny do baterii (test odporności)
       const np=pinsOf(c).length; if(np>=2){S.wires.push({id:newId(),a:{c:bat.id,t:0},b:{c:c.id,t:0},pts:[],color:'#f00'});S.wires.push({id:newId(),a:{c:bat.id,t:1},b:{c:c.id,t:np-1},pts:[],color:'#000'});}
       changed(); toggleSim(); for(let i=0;i<200;i++)simStep(E.dt); render(); select('c',c.id); renderProps(); setTab('code'); setTab('props'); toggleSim();})()`);
     const nan=ev(`CIR===null?false:Array.from(CIR?CIR.V:[]).some(v=>!isFinite(v))`); if(nan) bad.push(ty+': NaN');
   }catch(e){bad.push(ty+': '+e.message.split('\n')[0]);}
 }
 ev("LANG='en'; applyLang(); buildPalette();"); ev("$('#search').value='555'; buildPalette()"); console.log('wyszukiwanie "555":', ev("document.querySelectorAll('#plist .pal-item').length"));
 ev("$('#search').value='tranzystor npn'; buildPalette()"); console.log('wyszukiwanie "tranzystor npn":', ev("[...document.querySelectorAll('#plist .pal-item')].map(e=>e.dataset.type).join(',')"));
 ev("$('#search').value='wyswietlacz'; buildPalette()"); console.log('wyszukiwanie "wyswietlacz":', ev("document.querySelectorAll('#plist .pal-item').length"));
 console.log('problemy:',bad.length?bad:'brak'); console.log('błędy okna:',errs.slice(0,5)); process.exit(0)},300);
