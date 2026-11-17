'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../integrations/dkds-native/model.js'),'utf8');
let model;
vm.runInNewContext(source,{window:{DKDSPluginModules:{define:(_id,name,api)=>{
 if(name==='model')model=api;
}}}},{filename:'integrations/dkds-native/model.js'});
function configured(){
 let state=model.initial();
 state=model.edit(state,'D',{resource:'SMU1',role:'X'});
 state=model.edit(state,'G',{resource:'SMU2',role:'P'});
 state=model.edit(state,'S',{resource:'SMU3',bias:'0.25',role:'CONDITION'});
 state=model.editSegment(state,'X',0,{start:'0',stop:'1',step:'1',delayMs:'25'});
 state=model.editSegment(state,'P',0,{start:'-1',stop:'1',step:'2',delayMs:'30'});
 state=model.editSweep(state,{loops:'2',xRepeats:'2',pRepeats:'2',pEnabled:true});
 return state.pages[0];
}
test('native offline X/P order nests X points -> X repeats -> P points -> P repeats -> full loops',()=>{
 const page=configured(),summary=model.summary(page);
 assert.equal(summary.ready,true);
 assert.equal(summary.total,32);
 const samples=Array.from({length:summary.total},(_,i)=>model.pointAt(page,i));
 assert.deepEqual(samples.slice(0,8).map(x=>[x.x.value,x.x.repeat,x.p.value,x.p.repeat]),[
  [0,1,-1,1],[1,1,-1,1],[0,2,-1,1],[1,2,-1,1],
  [0,1,1,1],[1,1,1,1],[0,2,1,1],[1,2,1,1]
 ]);
 assert.deepEqual([samples[8].p.value,samples[8].p.repeat],[-1,2]);
 assert.deepEqual([samples[16].loop,samples[16].p.repeat,samples[16].x.value],[2,1,0]);
 assert.equal(samples[31].x.value,1);
 assert.equal(samples[31].p.value,1);
 assert.equal(samples[31].loop,2);
 for(const row of samples){
  assert.equal(row.provenance,'planned-only');
  assert.equal(row.executable,false);
  assert.equal(row.hardwareVerified,false);
  assert.equal(row.x.delayMs,25);
  assert.equal(row.p.delayMs,30);
  assert.deepEqual(Array.from(row.fixed,term=>[term.logical,term.value]),[['S',0.25]]);
 }
});
test('offline cursor preserves strict X and P segment endpoints and supports a single point',()=>{
 let state=model.initial();
 state=model.edit(state,'D',{resource:'SMU1',role:'X'});
 state=model.editSegment(state,'X',0,{start:'0',stop:'0',step:'0'});
 state=model.addSegment(state,'X');
 state=model.editSegment(state,'X',1,{start:'1',stop:'0',step:'-1'});
 const page=state.pages[0];
 assert.equal(model.summary(page).total,3);
 assert.deepEqual([0,1,2].map(i=>model.pointAt(page,i).x.value),[0,1,0]);
 assert.deepEqual([0,1,2].map(i=>model.pointAt(page,i).x.segment),[1,2,2]);
 assert.equal(model.pointAt(page,2).p,null);
});
test('offline cursor fails closed without real port, with bad range, or on unsupported test type',()=>{
 let state=model.initial();
 state=model.edit(state,'D',{resource:'None'});
 assert.throws(()=>model.pointAt(state.pages[0],0),/分配 Xsweep/);
 state=model.edit(state,'D',{resource:'SMU1',role:'X'});
 const page=state.pages[0];
 assert.throws(()=>model.pointAt(page,-1),/out of bounds/);
 assert.throws(()=>model.pointAt(page,21),/out of bounds/);
 assert.throws(()=>model.pointAt(page,1.2),/out of bounds/);
 assert.throws(()=>model.pointAt({...page,kind:'pund'},0),/Only DC sweep/);
 assert.throws(()=>model.pointAt({...page,sweep:{...page.sweep,xSegments:[
  {start:'0',stop:'2',step:'0.3',delayMs:'20',range:'auto'}]}},0),/SWEEP_ENDPOINT/);
 assert.equal(page.sweep.xSegments[0].step,'0.1','cursor never changes persisted scan segments');
});
