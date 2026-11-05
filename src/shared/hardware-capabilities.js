(() => {
  'use strict';
  const DATABASE = {
    schema: 'dkts.4200a.hardware-capabilities.v1',
    databaseVersion: '1.1.0',
    generatedAt: '2026-11-05',
    instrument: { family: 'Keithley 4200A-SCS', maxChassisPowerW: 500, kxciInventorySlots: 8, maxKxciSmuChannelNumber: 9 },
    inventoryDiscovery: {
      logicalInventoryCommand: '*OPT?',
      physicalCardInfoSequence: ['UL','EX SystemUtil instrumentinfo(,4096,)','GN result','DE'],
      remoteModuleInfoSequence: ['UL','EX SystemUtil remotemoduleinfo(,4096,)','GN result','DE'],
      notes: [
        '*OPT? reports the KXCI category: medium/high-power SMU, PA presence, PMU/RPM channel assignment, VPU/PGU, CVU, VS, and VM. It does not distinguish 4200/4201 or 4210/4211 model variants.',
        'SystemUtil instrumentinfo returns physical card model, serial, hardware/firmware versions, and calibration dates.',
        'SystemUtil remotemoduleinfo returns the attached 4200-PA and 4225-RPM physical identities.'
      ]
    },
    sources: [
      { id: 'tek-4200a-datasheet-2026', title: '4200A-SCS Parameter Analyzer Technical Data', revision: '1KW-60780-7', published: '2026-10-22', url: 'https://www.tek.com.cn/datasheet/4200a-scs-parameter-analyzer', authority: 'manufacturer' },
      { id: 'tek-4200a-kxci-rev-e', title: 'Model 4200A-SCS KXCI Remote Control Programming', revision: '4200A-KXCI-907-01 Rev. E', published: '2025-03', url: 'https://download.tek.com/manual/4200A-KXCI-907-01E_March2025.pdf', authority: 'manufacturer' },
      { id: 'tek-4200a-pmu-rev-c', title: 'Model 4200A-SCS Pulse Card (PGU and PMU) User Manual', revision: '4200A-PMU-900-01 Rev. C', published: '2024-05', url: 'https://download.tek.com/manual/4200A-PMU-900-01C_May31_2024.pdf', authority: 'manufacturer' },
      { id: 'tek-4200a-setup-rev-f', title: 'Model 4200A-SCS Setup and Maintenance', revision: '4200A-908-01 Rev. F', published: '2025-03', url: 'https://download.tek.com/manual/4200A-908-01F_Setup_Maint_March_2025.pdf', authority: 'manufacturer' },
      { id: 'tek-4200a-cvu-rev-b', title: 'Model 4200A-SCS CVU User Manual', revision: '4200A-CVU-900-01 Rev. B', published: '2023-03', url: 'https://download.tek.com/manual/4200A-CVU-900-01B_March_2023.pdf', authority: 'manufacturer' },
      { id: 'tek-4200a-current-manual-index', title: 'Tektronix 4200A-SCS manuals and software download index', revision: 'Current index checked 2026-11-05', url: 'https://www.tek.com/en/support/datasheets-manuals-software-downloads?model=4200A-SCS', authority: 'manufacturer' },
      { id: 'tek-4200-cvu-pwr-rev-f', title: 'Model 4200-CVU-PWR Parts Package Instruction Sheet', revision: 'PA-977 Rev. F', published: '2023-06-21', url: 'https://www.tek.com/en/manual/model-4200-cvu-pwr-parts-package', authority: 'manufacturer' },
      { id: 'tek-4200-cvu-pwr-appnote', title: 'Using the 4200-CVU-PWR C-V Power Package for High Voltage and High Current C-V Measurements', revision: 'Application Note', published: '2020-04-06', url: 'https://download.tek.com/document/1KW606370MakingHighVoltageHighCurrentCV%20Measurements4200ASCS4200CVUPWRApplicationNote040620.pdf', authority: 'manufacturer' }
    ],
    chassisPower: {
      maximumW: 500, formula: 'Ptotal = Pidle + Ptest',
      idleW: { pguCard: 29.4, pmuCard: 50.4, rpmModule: 4.2 },
      testW: { highPowerSmu: 45, pmuOrPguChannel10V: 8.4, pmuOrPguChannel40V: 54.6 },
      notes: ['KXCI manual system power calculation.', 'Only calculate a definite budget when installed inventory and active channels are known.', 'Unknown modules must not be assigned zero power.'],
      sourceRefs: ['tek-4200a-kxci-rev-e']
    },
    modules: {
      SMU: {
        type: 'SMU', family: 'SMU', role: 'source-measure', verificationStatus: 'documented',
        modelAliases: ['4200-SMU', '4201-SMU'], powerClass: 'medium', preamplifier: false,
        electrical: {
          nominalMaxSourceVoltageV: 200, maxSourceVoltageV: 210, ratedMaxCurrentA: 0.1, overrangeMaxCurrentA: 0.105,
          ratedMaxPowerW: 2.1, setupManualMaxPowerW: 2.2,
          voltageRanges: [
            { nominalV: 200, maxAbsV: 210, maxComplianceA: 0.0105, requiresInterlock: true },
            { nominalV: 20, maxAbsV: 21, maxComplianceA: 0.105, requiresInterlock: false },
            { nominalV: 2, maxAbsV: 2.1, maxComplianceA: 0.105, requiresInterlock: false },
            { nominalV: 0.2, maxAbsV: 0.21, maxComplianceA: 0.105, requiresInterlock: false }
          ],
          minComplianceA: 1e-7, currentRangesA: [1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1],
          complianceMinFractionOfRange: 0.1, rangeOverrangeFactor: 1.05
        },
        kxci: { maxListPoints: 4096, delayMinS: 0, delayMaxS: 6.553, itIntervalMinS: 0.01, itIntervalMaxS: 10 },
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-setup-rev-f']
      },
      SMUPA: {
        type: 'SMUPA', family: 'SMU', role: 'source-measure', verificationStatus: 'documented',
        modelAliases: ['4200-SMU + 4200-PA', '4201-SMU + 4200-PA'], powerClass: 'medium', preamplifier: true,
        electrical: {
          nominalMaxSourceVoltageV: 200, maxSourceVoltageV: 210, ratedMaxCurrentA: 0.1, overrangeMaxCurrentA: 0.105,
          ratedMaxPowerW: 2.1, setupManualMaxPowerW: 2.2,
          voltageRanges: [
            { nominalV: 200, maxAbsV: 210, maxComplianceA: 0.0105, requiresInterlock: true },
            { nominalV: 20, maxAbsV: 21, maxComplianceA: 0.105, requiresInterlock: false },
            { nominalV: 2, maxAbsV: 2.1, maxComplianceA: 0.105, requiresInterlock: false },
            { nominalV: 0.2, maxAbsV: 0.21, maxComplianceA: 0.105, requiresInterlock: false }
          ],
          minComplianceA: 1e-10, currentRangesA: [1e-12, 1e-11, 1e-10, 1e-9, 1e-8, 1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1],
          complianceMinFractionOfRange: 0.1, rangeOverrangeFactor: 1.05
        },
        kxci: { maxListPoints: 4096, delayMinS: 0, delayMaxS: 6.553, itIntervalMinS: 0.01, itIntervalMaxS: 10 },
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-setup-rev-f']
      },
      HPSMU: {
        type: 'HPSMU', family: 'SMU', role: 'source-measure', verificationStatus: 'documented',
        modelAliases: ['4210-SMU', '4211-SMU'], powerClass: 'high', preamplifier: false,
        electrical: {
          nominalMaxSourceVoltageV: 200, maxSourceVoltageV: 210, ratedMaxCurrentA: 1, overrangeMaxCurrentA: 1.05,
          ratedMaxPowerW: 21, setupManualMaxPowerW: 22,
          voltageRanges: [
            { nominalV: 200, maxAbsV: 210, maxComplianceA: 0.105, requiresInterlock: true },
            { nominalV: 20, maxAbsV: 21, maxComplianceA: 1.05, requiresInterlock: false },
            { nominalV: 2, maxAbsV: 2.1, maxComplianceA: 1.05, requiresInterlock: false },
            { nominalV: 0.2, maxAbsV: 0.21, maxComplianceA: 1.05, requiresInterlock: false }
          ],
          minComplianceA: 1e-7, currentRangesA: [1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1],
          complianceMinFractionOfRange: 0.1, rangeOverrangeFactor: 1.05
        },
        kxci: { maxListPoints: 4096, delayMinS: 0, delayMaxS: 6.553, itIntervalMinS: 0.01, itIntervalMaxS: 10 },
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-setup-rev-f']
      },
      HPSMUPA: {
        type: 'HPSMUPA', family: 'SMU', role: 'source-measure', verificationStatus: 'documented',
        modelAliases: ['4210-SMU + 4200-PA', '4211-SMU + 4200-PA'], powerClass: 'high', preamplifier: true,
        electrical: {
          nominalMaxSourceVoltageV: 200, maxSourceVoltageV: 210, ratedMaxCurrentA: 1, overrangeMaxCurrentA: 1.05,
          ratedMaxPowerW: 21, setupManualMaxPowerW: 22,
          voltageRanges: [
            { nominalV: 200, maxAbsV: 210, maxComplianceA: 0.105, requiresInterlock: true },
            { nominalV: 20, maxAbsV: 21, maxComplianceA: 1.05, requiresInterlock: false },
            { nominalV: 2, maxAbsV: 2.1, maxComplianceA: 1.05, requiresInterlock: false },
            { nominalV: 0.2, maxAbsV: 0.21, maxComplianceA: 1.05, requiresInterlock: false }
          ],
          minComplianceA: 1e-10, currentRangesA: [1e-12, 1e-11, 1e-10, 1e-9, 1e-8, 1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1],
          complianceMinFractionOfRange: 0.1, rangeOverrangeFactor: 1.05
        },
        kxci: { maxListPoints: 4096, delayMinS: 0, delayMaxS: 6.553, itIntervalMinS: 0.01, itIntervalMaxS: 10 },
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-setup-rev-f']
      },
      PMU: {
        type: 'PMU', family: 'PMU', role: 'pulse-source-and-measure', verificationStatus: 'documented', modelAliases: ['4225-PMU'], channelsPerCard: 2,
        output: { rangesV: [10, 40], sourceImpedanceOhm: 50, loadOhms: { min: 1, max: 1000000 }, maxShortCircuitCurrentA: { '10': 0.2, '40': 0.8 }, loadLine: 'Imax = Vrange / (50 Ω + Rload); Vmax = Imax × Rload' },
        segmentArb: { minSegmentsPerSequence: 3, maxSegmentsPerChannel: 2048, maxSequencesPerChannel: 512, maxSegmentsPerCommand: 128, maxSequenceLoops: 1e12, timeResolutionS: 1e-8, maxSegmentTimeS: 40, kxciMaxSegmentTimeS: 1, minSegmentTimeS: { '10': 2e-8, '40': 5e-8 } },
        kxciPulseTiming: { '10': { periodMinS: 6e-8, periodMaxS: 1, pulseWidthMinS: 4e-8, transitionMinS: 2e-8, transitionMaxS: 33e-3, delayMinS: 0, delayStepS: 2e-8, minOffTimeS: 4e-8 }, '40': { periodMinS: 5e-7, periodMaxS: 1, pulseWidthMinS: 2.5e-7, transitionMinS: 5e-8, transitionMaxS: 33e-3, delayMinS: 0, delayStepS: 5e-8, minOffTimeS: 4e-8 } },
        pulseTiming: {
          '10': { sourceOnly: { periodMinS: 2e-8, periodMaxS: 1, pulseWidthMinS: 1e-8, transitionMinS: 1e-8, maxFrequencyHz: 5e7 }, withMeasurement: { periodMinS: 1.2e-7, periodMaxS: 1, pulseWidthMinS: 6e-8, transitionMinS: 2e-8, maxFrequencyHz: 8.3e6 } },
          '40': { sourceOnly: { periodMinS: 1e-7, periodMaxS: 1, pulseWidthMinS: 5e-8, transitionMinS: 3e-8, maxFrequencyHz: 1e7 }, withMeasurement: { periodMinS: 2.8e-7, periodMaxS: 1, pulseWidthMinS: 1.4e-7, transitionMinS: 1e-7, maxFrequencyHz: 3.5e6 } }
        },
        measurement: {
          currentRangesA: { '10': [1e-2, 2e-1], '40': [1e-4, 1e-2, 8e-1] },
          withRpmCurrentRangesA: { '10': [1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 2e-1], '40': [1e-4, 1e-2, 8e-1] },
          maxSampleRateHz: 2e8, minSampleRateHz: 1e3, maxKxciBufferPointsPerChannel: 65536, maxHardwareSamplesPerChannel: 1000000
        },
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-pmu-rev-c']
      },
      PMURPM: {
        type: 'PMURPM', family: 'PMU', role: 'pulse-source-and-measure-with-rpm', verificationStatus: 'documented',
        modelAliases: ['4225-PMU + 4225-RPM'], channelsPerCard: 2, hasRpm: true,
        output: { rangesV: [10, 40], sourceImpedanceOhm: 50, loadOhms: { min: 1, max: 1000000 }, maxShortCircuitCurrentA: { '10': 0.2, '40': 0.8 }, loadLine: 'Imax = Vrange / (50 Ω + Rload); Vmax = Imax × Rload' },
        segmentArb: { minSegmentsPerSequence: 3, maxSegmentsPerChannel: 2048, maxSequencesPerChannel: 512, maxSegmentsPerCommand: 128, maxSequenceLoops: 1e12, timeResolutionS: 1e-8, maxSegmentTimeS: 40, kxciMaxSegmentTimeS: 1, minSegmentTimeS: { '10': 2e-8, '40': 5e-8 } },
        pulseTiming: {
          '10': { sourceOnly: { periodMinS: 2e-8, periodMaxS: 1, pulseWidthMinS: 1e-8, transitionMinS: 1e-8, maxFrequencyHz: 5e7 }, withMeasurement: { periodMinS: 1.2e-7, periodMaxS: 1, pulseWidthMinS: 6e-8, transitionMinS: 2e-8, maxFrequencyHz: 8.3e6 } },
          '40': { sourceOnly: { periodMinS: 1e-7, periodMaxS: 1, pulseWidthMinS: 5e-8, transitionMinS: 3e-8, maxFrequencyHz: 1e7 }, withMeasurement: { periodMinS: 2.8e-7, periodMaxS: 1, pulseWidthMinS: 1.4e-7, transitionMinS: 1e-7, maxFrequencyHz: 3.5e6 } }
        },
        measurement: {
          currentRangesA: { '10': [1e-2, 2e-1], '40': [1e-4, 1e-2, 8e-1] },
          withRpmCurrentRangesA: { '10': [1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 2e-1], '40': [1e-4, 1e-2, 8e-1] },
          minimumCurrentRangeA: 1e-7, currentMeasurementResolutionA: 2e-10,
          maxSampleRateHz: 2e8, minSampleRateHz: 1e3, maxKxciBufferPointsPerChannel: 65536, maxHardwareSamplesPerChannel: 1000000
        },
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-pmu-rev-c']
      },
      VPU: {
        type: 'VPU', family: 'PGU', role: 'pulse-generator-source-only', verificationStatus: 'documented', modelAliases: ['4220-PGU'], channelsPerCard: 2,
        kxciPulseTiming: { '10': { periodMinS: 2e-8, periodMaxS: 1, pulseWidthMinS: 1e-8, transitionMinS: 1e-8, transitionMaxS: 33e-3, delayMinS: 0, delayStepS: 1e-8, minOffTimeS: 4e-8 }, '40': { periodMinS: 5e-7, periodMaxS: 1, pulseWidthMinS: 2.5e-7, transitionMinS: 5e-8, transitionMaxS: 33e-3, delayMinS: 0, delayStepS: 5e-8, minOffTimeS: 4e-8 } },
        pulseTiming: {
          '10': { sourceOnly: { periodMinS: 2e-8, periodMaxS: 1, pulseWidthMinS: 1e-8, transitionMinS: 1e-8, maxFrequencyHz: 5e7 } },
          '40': { sourceOnly: { periodMinS: 1e-7, periodMaxS: 1, pulseWidthMinS: 5e-8, transitionMinS: 3e-8, transitionMinSAbove10V: 1e-7, transitionCondition: '输出幅值绝对值不超过10 V时为30 ns，超过10 V时为100 ns', maxFrequencyHz: 1e7 } }
        },
        output: { rangesV: [10, 40], sourceImpedanceOhm: 50, loadOhms: { min: 1, max: 1000000 }, maxShortCircuitCurrentA: { '10': 0.2, '40': 0.8 }, loadLine: 'Imax = Vrange / (50 Ω + Rload); Vmax = Imax × Rload' },
        segmentArb: { minSegmentsPerSequence: 3, maxSegmentsPerChannel: 2048, maxSequencesPerChannel: 512, timeResolutionS: 1e-8, maxSegmentTimeS: 40, kxciMaxSegmentTimeS: 1, minSegmentTimeS: { '10': 1e-8, '40': 5e-8 } },
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-pmu-rev-c']
      },
      CVU: {
        type: 'CVU', family: 'CVU', role: 'capacitance-voltage-measurement', verificationStatus: 'family-documented-variant-dependent',
        variants: {
          '4210-CVU': { frequencyHz: { min: 1000, max: 10000000 }, frequencyResolutionHz: 1000, acDriveVrms: { min: 0.01, max: 0.1 }, dcBiasV: { min: -30, max: 30 }, maxDcCurrentA: 0.01, maxMeasurementPoints: 4096, sourceImpedanceOhm: 100 },
          '4215-CVU': { frequencyHz: { min: 1000, max: 10000000 }, frequencyResolutionHz: 1000, acDriveVrms: { min: 0.01, max: 1 }, dcBiasV: { min: -30, max: 30 }, maxDcCurrentA: 0.01, maxMeasurementPoints: 4096, sourceImpedanceOhm: 100 }
        },
        common: { frequencyHz: { min: 1000, max: 10000000 }, dcBiasV: { min: -30, max: 30 }, maxDcCurrentA: 0.01, maxMeasurementPoints: 4096 },
        optionalPowerModule: { name: '4200-CVU-PWR', differentialMaxV: 400, maxAbsBiasV: 200, maxDcCurrentAByBiasSmu: { mediumPowerSmu: 0.1, highPowerSmu: 0.3 }, requiresBiasSmu: true, biasSmuChannelsFor200V: 1, biasSmuChannelsFor400VDifferential: 2, requiresExplicitOptionIdentification: true, sourceRefs: ['tek-4200-cvu-pwr-rev-f','tek-4200-cvu-pwr-appnote'] },
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-cvu-rev-b']
      },
      VS: { type: 'VS', family: 'VS', role: 'voltage-source-only', verificationStatus: 'role-only', kxci: { maxSupportedVoltageV: 20, physicalSmuBindingRequired: true }, sourceRefs: ['tek-4200a-kxci-rev-e'] },
      VM: { type: 'VM', family: 'VM', role: 'voltage-meter-only', verificationStatus: 'role-only', measurement: { nominalMaxVoltageV: 200, maxAbsVoltageV: 210, inputImpedanceOhm: 1e13, inputLeakageA: 30e-12 }, sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e'] },
      RPM: { type: 'RPM', family: 'RPM', role: 'low-current-measurement-accessory', verificationStatus: 'documented', measurement: { lowestCurrentRangeA: 1e-7, currentMeasurementResolutionA: 2e-10 }, sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e'] },
      PA: { type: 'PA', family: 'SMU-accessory', role: 'low-current-preamplifier', verificationStatus: 'documented', measurement: { lowestCurrentRangeA: 1e-12, currentMeasurementResolutionA: 1e-17 }, sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e'] },
      CVIV: { type: 'CVIV', family: 'switch-matrix', role: 'signal-routing-only', verificationStatus: 'documented', channels: 4, maxVoltageV: 210, maxCurrentA: 1, independentSource: false, sourceRefs: ['tek-4200a-datasheet-2026'] },
      GNDU: { type: 'GNDU', family: 'ground-unit', role: 'built-in-ground-unit', verificationStatus: 'documented', currentA: { dualMiniTriax: 2.6, bindingPosts: 9.5 }, independentSource: false, sourceRefs: ['tek-4200a-datasheet-2026'] }
    },
    safetyPolicies: {
      unknownModule: { applyGuessedNumericLimit: false, allowNonExecutablePlanning: true, allowHardwareOutput: false, requiredAction: 'Identify the exact installed module or mapped channel before enabling output.' },
      smu: { maximumSourceVoltageV: 210, voltageRangeOverrangePercent: 105, highVoltageNominalRangeV: 200, interlockRequiredFor200VRange: true, interlockStatusAvailableThroughCurrentReadOnlyBridge: false, complianceMinimumA: { withoutPreamplifier: 1e-7, withPreamplifier: 1e-10 }, note: 'Reject a compliance request below the KXCI minimum instead of allowing KXCI to silently raise it.' },
      pulse: { allowedVoltageRangesV: [10, 40], sourceImpedanceOhm: 50, requireDutAndInterconnectLoad: true, maxLoadOhms: 1000000, requireAtLeastThreeSegmentsForSegmentArb: true, segmentArbTimeResolutionS: 1e-8, hardwareMaxSegmentTimeS: 40, currentKxciCommandMaxSegmentTimeS: 1, hardwareMaxSamplesPerChannel: 1000000, currentKxciBufferPointsPerChannel: 65536 },
      chassis: { maximumPowerW: 500, blockPlanIfCompletePowerBudgetExceeded: true, doNotAssumeUnknownModulesConsumeZeroPower: true },
      dataProvenance: { callerSuppliedArraysAreRawInstrumentData: false, rawDataRequiresTrustedAcquisitionReceipt: true, currentBuildHasTrustedAcquisitionExecutor: false },
      execution: { allOutputCommandsDisabled: true, allowedKxciCommands: ['*IDN?', '*OPT?', 'UL', 'EX SystemUtil instrumentinfo(,4096,)', 'GN result', 'EX SystemUtil remotemoduleinfo(,4096,)', 'GN result', 'DE'], requireSingleInstrumentLease: true, requireFailClosedOnDisconnect: true, requireEmergencyStop: true }
    }
  };
  function deepFreeze(value) { if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value; for (const child of Object.values(value)) deepFreeze(child); return Object.freeze(value); }
  deepFreeze(DATABASE);
  function getModuleCapability(type) { return DATABASE.modules[String(type || '').toUpperCase()] || null; }
  function getSmuLimits(slot, voltageV, requestedComplianceA) {
    if (!slot || slot.family !== 'SMU') return { known: false, reason: 'SMU channel not identified' };
    const physicalType = slot.physicalType || (slot.ratingsVerified === true ? slot.type : (slot.physicalIdentityVerified === false ? null : slot.type));
    const mod = getModuleCapability(physicalType);
    if (!mod || mod.family !== 'SMU' || !mod.electrical) return { known: false, moduleType: physicalType || null, maxAbsVoltageV: 210, maxComplianceA: null, minComplianceA: null, reason: '物理 SMU 型号尚未由 instrumentinfo 确认，不能猜测中功率/高功率额定值' };
    const absV = Math.abs(Number(voltageV));
    if (!Number.isFinite(absV)) throw Error('SMU 电压不是有限数值');
    const range = mod.electrical.voltageRanges.filter(item => absV <= item.maxAbsV + 1e-12).sort((a,b) => a.maxAbsV - b.maxAbsV)[0];
    if (!range) throw Error('SMU 电压超过该模块 ±' + mod.electrical.maxSourceVoltageV + ' V 理论边界');
    const powerLimitedComplianceA = absV > 0 ? mod.electrical.ratedMaxPowerW / absV : Infinity;
    const maxComplianceA = Math.min(range.maxComplianceA, powerLimitedComplianceA);
    const result = {
      known: true, moduleType: mod.type, powerClass: mod.powerClass, preamplifier: mod.preamplifier,
      voltageRangeNominalV: range.nominalV, maxAbsVoltageV: range.maxAbsV, maxComplianceA,
      minComplianceA: mod.electrical.minComplianceA, requiresInterlock: range.requiresInterlock,
      ratedMaxPowerW: mod.electrical.ratedMaxPowerW, setupManualMaxPowerW: mod.electrical.setupManualMaxPowerW,
      powerLimitedComplianceA, availableCurrentRangesA: mod.electrical.currentRangesA.filter(r => r <= maxComplianceA + 1e-15)
    };
    if (requestedComplianceA !== undefined && requestedComplianceA !== null) {
      const current = Number(requestedComplianceA);
      if (!Number.isFinite(current) || current <= 0) throw Error('电流限值必须是大于 0 的有限数值');
      if (current < result.minComplianceA) throw Error('电流限值低于该 SMU/KXCI 最小值 ' + result.minComplianceA + ' A；不能让仪器静默提高限流值');
      if (current > result.maxComplianceA) throw Error('电流限值超过该 SMU 在当前电压档的理论上限 ' + result.maxComplianceA + ' A');
      const selected = result.availableCurrentRangesA.find(r => current <= r * mod.electrical.rangeOverrangeFactor + 1e-15 && current >= r * mod.electrical.complianceMinFractionOfRange - 1e-15);
      if (!selected) throw Error('当前电流限值无法映射到该 SMU 的有效电流量程');
      result.selectedCurrentRangeA = selected;
    } else result.selectedCurrentRangeA = null;
    return Object.freeze(result);
  }
  function getSourceLimits(slot, voltageV, requestedComplianceA) {
    if (!slot) return { known: false, reason: 'source channel not identified', maxAbsVoltageV: 210, maxComplianceA: null };
    if (slot.family === 'SMU') return getSmuLimits(slot, voltageV, requestedComplianceA);
    if (slot.family === 'VS') {
      const maxAbsVoltageV = getModuleCapability('VS').kxci.maxSupportedVoltageV;
      if (Math.abs(Number(voltageV)) > maxAbsVoltageV) throw Error('KXCI VS 通道当前支持的电压上限为 ±' + maxAbsVoltageV + ' V');
      const physicalType = slot.physicalType || (slot.physicalIdentityVerified === false ? null : slot.type);
      if (!physicalType) return Object.freeze({ known: false, moduleType: null, maxAbsVoltageV, maxComplianceA: null, minComplianceA: null, requiresInterlock: false, reason: 'VS 的物理 SMU 型号尚未由 instrumentinfo 确认' });
      const limits = getSmuLimits({ ...slot, type: physicalType, family: 'SMU', physicalIdentityVerified: true }, voltageV, requestedComplianceA);
      return Object.freeze({ ...limits, moduleType: physicalType, logicalRole: 'VS', maxAbsVoltageV: Math.min(maxAbsVoltageV, limits.maxAbsVoltageV || maxAbsVoltageV) });
    }
    throw Error('所选通道不是可用的 SMU/VS 电压源');
  }
  function getPulseOutputLimits(sourceType, rangeV, loadOhms) {
    const key = String(sourceType || '').toLowerCase() === 'pgu' ? 'VPU' : 'PMU';
    const mod = getModuleCapability(key), range = Number(rangeV), load = Number(loadOhms);
    if (!mod.output.rangesV.includes(range)) throw Error('PMU/PGU 输出量程只能选择 10 V 或 40 V');
    if (!Number.isFinite(load) || load < mod.output.loadOhms.min || load > mod.output.loadOhms.max) throw Error('PMU/PGU 必须填写 1 Ω 至 1 MΩ 的 DUT 与互连总负载阻值');
    const sourceImpedanceOhm = mod.output.sourceImpedanceOhm;
    const maxCurrentA = range / (sourceImpedanceOhm + load);
    return Object.freeze({ moduleType: key, rangeV: range, loadOhms: load, sourceImpedanceOhm, maxCurrentA, maxVoltageV: maxCurrentA * load, openCircuitVoltageV: range, shortCircuitCurrentA: mod.output.maxShortCircuitCurrentA[String(range)] });
  }
  function getSegmentArbLimits(sourceType, rangeV) {
    const key = String(sourceType || '').toLowerCase() === 'pgu' ? 'VPU' : 'PMU';
    const mod = getModuleCapability(key), range = Number(rangeV);
    if (!mod.output.rangesV.includes(range)) throw Error('PMU/PGU 输出量程只能选择 10 V 或 40 V');
    return Object.freeze({ minSegments: mod.segmentArb.minSegmentsPerSequence, maxSegments: mod.segmentArb.maxSegmentsPerChannel, maxSegmentsPerCommand: mod.segmentArb.maxSegmentsPerCommand || 128, maxSequences: mod.segmentArb.maxSequencesPerChannel, maxSequenceLoops: mod.segmentArb.maxSequenceLoops, minSegmentS: mod.segmentArb.minSegmentTimeS[String(range)], maxSegmentS: mod.segmentArb.maxSegmentTimeS, kxciMaxSegmentS: mod.segmentArb.kxciMaxSegmentTimeS || 1, timeResolutionS: mod.segmentArb.timeResolutionS });
  }
  function getPmuCurrentRanges(rangeV, withRpm = false) {
    const mod = getModuleCapability(withRpm ? 'PMURPM' : 'PMU');
    const ranges = mod.measurement[withRpm ? 'withRpmCurrentRangesA' : 'currentRangesA'][String(Number(rangeV))];
    if (!ranges) throw Error('未定义该 PMU 电压档的电流测量量程');
    return [...ranges];
  }
  function getPmuCaptureBudget(durationS, measureWindowS, requestedRateHz) {
    const mod = getModuleCapability('PMU'), duration = Number(durationS);
    if (!Number.isFinite(duration) || duration <= 0) throw Error('PMU 采集时长必须大于 0');
    const hardwareMaxPoints = mod.measurement.maxHardwareSamplesPerChannel;
    const interfaceMaxPoints = mod.measurement.maxKxciBufferPointsPerChannel;
    const hardwareMaxRateHz = Math.min(mod.measurement.maxSampleRateHz, hardwareMaxPoints / duration);
    const kxciMaxRateHz = Math.min(mod.measurement.maxSampleRateHz, interfaceMaxPoints / duration);
    const minimumRateHz = mod.measurement.minSampleRateHz;
    if (hardwareMaxRateHz < minimumRateHz) throw Error('PMU 采集时长超过硬件单通道一百万采样点在最低采样率下的容量');
    let minimumRequiredRateHz = minimumRateHz;
    if (measureWindowS !== undefined && measureWindowS !== null) {
      const windowS = Number(measureWindowS);
      if (!Number.isFinite(windowS) || windowS <= 0) throw Error('PMU 测量窗口无效');
      minimumRequiredRateHz = Math.max(minimumRateHz, 1 / windowS);
    }
    if (minimumRequiredRateHz > hardwareMaxRateHz) throw Error('PMU 测量窗口与总采集时长超过硬件采样容量可同时满足的采样率范围');
    const selectedRateHz = requestedRateHz === undefined || requestedRateHz === null ? hardwareMaxRateHz : Number(requestedRateHz);
    if (!Number.isFinite(selectedRateHz) || selectedRateHz < minimumRequiredRateHz || selectedRateHz > hardwareMaxRateHz) throw Error('PMU 采样率必须在 ' + minimumRequiredRateHz + ' 至 ' + hardwareMaxRateHz + ' Sa/s 之间');
    const kxciCompatible = selectedRateHz <= kxciMaxRateHz + 1e-6 && selectedRateHz * duration <= interfaceMaxPoints + 1e-6;
    return Object.freeze({
      minSampleRateHz: minimumRequiredRateHz, maxSampleRateHz: hardwareMaxRateHz,
      selectedSampleRateHz: selectedRateHz, sampleIntervalS: 1 / selectedRateHz,
      maxPointsPerChannel: hardwareMaxPoints, hardwareMaxPointsPerChannel: hardwareMaxPoints,
      interfaceMaxPointsPerChannel: interfaceMaxPoints, kxciMaxSampleRateHz: kxciMaxRateHz,
      hardwareMaxSampleRateHz: mod.measurement.maxSampleRateHz, kxciCompatible,
      interface: 'KXCI', interfaceLimitation: kxciCompatible ? null : '当前 KXCI 数据缓冲上限为每通道 65536 点；硬件采集上限为每通道 1000000 点'
    });
  }
  function getPulseTimingRecommendation(rangeV, measurementRangeA, withMeasurement = true, source = 'pmu', withRpm = false, peakVoltageV = null) {
    const key = String(source || 'pmu').toLowerCase() === 'pgu' ? 'VPU' : 'PMU';
    const mod = getModuleCapability(key), range = String(Number(rangeV));
    const mode = withMeasurement ? 'withMeasurement' : 'sourceOnly';
    const timing = mod.pulseTiming?.[range]?.[mode];
    if (!timing) throw Error('没有该模块/电压档/测量模式的硬件脉冲时序规格');
    if (key === 'VPU' && withMeasurement) throw Error('4220-PGU/VPU 不具备电流测量功能');
    const peakAbs = peakVoltageV === null || peakVoltageV === undefined ? null : Math.abs(Number(peakVoltageV));
    if (peakAbs !== null && !Number.isFinite(peakAbs)) throw Error('脉冲峰值电压无效');
    let transitionMinS = timing.transitionMinS;
    let transitionSelection = 'fixed';
    if (timing.transitionMinSAbove10V !== undefined) {
      if (peakAbs === null) {
        transitionMinS = null;
        transitionSelection = 'requires-output-amplitude';
      } else {
        transitionMinS = peakAbs > 10 ? timing.transitionMinSAbove10V : timing.transitionMinS;
        transitionSelection = peakAbs > 10 ? 'above-10V' : 'at-or-below-10V';
      }
    }
    const recommendation = {
      ...timing, transitionMinS, transitionSelection, peakAbsVoltageV: peakAbs,
      source: 'tek-4200a-datasheet-2026', measurementEnabled: Boolean(withMeasurement),
      hardwareSpecification: true,
      kxciInterfaceTiming: mod.kxciPulseTiming?.[range] || null,
      kxciInterfaceSource: mod.kxciPulseTiming ? 'tek-4200a-kxci-rev-e' : null
    };
    if (measurementRangeA !== undefined && measurementRangeA !== null) {
      const current = Number(measurementRangeA);
      if (key !== 'PMU' || !getPmuCurrentRanges(Number(rangeV), Boolean(withRpm)).some(x => Math.abs(x - current) <= Math.max(1e-15, current * 1e-9))) throw Error('所选 PMU 电流量程与该电压档/前端模块不匹配');
      recommendation.measurementRangeA = current;
      recommendation.rpmEnabled = Boolean(withRpm);
    }
    return Object.freeze(recommendation);
  }
  function calculateChassisPower({ inventory, activeSmuChannels = [], activePulseChannels = [] } = {}) {
    if (!inventory || !Array.isArray(inventory.slots)) return Object.freeze({ known: false, reason: '模块清单尚未读取' });
    if (inventory.unknownModules?.length || inventory.unverifiedModules?.some(slot => ['SMU','VS','VM','PMU','PGU','unknown'].includes(slot.family))) return Object.freeze({ known: false, reason: '存在未确认物理型号的高功率相关模块，不能把其功耗按零计算' });
    const slots = inventory.slots.filter(slot => slot && slot.type && slot.type !== 'empty');
    if (slots.some(slot => slot.family === 'unknown' || (['SMU','VS','VM'].includes(slot.family) && (!slot.powerClass || slot.powerClass === 'unknown')))) return Object.freeze({ known: false, reason: '存在未确认物理 SMU 型号的通道，无法核算高功率 SMU 功耗' });
    if (slots.some(slot => slot.family === 'PMU' && !Number.isFinite(slot.rpmCount))) return Object.freeze({ known: false, reason: 'PMU/RPM 数量未能从 *OPT? 完整解析' });
    const nPgu = slots.filter(slot => slot.family === 'PGU').length;
    const nPmu = slots.filter(slot => slot.family === 'PMU').length;
    const nRpm = slots.filter(slot => slot.family === 'PMU').reduce((sum, slot) => sum + (slot.rpmCount || 0), 0);
    const activeMap = new Map();
    for (const item of activeSmuChannels) {
      const channel = Number(item && typeof item === 'object' ? item.channel : item);
      const family = item && typeof item === 'object' ? String(item.family || '') : '';
      if (Number.isInteger(channel)) activeMap.set((family || '*') + ':' + channel, { channel, family });
    }
    let nHighPowerSmu = 0;
    for (const activeChannel of activeMap.values()) {
      const channel=activeChannel.channel,family=activeChannel.family;
      const slot = slots.find(item => ['SMU','VS','VM'].includes(item.family) && item.channel === channel && (!family || item.family === family));
      if (!slot) return Object.freeze({ known: false, reason: '活动 SMU 通道 ' + (family ? family + channel : channel) + ' 未映射到已识别物理模块' });
      if (slot.powerClass === 'high') nHighPowerSmu++;
    }
    let nC10 = 0, nC40 = 0;
    for (const channel of activePulseChannels) {
      const family = channel.family === 'PGU' ? 'PGU' : 'PMU';
      const slot = slots.find(item => item.family === family && (!Number.isInteger(channel.cardIndex) || item.channel === channel.cardIndex));
      if (!slot) return Object.freeze({ known: false, reason: '活动脉冲通道未映射到已识别模块' });
      if (Number(channel.rangeV) === 10) nC10++;
      else if (Number(channel.rangeV) === 40) nC40++;
      else return Object.freeze({ known: false, reason: '活动脉冲通道量程无效' });
    }
    const idleW = nPgu * DATABASE.chassisPower.idleW.pguCard + nPmu * DATABASE.chassisPower.idleW.pmuCard + nRpm * DATABASE.chassisPower.idleW.rpmModule;
    const testW = nHighPowerSmu * DATABASE.chassisPower.testW.highPowerSmu + nC10 * DATABASE.chassisPower.testW.pmuOrPguChannel10V + nC40 * DATABASE.chassisPower.testW.pmuOrPguChannel40V;
    return Object.freeze({ known: true, nPGU: nPgu, nPMU: nPmu, nRPM: nRpm, nHPSMU: nHighPowerSmu, nC10, nC40, idleW, testW, totalW: idleW + testW, limitW: DATABASE.chassisPower.maximumW, withinLimit: idleW + testW <= DATABASE.chassisPower.maximumW });
  }
  function getCvuCapabilities(variant, powerOption = false) {
    const mod = getModuleCapability('CVU'), key = String(variant || '').toUpperCase();
    if (!Object.hasOwn(mod.variants, key)) return Object.freeze({ known: false, variantRequired: true, common: mod.common, reason: 'KXCI *OPT? 只报告 CVU，不能区分 4210-CVU 与 4215-CVU' });
    return Object.freeze({ known: true, variant: key, ...mod.variants[key], powerOption: powerOption ? mod.optionalPowerModule : null });
  }
  function exportDatabase() { return JSON.parse(JSON.stringify(DATABASE)); }
  const api = Object.freeze({ DATABASE, exportDatabase, getModuleCapability, getSmuLimits, getSourceLimits, getPulseOutputLimits, getSegmentArbLimits, getPmuCurrentRanges, getPmuCaptureBudget, getPulseTimingRecommendation, calculateChassisPower, getCvuCapabilities });
  if (typeof window !== 'undefined') {
    window.DKTSHardwareCapabilities = api;
    if (window.DKDSPluginModules) window.DKDSPluginModules.define('com.dkds.keithley-4200', 'dkts-capabilities', api);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();