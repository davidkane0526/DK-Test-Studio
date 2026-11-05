'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const caps = require('../src/shared/hardware-capabilities.js');
const protocol = require('../src/shared/kxci-protocol.js');
test('SMU module limits use the identified module and selected voltage range', () => {
  const medium = caps.getSmuLimits({ type: 'SMU', family: 'SMU' }, 200, 0.01);
  assert.equal(medium.maxComplianceA, 0.0105);
  assert.equal(medium.voltageRangeNominalV, 200);
  assert.equal(medium.requiresInterlock, true);
  const high = caps.getSmuLimits({ type: 'HPSMU', family: 'SMU' }, 20, 1);
  assert.equal(high.maxComplianceA, 1.05);
  assert.equal(high.availableCurrentRangesA.at(-1), 1);
  const unknown = caps.getSmuLimits({ type: 'SMU', family: 'SMU', physicalIdentityVerified: false }, 20, 0.01);
  assert.equal(unknown.known, false);
  assert.equal(unknown.maxComplianceA, null);
  assert.equal(high.voltageRangeNominalV, 20);
  const pa = caps.getSmuLimits({ type: 'SMUPA', family: 'SMU' }, 20, 1e-10);
  assert.equal(pa.minComplianceA, 1e-10);
  assert.throws(() => caps.getSmuLimits({ type: 'SMU', family: 'SMU' }, 20, 1e-10), /最小值/);
  assert.throws(() => caps.getSmuLimits({ type: 'SMU', family: 'SMU' }, 200, 0.011), /理论上限/);
});
test('PMU and PGU load line and Segment Arb limits are module-specific', () => {
  const pmu = caps.getPulseOutputLimits('pmu', 40, 50);
  assert.equal(pmu.maxVoltageV, 20);
  assert.equal(pmu.maxCurrentA, 0.4);
  const pg10 = caps.getSegmentArbLimits('pgu', 10);
  const pm10 = caps.getSegmentArbLimits('pmu', 10);
  const pm40 = caps.getSegmentArbLimits('pmu', 40);
  assert.equal(pg10.minSegmentS, 1e-8);
  assert.equal(pm10.minSegmentS, 2e-8);
  assert.equal(pm40.minSegmentS, 5e-8);
  assert.equal(pm40.maxSegments, 2048);
  assert.equal(pm40.timeResolutionS, 1e-8);
  assert.equal(pm40.maxSegmentsPerCommand, 128);
  assert.equal(pm40.maxSequenceLoops, 1e12);
  const pmuTiming = caps.getPulseTimingRecommendation(10, 0.01, true);
  assert.equal(pmuTiming.periodMinS, 60e-9);
  const pguTiming = caps.getPulseTimingRecommendation(10, null, false, 'pgu');
  assert.equal(pguTiming.periodMinS, 20e-9);
});
test('chassis power is calculated from KXCI inventory and active test channels', () => {
  const inventory = { slots: [
    { type: 'HPSMU', family: 'SMU', channel: 1, powerClass: 'high' },
    { type: 'PMU', family: 'PMU', channel: 1, rpmCount: 0 },
    { type: 'VPU', family: 'PGU', channel: 2, rpmCount: 0 }
  ], unknownModules: [] };
  const p = caps.calculateChassisPower({
    inventory, activeSmuChannels: [1],
    activePulseChannels: [{ family: 'PMU', cardIndex: 1, rangeV: 40 }, { family: 'PGU', cardIndex: 2, rangeV: 10 }]
  });
  assert.equal(p.known, true);
  assert.equal(p.nPMU, 1);
  assert.equal(p.nPGU, 1);
  assert.equal(p.nHPSMU, 1);
  assert.equal(p.totalW, 29.4 + 50.4 + 45 + 54.6 + 8.4);
  assert.equal(p.withinLimit, true);
  const unknown = caps.calculateChassisPower({ inventory: { slots: [], unknownModules: [{ raw: 'MYSTERY' }] } });
  assert.equal(unknown.known, false);
});
test('KXCI option parsing distinguishes RPM bindings and logical VS/VM roles', () => {
  const p = protocol.parseOptions('SMU1,HPSMUPA2,PMU1RPM1-2,VPU1,CVU1,VS1,VM1');
  assert.equal(p.knownModules.length, 4);
  assert.equal(p.slots[2].type, 'PMURPM');
  assert.equal(p.slots[2].rpmCount, 2);
  assert.equal(p.slots[3].family, 'PGU');
  assert.equal(p.slots[5].capabilityStatus, 'physical-variant-required');
  assert.equal(p.hardwareLimitsVerified, false);
});
