'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const net=require('node:net');
const {IDN_REQUEST,OPTIONS_REQUEST,parseOptions}=require('../src/protocol/kxci-protocol.cjs');
const {createIdentityController}=require('../src/controller/identity.cjs');
test('KXCI module inventory is read-only and does not assert rated hardware limits',()=>{
  assert.equal(Buffer.from(OPTIONS_REQUEST,'ascii').toString('hex'),'2a4f50543f00');
  const inventory=parseOptions('SMU1,HPSMUPA2,PMURPM3,CVU1,VPU1,VS1,VM1,\0');
  assert.equal(inventory.slots.length,8);
  assert.deepEqual(inventory.knownModules.map(m=>m.family),['SMU','SMU','PMU','CVU','PGU','VS','VM']);
  assert.equal(inventory.slots[0].powerClass,'medium');
  assert.equal(inventory.slots[1].channel,2);
  assert.equal(inventory.slots[1].powerClass,'high');
  assert.equal(inventory.slots[1].preamplifier,true);
  assert.equal(inventory.hardwareLimitsVerified,false);
  assert.throws(()=>parseOptions(''),/为空/);
  assert.throws(()=>parseOptions('SMU1,'.repeat(9)),/八个插槽/);
});
test('connection sends IDN and optional OPT only; cached inventory prevents redundant queries',async()=>{
  const writes=[];
  const server=net.createServer(socket=>socket.on('data',bytes=>{
    writes.push(bytes.toString('hex'));
    const cmd=bytes.toString('ascii');
    if(cmd===IDN_REQUEST)socket.write('KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14\0');
    else if(cmd===OPTIONS_REQUEST)socket.write('SMU1,HPSMUPA2,PMU3,CVU1\0');
    else assert.fail('Unexpected potentially unsafe KXCI command '+cmd);
  }));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const ctl=createIdentityController();
  try{
    const cfg={host:'127.0.0.1',port:server.address().port};
    assert.equal((await ctl.connect(cfg)).phase,'connected');
    const info=await ctl.inspectModules();
    assert.equal(info.inventory.knownModules.length,4);
    assert.equal(info.inventory.knownModules[1].family,'SMU');
    await ctl.inspectModules();
    assert.deepEqual(writes,['2a49444e3f00','2a4f50543f00']);
    assert.equal((await ctl.disconnect()).inventory,null);
  }finally{await ctl.dispose();await new Promise(resolve=>server.close(resolve));}
});
test('malformed OPT response keeps known identity but never claims module inventory',async()=>{
  let requests=0;
  const tcp={
    open:async()=>({sessionId:'test'}),
    exchange:async ({base64})=>{
      requests++;
      const cmd=Buffer.from(base64,'base64').toString('hex');
      return {base64:Buffer.from(cmd==='2a49444e3f00'
        ?'KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14\0'
        :'UNRECOGNIZED RESPONSE IN EMULATION\0').toString('base64')};
    },
    close:async()=>true
  };
  const ctl=createIdentityController({tcp});
  try{
    await ctl.connect({host:'127.0.0.1'});
    const s=await ctl.inspectModules();
    assert.equal(s.phase,'connected');
    assert.equal(s.inventory.knownModules.length,0);
    assert.equal(s.inventory.unknownModules.length,1);
    assert.equal(requests,2);
  }finally{await ctl.dispose();}
});
