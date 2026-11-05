'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),net=require('node:net');
const caps=require('../src/shared/hardware-capabilities.js');
const protocol=require('../src/shared/kxci-protocol.js');
const {createIdentityController}=require('../src/controller/identity.cjs');
const options='SMUPA1,PMU1RPM1-2,CVU1,VPU1';
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
test('OPT? directly identifies SMU power class, PA and RPM categories before exact model metadata',()=>{
 const p=protocol.parseOptions(options);assert.equal(p.logicalModules.length,4);assert.equal(p.hardwareLimitsVerified,false);
 assert.equal(p.slots[0].type,'SMUPA');assert.equal(p.slots[0].powerClass,'medium');assert.equal(p.slots[0].preamplifier,true);
 assert.equal(p.slots[1].type,'PMURPM');assert.equal(p.slots[1].rpmCount,2);
 const limits=caps.getSmuLimits(p.slots[0],20,0.01);assert.equal(limits.known,true);assert.equal(limits.maxComplianceA,0.105);
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
test('VS and VM logical channels inherit their physical SMU class and attached PA',()=>{
 const slots='VS1,VM2';
 const cards=[
  'slotno:1,name:SMU1,model:KISMU4200,serialno:SMU001,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026',
  'slotno:2,name:SMU2,model:KIHPSMU4210,serialno:SMU002,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026'
 ].join(',');
 const remotes='slotno:1,name:PA1,model:KI4200,serialno:PA001,hwver:1.0,fwver:1.0,caldate:Jan 01, 2025,caldue:Jan 01, 2026';
 const p=protocol.parseHardwareInventory(slots,cards,remotes);
 assert.equal(p.hardwareLimitsVerified,true);
 assert.equal(p.slots[0].physicalType,'SMUPA');
 assert.equal(p.slots[0].powerClass,'medium');
 assert.equal(p.slots[0].ratingsVerified,true);
 assert.equal(p.slots[1].physicalType,'HPSMU');
 assert.equal(p.slots[1].powerClass,'high');
 assert.equal(p.slots[1].ratingsVerified,true);
 const source=caps.getSourceLimits(p.slots[0],20,0.01);
 assert.equal(source.known,true);
 assert.equal(source.logicalRole,'VS');
 assert.equal(source.maxAbsVoltageV,20);
 assert.throws(()=>caps.getSourceLimits(p.slots[0],21,0.01),/上限/);
});
test('KXCI module inspection sends only fixed read-only metadata commands and caches results',async()=>{
 const writes=[];let lastQuery='';
 const server=net.createServer(socket=>{
  let pending='';
  socket.on('data',bytes=>{
   pending+=bytes.toString('ascii');
   while(pending.includes('\0')){
    const end=pending.indexOf('\0');
    const cmd=pending.slice(0,end+1);pending=pending.slice(end+1);
    writes.push(cmd);
    if(cmd===protocol.IDN_REQUEST)socket.write('KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14\0');
    else if(cmd===protocol.OPTIONS_REQUEST)socket.write(options+'\0');
    else if(cmd===protocol.UL_REQUEST||cmd===protocol.DE_REQUEST){
     // KXCI UL/DE are write-only mode switches; the real instrument sends no reply.
    }else if(cmd===protocol.INSTRUMENT_INFO_REQUEST||cmd===protocol.REMOTE_MODULE_INFO_REQUEST){
     if(cmd===protocol.INSTRUMENT_INFO_REQUEST)lastQuery='instrument';if(cmd===protocol.REMOTE_MODULE_INFO_REQUEST)lastQuery='remote';socket.write('OK\0');
    }else if(cmd===protocol.GN_RESULT_REQUEST)socket.write((lastQuery==='instrument'?instrumentInfo:remoteInfo)+'\0');
    else assert.fail('Unexpected KXCI command '+cmd);
   }
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const ctl=createIdentityController();
 try{
  const cfg={host:'127.0.0.1',port:server.address().port};assert.equal((await ctl.connect(cfg)).phase,'connected');
  const info=await ctl.inspectModules();assert.equal(info.inventory.hardwareLimitsVerified,true);assert.equal(info.inventory.slots[1].type,'PMURPM');
  await ctl.inspectModules();
  await new Promise((resolve,reject)=>{const deadline=Date.now()+750;const poll=()=>{if(writes.length===8)return resolve();if(Date.now()>deadline)return reject(new Error('Timed out waiting for the write-only DE command to reach the fake KXCI server.'));setTimeout(poll,5);};poll();});
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
 try{await ctl.connect({host:'127.0.0.1'});const s=await ctl.inspectModules();assert.equal(s.phase,'connected');assert.equal(s.inventory.unknownModules.length,1);assert.equal(s.inventory.hardwareLimitsVerified,false);assert.match(s.inventoryError,/没有可识别的模块类型/);assert.equal(requests,2);}
 finally{await ctl.dispose();}
});
