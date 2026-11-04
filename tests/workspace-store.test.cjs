'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8');
const start=app.indexOf('function createWorkspaceStore(options = {})');
const end=app.indexOf('\nconst workspaceStore=createWorkspaceStore(',start);
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

test('closing archives a workspace and re-opening preserves measurement history',()=>{
  const store=makeStore();
  const a=store.createTab({name:'A'}),b=store.createTab({name:'B'}),c=store.createTab({name:'C'});
  store.saveDraft(b.id,'iv',{formValues:{startV:'-1'},waveform:'0 0'});
  const raw=[{voltageV:0,currentA:0,timeS:0},{voltageV:1,currentA:1e-8,timeS:1}];
  const run=store.recordRun(b.id,'iv',raw,{summary:'unmodified instrument samples'});
  store.activateTab(b.id);
  store.closeTab(b.id);
  assert.equal(store.getTab(b.id),null);
  assert.equal(store.listTabs().length,2);
  assert.equal(store.listArchivedTabs().length,1);
  assert.equal(store.listArchivedTabs()[0].id,b.id);
  assert.equal(store.listArchivedTabs()[0].historyByMode.iv[0].id,run.id);
  assert.equal(store.getHistory(a.id,'iv').length,0);
  assert.equal(store.getActiveTab().id,c.id);
  const revived=store.reopenTab(b.id);
  assert.equal(revived.id,b.id);
  assert.equal(store.getActiveTab().id,b.id);
  assert.deepEqual(store.getData(b.id,'iv'),raw);
  assert.deepEqual(store.getHistory(b.id,'iv')[0].rawRows,raw);
  assert.deepEqual(store.getDraft(b.id,'iv'),{formValues:{startV:'-1'},waveform:'0 0'});
  assert.equal(store.getActiveRunId(b.id,'iv'),run.id);
  assert.equal(store.listArchivedTabs().length,0);
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

test('v2 snapshot persists closed tabs and their raw measurements across reload',()=>{
  const first=makeStore();
  const tab=first.createTab({name:'归档器件',mode:'it'});
  const rows=[{timeS:0,currentA:1e-10},{timeS:0.1,currentA:1e-9}];
  first.recordRun(tab.id,'it',rows);
  first.closeTab(tab.id);
  assert.equal(first.snapshot().schema,'dkts.workspace.v2');
  assert.equal(first.snapshot().archivedTabs.length,1);
  const restarted=makeStore();
  assert.equal(restarted.restore(JSON.parse(JSON.stringify(first.snapshot()))),true);
  assert.equal(restarted.getActiveTab(),null);
  assert.equal(restarted.listArchivedTabs().length,1);
  assert.equal(restarted.reopenTab(tab.id).name,'归档器件');
  assert.deepEqual(restarted.getData(tab.id,'it'),rows);
  assert.equal(restarted.getHistory(tab.id,'it').length,1);
});

test('legacy v1 snapshots migrate without losing open workspace measurements',()=>{
  const legacy=makeStore(),tab=legacy.createTab({name:'旧版 I-V',mode:'iv'});
  legacy.recordRun(tab.id,'iv',[{voltageV:-1,currentA:-1e-9}]);
  const old={...legacy.snapshot(),schema:'dkts.workspace.v1'};
  delete old.archivedTabs;
  const upgraded=makeStore();
  assert.equal(upgraded.restore(old),true);
  assert.deepEqual(upgraded.getHistory(tab.id,'iv')[0].rawRows,[{voltageV:-1,currentA:-1e-9}]);
  assert.equal(upgraded.listArchivedTabs().length,0);
  assert.equal(upgraded.snapshot().schema,'dkts.workspace.v2');
});

test('archived IDs remain reserved and validation is atomic across all tabs',()=>{
  let id=0;
  const store=createWorkspaceStore({idFactory:()=>String(++id)});
  const a=store.createTab(),b=store.createTab();
  store.closeTab(a.id);
  assert.notEqual(store.createTab().id,a.id);
  const snapshot=store.snapshot();
  const broken=JSON.parse(JSON.stringify(snapshot));
  broken.archivedTabs[0].id=b.id;
  assert.throws(()=>store.restore(broken),/重复/);
  assert.deepEqual(store.snapshot(),snapshot);
  assert.equal(store.reopenTab('missing'),null);
  assert.equal(store.deleteArchivedTab('missing'),false);
});

test('permanent removal is distinct from tab close and only affects archived entries',()=>{
  const store=makeStore(),a=store.createTab({name:'Keep'}),b=store.createTab({name:'Delete'});
  store.recordRun(a.id,'iv',[{voltageV:0,currentA:0}]);
  store.recordRun(b.id,'it',[{timeS:1,currentA:1e-9}]);
  assert.equal(store.deleteArchivedTab(a.id),false);
  store.closeTab(b.id);
  assert.equal(store.deleteArchivedTab(b.id),true);
  assert.equal(store.listArchivedTabs().length,0);
  assert.equal(store.getHistory(a.id,'iv').length,1);
  assert.equal(store.reopenTab(b.id),null);
});
