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
  assert.throws(()=>validateWaveform(points,{sourceType:'pmu',loadOhms:50,rangeV:40,inventory:{slots:[],unknownModules:[]}}),/没有已识别/);
  assert.throws(()=>validateWaveform([{timeS:0,voltageV:0},{timeS:0.00000005,voltageV:39.999},{timeS:0.0000001,voltageV:0},{timeS:0.00000015,voltageV:1}],{sourceType:'pmu',loadOhms:1000000,rangeV:40,inventory}),/输出边界/);
  assert.throws(()=>validateWaveform(points.slice(0,3),{sourceType:'pmu',loadOhms:50,rangeV:40}),/至少需要 3 个分段/);
  assert.throws(()=>validateWaveform([{timeS:0,voltageV:0},{timeS:0.000000025,voltageV:1},{timeS:0.00000005,voltageV:0},{timeS:0.000000075,voltageV:1}],{sourceType:'pmu',loadOhms:50,rangeV:10}),/10 ns 时间分辨率/);
  assert.throws(()=>validateWaveform([{timeS:0,voltageV:0},{timeS:0.00000002,voltageV:1},{timeS:0.00000004,voltageV:0},{timeS:0.00000006,voltageV:1}],{sourceType:'pmu',loadOhms:50,rangeV:40}),/分段时间/);
});
test('PGU source-only uses its own 10 V minimum segment time and cannot capture current',()=>{
  const points=[{timeS:0,voltageV:0},{timeS:1e-8,voltageV:1},{timeS:2e-8,voltageV:0},{timeS:3e-8,voltageV:1}];
  const w=validateWaveform(points,{sourceType:'pgu',loadOhms:50,rangeV:10,inventory:pguInventory});
  assert.equal(w.maxVoltageV,5);
  assert.equal(w.moduleType,'VPU');
  assert.throws(()=>validateWaveform(points,{sourceType:'pgu',loadOhms:50,rangeV:10,captureCurrent:true}),/不支持电流波形测量/);
});
test('PMU current capture exposes ranges and enforces acquisition buffer',()=>{
  const points=[{timeS:0,voltageV:0},{timeS:0.00000002,voltageV:1},{timeS:0.00000004,voltageV:0},{timeS:0.00000006,voltageV:1}];
  const w=validateWaveform(points,{sourceType:'pmu',loadOhms:50,rangeV:10,captureCurrent:true,measureWindowS:20e-9,inventory});
  assert(w.pulseCurrentRangesA.includes(0.2));
  assert.equal(w.captureBudget.maxPointsPerChannel,65536);
  assert.equal(w.captureBudget.hardwareMaxSampleRateHz,200e6);
  assert.throws(()=>validateWaveform(points,{sourceType:'pmu',loadOhms:50,rangeV:10,captureCurrent:true,measureWindowS:1e-9,inventory}),/采样率范围/);
});
test('waveform parser rejects duplicate times, invalid load and point counts',()=>{
  assert.throws(()=>parseWaveformText('0 0\n0 1'),/严格递增/);
  assert.throws(()=>parseWaveformText('1 0\n0.5 1'),/严格递增/);
  assert.throws(()=>parseWaveformText('0 0\n1 1',{sourceType:'pmu'}),/负载阻值/);
  assert.throws(()=>parseWaveformText('0 0'),/至少需要 2 个/);
});
