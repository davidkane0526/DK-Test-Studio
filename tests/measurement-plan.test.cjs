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
  assert.throws(()=>normalizePlan({startV:201}),/规划范围/);
  assert.throws(()=>normalizePlan({points:0}),/规划范围/);
  assert.throws(()=>normalizePlan({gateSmU:1,sourceSmU:1}),/不得/);
  assert.throws(()=>normalizePlan({complianceA:''}),/不能为空/);
});
