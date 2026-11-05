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
  if(o.pressAt){ ev(`while(E.t<${o.pressAt})simStep(E.dt)`); ev(o.press); } ev(`while(E.t<${o.secs||1})simStep(E.dt)`);
  let res; try{res=ev(o.check);}catch(e){res='EXC '+e.message}
  const ser=ev(`(CIR.mcus[0].mcu.serial||'').slice(-120)`);
  console.log((o.ok&&o.ok(res,ser))?'✓':'?',name,'→',typeof res==='string'?res.slice(0,200):res,'| serial:',JSON.stringify(ser.slice(-80)));
}
const P=(k,t)=>`CIR.devs.find(d=>d.c===M.${k})`;
const pw=k=>[[k,'GND','u','GND'],[k,'VCC','u','5V']];
module.exports={sc,P,pw,ev,errs};
