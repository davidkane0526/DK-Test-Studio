'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8');
const start=app.indexOf('function createWorkspaceStore(options = {})');
const end=app.indexOf('\nconst workspaceStore=createWorkspaceStore();',start);
assert(start>=0&&end>start,'Workspace store factory must be present in app.js');
const createWorkspaceStore=vm.runInThisContext('('+app.slice(start,end).trim()+')');
function makeStore(){
  let serial=0;
  return createWorkspaceStore({idFactory:kind=>kind+'-'+(++serial)});
}

test('workspace IDs are independent of test modes and names are editable',()=>{
  const store=makeStore();
  const a=store.createTab({name:'样品 A',mode:'iv'});
  const b=store.createTab({name:'样品 B',mode:'iv'});
  assert.notEqual(a.id,b.id);
  assert.equal(store.listTabs().length,2);
  assert.equal(a.activeMode,'iv');
  assert.equal(b.activeMode,'iv');
  assert.equal(store.renameTab(a.id,'器件 A'),true);
  assert.equal(store.getTab(a.id).name,'器件 A');
  assert.equal(store.renameTab(a.id,'   '),false);
});

test('drafts are isolated by workspace and test mode',()=>{
  const store=makeStore();
  const a=store.createTab({name:'A'}),b=store.createTab({name:'B'});
  store.saveDraft(a.id,'iv',{startV:-1});
  store.saveDraft(a.id,'it',{fixedV:.2});
  store.saveDraft(b.id,'iv',{startV:-.5});
  assert.deepEqual(store.getDraft(a.id,'iv'),{startV:-1});
  assert.deepEqual(store.getDraft(a.id,'it'),{fixedV:.2});
  assert.deepEqual(store.getDraft(b.id,'iv'),{startV:-.5});
  assert.equal(store.getDraft(b.id,'it'),null);
});

test('history and raw data are isolated by workspace and grouped by test mode',()=>{
  const store=makeStore();
  const a=store.createTab({name:'A'}),b=store.createTab({name:'B'});
  const iv=[{voltageV:1,currentA:.001,timeS:0}];
  const it=[{voltageV:.1,currentA:.002,timeS:1}];
  const bIv=[{voltageV:2,currentA:.003,timeS:0}];
  const runAiv=store.recordRun(a.id,'iv',iv,{summary:'A I-V'});
  const runAit=store.recordRun(a.id,'it',it,{summary:'A I-t'});
  const runBiv=store.recordRun(b.id,'iv',bIv,{summary:'B I-V'});
  assert.equal(store.getHistory(a.id,'iv').length,1);
  assert.equal(store.getHistory(a.id,'it').length,1);
  assert.equal(store.getHistory(b.id,'iv').length,1);
  assert.equal(store.getHistory(b.id,'it').length,0);
  assert.deepEqual(store.getData(a.id,'iv'),iv);
  assert.deepEqual(store.getData(a.id,'it'),it);
  assert.deepEqual(store.getData(b.id,'iv'),bIv);
  store.selectRun(a.id,'iv',runAiv.id);
  assert.deepEqual(store.getData(a.id,'iv'),iv);
  assert.notEqual(runAit.id,runBiv.id);
});

test('streaming updates append to one run instead of creating mixed histories',()=>{
  const store=makeStore(),tab=store.createTab();
  const run=store.recordRun(tab.id,'iv',[{voltageV:0,currentA:0,timeS:0}],{status:'running'});
  store.appendRunRows(tab.id,'iv',run.id,[{voltageV:1,currentA:.001,timeS:1}]);
  store.updateRun(tab.id,'iv',run.id,store.getData(tab.id,'iv'),{status:'completed'});
  assert.equal(store.getHistory(tab.id,'iv')[0].rawRows.length,2);
  assert.equal(store.getHistory(tab.id,'iv')[0].status,'completed');
});

test('closing a workspace removes only its data and activates a neighbor',()=>{
  const store=makeStore();
  const a=store.createTab({name:'A'}),b=store.createTab({name:'B'}),c=store.createTab({name:'C'});
  store.recordRun(b.id,'iv',[{voltageV:0,currentA:0,timeS:0}]);
  store.activateTab(b.id);
  store.closeTab(b.id);
  assert.equal(store.getTab(b.id),null);
  assert.equal(store.getHistory(a.id,'iv').length,0);
  assert.equal(store.getActiveTab().id,c.id);
});


test('workspace snapshots round-trip across process reload without mixing measurements',()=>{
  const first=makeStore();
  const a=first.createTab({name:'器件 A',mode:'iv'});
  const b=first.createTab({name:'器件 B',mode:'iv'});
  first.saveDraft(a.id,'iv',{startV:-1,stopV:1});
  first.saveDraft(a.id,'it',{fixedV:.2});
  const a1=first.recordRun(a.id,'iv',[{voltageV:1,currentA:.01,timeS:0}]);
  first.recordRun(a.id,'it',[{timeS:0.2,currentA:.02,voltageV:.2}]);
  first.recordRun(b.id,'iv',[{voltageV:1,currentA:.3,timeS:0}]);
  first.selectRun(a.id,'iv',a1.id);
  first.activateTab(b.id);
  const saved=JSON.parse(JSON.stringify(first.snapshot()));
  const restarted=makeStore();
  assert.equal(restarted.restore(saved),true);
  assert.equal(restarted.getActiveTab().id,b.id);
  assert.equal(restarted.getTab(a.id).name,'器件 A');
  assert.deepEqual(restarted.getDraft(a.id,'iv'),{startV:-1,stopV:1});
  assert.deepEqual(restarted.getDraft(a.id,'it'),{fixedV:.2});
  assert.equal(restarted.getHistory(a.id,'iv').length,1);
  assert.equal(restarted.getHistory(a.id,'it').length,1);
  assert.equal(restarted.getHistory(b.id,'iv').length,1);
  assert.equal(restarted.getHistory(b.id,'it').length,0);
  assert.notDeepEqual(restarted.getData(a.id,'iv'),restarted.getData(b.id,'iv'));
  const created=restarted.createTab({name:'器件 C',mode:'iv'});
  assert.notEqual(created.id,a.id);
  assert.notEqual(created.id,b.id);
});

test('invalid or duplicate workspace identifiers never corrupt a loaded session',()=>{
  const store=makeStore(),a=store.createTab({name:'A'});
  const baseline=store.snapshot();
  assert.throws(()=>store.restore({schema:'bad',tabs:[]}),/格式/);
  assert.throws(()=>store.restore({...baseline,tabs:[baseline.tabs[0],baseline.tabs[0]]}),/重复/);
  assert.equal(store.getActiveTab().id,a.id);
});

test('state changes schedule persistence but read-only inspection does not',()=>{
  let changes=0;
  const store=createWorkspaceStore({idFactory:(()=>{let id=0;return k=>k+'-'+(++id)})(),onChange:()=>changes++});
  const a=store.createTab();
  assert.equal(changes,1);
  store.getHistory(a.id,'iv');
  store.snapshot();
  assert.equal(changes,1);
  store.renameTab(a.id,'test');
  store.recordRun(a.id,'iv',[]);
  assert.equal(changes,3);
});
