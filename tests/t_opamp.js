const {w,ev,errs}=require('./test.js');
function mk(comps,wires){ ev(`EXAMPLES.push({g:{pl:'T',en:'T'},n:{pl:'T',en:'T'},d:{pl:'',en:''},comps:${JSON.stringify(comps)},wires:${JSON.stringify(wires)}}); loadExample(EXAMPLES.length-1); toggleSim();`); }
function run(T){ return JSON.parse(ev(`(()=>{const o=[];while(E.t<${T}){simStep(E.dt);o.push([E.t,CIR.V[CIR.nodeOfKey(S.comps[1].id+':0')]]);}toggleSim();return JSON.stringify(o)})()`)); }
setTimeout(()=>{
  for (const [part,f] of (process.env.SKIP?[]:[['op_lm358',1e3],['op_lm358',1e4],['op_tl072',1e4]])) {
    // comps: 0 dcsupply, 1 opamp, 2 fgen, 3 R1 1k, 4 R2 100k
    mk([['dcsupply',0,0,0,{v:10,ilim:1}],[part,200,0],['fgen',0,200,0,{wave:'sine',f,amp:0.01,off:0.06}],['resistor',300,200,0,{r:1000}],['resistor',300,300,0,{r:100000}]],
      [[0,0,1,7,[],0],[0,1,1,3,[],1],[2,0,1,2,[],2],[2,1,0,1,[],1],[3,0,1,1,[],2],[3,1,0,1,[],1],[4,0,1,1,[],2],[4,1,1,0,[],2]]);
    const o=run(8/f); const tail=o.filter(x=>x[0]>4/f).map(x=>x[1]); const amp=(Math.max(...tail)-Math.min(...tail))/2;
    const ideal=101*0.01, gbw={op_lm358:0.7e6,op_tl072:3e6}[part]; const exp=ideal/Math.sqrt(1+(f*101/gbw)**2);
    console.log(part,'f=',f,'dt=',ev('E.dt'),'amp out',amp.toFixed(4),'expected',exp.toFixed(4),'DC',(tail.reduce((a,b)=>a+b,0)/tail.length).toFixed(3));
  }
  // slew: TL072 vs uA741 follower, square 0..2 V at 2 kHz, ±12 V
  for (const part of ['op_ua741','op_tl072']) {
    mk([['dcsupply',0,0,0,{v:24,ilim:1}],[part,200,0],['fgen',0,200,0,{wave:'square',f:2000,amp:2,off:0}],['resistor',300,200,0,{r:10000}],['resistor',300,300,0,{r:10000}]],
      // supply: + to V+ (pin7 idx6), − to V− (pin4 idx3); fgen COM to midpoint of 2 resistors across supply
      [[0,0,1,6,[],0],[0,1,1,3,[],1],[3,0,0,0,[],0],[3,1,4,0,[],1],[4,1,0,1,[],1],[2,1,3,1,[],1],[2,0,1,2,[],2],[1,5,1,1,[],2]]);
    ev('E.dt=2e-7');
    const o=JSON.parse(ev(`(()=>{const o=[];const mid=()=>CIR.V[CIR.nodeOfKey(S.comps[3].id+':1')];while(E.t<0.62e-3){simStep(E.dt);o.push([E.t,CIR.V[CIR.nodeOfKey(S.comps[1].id+':5')]-mid()]);}toggleSim();return JSON.stringify(o)})()`));
    // rising edge at t=0.5 ms (half period end)? find max slope
    let ms=0; for(let i=1;i<o.length;i++){ const s=(o[i][1]-o[i-1][1])/(o[i][0]-o[i-1][0]); if(Math.abs(s)>ms) ms=Math.abs(s); }
    console.log(part,'max slope V/us',(ms/1e6).toFixed(3));
  }
  console.log('errs',errs); process.exit(0);
},300);
