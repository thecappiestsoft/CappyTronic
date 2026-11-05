const {w,ev,errs}=require('./test.js'); const fs=require('fs'); const {execSync}=require('child_process');
const D=require('path').join(require('os').tmpdir(),'cappytronic-kicad')+'/'; fs.mkdirSync(D,{recursive:true}); // porównanie z kicad-cli (jeśli zainstalowany)
function canonT(){ return canon().map(x=>x.split('|').map(y=>y.replace(/@[-\d]+,[-\d]+/,'')).sort().join('|')).sort(); }
function canon(){ return JSON.parse(ev(`(()=>{const N=kiNets();const g={};for(const c of S.comps){if(c.type==='bb'||KI_SKIP.has(c.type))continue; /* przyrządy (np. multimetr) nie są eksportowane do KiCad */const n=pinsOf(c).length;for(let i=0;i<n;i++){const r=N.root(c,i);(g[r]=g[r]||[]).push(c.type+'@'+c.x+','+c.y+':'+i)}}return JSON.stringify(Object.values(g).filter(a=>a.length>1).map(a=>a.sort().join('|')).sort())})()`)); }
function sxNets(txt){ // parse (net ... (node (ref X) (pin N)))
  const nets=[]; const re=/\(net \(code "?\d+"?\) \(name "([^"]*)"\)([\s\S]*?)(?=\(net \(code|\)\s*\)\s*$)/g; let m;
  while((m=re.exec(txt))){ const nodes=[...m[2].matchAll(/\(node \(ref "?([^")\s]+)"?\) \(pin "?([^")\s]+)"?\)/g)].map(x=>x[1]+'.'+x[2]); if(nodes.length>1) nets.push(nodes.sort().join('|')); }
  return nets.sort();
}
setTimeout(()=>{ let bad=0;
 const n=+ev('EXAMPLES.length');
 for(let i=0;i<n;i++){
  ev(`loadExample(${i})`); const name=ev(`L(EXAMPLES[${i}].n)`);
  const before=canon();
  const sch=ev('kiExportSch().text'), net=ev('kiExportNet().text');
  fs.writeFileSync(D+`e${i}.kicad_sch`,sch); fs.writeFileSync(D+`e${i}.net`,net);
  let cli='';
  try{ execSync(`kicad-cli sch export netlist --format kicadsexpr -o ${D}e${i}_cli.net ${D}e${i}.kicad_sch`,{stdio:'pipe'}); cli=fs.readFileSync(D+`e${i}_cli.net`,'utf8'); }catch(e){ cli='ERR '+e.stderr; }
  const a=sxNets(net), b=cli.startsWith('ERR')?['ERR']:sxNets(cli);
  const same=JSON.stringify(a)===JSON.stringify(b);
  // round trips
  ev(`kiImport(${JSON.stringify(sch)},'x.kicad_sch')`); const rs=canon();
  ev(`loadExample(${i})`); ev(`kiImport(${JSON.stringify(net)},'x.net')`); const rn=canonT(); ev(`loadExample(${i})`); const bt=canonT();
  const okS=JSON.stringify(rs)===JSON.stringify(before), okN=JSON.stringify(rn)===JSON.stringify(bt);
  if(!same||!okS||!okN) bad++;
  console.log(`${i} ${name}: cli==ours ${same} (${a.length}/${b.length})  rt-sch ${okS}  rt-net ${okN}`);
  if(!same){ console.log('  ours-only',a.filter(x=>!b.includes(x)).slice(0,4)); console.log('  cli-only',b.filter(x=>!a.includes(x)).slice(0,4)); }
  if(!okN){ console.log('  net lost',bt.filter(x=>!rn.includes(x)).slice(0,3),' new',rn.filter(x=>!bt.includes(x)).slice(0,3)); }
  if(!okS){ console.log('  sch lost',before.filter(x=>!rs.includes(x)).slice(0,3),' new',rs.filter(x=>!before.includes(x)).slice(0,3)); }
 }
 console.log('bad',bad,'errors',errs.slice(0,3)); process.exit(0);
},300);
