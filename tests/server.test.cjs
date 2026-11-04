'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const net=require('node:net');
const {createAppServer}=require('../src/server.cjs');
test('localhost API is read-only, origin guarded and waveform is not executable',async()=>{
  const app=await createAppServer();
  try{
    const base=app.url.slice(0,-1);
    const home=await fetch(base+'/');assert.equal(home.status,200);
    assert.match(await home.text(),/DK Test Studio/);
    const status=await (await fetch(base+'/api/status')).json();
    assert.equal(status.phase,'disconnected');
    const invalid=await fetch(base+'/api/connect',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    assert.equal(invalid.status,403);
    const cross=await fetch(base+'/api/connect',{method:'POST',headers:{'Content-Type':'application/json','X-DKTS-Request':'1','Origin':'https://other.example'},body:'{}'});
    assert.equal(cross.status,403);
    const res=await fetch(base+'/api/waveform/validate',{method:'POST',headers:{'Content-Type':'application/json','X-DKTS-Request':'1'},
      body:JSON.stringify({text:'0 0\n0.00000002 1\n0.00000004 0'})});
    assert.equal(res.status,200);
    const plan=await res.json();assert.equal(plan.ok,true);assert.equal(plan.executable,false);
    const planResponse=await fetch(base+'/api/plan/validate',{method:'POST',headers:{'Content-Type':'application/json','X-DKTS-Request':'1'},body:JSON.stringify({kind:'iv',points:11,loops:2})});
    const smuPlan=await planResponse.json();assert.equal(smuPlan.ok,true);assert.equal(smuPlan.plan.executable,false);assert.equal(smuPlan.plan.totalPoints,42);
    const unknown=await fetch(base+'/api/output',{method:'POST',headers:{'Content-Type':'application/json','X-DKTS-Request':'1'},body:'{}'});
    assert.equal(unknown.status,404);
  }finally{await app.close();}
});
test('browser API can identify a fake 4200A and then disconnect',async()=>{
  const mock=net.createServer(socket=>socket.once('data',data=>{
    assert.deepEqual(data,Buffer.from([42,73,68,78,63,0]));
    socket.write('KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14\0');
  }));
  await new Promise(resolve=>mock.listen(0,'127.0.0.1',resolve));
  const app=await createAppServer();
  const base=app.url.slice(0,-1);
  const post=(route,body)=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json','X-DKTS-Request':'1'},body:JSON.stringify(body||{})}).then(r=>r.json());
  try{
    const first=await post('/api/connect',{host:'127.0.0.1',port:mock.address().port});
    assert.equal(first.ok,true);assert.equal(first.identity.serial,'1498377');
    const second=await post('/api/disconnect',{});assert.equal(second.phase,'disconnected');
  }finally{await app.close();await new Promise(resolve=>mock.close(resolve));}
});

test('manual UI update check is origin guarded and explicitly disabled in bare browser mode',async()=>{
  const app=await createAppServer();
  try{
    const url=app.url+'api/ui/check';
    const bad=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    assert.equal(bad.status,403);
    const other=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-DKTS-Request':'1','Origin':'https://example.com'},body:'{}'});
    assert.equal(other.status,403);
    const valid=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-DKTS-Request':'1'},body:'{}'});
    assert.equal(valid.status,200);
    assert.deepEqual(await valid.json(),{ok:true,updated:false,status:'disabled'});
  }finally{await app.close();}
});
