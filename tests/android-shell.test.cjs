'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const assetRoot=path.join(root,'android/app/src/main/assets');
test('Android APK includes independent native launcher and byte-identical shared core',()=>{
  execFileSync(process.execPath,['tools/sync-android-assets.cjs'],{cwd:root,stdio:'pipe'});
  const html=fs.readFileSync(path.join(assetRoot,'index.html'),'utf8');
  assert.match(html,/android\/native-client\.js/);
  assert.match(html,/shared\/identity-core\.js/);
  assert.match(html,/app\.js/);
  for(const file of ['kxci-protocol.js','measurement-plan.js','waveform.js','identity-core.js'])
    assert.equal(fs.readFileSync(path.join(assetRoot,'shared',file),'utf8'),
      fs.readFileSync(path.join(root,'src/shared',file),'utf8'));
  const manifest=fs.readFileSync(path.join(root,'android/app/src/main/AndroidManifest.xml'),'utf8');
  assert.match(manifest,/DK Test Studio/);
  assert.doesNotMatch(manifest,/DK Data Studio/);
  const bridge=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/InstrumentBridge.java'),'utf8');
  assert.match(bridge,/Arrays\.equals\(request, IDN\) && !Arrays\.equals\(request, OPT\)/);
});
test('Android host exercises the exact shared identity controller via native TCP adapter',async()=>{
  const writes=[];
  const window={};
  let session=null;
  window.DKTSNative={request(payload){
    const request=JSON.parse(payload);
    let value={};
    if(request.op==='open'){
      session='mock';
      value={sessionId:session,remoteAddress:'169.254.111.118',remotePort:1225,interfaceName:'eth0',localAddress:'169.254.111.115'};
    }else if(request.op==='exchange'){
      assert.equal(request.payload.sessionId,session);
      const command=Buffer.from(request.payload.base64,'base64').toString('hex');
      writes.push(command);
      assert(['2a49444e3f00','2a4f50543f00'].includes(command));
      value={base64:Buffer.from(command==='2a49444e3f00'
        ?'KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14\0'
        :'SMU1,PMU3,CVU1\0').toString('base64')};
    }else if(request.op==='close'){
      session=null;value={closed:true};
    }else assert.fail('Unexpected native operation '+request.op);
    queueMicrotask(()=>window.DKTSNativeBridgeResolve(JSON.stringify({id:request.id,ok:true,value})));
  }};
  const context={window,atob,btoa};
  vm.createContext(context);
  for(const file of [
    'android/web/bootstrap.js',
    'src/shared/kxci-protocol.js',
    'src/shared/measurement-plan.js',
    'src/shared/waveform.js',
    'src/shared/identity-core.js',
    'android/web/native-client.js'
  ])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context,{filename:file});
  const client=window.DKTSClient;
  assert(client,'native Android client must expose independent application bridge');
  const connected=await client.post('/api/connect',{host:'169.254.111.118',port:1225});
  assert.equal(connected.phase,'connected');
  const modules=await client.post('/api/modules/inspect',{});
  assert.equal(modules.inventory.knownModules.length,3);
  assert.deepEqual(writes,['2a49444e3f00','2a4f50543f00']);
  const plan=await client.post('/api/plan/validate',{kind:'iv',points:3,loops:2});
  assert.equal(plan.plan.executable,false);
  const waveform=await client.post('/api/waveform/validate',{text:'0,0\n0.00000002,1'});
  assert.equal(waveform.executable,false);
  await assert.rejects(()=>client.post('/api/output',{voltageV:200}),/未授权/);
  assert.equal((await client.post('/api/disconnect')).phase,'disconnected');
});
