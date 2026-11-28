'use strict';
// Feature extensions built on KXCI Rev F commands (R-20261128-003).
const test=require('node:test'),assert=require('node:assert/strict');
const protocol=require('../integrations/dkds-native/kxci-protocol.js');
const {createIdentityController}=require('../integrations/dkds-native/identity-core.js');

function fakeInstrument({syntaxBit=true,idn='KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14'}={}){
 let syntax=false;const sent=[];
 const tcp={
  open:async()=>({sessionId:'s1',localAddress:'10.0.0.2',remoteAddress:'10.0.0.5',remotePort:1225}),
  close:async()=>{},
  exchange:async({base64})=>{
   const cmd=Buffer.from(base64,'base64').toString('latin1').replace(/\0$/,'');sent.push(cmd);
   const r=t=>({base64:Buffer.from(t+'\0','latin1').toString('base64')});
   if(cmd==='*IDN?')return r(idn);
   if(cmd==='ID')return r('KI4200A V1.14');
   if(cmd==='*OPT?')return r('SMU1,SMU2,,,,,,');
   if(cmd==='SP'){const v=syntax?2:0;syntax=false;return r(String(v));}
   if(cmd===':ERROR:LAST:CLEAR'){return r('ACK');}
   if(cmd===':ERROR:LAST:GET')return r(sent.includes(protocol.SELF_TEST_UNSUPPORTED)&&sent.lastIndexOf(':ERROR:LAST:CLEAR')<sent.lastIndexOf(protocol.SELF_TEST_UNSUPPORTED)?'Unsupported command received. (-986)':'No error (0)');
   if(cmd===protocol.SELF_TEST_UNSUPPORTED){if(syntaxBit)syntax=true;return r('ACK');}
   throw Error('unexpected command in self-test: '+cmd);
  }
 };
 return {tcp,sent};
}

test('self-check sends only the fixed query plan and grades every finding',async()=>{
 const {tcp,sent}=fakeInstrument();
 const c=createIdentityController(tcp,protocol);
 await c.connect({host:'10.0.0.5'});
 const report=await c.selfTest();
 assert.equal(report.status,'pass',JSON.stringify(report.findings));
 assert.deepEqual(sent.slice(1),protocol.SELF_TEST_PLAN.map(s=>s.command));
 assert.ok(!sent.some(cmd=>/^(DV|DI|TI|TV|ME|VC|IC|VR|IR|VL|IL|VP|IP)/.test(cmd)),'no source/measure command');
 assert.equal(report.entries.length,protocol.SELF_TEST_PLAN.length);
 assert.match(report.entries.find(e=>e.id==='idn').frameHex,/00$/);
});

test('self-check flags an instrument that never raises the syntax-error bit',async()=>{
 const {tcp}=fakeInstrument({syntaxBit:false});
 const c=createIdentityController(tcp,protocol);
 await c.connect({host:'10.0.0.5'});
 const report=await c.selfTest();
 assert.equal(report.status,'fail');
 assert.equal(report.findings.find(f=>f.id==='syntax-bit').status,'fail');
});

test('self-check refuses to run while a measurement program is active',async()=>{
 const {tcp}=fakeInstrument();
 const c=createIdentityController(tcp,protocol);
 await c.connect({host:'10.0.0.5'});
 c.beginSystemProgram({setup:[],reads:[],cleanup:[],rdNames:[],count:1});
 await assert.rejects(()=>c.selfTest(),/测量进行中/);
});

function loadNative(){
 const fs=require('fs'),path=require('path'),vm=require('vm');
 const modules=new Map(),window={DKDSPluginModules:{define:(o,n,a)=>modules.set(n,a),require:n=>modules.get(n)}};
 for(const n of ['hardware-capabilities.js','model.js','measurement-plan.js','measurement-runtime.js','kxci-measurement.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../integrations/dkds-native',n),'utf8'),{window});
 const smu=c=>({family:'SMU',channel:c,type:'SMU',physicalType:'SMU',physicalIdentityVerified:true,ratingsVerified:true,powerClass:'medium',preamplifier:false});
 const hardware={inventory:{physicalModelsVerified:true,hardwareLimitsVerified:true,slots:[smu(1),smu(2),smu(3),smu(4)]},capabilities:modules.get('dkts-capabilities')};
 return {m:modules.get('model'),r:modules.get('measurementRuntime'),k:modules.get('dkts-kxci-measurement'),hardware};
}
function dcPage(m,preset='optimized'){const p=m.validate(m.initial()).pages.find(p=>p.kind==='dc');p.dc.preset=preset;return p;}
function fakeController(){
 const sent=[];let started=false;
 return {sent,controller:{
  status:()=>({phase:'connected'}),beginSystemProgram(){},endSystemProgram(){},
  measurementExchange:async(cmd,reply)=>{sent.push(cmd);
   if(cmd==='ME1')started=true;
   if(cmd==='SP')return started?'1':'0';
   if(/^TI1$/.test(cmd))return 'NAI+1.0000E-09';
   if(/^TI2$/.test(cmd))return 'NBI+1.0000E-12';
   if(/^TV1$/.test(cmd))return 'NAV+1.0000E-01';
   if(/^TV2$/.test(cmd))return 'NBV+0.0000E+00';
   if(cmd===':ERROR:LAST:GET')return 'No error (0)';
   if(/^DO '/.test(cmd)){const n=sent.filter(c=>/^VR1,|^VL/.test(c)).length?11:1;return Array.from({length:n},(_,i)=>cmd.endsWith("T'")?String(i*0.01):'N'+(i*0.1).toFixed(1)).join(',');}
   return '';
  }}};
}

test('Rev F 5-48: OV headroom is 10 % + 0.5 V rounded up to 0.1 V and capped at 221 V',()=>{
 const {k}=loadNative();
 assert.equal(k.overvoltageLimit(0),0.5);
 assert.equal(k.overvoltageLimit(1),1.6);
 assert.equal(k.overvoltageLimit(20),22.5);
 assert.equal(k.overvoltageLimit(210),221);
});

test('System Mode sets OV per SMU after SS and releases it after ZE',()=>{
 const {m,r,k,hardware}=loadNative();
 const c=k.compileSweep(r.pageToBasicProgram(dcPage(m),m),hardware);
 const s=c.system.setup,ss=s.indexOf('SS');
 const ov=s.filter(x=>/^OV /.test(x));
 assert.ok(ov.length===c.active.length&&ov.length>0);
 assert.ok(s.findIndex(x=>/^OV /.test(x))>ss&&s.findIndex(x=>/^(VR|VL|VC|IC|IR)/.test(x))>s.findIndex(x=>/^OV /.test(x)));
 const cl=c.system.cleanup;
 assert.ok(cl.indexOf('ZE')<cl.findIndex(x=>/^OV .*,221$/.test(x)));
 assert.ok(c.system.overvoltageRelease.every(x=>/,221$/.test(x)));
});

test('OV can be switched off per program',()=>{
 const {m,r,k,hardware}=loadNative();
 const input={...r.pageToBasicProgram(dcPage(m),m),overvoltageProtection:false};
 const c=k.compileSweep(input,hardware);
 assert.equal(c.overvoltage,null);assert.ok(!c.system.setup.some(x=>/^OV /.test(x)));
});

test('user mode clamps every SMU with OV before the first DV and releases after DV off',async()=>{
 const {m,r,k,hardware}=loadNative(),{sent,controller}=fakeController();
 const runner=k.createRunner({controller,execution:{begin:()=>({end(){}})},wait:()=>Promise.resolve()});
 runner.start(r.pageToBasicProgram(dcPage(m,'point-by-point'),m),hardware,'CONFIRM_WIRING_AND_OUTPUT');
 const result=await runner.waitForCompletion();
 assert.equal(result.state,'completed',result.error);
 const firstDv=sent.findIndex(c=>/^DV[1-9],/.test(c)),firstOv=sent.findIndex(c=>/^OV /.test(c));
 assert.ok(firstOv>=0&&firstOv<firstDv);
 const lastOff=sent.map((c,i)=>/^DV[1-9]$/.test(c)?i:-1).filter(i=>i>=0).at(-1);
 assert.ok(sent.slice(lastOff).some(c=>/^OV [1-9],221$/.test(c)));
});

function withStrategy(m,preset,patch){const p=dcPage(m,preset);Object.assign(p.dc.strategy,patch);return p;}

test('Rev F 5-16/17: power-on order OS/OD follows the listed terminals and is restored',()=>{
 const {m,r,k,hardware}=loadNative();
 const input=r.pageToBasicProgram(withStrategy(m,'optimized',{powerOrder:'G,D',powerDelays:'0.01,0.02'}),m);
 const c=k.compileSweep(input,hardware),s=c.system.setup;
 const os=s.find(x=>/^OS /.test(x)),od=s.find(x=>/^OD /.test(x));
 const g=c.channels.gate??c.channels.G,d=c.channels.drain??c.channels.D;
 assert.ok(os&&os.startsWith('OS '+g+','+d),os);
 assert.match(od,/^OD 0\.01,0\.02/);
 assert.ok(s.indexOf(os)>s.indexOf('SS'));
 assert.ok(c.system.cleanup.some(x=>/^OS /.test(x))&&c.system.cleanup.some(x=>/^OD 0(,0)*$/.test(x)));
});

test('power-on order is rejected outside Optimized mode and for unknown terminals',()=>{
 const {m}=loadNative();
 const bad=withStrategy(m,'point-by-point',{powerOrder:'G,D'});
 assert.throws(()=>m.dcSummary(bad),/Optimized/);
 const unknown=withStrategy(m,'optimized',{powerOrder:'Q'});
 assert.throws(()=>m.dcSummary(unknown),/distinct mapped/);
});

test('Rev F 5-37: best fixed source range uses SR ch,2 in System Mode and is restored to auto',()=>{
 const {m,r,k,hardware}=loadNative();
 const c=k.compileSweep(r.pageToBasicProgram(withStrategy(m,'optimized',{sourceRange:'best'}),m),hardware);
 const sr=c.system.setup.filter(x=>/^SR /.test(x));
 assert.equal(sr.length,c.active.filter(role=>c.system.setup.some(x=>x==='SR '+c.channels[role]+',2')).length);
 assert.ok(sr.length>0&&sr.every(x=>/,2$/.test(x)));
 assert.ok(c.system.cleanup.some(x=>/^SR \d,0$/.test(x)));
 const auto=k.compileSweep(r.pageToBasicProgram(dcPage(m),m),hardware);
 assert.ok(!auto.system.setup.some(x=>/^SR /.test(x)));
});

test('user mode best source range picks DV range code 1 (20 V) for low-voltage sweeps',async()=>{
 const {m,r,k,hardware}=loadNative(),{sent,controller}=fakeController();
 const runner=k.createRunner({controller,execution:{begin:()=>({end(){}})},wait:()=>Promise.resolve()});
 runner.start(r.pageToBasicProgram(withStrategy(m,'point-by-point',{sourceRange:'best'}),m),hardware,'CONFIRM_WIRING_AND_OUTPUT');
 const result=await runner.waitForCompletion();
 assert.equal(result.state,'completed',result.error);
 assert.ok(sent.some(c=>/^DV[1-9],1,/.test(c)),sent.filter(c=>/^DV/.test(c)).join(' '));
});

test('Rev F 5-47/5-50/5-52: custom speed sends IT4, RF and RK with validated parameters',()=>{
 const {m,r,k,hardware}=loadNative();
 const p=withStrategy(m,'optimized',{mode:'local',integrationPreset:'custom',customDelayFactor:'1.5',customFilterFactor:'0',customPlc:'2',rangeSkip:'1e-9 1e-10',rangeDelay:'1e-9:3'});
 const c=k.compileSweep(r.pageToBasicProgram(p,m),hardware),s=c.system.setup;
 assert.ok(s.includes('IT4,1.5,0,2'),s.join(' | '));
 assert.ok(s.some(x=>/^RK \d,1E-9,1E-10$|^RK \d,1E-09,1E-10$|^RK \d,1e-9,1e-10$/i.test(x)),s.filter(x=>/^RK/.test(x)).join(' '));
 assert.ok(s.some(x=>/^RF \d,1E-0?9,3$/i.test(x)),s.filter(x=>/^RF/.test(x)).join(' '));
});

test('custom speed fields are range-checked and per-range delays need custom speed',()=>{
 const {m}=loadNative(),root=m.validate(m.initial());
 assert.throws(()=>m.dcSummary(withStrategy(m,'optimized',{mode:'local',integrationPreset:'custom',customPlc:'20'})),/PLC/);
 assert.throws(()=>m.dcSummary(withStrategy(m,'optimized',{rangeDelay:'1e-9:2'})),/Custom/);
 assert.throws(()=>m.dcSummary(withStrategy(m,'optimized',{rangeSkip:'1e-2'})),/below 1 mA/);
});

test('transport whitelist accepts the new modeless commands and rejects out-of-range forms',async()=>{
 const {tcp}=fakeInstrument();
 const c=createIdentityController(tcp,protocol);
 await c.connect({host:'10.0.0.5'});
 c.beginSystemProgram({setup:[],reads:[],cleanup:[],rdNames:[],count:1});
 for(const bad of ['OV 1,300','IT4,1,1,50','DV1,1,30,0.001','RK 1,1E-2'])
  await assert.rejects(()=>c.measurementExchange(bad),undefined,bad);
});

function logPage(m,{start='0.1',stop='10',points='21'}={}){
 const p=dcPage(m);Object.assign(p.dc.terminals.D.segments[0],{method:'log',start,stop,points});return p;
}

test('Rev F 5-24: a log sweep on a whole log10/25/50 grid compiles to native VR2/3/4',()=>{
 const {m,r,k,hardware}=loadNative();
 const cases=[['21',2],['51',3],['101',4]];
 for(const [points,type] of cases){
  const c=k.compileSweep(r.pageToBasicProgram(logPage(m,{points}),m),hardware),s=c.system.setup;
  const vr=s.find(x=>/^VR[234],/.test(x));
  assert.equal(vr,'VR'+type+',0.1,10,0.01',s.join(' | '));
  assert.ok(!s.some(x=>/^VL/.test(x)));
 }
});

test('log sweeps off the native grid keep the exact planned levels as VL',()=>{
 const {m,r,k,hardware}=loadNative();
 const c=k.compileSweep(r.pageToBasicProgram(logPage(m,{stop:'5',points:'12'}),m),hardware),s=c.system.setup;
 assert.ok(!s.some(x=>/^VR[234],/.test(x)));
 assert.ok(s.some(x=>/^VL1,1,/.test(x)));
 assert.equal(k.nativeLogSweep({role:'drain',start:0.0001,stop:0.1,points:31},{terminal:'drain'},Array(31).fill(0),false,null),null,'planned levels must match');
});

test('Rev F 5-22/5-23: several Psweep sources compile to VP with stepper index 2–4 in CH order',()=>{
 const {m,r,k,hardware}=loadNative();
 const p=dcPage(m);p.dc.bodyResource='SMU3';
 Object.assign(p.dc.terminals.G,{role:'P',segments:[{...p.dc.terminals.G.segments[0],method:'points',start:'0',stop:'2',points:'3'}]});
 Object.assign(p.dc.terminals.B,{role:'P',ref:'GND',segments:[{...p.dc.terminals.B.segments[0],method:'points',start:'0',stop:'-1',points:'3'}]});
 const input=r.pageToBasicProgram(p,m);
 assert.equal(input.sweepProgram.pExtra.length,1);
 const c=k.compileSweep(input,hardware),s=c.system.setup;
 const vp=s.filter(x=>/^VP /.test(x));
 assert.deepEqual([...vp],['VP 0,1,3,0.01','VP 0,-0.5,3,0.01,2'],s.join(' | '));
 const ch=s.filter(x=>/^CH\d,'V/.test(x));
 assert.match(ch.at(-1),/^CH3,'V3','I3',1,2$/,'extra VAR2 defined last');
 assert.ok(ch.indexOf(ch.find(x=>/^CH2,/.test(x)))<ch.length-1);
 assert.ok(!s.some(x=>/^VC3,/.test(x)),'VAR2 source must not also get a fixed VC');
 assert.equal(c.overvoltage.body,1.6);
});

test('several Psweep sources need Optimized mode and equal step counts',()=>{
 const {m}=loadNative();
 const p=dcPage(m,'point-by-point');p.dc.bodyResource='SMU3';
 p.dc.terminals.G.role='P';p.dc.terminals.G.segments[0].method='step';
 p.dc.terminals.B.role='P';p.dc.terminals.B.ref='GND';p.dc.terminals.B.segments[0].method='step';
 assert.throws(()=>m.dcSummary(p),/Optimized/);
 p.dc.preset='optimized';p.dc.terminals.B.segments[0].step='0.5';
 assert.throws(()=>m.dcSummary(p),/same number of steps/);
});
