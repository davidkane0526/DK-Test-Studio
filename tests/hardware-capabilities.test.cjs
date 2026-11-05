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
  const mediumAt210 = caps.getSmuLimits({ type: 'SMU', family: 'SMU' }, 210, 0.01);
  assert.equal(mediumAt210.maxComplianceA, 0.01);
  assert.equal(mediumAt210.availableCurrentRangesA.at(-1), 0.01);
  assert.throws(() => caps.getSmuLimits({ type: 'SMU', family: 'SMU' }, 210, 0.0101), /理论上限/);
  const highAt21 = caps.getSmuLimits({ type: 'HPSMU', family: 'SMU' }, 21, 1);
  assert.equal(highAt21.maxComplianceA, 1);
  assert.throws(() => caps.getSmuLimits({ type: 'HPSMU', family: 'SMU' }, 21, 1.01), /理论上限/);
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
  assert.equal(pg10.minSegmentS, 2e-8);
  assert.equal(pg10.kxciMinSegmentS, 1e-8);
  assert.equal(pm10.minSegmentS, 2e-8);
  assert.equal(pm40.minSegmentS, 2e-8);
  assert.equal(pm40.kxciMinSegmentS, 5e-8);
  assert.equal(pm40.maxSegments, 2048);
  assert.equal(pm40.maxSegmentS, 40);
  assert.equal(pm40.kxciMaxSegmentS, 1);
  assert.equal(pm40.timeResolutionS, 1e-8);
  assert.equal(pm40.maxSegmentsPerCommand, 128);
  assert.equal(pm40.maxSequenceLoops, 1e12);
  const pmuTiming = caps.getPulseTimingRecommendation(10, 0.01, true);
  assert.equal(pmuTiming.periodMinS, 120e-9);
  assert.equal(pmuTiming.pulseWidthMinS, 60e-9);
  assert.equal(pmuTiming.transitionMinS, 20e-9);
  assert.equal(pmuTiming.kxciInterfaceTiming.periodMinS, 60e-9);
  const pguTiming = caps.getPulseTimingRecommendation(10, null, false, 'pgu');
  assert.equal(pguTiming.periodMinS, 20e-9);
  assert.equal(pguTiming.kxciInterfaceTiming.periodMinS, 20e-9);
  const pgu40Low = caps.getPulseTimingRecommendation(40, null, false, 'pgu', false, 5);
  const pgu40High = caps.getPulseTimingRecommendation(40, null, false, 'pgu', false, 20);
  assert.equal(pgu40Low.periodMinS, 100e-9);
  assert.equal(pgu40Low.transitionMinS, 30e-9);
  assert.equal(pgu40High.transitionMinS, 100e-9);
  const pgu40Boundary = caps.getPulseTimingRecommendation(40, null, false, 'pgu', false, 10);
  assert.equal(pgu40Boundary.transitionMinS, null);
  assert.equal(pgu40Boundary.transitionSelection, 'exactly-10V-not-specified-in-manual');
  assert.throws(() => caps.getPulseTimingRecommendation(10, null, true, 'pgu'), /不具备电流测量/);
  assert.deepEqual(caps.getPmuCurrentRanges(40, false), [1e-2, 1e-1, 8e-1]);
  assert.deepEqual(caps.getPmuCurrentRanges(40, true), [1e-4, 1e-2]);
  assert.deepEqual(caps.getPmuCurrentRanges(10, true), [1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2]);
  const rpmTiming10 = caps.getPulseTimingRecommendation(10, 1e-7, true, 'pmu', true);
  const rpmTiming40 = caps.getPulseTimingRecommendation(40, 1e-4, true, 'pmu', true);
  assert.equal(rpmTiming10.rpmTimingStatus, 'published-typical');
  assert.equal(rpmTiming10.rpmTypicalTiming.recommendedMinPulseWidthS, 134e-6);
  assert.equal(rpmTiming40.rpmTypicalTiming.recommendedMinPulseWidthS, 6.4e-6);
  const rpmTiming40Fast = caps.getPulseTimingRecommendation(40, 1e-2, true, 'pmu', true);
  assert.equal(rpmTiming40Fast.rpmTypicalTiming.recommendedMinPulseWidthS, 770e-9);
  const pmu40High = caps.getPulseTimingRecommendation(40, null, false, 'pmu', false, 20);
  assert.equal(pmu40High.transitionMinS, 100e-9);
  const capture = caps.getPmuCaptureBudget(1, null);
  assert.equal(capture.maxPointsPerChannel, 1000000);
  assert.equal(capture.interfaceMaxPointsPerChannel, 65536);
  assert.equal(capture.maxSampleRateHz, 1000000);
  assert.equal(capture.kxciMaxSampleRateHz, 65536);
  assert.equal(capture.kxciCompatible, false);
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

test('exported module database includes dedicated safety policies for all non-SMU module families', () => {
  const p = caps.DATABASE.safetyPolicies;
  assert.equal(p.cvu.requiresExactVariantIdentification, true);
  assert.equal(p.cvu.optionalPowerModule.unverifiedPowerOptionBlocksHighVoltageBias, true);
  assert.equal(p.vsVm.VS.maximumSourceVoltageV, 20);
  assert.equal(p.vsVm.VM.sourceOutputSupported, false);
  assert.equal(p.accessories.PA.allowedHostFamily, 'SMU');
  assert.equal(p.accessories.RPM.allowedHostFamily, 'PMU');
  assert.equal(p.switchMatrix.CVIV.forbidDirectMainsConnection, true);
  assert.equal(p.switchMatrix.CVIV.maximumVoltagePerSignalPathV, 210);
  assert.equal(p.switchMatrix.CVIV.biasTeeModes.biasTSmuCvHiLo.maximumDcCurrentA, 1);
  assert.equal(p.switchMatrix.CVIV.biasTeeModes.biasTSmuLoICvHiLo.maximumDcCurrentA, 1e-4);
  assert.equal(p.switchMatrix.CVIV.specialDifferentialMode.maximumDifferentialVoltageV, 400);
  assert.equal(p.switchMatrix.CVIV.specialDifferentialMode.requiresThreeSynchronizedSmuChannels, true);
  assert.equal(p.switchMatrix.CVIV.specialDifferentialMode.packagedDevicesOnly, true);
  assert.equal(caps.DATABASE.modules.CVIV.specialDifferentialMode.waferLevelAllowed, false);
  assert.equal(p.groundUnit.GNDU.doNotUseAsVoltageSource, true);
  const unknownCvu = caps.getCvuCapabilities(null, { powerOptionRequested: true });
  assert.equal(unknownCvu.known, false);
  assert.equal(unknownCvu.powerOption, null);
  const unverifiedPower = caps.getCvuCapabilities('4215-CVU', { powerOptionRequested: true });
  assert.equal(unverifiedPower.powerOptionStatus, 'requested-but-not-verified-by-inventory');
  assert.equal(unverifiedPower.highVoltageBiasAllowed, false);
  assert.equal(unverifiedPower.powerOption, null);
  const callerClaim = caps.getCvuCapabilities('4215-CVU', { powerOptionRequested: true, powerOptionVerified: true });
  assert.equal(callerClaim.powerOptionStatus, 'requested-but-not-verified-by-inventory');
  assert.equal(callerClaim.highVoltageBiasAllowed, false);
  assert.equal(callerClaim.powerOption, null);
  const verifiedPower = caps.getCvuCapabilities('4215-CVU', {
    powerOptionRequested: true,
    inventory: { hardwareLimitsVerified: true, verifiedOptions: ['4200-CVU-PWR'] }
  });
  assert.equal(verifiedPower.powerOptionStatus, 'verified');
  assert.equal(verifiedPower.highVoltageBiasAllowed, true);
  assert.equal(verifiedPower.powerOption.differentialMaxV, 400);
});

test('every capability and safety-policy source reference resolves to an exported manufacturer source', () => {
  const ids = new Set(caps.DATABASE.sources.map(source => source.id));
  const visit = (value, path = 'DATABASE') => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === 'sourceRefs') {
        for (const id of child) assert.equal(ids.has(id), true, path + ' references missing source ' + id);
      } else visit(child, path + '.' + key);
    }
  };
  visit(caps.DATABASE);
  for (const [name, module] of Object.entries(caps.DATABASE.modules)) {
    assert.ok(Array.isArray(module.sourceRefs) && module.sourceRefs.length, name + ' must cite its manufacturer source records');
  }
});
