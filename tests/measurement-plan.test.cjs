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


test('Xsweep segments preserve direction, exact endpoints, different ranges and nested Psweep ordering',()=>{
  const {previewSweepProgram,normalizeSweepProgram}=require('../src/controller/measurement-plan.cjs');
  const input={kind:'iv',sweepProgram:{
    terminals:{source:'GNDU',drain:'SMU1',gate:'SMU2'},
    fixedVoltages:{source:0,drain:0,gate:0},
    portSettings:{
      drain:{rangeMode:'auto',rangeA:'1e-6',complianceMode:'follow-range',complianceA:'1e-4'},
      gate:{rangeMode:'auto',rangeA:'1e-6',complianceMode:'custom',complianceA:'1e-4'}
    },
    loops:1,
    xSweep:{terminal:'drain',repeats:2,delayMs:20,segments:[
      {startV:0,stopV:2,stepV:.1,rangeA:'1e-6',delayMs:10},
      {startV:2,stopV:-2,stepV:-.1,rangeA:'1e-8',delayMs:30},
      {startV:-2,stopV:0,stepV:.1,rangeA:'1e-6',delayMs:10}
    ]},
    pSweep:{enabled:true,terminal:'gate',repeats:1,delayMs:50,
      segments:[{startV:0,stopV:1,stepV:.5,rangeA:'auto'}]}
  }};
  const hardware={inventory:{slots:[
    {type:'SMUPA',physicalType:'SMUPA',family:'SMU',channel:1,ratingsVerified:true,powerClass:'medium'},
    {type:'SMUPA',physicalType:'SMUPA',family:'SMU',channel:2,ratingsVerified:true,powerClass:'medium'}
  ],unknownModules:[],hardwareLimitsVerified:true}};
  const plan=normalizeSweepProgram(input,hardware);
  assert.equal(plan.totalPoints,498);
  assert.equal(plan.xSweep.points,83);
  assert.equal(plan.pSweep.points,3);
  assert.equal(plan.executable,false);
  assert.equal(plan.hardwareVerified,false);
  assert.equal(plan.hardwareCapabilityStatus,'identified');
  assert.deepEqual(plan.xSweep.segments.map(s=>s.rangeA),['1e-6','1e-8','1e-6']);
  const result=previewSweepProgram(input,300,hardware);
  assert.equal(result.firstPoints[0].drainVoltageV,0);
  assert.equal(result.firstPoints[20].drainVoltageV,2);
  assert.equal(result.firstPoints[21].drainVoltageV,2);
  assert.equal(result.firstPoints[22].drainVoltageV,1.9);
  assert.equal(result.firstPoints[61].drainVoltageV,-2);
  assert.equal(result.firstPoints[62].drainVoltageV,-2);
  assert.equal(result.firstPoints[82].drainVoltageV,0);
  assert.equal(result.firstPoints[21].currentRangeA,'1e-8');
  assert.equal(result.firstPoints[21].plannedPointDelayMs,30);
  assert.equal(result.firstPoints[165].gateVoltageV,0,'X repeats before P changes');
  assert.equal(result.firstPoints[166].gateVoltageV,.5,'P advances only after two X scans');
  assert.equal(result.firstPoints[166].xRepeat,1);
  assert.equal(result.truncated,true);
  const throughUnified=previewPlan(input,300,hardware);
  assert.equal(throughUnified.plan.schema,'dkts.sweep-program.v1');
});

test('multi-port sweep planner rejects contradictory directions, missing channels and false hardware ranges',()=>{
  const {normalizeSweepProgram}=require('../src/controller/measurement-plan.cjs');
  const base={
    terminals:{source:'None',drain:'SMU1',gate:'SMU2'},
    fixedVoltages:{source:0,drain:0,gate:0},
    loops:1,
    xSweep:{terminal:'drain',repeats:1,delayMs:0,
      segments:[{startV:0,stopV:2,stepV:.1,rangeA:'auto'}]},
    pSweep:{enabled:false,terminal:'gate',delayMs:20,repeats:1,
      segments:[{startV:0,stopV:1,stepV:.1,rangeA:'auto'}]}
  };
  assert.throws(()=>normalizeSweepProgram({kind:'iv',...base,xSweep:{...base.xSweep,
    segments:[{startV:2,stopV:-2,stepV:.1}]} }),/步长符号/);
  assert.throws(()=>normalizeSweepProgram({kind:'iv',...base,xSweep:{...base.xSweep,
    segments:[{startV:0,stopV:1,stepV:.3}]} }),/准确到达终点/);
  assert.throws(()=>normalizeSweepProgram({kind:'iv',...base,
    terminals:{source:'SMU1',drain:'SMU1',gate:'SMU2'}}),/端口冲突/);
  assert.throws(()=>normalizeSweepProgram({kind:'iv',...base,pSweep:{...base.pSweep,enabled:true,
    terminal:'drain'}}),/不能扫描同一个电极/);
  assert.throws(()=>normalizeSweepProgram({kind:'iv',...base,pSweep:{...base.pSweep,enabled:true},
    terminals:{source:'None',drain:'SMU1',gate:'None'}}),/必须分配/);
  const withoutPa={inventory:{slots:[
    {family:'SMU',type:'SMU',physicalType:'SMU',channel:1,ratingsVerified:true},
    {family:'SMU',type:'SMU',physicalType:'SMU',channel:2,ratingsVerified:true}
  ]}};
  assert.throws(()=>normalizeSweepProgram({kind:'iv',...base,
    xSweep:{...base.xSweep,segments:[{startV:0,stopV:1,stepV:.1,rangeA:'1e-8'}]}
  },withoutPa),/不受已识别模块支持/);
  const withPa={inventory:{slots:[
    {family:'SMU',type:'SMUPA',physicalType:'SMUPA',channel:1,ratingsVerified:true},
    {family:'SMU',type:'SMUPA',physicalType:'SMUPA',channel:2,ratingsVerified:true}
  ]}};
  assert.throws(()=>normalizeSweepProgram({kind:'iv',...base,
    xSweep:{...base.xSweep,segments:[{startV:0,stopV:1,stepV:.1,rangeA:'1e-8'}]},
    portSettings:{drain:{rangeMode:'auto',complianceMode:'custom',complianceA:'1e-4'}}
  },withPa),/不匹配/);
  const offline=normalizeSweepProgram({kind:'iv',...base});
  assert.equal(offline.hardwareCapabilityStatus,'not-inspected');
  assert.equal(offline.executable,false);
});


test('I–t preserves independent drain and gate compliance rather than imposing the gate limit on drain',()=>{
  const hardware={inventory:{slots:[
    {type:'HPSMU',physicalType:'HPSMU',family:'SMU',channel:1,powerClass:'high'},
    {type:'SMU',physicalType:'SMU',family:'SMU',channel:2,powerClass:'medium'}
  ]}};
  const params={kind:'it',sourceSmU:1,measureSmU:1,gateSmU:2,
    fixedV:20,gateBiasV:100,sourceComplianceA:.5,gateComplianceA:.01,
    sourceCurrentRangeA:'1',gateCurrentRangeA:'1e-2'};
  const plan=normalizePlan(params,hardware);
  assert.equal(plan.sourceComplianceA,.5);
  assert.equal(plan.gateComplianceA,.01);
  assert.equal(plan.sourceFixedCurrentRangeA,'1e0');
  assert.equal(plan.gateFixedCurrentRangeA,'1e-2');
  assert.equal(plan.maxComplianceA,.0105,'Combined theoretical limit remains diagnostic only');
  assert.equal(plan.executable,false);
  assert.throws(()=>normalizePlan({...params,gateCurrentRangeA:'1e-8'},hardware),/不.*支持/);
  assert.throws(()=>normalizePlan({...params,sourceCurrentRangeA:'1e-1'},hardware),/不匹配/);
});


test('segment-specific voltage/current envelopes permit full hardware capability without global throttling',()=>{
  const {normalizeSweepProgram,previewSweepProgram}=require('../src/controller/measurement-plan.cjs');
  const hardware={inventory:{slots:[
    {type:'SMU',physicalType:'SMU',family:'SMU',channel:1,ratingsVerified:true}
  ],unknownModules:[],hardwareLimitsVerified:true}};
  const program={kind:'iv',terminals:{source:'GNDU',drain:'SMU1',gate:'None'},
    fixedVoltages:{source:0,drain:0,gate:0},
    xSweep:{terminal:'drain',delayMs:20,repeats:1,segments:[
      {startV:0,stopV:2,stepV:1,rangeA:'1e-1'},
      {startV:2,stopV:200,stepV:99,rangeA:'1e-2'}
    ]},pSweep:{enabled:false},loops:1,
    portSettings:{drain:{rangeMode:'auto',complianceMode:'follow-range',
      complianceA:'1e-4'}}};
  const result=normalizeSweepProgram(program,hardware);
  assert.equal(result.totalPoints,6);
  assert.equal(result.hardwareCapabilityStatus,'identified');
  assert.deepEqual(result.limitsByRole.drain.segmentLimits.map(x=>x.maxComplianceA),[.105,.0105]);
  assert.deepEqual(result.limitsByRole.drain.segmentLimits.map(x=>x.selectedRangeA),[.1,.01]);
  assert.deepEqual(previewSweepProgram(program,30,hardware).firstPoints.map(x=>x.drainVoltageV),
    [0,1,2,2,101,200]);
  assert.throws(()=>normalizeSweepProgram({...program,
    xSweep:{...program.xSweep,segments:[
      {startV:0,stopV:200,stepV:100,rangeA:'1e-1'}]}
  },hardware),/当前电压段支持/);
  assert.throws(()=>normalizeSweepProgram({...program,
    xSweep:{...program.xSweep,segments:[
      {startV:0,stopV:1,stepV:.5,rangeA:'1e-13'}]}
  }),/离散硬件档位/,'A non-existent hardware range must fail even offline');
  assert.throws(()=>normalizeSweepProgram({...program,
    portSettings:{drain:{rangeMode:'auto',complianceMode:'custom',complianceA:5}}
  }),/理论上限 1.05 A/,'No inventory may never allow 5 A compliance');
});
