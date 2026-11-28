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
