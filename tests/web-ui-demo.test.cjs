'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const {buildWebDemo}=require('../tools/build-web-demo.cjs');
test('demo builds the actual DKTS web assets with safe relative paths',()=>{
  const out=buildWebDemo(path.join(root,'dist','web-ui-demo-test'));
  const html=fs.readFileSync(path.join(out.out,'index.html'),'utf8');
  assert.match(html,/src="\.\/demo-adapter\.js"/);
  assert.ok(html.indexOf('src="./demo-adapter.js"')<html.indexOf('src="./app.js"'));
  assert.match(html,/href="\.\/styles\.css"/);
  assert.match(html,/UI DEMO · OFFLINE/);
  for(const file of ['app.js','styles.css','demo-adapter.js','vendor/dkds/chart-runtime.js','vendor/d3.min.js'])
    assert.ok(fs.existsSync(path.join(out.out,file)),file);
  assert.doesNotMatch(html,/(?:href|src)="\/(?:app\.js|styles\.css|vendor\/)/);
});
test('web demo cannot connect to or start 4200A measurement',async()=>{
  const source=fs.readFileSync(path.join(root,'web','demo-adapter.js'),'utf8');
  const document={documentElement:{dataset:{}},getElementById:()=>null};
  const window={addEventListener(){}};
  const store=new Map(),sessionStorage={getItem:key=>store.get(key)||null,setItem:(k,v)=>store.set(k,v)};
  vm.runInNewContext(source,{window,document,sessionStorage,MutationObserver:undefined});
  assert.equal(window.DKTSWebDemo.hardwareOutput,false);
  assert.equal((await window.DKTSClient.status()).phase,'disconnected');
  assert.equal((await window.DKTSClient.post('/api/connect')).phase,'disconnected');
  assert.equal((await window.DKTSClient.post('/api/measurement/start')).ok,false);
  assert.equal((await window.DKTSClient.post('/api/measurement/stop')).ok,false);
  const preview=await window.DKTSClient.post('/api/plan/validate',{
    kind:'iv',sweepProgram:{loops:1,xSweep:{repeats:2,segments:[{startV:0,stopV:1,stepV:0.1}]},pSweep:{enabled:false}}
  });
  assert.equal(preview.plan.totalPoints,22);
  assert.equal(preview.hardwareVerified,false);
  const invalid=await window.DKTSClient.post('/api/plan/validate',{
    kind:'iv',sweepProgram:{loops:1,xSweep:{repeats:1,segments:[{startV:0,stopV:1000,stepV:1}]}}
  });
  assert.equal(invalid.ok,false);
  await window.DKTSClient.post('/api/workspaces',{workspace:{tabs:[]}});
  assert.equal((await window.DKTSClient.loadWorkspace()).workspace.tabs.length,0);
});