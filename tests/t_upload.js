// Testy protokołów wgrywania (STK500v1/v2, ArduinoISP, bootloader STM32, REPL MicroPythona) na symulowanych bootloaderach
const fs=require('fs');
global.performance=require('perf_hooks').performance;
global.t=(k,o)=>k+(o?JSON.stringify(o):''); global.PY_FILES=[['/lib/ssd1306.py','# ssd1306 driver\nclass SSD1306: pass\n']];
global.PARTS={}; global.$=()=>null;
const SRC=require('path').join(__dirname,'..','src','js');
eval(fs.readFileSync(SRC+'/picasm.js','utf8').replace("'use strict';",'')+';global.parseIntelHex=parseIntelHex;global.toIntelHex=toIntelHex');
const src=fs.readFileSync(SRC+'/upload.js','utf8').replace("'use strict';",'');
eval(src+';global.U={uploadStk500v1,uploadStk500v2,uploadStm32,uploadMicroPython,SerialLink,uploadMethod}');
// łącze z urządzeniem zasymulowanym funkcją onBytes
class MockLink{ constructor(dev){this.dev=dev;this.buf=[];this.waiters=[];dev.send=b=>{setTimeout(()=>{for(const x of b)this.buf.push(x);const w=this.waiters;this.waiters=[];w.forEach(f=>f());},1);};}
  async write(b){ this.dev.rx(Array.from(b)); } async setSignals(s){ if(this.dev.signals) this.dev.signals(s); } drain(){this.buf.length=0;}
}
MockLink.prototype.read=U.SerialLink.prototype.read; MockLink.prototype.readUntil=U.SerialLink.prototype.readUntil;
const ui={step:()=>{},log:s=>{},progress:()=>{}};
function rndHex(n,base){const m=new Map();for(let i=0;i<n;i++)m.set(base+i,(i*37+11)&255);return {hex:toIntelHex(m),m};}
// --- Optiboot (STK500v1) ---
function optiboot(sig,isp){const flash=new Uint8Array(0x8000).fill(0xFF);let q=[],addr=0,synced=false;const d={flash,rx(b){q.push(...b);this.proc();},proc(){
  for(;;){ if(!q.length) return; const c=q[0]; const need={0x30:2,0x50:2,0x51:2,0x75:2,0x55:4,0x42:22,0x45:7,0x56:6}[c]; let n=need;
    if(c===0x64||c===0x74){ if(q.length<4) return; const len=(q[1]<<8)|q[2]; n=c===0x64?5+len:5; }
    if(n===undefined){q.shift();continue;} if(q.length<n) return; const m=q.splice(0,n); if(m[n-1]!==0x20){this.send([0x15]);continue;}
    if(c===0x30){synced=true;this.send([0x14,0x10]);} else if(c===0x75)this.send([0x14,...sig,0x10]); else if(c===0x55){addr=(m[1]|(m[2]<<8))*2;this.send([0x14,0x10]);}
    else if(c===0x64){const len=(m[1]<<8)|m[2];for(let i=0;i<len;i++)flash[addr+i]=m[4+i];this.send([0x14,0x10]);}
    else if(c===0x74){const len=(m[1]<<8)|m[2];this.send([0x14,...flash.slice(addr,addr+len),0x10]);}
    else if(c===0x56){ if(m[1]===0xAC&&m[2]===0x80) flash.fill(0xFF); this.send([0x14,0,0x10]);}
    else this.send([0x14,0x10]); } }};return d;}
// --- STK500v2 ---
function wiring(){const flash=new Uint8Array(0x40000).fill(0xFF);let q=[],addr=0;const d={flash,rx(b){q.push(...b);for(;;){if(q.length<5)return;if(q[0]!==0x1B){q.shift();continue;}const len=(q[2]<<8)|q[3];if(q.length<6+len)return;const m=q.splice(0,6+len);const body=m.slice(5,5+len),seq=m[1];let ans;
  switch(body[0]){case 0x01:ans=[0x01,0,8,...Buffer.from('AVRISP_2')];break;case 0x10:case 0x11:ans=[body[0],0];break;case 0x1B:ans=[0x1B,0,[0x1E,0x98,0x01][body[4]],0];break;
   case 0x06:addr=(((body[1]&0x7F)<<24)|(body[2]<<16)|(body[3]<<8)|body[4])*2;ans=[0x06,0];break;
   case 0x13:{const n=(body[1]<<8)|body[2];for(let i=0;i<n;i++)flash[addr+i]=body[10+i];addr+=n;ans=[0x13,0];break;}
   case 0x14:{const n=(body[1]<<8)|body[2];ans=[0x14,0,...flash.slice(addr,addr+n),0];addr+=n;break;}}
  const r=[0x1B,seq,ans.length>>8,ans.length&255,0x0E,...ans];r.push(r.reduce((x,y)=>x^y,0));this.send(r);}}};return d;}
// --- bootloader STM32 ---
function stmbl(){const flash=new Uint8Array(0x10000).fill(0);let q=[],st='cmd',cmd=0,addr=0,init=false,go=null;const d={flash,go:()=>go,rx(b){q.push(...b);this.proc();},proc(){for(;;){
  if(!init){ if(!q.length)return; if(q.shift()===0x7F){init=true;this.send([0x79]);} continue; }
  if(st==='cmd'){ if(q.length<2)return; const [c,x]=q.splice(0,2); if((c^x)!==0xFF){this.send([0x1F]);continue;} cmd=c;
    if(c===0x00){this.send([0x79,11,0x22,0x00,0x01,0x02,0x11,0x21,0x31,0x44,0x63,0x73,0x82,0x92,0x79]);continue;}
    if(c===0x02){this.send([0x79,1,0x04,0x10,0x79]);continue;}
    this.send([0x79]); st=(c===0x44)?'erase':'addr'; continue; }
  if(st==='erase'){ if(q.length<3)return; q.splice(0,3); flash.fill(0xFF); this.send([0x79]); st='cmd'; continue; }
  if(st==='addr'){ if(q.length<5)return; const a=q.splice(0,5); addr=((a[0]<<24)|(a[1]<<16)|(a[2]<<8)|a[3])>>>0; this.send([0x79]); if(cmd===0x21){go=addr;st='cmd';} else st=cmd===0x31?'wdata':'rlen'; continue; }
  if(st==='wdata'){ if(!q.length)return; const n=q[0]+1; if(q.length<n+2)return; const m=q.splice(0,n+2); for(let i=0;i<n;i++)flash[addr-0x08000000+i]=m[1+i]; this.send([0x79]); st='cmd'; continue; }
  if(st==='rlen'){ if(q.length<2)return; const [n]=q.splice(0,2); this.send([0x79,...flash.slice(addr-0x08000000,addr-0x08000000+n+1)]); st='cmd'; continue; } }}};return d;}
// --- MicroPython raw REPL ---
function mpy(){const fs2={};let q=[],raw=false,cur=null;const d={fs:fs2,rx(b){for(const c of b){ if(!raw){ if(c===0x01){raw=true;this.send([...Buffer.from('raw REPL; CTRL-B to exit\r\n>')]);} continue; }
  if(c===0x02){raw=false;continue;} if(c===0x04){ const code=Buffer.from(q).toString(); q=[]; let out='',err='';
    try{ for(const line of code.split('\n')){ let m; if(m=/^f=open\("([^"]+)",'wb'\)$/.exec(line)){cur=m[1];fs2[cur]='';} else if(m=/^w\(b'(.*)'\)$/.exec(line)){fs2[cur]+=m[1].replace(/\\x([0-9a-f]{2})/g,(_,h)=>String.fromCharCode(parseInt(h,16)));} else if(line==='f.close()'){} else if(line.startsWith('print(')){out+='micropython esp32\r\n';} } }catch(e){err=String(e);}
    this.send([...Buffer.from('OK'+out),4,...Buffer.from(err),4,0x3E]); continue; }
  q.push(c);} }};return d;}
(async()=>{
  const ok=(n,c)=>console.log(c?'✓':'✗',n);
  { const {hex,m}=rndHex(3000,0); const dev=optiboot([0x1E,0x95,0x0F]); const L=new MockLink(dev); const r=await U.uploadStk500v1(L,hex,{flash:0x7E00,page:128,sig:[0x1E,0x95,0x0F]},ui); ok('STK500v1 (Uno) '+r.bytes+' B',[...m].every(([a,v])=>dev.flash[a]===v)); }
  { const {hex}=rndHex(100,0); const dev=optiboot([0x1E,0x95,0x16]); const L=new MockLink(dev); try{await U.uploadStk500v1(L,hex,{flash:0x7E00,page:128,sig:[0x1E,0x95,0x0F]},ui);ok('zła sygnatura',false);}catch(e){ok('STK500v1 zła sygnatura → '+e.code,e.code==='badsig');} }
  { const {hex,m}=rndHex(1000,0); const dev=optiboot([0x1E,0x93,0x0B]); const L=new MockLink(dev); const r=await U.uploadStk500v1(L,hex,{flash:0x2000,page:64,isp:true,sig:[0x1E,0x93,0x0B]},ui); ok('ArduinoISP (ATtiny85) '+r.bytes+' B',[...m].every(([a,v])=>dev.flash[a]===v)); }
  { const {hex,m}=rndHex(70000,0); const dev=wiring(); const L=new MockLink(dev); const r=await U.uploadStk500v2(L,hex,{flash:0x3E000,sig:[0x1E,0x98,0x01]},ui); ok('STK500v2 (Mega) '+r.bytes+' B',[...m].every(([a,v])=>dev.flash[a]===v)); }
  { const {hex,m}=rndHex(5001,0x08000000); const dev=stmbl(); const L=new MockLink(dev); const r=await U.uploadStm32(L,hex,{flash:0x10000},ui); ok('STM32 AN3155 '+r.bytes+' B, Go 0x'+(dev.go()||0).toString(16),[...m].every(([a,v])=>dev.flash[a-0x08000000]===v)&&dev.go()===0x08000000); }
  { const code='from machine import Pin\nimport ssd1306\nprint("zażółć")\n'; const dev=mpy(); const L=new MockLink(dev); const r=await U.uploadMicroPython(L,code,{},ui); ok('MicroPython main.py + ssd1306.py',Buffer.from(dev.fs['main.py'],'latin1').toString('utf8')===code&&!!dev.fs['ssd1306.py']); }
  process.exit(0);
})().catch(e=>{console.log('EXC',e);process.exit(1)});
