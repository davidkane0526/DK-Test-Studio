'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const DB=require('../src/shared/4200a-capabilities-data.js');
const safety=require('../src/shared/4200a-safety-policy.js');

test('canonical capability database is the single shared source for every supported module',()=>{
  assert.equal(DB.schema,'dkts.4200a.capability-safety');
  assert.equal(DB.databaseVersion,'1.2.0');
  for(const model of ['4200-SMU','4201-SMU','4210-SMU','4211-SMU','4200-PA',
    '4210-CVU','4215-CVU','4200A-CVIV','4200-CVU-PWR','4225-PMU','4225-RPM','4220-PGU'])
    assert(DB.modules[model],model+' must be represented in the exportable database');
  assert.equal(DB.rules.waveform.segmentArb.hardware.minSegmentTimeS,20e-9);
  assert.equal(DB.rules.waveform.segmentArb.hardware.maxSegmentTimeS,40);
  assert.equal(DB.rules.waveform.segmentArb.hardware.timeResolutionS,10e-9);
  assert.equal(DB.rules.waveform.segmentArb.hardware.maxSegments,2048);
  assert.equal(DB.rules.waveform.segmentArb.clariusExampleProfile.notEnforced,true);
  assert.equal(DB.rules.waveform.segmentArb.enforceProfile,'hardware');
});

test('SMU load-capacitance values use the full published 4201/4211 ratings',()=>{
  const c4201=DB.modules['4201-SMU'].loadCapacitance.byCurrentRange;
  const c4211=DB.modules['4211-SMU'].loadCapacitance.byCurrentRange;
  assert.equal(c4201.find(x=>x.rangeA===0.1).maxF,100e-6);
  assert.equal(c4211.find(x=>x.rangeA===1).maxF,100e-6);
  assert.equal(c4211.find(x=>x.rangeA===0.1).maxF,100e-6);
});

test('offline CVU validation requires a specific model and uses that model full AC-drive capability',()=>{
  assert.throws(()=>safety.validateCvuPlan({frequencyHz:1e6}),/必须明确选择 CVU1 的具体型号/);
  const highResolution=safety.validateCvuPlan({
    cvuModel:'4215-CVU',frequencyHz:10e6,acDriveVrms:1
  });
  assert.equal(highResolution.modelKey,'4215-CVU');
  assert.equal(highResolution.acDriveVrms,1);
  assert.equal(highResolution.frequencyHz,10e6);
  assert.equal(highResolution.hardwareVerified,false);
  assert.throws(()=>safety.validateCvuPlan({
    cvuModel:'4210-CVU',frequencyHz:10e6,acDriveVrms:1
  }),/必须在/);
});

test('RPM uses its actual 10 V capability table, not the requested 40 V range table',()=>{
  const hardware={connected:true,inventory:{slots:[
    {family:'PMU',channel:1,rpm:true}
  ],remoteModules:[]}};
  const plan=safety.validatePulseWaveform([
    {timeS:0,voltageV:0},
    {timeS:20e-9,voltageV:1},
    {timeS:40e-9,voltageV:0}
  ],{
    sourceType:'pmu',rangeV:40,loadOhms:50,dutCurrentLimitA:0.8,
    measureMode:'current',currentMeasureRangeA:0.01,measureWindowS:5e-9,
    pmuCard:1,pmuChannel:1
  },hardware);
  assert.equal(plan.requestedRangeV,40);
  assert.equal(plan.rangeV,10);
  assert.equal(plan.useRPM,true);
  assert.equal(plan.currentMeasureRangeA,0.01);
  assert.equal(plan.minSegmentTimeS,20e-9);
  assert.equal(plan.minimumStepS,20e-9);
  assert(plan.warnings.some(x=>x.includes('典型推荐最小脉宽')));
});

test('database timing recommendations never become a hidden Segment ARB hard minimum',()=>{
  const plan=safety.validatePulseWaveform([
    {timeS:0,voltageV:0},
    {timeS:20e-9,voltageV:1},
    {timeS:40e-9,voltageV:0}
  ],{
    sourceType:'pmu',rangeV:10,loadOhms:50,dutCurrentLimitA:0.2,
    measureMode:'current',currentMeasureRangeA:0.2,measureWindowS:5e-9
  });
  assert.equal(plan.minSegmentTimeS,20e-9);
  assert.equal(plan.measureWindowS,5e-9);
  assert.equal(plan.timingRecommendations.minimumPulseWidthS,70e-9);
  assert.equal(plan.timingRecommendations.status,'typical-recommended-not-hard-limits');
  assert(plan.warnings.length>0);
});
