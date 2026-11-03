'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const net=require('node:net');
const {createIdentityController,normalizeSettings,summarizeError}=require('../src/controller/identity.cjs');
const {IDN_REQUEST,parseIdentity}=require('../src/protocol/kxci-protocol.cjs');
test('identity parser accepts exact KI4200A and rejects wrong serial',()=>{
  assert.equal(Buffer.from(IDN_REQUEST,'ascii').toString('hex'),'2a49444e3f00');
  assert.equal(parseIdentity('KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14\0','1498377').serial,'1498377');
  assert.throws(()=>parseIdentity('OTHER,KI4200A,1,V1'),/身份不匹配/);
  assert.throws(()=>parseIdentity('KEITHLEY INSTRUMENTS,KI4200A,1,V1','2'),/序列号不匹配/);
  assert.throws(()=>normalizeSettings({networkMode:'interface'}),/网卡名称/);
  assert.match(summarizeError(Error('ECONNREFUSED')),/拒绝连接/);
});
test('controller sends only the read-only identity bytes and reuses repeated connections',async()=>{
  const writes=[];
  const server=net.createServer(socket=>socket.on('data',chunk=>{
    writes.push(chunk);
    socket.write('KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14\0');
  }));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const controller=createIdentityController();
  try{
    const cfg={host:'127.0.0.1',port:server.address().port,expectedSerial:'1498377'};
    const first=await controller.connect(cfg);
    assert.equal(first.phase,'connected');
    assert.equal(first.identity.serial,'1498377');
    assert.equal((await controller.connect(cfg)).phase,'connected');
    assert.equal(writes.length,1,'a repeated Connect must not repeat IDN exchange');
    assert.deepEqual(writes[0],Buffer.from([42,73,68,78,63,0]));
    assert.equal((await controller.disconnect()).phase,'disconnected');
  }finally{await controller.dispose();await new Promise(resolve=>server.close(resolve));}
});
test('reject mismatched identity with no live session',async()=>{
  const server=net.createServer(socket=>socket.on('data',()=>socket.end('NOT A 4200A\0')));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const controller=createIdentityController();
  try{
    await assert.rejects(()=>controller.connect({host:'127.0.0.1',port:server.address().port}),/身份不匹配/);
    assert.equal(controller.status().phase,'error');
    assert.equal(controller.status().route,null);
  }finally{await controller.dispose();await new Promise(resolve=>server.close(resolve));}
});
