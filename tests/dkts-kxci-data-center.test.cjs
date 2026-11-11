'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../integrations/dkds-native');
const code=fs.readFileSync(root+'/measurement-data.js','utf8');
const api=(()=>{
 let definition;
 vm.runInNewContext(code,{window:{DKDSPluginModules:{define:(id,name,value)=>{
  assert.equal(id,'com.dkts.keithley-4200');
  assert.equal(name,'measurementData');definition=value;
 }}}},{filename:'measurement-data.js'});
 return definition;
})();
function frame(seq,overrides={}){
 return {source:'4200A-KXCI-TI',sequence:seq,timeS:seq*.1,
  drainVoltageV:seq*.05,drainCurrentA:seq*1e-9,
  gateVoltageV:0,gateCurrentA:null,sourceVoltageV:0,sourceCurrentA:null,
  cycle:1,xRepeat:1,xSegment:1,pRepeat:1,pSegment:1,
  measurementStatus:'N',measurementCompleteness:'partial',
  complianceRole:null,rawKxciResponse:'N'+seq+'.0E-9',
  rawKxciResponses:{drain:'N'+seq+'.0E-9'},
  measurementStatusByRole:{drain:'N'},measurementOrder:['drain'],...overrides};
}
function context(){
 const record={published:[],captures:0};
 const ctx={data:{
  model:{createTable:spec=>({kind:'data.table',rowCount:spec.columns[0].values.length,...spec})},
  artifacts:{publish:table=>{record.published.push(table);return {changed:true}}}
 },project:{capture:()=>record.captures++}};
 return {ctx,record};
}
const input=rows=>({runId:'run-007',serial:'1498377',startedAt:'2026-11-11T07:00:00.000Z',
 finishedAt:'2026-11-11T07:00:01.000Z',runState:'stopped',rows});
test('actual KXCI TI rows publish canonical full-resolution DataTable with raw status and original responses',()=>{
 const {ctx,record}=context(),rows=[frame(1),frame(2,{measurementStatus:'C',complianceRole:'gate'})];
 const result=api.publishRaw(ctx,input(rows));
 assert.equal(result.canonical,true);assert.equal(result.unprocessed,true);
 assert.equal(result.rows,2);assert.equal(record.published.length,1);
 const artifact=record.published[0];
 assert.equal(artifact.id,'dkts:kxci:run-007');assert.equal(artifact.semanticType,'science.transport.iv');
 assert.deepEqual(Array.from(artifact.metadata.dataAssignments),['com.dkts.keithley-4200']);
 const c=key=>artifact.columns.find(col=>col.key===key);
 assert.deepEqual(Array.from(c('drainVoltageV').values),[.05,.1]);
 assert.deepEqual(Array.from(c('drainCurrentA').values),[1e-9,2e-9]);
 assert.equal(c('rawKxciResponse').values[1],'N2.0E-9');
 assert.equal(JSON.parse(c('rawKxciResponses').values[0]).drain,'N1.0E-9');
 assert.equal(c('measurementStatus').values[1],'C');
 assert.ok(Number.isNaN(c('gateCurrentA').values[0]),'missing channel is not manufactured');
 assert.equal(record.captures,1);
});
test('no synthetic/planned/malformed/unfinished rows cross canonical store boundary',()=>{
 const bad=[
  input([frame(1,{source:'simulation'})]),
  input([frame(2)]),
  input([frame(1,{rawKxciResponse:''})]),
  {...input([frame(1)]),runState:'running'},
  {...input([frame(1)]),serial:''},
  input([]),
  input([frame(1,{measurementCompleteness:'invented'})])
 ];
 for(const payload of bad){const {ctx,record}=context();
  assert.throws(()=>api.publishRaw(ctx,payload));
  assert.equal(record.published.length,0);
 }
});
