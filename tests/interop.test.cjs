'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const protocol=require('../src/protocol/kxci-protocol.cjs');
const wave=require('../src/controller/waveform.cjs');
const plan=require('../src/controller/measurement-plan.cjs');
const domain=require('../src/shared/identity-core.js');
const interop=require('../src/controller/interop.cjs');
const manifest=require('../integrations/dkds/plugin.json');
test('browser SDK modules use the same implementation as Node',()=>{
  const registry=new Map();
  const sandbox={atob,btoa,window:{DKDSPluginModules:{define:(id,name,value)=>{
    assert.equal(id,'com.dkds.keithley-4200');registry.set(name,value);
  }}}};
  vm.createContext(sandbox);
  for(const file of ['kxci-protocol.js','waveform.js','measurement-plan.js','identity-core.js','interop.js'])
    vm.runInContext(fs.readFileSync(path.join(root,'src/shared',file),'utf8'),sandbox,{filename:file});
  assert.equal(registry.size,5);
  assert.equal(registry.get('dkts-kxci').IDN_REQUEST,protocol.IDN_REQUEST);
  const input={kind:'iv',points:3,loops:2,direction:'roundtrip'};
  assert.equal(JSON.stringify(registry.get('dkts-plan').previewPlan(input)),JSON.stringify(plan.previewPlan(input)));
  const points='0,0\n0.00000002,1\n0.00000004,0';
  assert.equal(JSON.stringify(registry.get('dkts-waveform').parseWaveformText(points)),JSON.stringify(wave.parseWaveformText(points)));
  const envelope=registry.get('dkts-interop').createPlanEnvelope(input,registry.get('dkts-plan'));
  assert.equal(JSON.stringify(envelope),JSON.stringify(interop.createPlanEnvelope(input,plan)));
  assert.equal(interop.readPlanEnvelope(envelope,plan).totalPoints,10);
  assert.throws(()=>interop.readPlanEnvelope({...envelope,schema:'unknown'},plan),/不支持/);
  assert.throws(()=>interop.readPlanEnvelope({...envelope,plan:{...envelope.plan,executable:true}},plan),/未获验证/);
});
test('DKDS package contains byte-for-byte copies of the shared core',()=>{
  const pkg=JSON.parse(fs.readFileSync(require('../tools/build-dkds-plugin.cjs').artifact,'utf8'));
  assert.equal(pkg.schema,1);
  assert.equal(pkg.manifest.id,'com.dkds.keithley-4200');
  assert.equal(pkg.manifest.version,'0.4.2');
  assert.equal(pkg.manifest.apiVersion,'1.19.0');
  for(const file of ['kxci-protocol.js','waveform.js','measurement-plan.js','identity-core.js','interop.js'])
    assert.equal(pkg.files[file],fs.readFileSync(path.join(root,'src/shared',file),'utf8'));
  assert(pkg.manifest.scripts.every(name=>typeof pkg.files[name]==='string'));
  let registered;
  const context={DKDSPlugins:{define:(m,activate)=>{registered={m,activate};}}};
  vm.runInNewContext(pkg.files['plugin.js'],context,{timeout:1000});
  assert(registered);
  assert.equal(JSON.stringify(registered.m),JSON.stringify(manifest));
  assert.equal(typeof registered.activate,'function');
});
test('shared identity service works via injected DKDS TCP adapter',async()=>{
  const writes=[];
  const tcp={
    open:async()=>({sessionId:'stub',remoteAddress:'127.0.0.1',remotePort:1225}),
    exchange:async p=>{
      writes.push(Buffer.from(p.base64,'base64'));
      return {base64:Buffer.from('KEITHLEY INSTRUMENTS,KI4200A,1498377,V1.14\0').toString('base64')};
    },
    close:async()=>true
  };
  const ctl=domain.createIdentityController(tcp,protocol);
  try{
    const status=await ctl.connect({host:'127.0.0.1'});
    assert.equal(status.phase,'connected');
    assert.equal((await ctl.connect({host:'127.0.0.1'})).phase,'connected');
    assert.deepEqual(writes.map(x=>x.toString('hex')),['2a49444e3f00']);
  }finally{await ctl.dispose();}
});
