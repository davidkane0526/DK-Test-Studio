'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {normalizePlan,previewPlan}=require('../src/controller/measurement-plan.cjs');

const medium={connected:true,inventory:{slots:[
  {family:'SMU',channel:1,powerClass:'medium'}
],remoteModules:[]}};
const high={connected:true,inventory:{slots:[
  {family:'SMU',channel:1,powerClass:'high'}
],remoteModules:[]}};

test('IV forward/reverse/roundtrip generates ordered setpoint plans only',()=>{
  const p=previewPlan({kind:'iv',points:3,loops:2,startV:-1,stopV:1,direction:'roundtrip'},300,medium);
  assert.equal(p.plan.totalPoints,10);
  assert.deepEqual(p.firstPoints.slice(0,5).map(x=>x.setVoltageV),[-1,0,1,0,-1]);
  assert.equal(p.plan.executable,false);
  assert.equal(p.plan.hardwareVerified,false);
  const reverse=previewPlan({kind:'iv',points:3,loops:1,startV:-1,stopV:1,direction:'reverse'},300,medium);
  assert.deepEqual(reverse.firstPoints.map(x=>x.setVoltageV),[1,0,-1]);
});

test('IT planner respects fixed voltage and elapsed-time order',()=>{
  const p=previewPlan({kind:'it',fixedV:0.1,points:4,loops:1,intervalMs:50},300,medium);
  assert.deepEqual(p.firstPoints.map(x=>x.setVoltageV),[0.1,0.1,0.1,0.1]);
  assert.deepEqual(p.firstPoints.map(x=>x.plannedElapsedS),[0,0.05,0.1,0.15]);
});

test('planning rejects invalid limits, missing values, and channel conflicts',()=>{
  assert.throws(()=>normalizePlan({kind:'pund'},medium),/尚未/);
  assert.throws(()=>normalizePlan({startV:211},medium),/规划范围/);
  assert.equal(normalizePlan({startV:210,stopV:-210},medium).startV,210);
  assert.throws(()=>normalizePlan({startV:1000},medium),/规划范围/);
  assert.throws(()=>normalizePlan({complianceA:''},medium),/不能为空/);
  assert.throws(()=>normalizePlan({startV:200,stopV:200,complianceA:0.0106},medium),/规划范围/);
  assert.equal(normalizePlan({startV:200,stopV:200,complianceA:0.0105},medium).maxComplianceA,0.0105);
  assert.equal(normalizePlan({startV:200,stopV:200,complianceA:0.1},high).maxComplianceA,0.105);
  assert.equal(normalizePlan({startV:20,stopV:20,complianceA:1},high).maxComplianceA,1.05);
  assert.throws(()=>normalizePlan({points:0},medium),/规划范围/);
  assert.throws(()=>normalizePlan({gateSmU:1,sourceSmU:1},medium),/不得/);
  assert.throws(()=>normalizePlan({gateBiasV:10,gateSmU:0},medium),/必须选择独立的栅极 SMU/);
});

test('identified hardware class is used at its full published rating, without a lower fallback',()=>{
  const plan=normalizePlan({
    sourceModel:'4210-SMU',
    startV:200,stopV:200,complianceA:0.0105
  },medium);
  assert.equal(plan.sourcePowerClass,'medium');
  assert.equal(plan.maxComplianceA,0.0105,
    'Connected inventory, not a user-supplied model selector, determines the actual module class');

  const highPlan=normalizePlan({startV:200,stopV:200,complianceA:0.1},high);
  assert.equal(highPlan.sourcePowerClass,'high');
  assert.equal(highPlan.maxComplianceA,0.105,
    'The high-power SMU must use its full 105 mA 200 V range capability');
  assert.equal(highPlan.warnings.some(x=>/保守/.test(x)),false);
});

test('offline planning requires an explicit exact SMU model rather than silently assuming medium power',()=>{
  assert.throws(()=>normalizePlan({startV:20,stopV:20,complianceA:0.1}),/必须明确选择 SMU1 的具体型号/);
  assert.throws(()=>normalizePlan({sourceModel:'high',startV:20,stopV:20,complianceA:0.1}),/具体型号/);
  const offline=normalizePlan({
    sourceModel:'4210-SMU',measureModel:'4210-SMU',
    startV:20,stopV:20,complianceA:1
  });
  assert.equal(offline.sourceModel,'4210-SMU');
  assert.equal(offline.sourcePowerClass,'high');
  assert.equal(offline.maxComplianceA,1.05);
  assert.equal(offline.hardwareVerified,false);
  assert.match(offline.warnings.join(' '),/明确选择的 4210-SMU/);
});

test('mixed SMU channels constrain the shared compliance using the actual selected source and gate modules',()=>{
  const mixed={connected:true,inventory:{slots:[
    {family:'SMU',channel:1,powerClass:'high'},
    {family:'SMU',channel:2,powerClass:'medium'},
    {family:'SMU',channel:3,powerClass:'high'}
  ],remoteModules:[]}};
  const dual=normalizePlan({
    sourceSmU:1,measureSmU:3,gateSmU:2,gateBiasV:100,
    startV:20,stopV:20,complianceA:0.0105
  },mixed);
  assert.equal(dual.sourceMaxComplianceA,1.05);
  assert.equal(dual.gateMaxComplianceA,0.0105);
  assert.equal(dual.maxComplianceA,0.0105,
    'The medium-power gate channel constrains the shared compliance setting');
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
