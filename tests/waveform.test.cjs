'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseWaveformText,validateWaveform}=require('../src/controller/waveform.cjs');
test('arbitrary waveform is a non-executable plan with exact input values',()=>{
  const w=parseWaveformText('# time(s),voltage(V)\n0,0\n0.00000002,1\n0.00000004,-1\n');
  assert.equal(w.points.length,3);
  assert.equal(w.points[1].timeS,2e-8);
  assert.equal(w.durationS,4e-8);
  assert.equal(w.executable,false);
  assert.equal(w.hardwareVerified,false);
});
test('waveform rejects duplicate/reverse time and out-of-plan voltage',()=>{
  assert.throws(()=>parseWaveformText('0 0\n0 1'),/严格递增/);
  assert.throws(()=>parseWaveformText('1 0\n0.5 1'),/严格递增/);
  assert.throws(()=>validateWaveform([{timeS:0,voltageV:0},{timeS:1,voltageV:211}]),/规划范围/);
  assert.throws(()=>validateWaveform([{timeS:0,voltageV:0},{timeS:1,voltageV:41}],{sourceType:'pmu',loadMode:'highz'}),/±40 V/);
  assert.throws(()=>validateWaveform([{timeS:0,voltageV:0},{timeS:1,voltageV:21}],{sourceType:'pmu'}),/±20 V/);
  assert.equal(validateWaveform([{timeS:0,voltageV:0},{timeS:1,voltageV:20}],{sourceType:'pmu'}).maxVoltageV,20);
  assert.equal(validateWaveform([{timeS:0,voltageV:0},{timeS:1,voltageV:40}],{sourceType:'pmu',loadMode:'highz'}).maxVoltageV,40);
  assert.equal(parseWaveformText('0 0\\n1 40',{sourceType:'pgu',loadMode:'highz'}).maxVoltageV,40);
  assert.throws(()=>parseWaveformText('0 0\\n1 21',{sourceType:'pgu'}),/±20 V/);
  assert.throws(()=>parseWaveformText('0 0'),/至少需要 2 个/);
});
