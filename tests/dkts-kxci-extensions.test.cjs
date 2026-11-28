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
