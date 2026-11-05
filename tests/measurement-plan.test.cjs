'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizePlan,previewPlan}=require('../src/controller/measurement-plan.cjs');
test('IV forward/reverse/roundtrip generates ordered setpoint plans only',()=>{
  const p=previewPlan({kind:'iv',points:3,loops:2,startV:-1,stopV:1,direction:'roundtrip'});
  assert.equal(p.plan.totalPoints,10);
  assert.deepEqual(p.firstPoints.slice(0,5).map(x=>x.setVoltageV),[-1,0,1,0,-1]);
  assert.equal(p.plan.executable,false);
  assert.equal(p.plan.hardwareVerified,false);
  const reverse=previewPlan({kind:'iv',points:3,loops:1,startV:-1,stopV:1,direction:'reverse'});
  assert.deepEqual(reverse.firstPoints.map(x=>x.setVoltageV),[1,0,-1]);
});
test('IT planner respects fixed voltage and elapsed-time order',()=>{
  const p=previewPlan({kind:'it',fixedV:0.1,points:4,loops:1,intervalMs:50});
  assert.deepEqual(p.firstPoints.map(x=>x.setVoltageV),[0.1,0.1,0.1,0.1]);
  assert.deepEqual(p.firstPoints.map(x=>x.plannedElapsedS),[0,0.05,0.1,0.15]);
});
test('planning rejects invalid limits, missing values, and channel conflicts',()=>{
  assert.throws(()=>normalizePlan({kind:'pund'}),/尚未/);
  assert.throws(()=>normalizePlan({startV:211}),/规划范围/);
  assert.equal(normalizePlan({startV:210,stopV:-210}).startV,210);
  assert.throws(()=>normalizePlan({startV:1000}),/规划范围/);
  const unidentified=normalizePlan({complianceA:0.011});
  assert.equal(unidentified.maxComplianceA,null);
  assert.equal(unidentified.hardwareCapabilityStatus,'not-inspected');
  assert.equal(unidentified.complianceA,0.011,'Unknown modules must not receive a guessed 10.5 mA cap');
  const medium={inventory:{slots:[{type:'SMU',family:'SMU',channel:1,powerClass:'medium'}],unknownModules:[]}};
  const high={inventory:{slots:[{type:'HPSMU',family:'SMU',channel:1,powerClass:'high'}],unknownModules:[]}};
  const unverified={inventory:{slots:[{type:'SMU',family:'SMU',channel:1,physicalIdentityVerified:false}],unknownModules:[],unverifiedModules:[{family:'SMU'}]}};
  const unverifiedPlan=normalizePlan({complianceA:0.011},unverified);
  assert.equal(unverifiedPlan.maxComplianceA,null);
  assert.equal(unverifiedPlan.hardwareCapabilityStatus,'unresolved');
  assert.equal(normalizePlan({startV:200,stopV:200,complianceA:0.0105},medium).maxComplianceA,0.0105);
  assert.equal(normalizePlan({startV:200,stopV:200,complianceA:0.1},high).maxComplianceA,0.105);
  assert.equal(normalizePlan({startV:20,stopV:20,complianceA:1},high).maxComplianceA,1.05);
  assert.equal(normalizePlan({sourceModel:'high',startV:20,stopV:20,complianceA:0.0001}).maxComplianceA,null,
    'A user-supplied model name must never create a hardware limit without inventory');
  assert.throws(()=>normalizePlan({startV:200,stopV:200,complianceA:0.0106},medium),/理论上限/);
  assert.throws(()=>normalizePlan({points:0}),/规划范围/);
  assert.throws(()=>normalizePlan({gateSmU:1,sourceSmU:1}),/不得/);
  const mixed={inventory:{slots:[
    {type:'HPSMU',family:'SMU',channel:1,powerClass:'high'},
    {type:'SMU',family:'SMU',channel:2,powerClass:'medium'}
  ]}};
  const dual=normalizePlan({
    sourceSmU:1,measureSmU:1,gateSmU:2,gateBiasV:100,
    startV:20,stopV:20,complianceA:0.0105
  },mixed);
  assert.equal(dual.sourceMaxComplianceA,1.05);
  assert.equal(dual.gateMaxComplianceA,0.0105);
  assert.equal(dual.maxComplianceA,0.0105,
    'The stricter gate-channel limit must constrain the shared compliance setting');
  assert.throws(()=>normalizePlan({gateBiasV:10,gateSmU:0}),/必须选择独立的栅极 SMU/);
  assert.throws(()=>normalizePlan({intervalMs:9,kind:'it'}),/规划范围/);
  assert.throws(()=>normalizePlan({intervalMs:10001,kind:'it'}),/规划范围/);
  assert.throws(()=>normalizePlan({points:3000,direction:'roundtrip'}),/最多 4096 个点/);

  assert.throws(()=>normalizePlan({complianceA:''}),/不能为空/);
});

test('exclusive execution coordinator forbids overlapping tests but releases on completion',async()=>{
  const {createExecutionCoordinator}=require('../src/controller/measurement-plan.cjs');
  const gate=createExecutionCoordinator();
  assert.deepEqual(gate.status(),{running:false,kind:null});
  const first=gate.begin('iv');
  assert.deepEqual(gate.status(),{running:true,kind:'iv'});
  assert.throws(()=>gate.begin('it'),/不允许同时执行两项测试/);
  assert.equal(first.end(),true);
  assert.equal(first.end(),false);
  assert.deepEqual(gate.status(),{running:false,kind:null});
  let unblock;
  const signal=new Promise(resolve=>{unblock=resolve;});
  const running=gate.run('pund',async()=>{await signal;return 'result';});
  assert.equal(gate.status().kind,'pund');
  await assert.rejects(()=>gate.run('retention',async()=>true),/不允许同时执行两项测试/);
  unblock();
  assert.equal(await running,'result');
  assert.equal(gate.status().running,false);
  await assert.rejects(()=>gate.run('iv',async()=>{throw Error('instrument fault');}),/instrument fault/);
  assert.equal(gate.status().running,false,'fault must release execution lease');
});
