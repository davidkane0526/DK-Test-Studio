'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseWaveformText,validateWaveform}=require('../src/controller/waveform.cjs');

const pmu40={sourceType:'pmu',rangeV:40,loadOhms:50,dutCurrentLimitA:0.8,measureMode:'none'};
const pmu10Measure={sourceType:'pmu',rangeV:10,loadOhms:50,dutCurrentLimitA:0.2,
  measureMode:'current',currentMeasureRangeA:0.2,measureWindowS:5e-9};

test('Segment ARB accepts the published 20 ns hardware minimum, including the 40 V range',()=>{
  const w=parseWaveformText('# time(s),voltage(V)\n0,0\n0.00000002,1\n0.00000004,0\n',pmu40);
  assert.equal(w.points.length,3);
  assert.equal(w.points[1].timeS,2e-8);
  assert.equal(w.durationS,4e-8);
  assert.equal(w.minSegmentTimeS,2e-8);
  assert.equal(w.maxSegmentTimeS,40);
  assert.equal(w.timeResolutionS,1e-8);
  assert.equal(w.executable,false);
  assert.equal(w.hardwareVerified,false);
});

test('recommended measurement timing is a warning, not a reduced hardware limit',()=>{
  const w=validateWaveform([
    {timeS:0,voltageV:0},
    {timeS:2e-8,voltageV:1},
    {timeS:4e-8,voltageV:0}
  ],pmu10Measure);
  assert.equal(w.minimumStepS,2e-8);
  assert.equal(w.measureWindowS,5e-9);
  assert.equal(w.sampleIntervalS,5e-9);
  assert.equal(w.timingRecommendations.status,'typical-recommended-not-hard-limits');
  assert(w.warnings.some(x=>x.includes('典型推荐最小脉宽')));
  assert(w.warnings.some(x=>x.includes('典型推荐窗口')));
});

test('Segment ARB accepts the full 40 s hardware segment maximum',()=>{
  const w=validateWaveform([
    {timeS:0,voltageV:0},
    {timeS:40,voltageV:0}
  ],pmu40);
  assert.equal(w.minimumStepS,40);
  assert.equal(w.maxSegmentTimeS,40);
  assert.throws(()=>validateWaveform([
    {timeS:0,voltageV:0},
    {timeS:40.00000001,voltageV:0}
  ],pmu40),/硬件范围/);
});

test('waveform rejects duplicate/reverse time, non-hardware time ticks, and non-closed loops',()=>{
  assert.throws(()=>validateWaveform([
    {timeS:0,voltageV:0},{timeS:0,voltageV:0}
  ],pmu40),/严格递增/);
  assert.throws(()=>validateWaveform([
    {timeS:0,voltageV:0},{timeS:2.5e-8,voltageV:0}
  ],pmu40),/10 ns 硬件编程分辨率/);
  assert.throws(()=>validateWaveform([
    {timeS:0,voltageV:0},{timeS:2e-8,voltageV:1},{timeS:4e-8,voltageV:0.5}
  ],pmu40),/首尾电压相同/);
  assert.throws(()=>validateWaveform([
    {timeS:0,voltageV:0},{timeS:2e-8,voltageV:21},{timeS:4e-8,voltageV:0}
  ],pmu40),/必须在/);
});

test('PMU measurement defaults to the hardware ADC interval, not the recommended window',()=>{
  const w=validateWaveform([
    {timeS:0,voltageV:0},{timeS:2e-8,voltageV:1},{timeS:4e-8,voltageV:0}
  ],{...pmu10Measure,measureWindowS:undefined});
  assert.equal(w.measureWindowS,5e-9);
  assert(w.warnings.some(x=>x.includes('典型推荐窗口')));
});

test('PMU measurement window cannot be shorter than one ADC sample or exceed its segment',()=>{
  assert.throws(()=>validateWaveform([
    {timeS:0,voltageV:0},{timeS:2e-8,voltageV:1},{timeS:4e-8,voltageV:0}
  ],{...pmu10Measure,measureWindowS:4e-9}),/必须在/);
  assert.throws(()=>validateWaveform([
    {timeS:0,voltageV:0},{timeS:2e-8,voltageV:1},{timeS:4e-8,voltageV:0}
  ],{...pmu10Measure,measureWindowS:3e-8}),/小于 PMU 测量窗口/);
});

test('PGU supports source-only Segment ARB but never measurement modes',()=>{
  const pgu={sourceType:'pgu',rangeV:40,loadOhms:1,dutCurrentLimitA:0.8,measureMode:'none'};
  const w=parseWaveformText('0 0\n0.00000002 0.78\n0.00000004 0',pgu);
  assert.equal(w.maxVoltageV<0.8,true);
  assert.equal(w.minSegmentTimeS,2e-8);
  assert.throws(()=>parseWaveformText('0 0\n0.00000002 0\n0.00000004 0',{
    ...pgu,measureMode:'current'
  }),/纯电压脉冲源/);
  assert.throws(()=>parseWaveformText('0 0\n0.00000002 0\n0.00000004 0',{
    ...pgu,loadOhms:undefined
  }),/负载阻值/);
  assert.throws(()=>parseWaveformText('0 0\n0.00000002 0\n0.00000004 0',{
    ...pgu,dutCurrentLimitA:undefined
  }),/DUT 允许最大电流/);
});

test('SMU arbitrary list uses an explicitly selected model and SDM timing, not PMU nanosecond timing',()=>{
  const options={sourceType:'smu',sourceModel:'4200-SMU',measureModel:'4200-SMU',
    complianceA:0.001,sourceDelayS:0.02,integrationTimeS:0.02};
  const w=parseWaveformText('0 0\n0.04 1\n0.08 0',options);
  assert.equal(w.minimumStepS,0.04);
  assert.equal(w.sourceType,'smu');
  assert.throws(()=>parseWaveformText('0 0\n0.04 1\n0.08 0',{
    ...options,sourceModel:undefined
  }),/必须明确选择 SMU1 的具体型号/);
});
