'use strict';
// Regression tests for the 2026-11-28 KXCI Rev F (4200A-KXCI-907-01F) review.
const test=require('node:test'),assert=require('node:assert/strict');
const {compileSystemPlan,executeSystemTask,parseTi,parseTv}=require('../integrations/dkds-native/kxci-measurement.js');
const {parseIdentity}=require('../integrations/dkds-native/kxci-protocol.js');

const slot={family:'SMU',channel:1,preamplifier:false};
const base={plan:{loops:1,xSweep:{terminal:'drain',repeats:1,delayMs:0,segments:[{startV:0,stopV:0.2,stepV:0.1,points:3,rangeA:'auto',delayMs:0}]},pSweep:null,fixedVoltages:{drain:0.1},portSettings:{drain:{rangeMode:'auto',complianceA:0.001}}},channels:{drain:1},active:['drain']};

function instrument({busyForever=false}={}){
 let started=false;const commands=[];
 return {commands,command:async c=>{
  commands.push(c);
  if(c==='ME1'){started=true;return '';}
  if(c==='SP')return busyForever&&started?'16':started?'1':'0';
  if(c==="DO 'V1'")return 'N0,N0.1,N0.2';
  if(c==="DO 'I1'")return 'N1E-9,N2E-9,N3E-9';
  if(c==="DO 'CH1T'")return '0,0.1,0.2';
  if(c===':ERROR:LAST:GET')return 'No error (0)';
  return '';
 }};
}

test('Rev F 5-45/5-56: DO and RD both use the CH<n>T timestamp name',()=>{
 const program=compileSystemPlan(base,{},{slots:[slot]});
 assert.equal(program.timestamp,'CH1T');
 assert.ok(program.reads.includes("DO 'CH1T'"));
 assert.equal(program.rdNames.at(-1),'CH1T');
 assert.ok(!program.reads.some(r=>r.includes("'V1T'")));
});

test('Rev F 5-26: cleanup whitelist always turns outputs off with SS + ZE before DE',()=>{
 const program=compileSystemPlan(base,{},{slots:[slot]});
 const c=program.cleanup;
 assert.ok(c.indexOf('ME4')<c.indexOf('SS')&&c.indexOf('SS')<c.indexOf('ZE')&&c.indexOf('ZE')<c.indexOf('DE'));
});

test('completed native run sends SS + ZE before removing channel definitions',async()=>{
 const program=compileSystemPlan(base,{},{slots:[slot]}),io=instrument();
 const result=await executeSystemTask(program,{command:io.command,wait:async()=>{},cancelled:()=>false,onBatch:()=>{},onPreview:()=>{}});
 assert.equal(result.state,'completed');assert.equal(result.shutdown,'commands-sent');
 const tail=io.commands.slice(io.commands.lastIndexOf("DO 'CH1T'"));
 assert.ok(tail.indexOf('ZE')>0&&tail.indexOf('ZE')<tail.lastIndexOf('DE'));
});

test('ZE is still attempted when ME4 abort cannot be confirmed',async()=>{
 const program=compileSystemPlan(base,{},{slots:[slot]}),io=instrument({busyForever:true});
 const result=await executeSystemTask(program,{command:io.command,wait:async()=>{},cancelled:()=>io.commands.includes('ME1'),onBatch:()=>{},onPreview:()=>{}});
 assert.equal(result.shutdown,'unconfirmed');
 assert.ok(io.commands.includes('ME4'));
 assert.ok(io.commands.includes('ZE'),'ZE must be sent even when the abort stays busy');
});

test('Rev F 5-16: HT outside 0–655.3 s is rejected at compile time',()=>{
 assert.throws(()=>compileSystemPlan(base,{systemHoldS:700},{slots:[slot]}),/HT/);
 assert.ok(compileSystemPlan(base,{systemHoldS:655.3},{slots:[slot]}).setup.includes('HT 655.3'));
});

test('Rev F 4-4: *IDN? manual format MODEL 4200A is accepted, other models rejected',()=>{
 const id=parseIdentity('KEITHLEY INSTRUMENTS,MODEL 4200A-SCS,1498377,V1.15\0');
 assert.equal(id.model,'KI4200A');assert.equal(id.serial,'1498377');assert.equal(id.format,'manual-model-prefixed');
 assert.equal(parseIdentity('KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14').format,'manufacturer-prefixed');
 assert.throws(()=>parseIdentity('KEITHLEY INSTRUMENTS,MODEL 2450,1498377,V1'),/不匹配/);
 assert.throws(()=>parseIdentity('KEITHLEY INSTRUMENTS,MODEL 4200A-SCS,1498377,V1',"999"),/序列号/);
});

test('Rev F 5-2/5-41/5-42: TI and TV replies with optional spaces parse identically',()=>{
 assert.equal(parseTi('NAI+1.0000E-09',1).currentA,1e-9);
 assert.equal(parseTi('NAI +1.0000 E-09',1).currentA,1e-9);
 assert.equal(parseTi('N A I -2.5000E-06',1).currentA,-2.5e-6);
 assert.throws(()=>parseTi('NBI +1.0E-09',1),/通道不匹配/);
 const v=parseTv('N G V +1.5000 E+00',5);assert.equal(v.voltageV,1.5);assert.equal(v.trigger,7);
 assert.throws(()=>parseTv('NEV+1.0E+00',5),/通道/);
});

test('Rev F 5-51: user-mode RI rejects an undocumented 1 A fixed range, keeps 100 mA',()=>{
 const fs=require('fs'),path=require('path'),vm=require('vm');
 const modules=new Map(),window={DKDSPluginModules:{define:(o,n,a)=>modules.set(n,a),require:n=>modules.get(n)}};
 for(const n of ['hardware-capabilities.js','model.js','measurement-plan.js','measurement-runtime.js','kxci-measurement.js'])vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../integrations/dkds-native',n),'utf8'),{window});
 const m=modules.get('model'),r=modules.get('measurementRuntime'),k=modules.get('dkts-kxci-measurement');
 const hp=c=>({family:'SMU',channel:c,type:'HPSMU',physicalType:'HPSMU',physicalIdentityVerified:true,ratingsVerified:true,powerClass:'high',preamplifier:false});
 const hardware={inventory:{physicalModelsVerified:true,hardwareLimitsVerified:true,slots:[hp(1),hp(2)]},capabilities:modules.get('dkts-capabilities')};
 const p=m.validate(m.initial()).pages.find(p=>p.kind==='dc');p.dc.preset='point-by-point';
 p.dc.terminals.D.segments[0].range='0.1';
 assert.equal(k.compileSweep(r.pageToBasicProgram(p,m),hardware).commandMode,'KXCI-US-DV-TI');
 p.dc.terminals.D.segments[0].range='1';p.dc.terminals.D.limitI='0.5';
 assert.throws(()=>k.compileSweep(r.pageToBasicProgram(p,m),hardware),/RI/);
});
