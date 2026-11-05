'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseWaveformText,validateWaveform}=require('../src/controller/waveform.cjs');
const inventory={slots:[{type:'PMU',family:'PMU',channel:1,rpmCount:0}],unknownModules:[]};
const pguInventory={slots:[{type:'VPU',family:'PGU',channel:1,rpmCount:0}],unknownModules:[]};
test('SMU arbitrary list is uniform-timed, voltage-bounded and explicitly non-deterministic',()=>{
  const w=parseWaveformText('0,0\n0.00002,1\n0.00004,-1',{sourceType:'smu'});
  assert.equal(w.waveformMode,'smu-voltage-list');
  assert.equal(w.timingStatus,'measurement-and-settling-dependent');
  assert.equal(w.hardwareVerified,false);
  assert.throws(()=>parseWaveformText('0,0\n0.00002,1\n0.00005,-1',{sourceType:'smu'}),/统一点间延迟/);
  assert.throws(()=>validateWaveform([{timeS:0,voltageV:0},{timeS:1,voltageV:211}]),/规划范围/);
});
test('PMU Segment Arb enforces exact range, load-line and segment timing',()=>{
  const points=[{timeS:0,voltageV:0},{timeS:0.00000005,voltageV:1},{timeS:0.0000001,voltageV:0},{timeS:0.00000015,voltageV:-1}];
  const w=validateWaveform(points,{sourceType:'pmu',loadOhms:50,rangeV:40,inventory});
  assert.equal(w.waveformMode,'segment-arb');
  assert.equal(w.maxVoltageV,20);
  assert.equal(w.maxCurrentA,0.4);
  assert.equal(w.durationS,1.5e-7);
  assert.equal(w.hardwareVerified,false);
  assert.equal(w.interfaceLimits.segmentTimesCompatible,true);
  assert.equal(w.executionCompatibility,'hardware-plan-only');
  assert.throws(()=>validateWaveform(points,{sourceType:'pmu',loadOhms:50,rangeV:40,inventory:{slots:[],unknownModules:[]}}),/没有已识别/);
  assert.throws(()=>validateWaveform([{timeS:0,voltageV:0},{timeS:0.00000005,voltageV:39.999},{timeS:0.0000001,voltageV:0},{timeS:0.00000015,voltageV:1}],{sourceType:'pmu',loadOhms:999999,rangeV:40,inventory}),/输出边界/);
  assert.throws(()=>validateWaveform(points.slice(0,3),{sourceType:'pmu',loadOhms:50,rangeV:40}),/至少需要 3 个分段/);
  assert.throws(()=>validateWaveform([{timeS:0,voltageV:0},{timeS:0.000000025,voltageV:1},{timeS:0.00000005,voltageV:0},{timeS:0.000000075,voltageV:1}],{sourceType:'pmu',loadOhms:50,rangeV:10}),/10 ns 时间分辨率/);
  const hardware20ns=validateWaveform([{timeS:0,voltageV:0},{timeS:20e-9,voltageV:1},{timeS:40e-9,voltageV:0},{timeS:60e-9,voltageV:1}],{sourceType:'pmu',loadOhms:50,rangeV:40,inventory});
  assert.equal(hardware20ns.interfaceLimits.segmentTimesCompatible,false);
  assert.equal(hardware20ns.interfaceLimits.minSegmentTimeS,50e-9);
  assert.equal(hardware20ns.executionCompatibility,'hardware-valid-kxci-limited');
});
test('Segment Arb accepts the documented 40 s hardware segment while exposing the 1 s KXCI command limit',()=>{
  const points=[{timeS:0,voltageV:0},{timeS:40,voltageV:1},{timeS:80,voltageV:0},{timeS:120,voltageV:1}];
  const w=validateWaveform(points,{sourceType:'pmu',loadOhms:50,rangeV:10,inventory});
  assert.equal(w.durationS,120);
  assert.equal(w.interfaceLimits.maxSegmentTimeS,1);
  assert.equal(w.interfaceLimits.verificationStatus,'provisional-pending-rev-f-content-verification');
  assert.equal(w.interfaceLimits.segmentTimesCompatible,false);
  assert.equal(w.interfaceLimits.requiresAlternateBackend,true);
  assert.equal(w.executionCompatibility,'hardware-valid-kxci-limited');
  assert.equal(w.executable,false);
  assert.throws(()=>validateWaveform([{timeS:0,voltageV:0},{timeS:40.00000001,voltageV:1},{timeS:80.00000002,voltageV:0},{timeS:120.00000003,voltageV:1}],{sourceType:'pmu',loadOhms:50,rangeV:10,inventory}),/分段时间/);
});
test('KXCI Segment Arb arrays over 128 values are planned for command chunking, not rejected',()=>{
  const points=Array.from({length:130},(_,i)=>({timeS:i*20e-9,voltageV:0}));
  const w=validateWaveform(points,{sourceType:'pmu',loadOhms:50,rangeV:10,inventory});
  assert.equal(w.interfaceLimits.requiresCommandChunking,true);
  assert.equal(w.interfaceLimits.requiresAlternateBackend,false);
  assert.equal(w.interfaceLimits.maxSegmentsPerCommand,128);
});
test('PGU source-only uses its own 10 V minimum segment time and cannot capture current',()=>{
  const points=[{timeS:0,voltageV:0},{timeS:2e-8,voltageV:1},{timeS:4e-8,voltageV:0},{timeS:6e-8,voltageV:1}];
  const w=validateWaveform(points,{sourceType:'pgu',loadOhms:50,rangeV:10,inventory:pguInventory});
  assert.equal(w.maxVoltageV,5);
  assert.equal(w.moduleType,'VPU');
  assert.throws(()=>validateWaveform(points,{sourceType:'pgu',loadOhms:50,rangeV:10,captureCurrent:true}),/不支持电流波形测量/);
});
test('PMU current capture exposes ranges and enforces acquisition buffer',()=>{
  const points=[{timeS:0,voltageV:0},{timeS:0.00000002,voltageV:1},{timeS:0.00000004,voltageV:0},{timeS:0.00000006,voltageV:1}];
  const w=validateWaveform(points,{sourceType:'pmu',loadOhms:50,rangeV:10,captureCurrent:true,measureWindowS:20e-9,inventory});
  assert(w.pulseCurrentRangesA.includes(0.2));
  assert.equal(w.captureBudget.maxPointsPerChannel,999999);
  assert.equal(w.captureBudget.interfaceMaxPointsPerChannel,65535);
  assert.equal(w.captureBudget.interfaceDataBufferCapacityPointsPerChannel,65536);
  assert.equal(w.captureBudget.hardwareMaxSampleRateHz,200e6);
  assert.throws(()=>validateWaveform(points,{sourceType:'pmu',loadOhms:50,rangeV:10,captureCurrent:true,measureWindowS:1e-9,inventory}),/采样率范围/);
});
test('PMU planning enforces fewer than one million hardware samples and fewer than 65536 KXCI-generated points',()=>{
  const points=[{timeS:0,voltageV:0},{timeS:0.25,voltageV:1},{timeS:0.5,voltageV:0},{timeS:0.75,voltageV:1},{timeS:1,voltageV:0}];
  const w=validateWaveform(points,{sourceType:'pmu',loadOhms:50,rangeV:10,captureCurrent:true,measureWindowS:1e-3,inventory});
  assert.equal(w.captureBudget.maxPointsPerChannel,1000000);
  assert.equal(w.captureBudget.interfaceMaxPointsPerChannel,65536);
  assert.equal(w.captureBudget.maxSampleRateHz,999999);
  assert.equal(w.captureBudget.kxciCompatible,false);
  assert.equal(w.interfaceLimits.capturePointsCompatible,false);
  assert.equal(w.interfaceLimits.requiresAlternateBackend,true);
  assert.equal(w.executionCompatibility,'hardware-valid-kxci-limited');
});
test('PMU plus RPM plan exposes published current-range timing guidance',()=>{
  const rpmInventory={slots:[{type:'PMURPM',family:'PMU',channel:1,rpmCount:1,rpmChannels:[1]}],unknownModules:[]};
  const points=[{timeS:0,voltageV:0},{timeS:50e-9,voltageV:1},{timeS:100e-9,voltageV:0},{timeS:150e-9,voltageV:1}];
  const w=validateWaveform(points,{sourceType:'pmu',loadOhms:50,rangeV:10,captureCurrent:true,measurementRangeA:1e-7,measureWindowS:20e-9,inventory:rpmInventory});
  assert.equal(w.timingRecommendation.rpmTimingStatus,'published-typical');
  assert.equal(w.timingRecommendation.rpmTypicalTiming.recommendedMinPulseWidthS,134e-6);
  assert.equal(w.timingRecommendation.measurementRangeA,1e-7);
});
test('waveform parser rejects duplicate times, invalid load and point counts',()=>{
  assert.throws(()=>parseWaveformText('0 0\n0 1'),/严格递增/);
  assert.throws(()=>parseWaveformText('1 0\n0.5 1'),/严格递增/);
  assert.throws(()=>parseWaveformText('0 0\n1 1',{sourceType:'pmu'}),/负载阻值/);
  assert.throws(()=>parseWaveformText('0 0'),/至少需要 2 个/);
});
