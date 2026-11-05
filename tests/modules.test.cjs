'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),net=require('node:net');
const caps=require('../src/shared/hardware-capabilities.js');
const protocol=require('../src/shared/kxci-protocol.js');
const {createIdentityController}=require('../src/controller/identity.cjs');
const options='SMU1,PMU1,CVU1,VPU1';
const instrumentInfo=[
'slotno:1,name:SMU1,model:KISMU4200,serialno:SMU001,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026',
'slotno:2,name:PMU1,model:KIPMU4225,serialno:PMU001,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026',
'slotno:3,name:CVU1,model:KICVU4210,serialno:CVU001,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026',
'slotno:4,name:VPU1,model:KIVPU4220,serialno:PGU001,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026'
].join(',');
const remoteInfo=[
'slotno:1,name:PA1,model:KI4200,serialno:PA001,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026',
'slotno:2,name:RPM1-1,model:KIRPM4225,serialno:RPM001,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026',
'slotno:2,name:RPM1-2,model:KIRPM4225,serialno:RPM002,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026'
].join(',');
test('OPT? is logical only; physical SMU ratings remain unknown until SystemUtil metadata is read',()=>{
 const p=protocol.parseOptions(options);assert.equal(p.logicalModules.length,4);assert.equal(p.hardwareLimitsVerified,false);
 assert.equal(p.slots[0].type,null);assert.equal(p.slots[0].physicalIdentityVerified,false);
 assert.equal(caps.getSmuLimits(p.slots[0],20,0.01).known,false);
 assert.throws(()=>protocol.parseOptions(''),/为空/);assert.throws(()=>protocol.parseOptions('SMU1,'.repeat(9)),/八个插槽/);
});
test('instrumentinfo and remotemoduleinfo identify physical SMU, PA, PMU, RPM, CVU and PGU modules',()=>{
 const p=protocol.parseHardwareInventory(options,instrumentInfo,remoteInfo);assert.equal(p.hardwareLimitsVerified,true);assert.equal(p.knownModules.length,4);
 assert.equal(p.slots[0].type,'SMUPA');assert.equal(p.slots[0].powerClass,'medium');assert.equal(p.slots[0].preamplifier,true);
 assert.equal(p.slots[1].type,'PMURPM');assert.equal(p.slots[1].rpmCount,2);assert.deepEqual(p.slots[1].rpmChannels,[1,2]);
 assert.equal(p.slots[2].variant,'4210-CVU');assert.equal(p.slots[3].type,'VPU');
 const smu=caps.getSmuLimits(p.slots[0],20,1e-10);assert.equal(smu.maxComplianceA,0.105);assert.equal(smu.minComplianceA,1e-10);
 assert.equal(caps.getPmuCurrentRanges(10,true).includes(1e-7),true);
});
test('KXCI module inspection sends only fixed read-only metadata commands and caches results',async()=>{
 const writes=[];let lastQuery='';
 const server=net.createServer(socket=>socket.on('data',bytes=>{
  const cmd=bytes.toString('ascii');writes.push(cmd);
  if(cmd===protocol.IDN_REQUEST)socket.write('KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14\0');
  else if(cmd===protocol.OPTIONS_REQUEST)socket.write(options+'\0');
  else if(cmd===protocol.UL_REQUEST||cmd===protocol.DE_REQUEST||cmd===protocol.INSTRUMENT_INFO_REQUEST||cmd===protocol.REMOTE_MODULE_INFO_REQUEST){
   if(cmd===protocol.INSTRUMENT_INFO_REQUEST)lastQuery='instrument';if(cmd===protocol.REMOTE_MODULE_INFO_REQUEST)lastQuery='remote';socket.write('OK\0');
  }else if(cmd===protocol.GN_RESULT_REQUEST)socket.write((lastQuery==='instrument'?instrumentInfo:remoteInfo)+'\0');
  else assert.fail('Unexpected KXCI command '+cmd);
 }));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const ctl=createIdentityController();
 try{
  const cfg={host:'127.0.0.1',port:server.address().port};assert.equal((await ctl.connect(cfg)).phase,'connected');
  const info=await ctl.inspectModules();assert.equal(info.inventory.hardwareLimitsVerified,true);assert.equal(info.inventory.slots[1].type,'PMURPM');
  await ctl.inspectModules();
  assert.deepEqual(writes,[protocol.IDN_REQUEST,protocol.OPTIONS_REQUEST,protocol.UL_REQUEST,protocol.INSTRUMENT_INFO_REQUEST,protocol.GN_RESULT_REQUEST,protocol.REMOTE_MODULE_INFO_REQUEST,protocol.GN_RESULT_REQUEST,protocol.DE_REQUEST]);
  assert.equal((await ctl.disconnect()).inventory,null);
 }finally{await ctl.dispose();await new Promise(resolve=>server.close(resolve));}
});
test('unrecognized logical channel remains unknown and never receives a guessed rating',()=>{
 const p=protocol.parseOptions('SMU1,UNKNOWN1');assert.equal(p.unknownModules.length,1);assert.equal(p.hardwareLimitsVerified,false);
});
test('malformed OPT response keeps verified identity but does not invent an inventory',async()=>{
 let requests=0;const tcp={open:async()=>({sessionId:'test'}),exchange:async({base64})=>{
  requests++;const cmd=Buffer.from(base64,'base64').toString('ascii');
  return {base64:Buffer.from(cmd===protocol.IDN_REQUEST?'KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14\0':'UNRECOGNIZED RESPONSE IN EMULATION\0').toString('base64')};
 },close:async()=>true};const ctl=createIdentityController({tcp});
 try{await ctl.connect({host:'127.0.0.1'});const s=await ctl.inspectModules();assert.equal(s.phase,'connected');assert.equal(s.inventory.unknownModules.length,1);assert.equal(s.inventory.hardwareLimitsVerified,false);assert.equal(requests,2);}
 finally{await ctl.dispose();}
});
