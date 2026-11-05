(() => {
  'use strict';
  const DATABASE = {
    schema: 'dkts.4200a.hardware-capabilities.v1',
    databaseVersion: '1.7.1',
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
      { id: 'tek-4200a-cviv-rev-e', title: 'Model 4200A-CVIV Multi-Switch User Manual', revision: '4200A-CVIV-900-01 Rev. E', published: '2020-12', url: 'https://www.tek.com/-/media/documents/4200a-cviv-900-01e_december2020.pdf', authority: 'manufacturer' },
      { id: 'tek-4200a-cviv-400v-appnote', title: 'Making Three-Terminal Capacitance-Voltage Measurements Up to 400 V Using the 4200A-CVIV Multi-Switch Bias Tee Capability', revision: '1KW-61529-1', published: '2020-12-15', url: 'https://download.tek.com/document/1KW-61529-1_Making_3-Terminal_C-V_Measurements_up_to_400V_4200A-CVIV_Application_Note_111320.pdf', authority: 'manufacturer' },
      { id: 'tek-4200a-current-manual-index', title: 'Tektronix 4200A-SCS manuals and software download index', revision: 'Current index checked 2026-11-05', observedManualRevisions: { PMU: { partNumber: '4200A-PMU-900-01D', published: '2026-10-22', contentRetrieved: false }, KXCI: { partNumber: '4200A-KXCI-907-01F', published: '2026-10-09', contentRetrieved: false }, LPT: { partNumber: '4200A-LPT-907-01E', published: '2026-10-09', contentRetrieved: false }, Clarius: { partNumber: '4200A-914-01G', published: '2026-10-09', contentRetrieved: false }, Setup: { partNumber: '4200A-908-01G', published: '2025-07-03', contentRetrieved: false }, CVIV: { partNumber: '4200A-CVIV-900-01F', published: '2025-04-30', contentRetrieved: false }, CVU: { partNumber: '4200A-CVU-900-01B', published: '2023-03-31', contentRetrieved: false } }, indexObservationCheckedAt: '2026-11-05', indexConflicts: { PMU: { openedModelSupportPage: { partNumber: '4200A-PMU-900-01C', published: '2024-06-07' }, searchIndexedSupportListing: { partNumber: '4200A-PMU-900-01D', published: '2026-10-22' }, manualSpecificListing: { partNumber: '4200A-PMU-900-01D', published: '2026-10-22' }, status: 'inconsistent-official-listings', resolution: 'The opened model-specific support page body still lists Rev C, while the search-indexed listing and manual-specific listing show Rev D. Rev D content has not been retrieved; numerical PMU limits remain grounded in the accessible Rev C manual until Rev D is compared.' } }, additionalObservationUrls: ['https://www.tek.com/en/manual/parametric-analyzer/model-4200a-scs-pulse-card-pgu-and-pmu-users-manual-4200a-scs-parameter-analyzer'], url: 'https://www.tek.com/en/support/datasheets-manuals-software-downloads?model=4200A-SCS', authority: 'manufacturer' },
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
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-setup-rev-f', 'tek-4200a-current-manual-index']
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
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-setup-rev-f', 'tek-4200a-current-manual-index']
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
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-setup-rev-f', 'tek-4200a-current-manual-index']
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
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-setup-rev-f', 'tek-4200a-current-manual-index']
      },
      PMU: {
        type: 'PMU', family: 'PMU', role: 'pulse-source-and-measure', verificationStatus: 'documented', modelAliases: ['4225-PMU'], channelsPerCard: 2,
        output: { rangesV: [10, 40], sourceImpedanceOhm: 50, loadOhms: { min: 1, max: 1000000 }, maxShortCircuitCurrentA: { '10': 0.2, '40': 0.8 }, loadLine: 'Imax = Vrange / (50 Ω + Rload); Vmax = Imax × Rload' },
        segmentArb: { minSegmentsPerSequence: 3, maxSegmentsPerChannel: 2048, maxSequencesPerChannel: 512, kxciMaxArrayValuesPerCommand: 128, maxSequenceLoops: 1e12, timeResolutionS: 1e-8, maxSegmentTimeS: 40, kxciMaxSegmentTimeS: 1, minSegmentTimeS: { '10': 2e-8, '40': 2e-8 }, kxciMinSegmentTimeS: { '10': 2e-8, '40': 5e-8 } },
        kxciPulseTiming: { '10': { periodMinS: 6e-8, periodMaxS: 1, pulseWidthMinS: 4e-8, transitionMinS: 2e-8, transitionMaxS: 33e-3, delayMinS: 0, delayStepS: 2e-8, minOffTimeS: 4e-8 }, '40': { periodMinS: 5e-7, periodMaxS: 1, pulseWidthMinS: 2.5e-7, transitionMinS: 5e-8, transitionMaxS: 33e-3, delayMinS: 0, delayStepS: 5e-8, minOffTimeS: 4e-8 } },
        pulseTiming: {
          '10': { sourceOnly: { periodMinS: 2e-8, periodMaxS: 1, pulseWidthMinS: 1e-8, transitionMinS: 1e-8, maxFrequencyHz: 5e7 }, withMeasurement: { periodMinS: 1.2e-7, periodMaxS: 1, pulseWidthMinS: 6e-8, transitionMinS: 2e-8, maxFrequencyHz: 8.3e6 } },
          '40': { sourceOnly: { periodMinS: 1e-7, periodMaxS: 1, pulseWidthMinS: 5e-8, transitionMinS: 3e-8, transitionMinSAbove10V: 1e-7, transitionCondition: '输出幅值绝对值小于10 V时为30 ns，大于10 V时为100 ns；恰为10 V时手册未明确', maxFrequencyHz: 1e7 }, withMeasurement: { periodMinS: 2.8e-7, periodMaxS: 1, pulseWidthMinS: 1.4e-7, transitionMinS: 1e-7, maxFrequencyHz: 3.5e6 } }
        },
        typicalTimingByCurrentRangeA: {
          '10': {
            '1e-7': { recommendedMinPulseWidthS: 134e-6, recommendedMinTransitionS: 1e-6, typical: true, measurementFrontEnd: 'RPM' },
            '1e-6': { recommendedMinPulseWidthS: 20.4e-6, recommendedMinTransitionS: 360e-9, typical: true, measurementFrontEnd: 'RPM' },
            '1e-5': { recommendedMinPulseWidthS: 8.36e-6, recommendedMinTransitionS: 360e-9, typical: true, measurementFrontEnd: 'RPM' },
            '1e-4': { recommendedMinPulseWidthS: 1.04e-6, recommendedMinTransitionS: 40e-9, typical: true, measurementFrontEnd: 'RPM' },
            '1e-3': { recommendedMinPulseWidthS: 370e-9, recommendedMinTransitionS: 30e-9, typical: true, measurementFrontEnd: 'RPM' },
            '1e-2': { recommendedMinPulseWidthS: 160e-9, recommendedMinTransitionS: 20e-9, typical: true, measurementFrontEnd: 'PMU/RPM' },
            '2e-1': { recommendedMinPulseWidthS: 70e-9, recommendedMinTransitionS: 20e-9, typical: true, measurementFrontEnd: 'PMU' }
          },
          '40': {
            '1e-4': { recommendedMinPulseWidthS: 6.4e-6, recommendedMinTransitionS: 1e-6, typical: true, measurementFrontEnd: 'PMU' },
            '1e-2': { recommendedMinPulseWidthS: 770e-9, recommendedMinTransitionS: 100e-9, typical: true, measurementFrontEnd: 'PMU' },
            '8e-1': { recommendedMinPulseWidthS: 770e-9, recommendedMinTransitionS: 100e-9, typical: true, measurementFrontEnd: 'PMU' }
          }
        },
        typicalTimingNote: '原厂典型最小脉冲宽度及上升/下降时间建议，条件为空载。10 V 档 100 nA 至 1 mA 为 RPM 扩展量程，10 mA 同时属于 PMU 与 RPM 量程，200 mA 为 PMU 量程；40 V 档 100 µA、10 mA、800 mA 为 PMU 量程。实际 DUT、线缆和互连可能需要更长的稳定时间。该表不提供独立的测量窗口或稳定时间数值；这些典型建议不作为硬件绝对最小值或自动拒绝条件。',
        measurement: {
          currentRangesA: { '10': [1e-2, 2e-1], '40': [1e-4, 1e-2, 8e-1] },
          maxSampleRateHz: 2e8, minSampleRateHz: 1e3, maxClariusItmPointsPerChannel: 4096, maxClariusUtmPointsPerChannel: 65536, sampleCountFormula: 'measureWindowS × sampleRateHz × pulseCount × sweepPoints × stepPoints', maxKxciBufferPointsPerChannel: 65536, maxKxciGeneratedPointsPerChannel: 65536, kxciGeneratedPointBoundaryNote: 'Rev. E states generated points must be below 65536, but also defines fastestSampleRate = 65536 / TotalMeasureDuration and a 65536-point data buffer. Exact endpoint semantics are ambiguous; expose the documented 65536 capacity and flag this boundary rather than silently reducing it to 65535.', maxHardwareSamplesPerChannel: 999999, hardwareSampleCountUpperBoundExclusive: 1000000
        },
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-pmu-rev-c', 'tek-4200a-current-manual-index']
      },
      PMURPM: {
        type: 'PMURPM', family: 'PMU', role: 'pulse-source-and-measure-with-rpm', verificationStatus: 'documented',
        modelAliases: ['4225-PMU + 4225-RPM'], channelsPerCard: 2, hasRpm: true,
        output: { rangesV: [10, 40], sourceImpedanceOhm: 50, loadOhms: { min: 1, max: 1000000 }, maxShortCircuitCurrentA: { '10': 0.2, '40': 0.8 }, loadLine: 'Imax = Vrange / (50 Ω + Rload); Vmax = Imax × Rload' },
        segmentArb: { minSegmentsPerSequence: 3, maxSegmentsPerChannel: 2048, maxSequencesPerChannel: 512, kxciMaxArrayValuesPerCommand: 128, maxSequenceLoops: 1e12, timeResolutionS: 1e-8, maxSegmentTimeS: 40, kxciMaxSegmentTimeS: 1, minSegmentTimeS: { '10': 2e-8, '40': 2e-8 }, kxciMinSegmentTimeS: { '10': 2e-8, '40': 5e-8 } },
        kxciPulseTiming: { '10': { periodMinS: 6e-8, periodMaxS: 1, pulseWidthMinS: 4e-8, transitionMinS: 2e-8, transitionMaxS: 33e-3, delayMinS: 0, delayStepS: 2e-8, minOffTimeS: 4e-8 }, '40': { periodMinS: 5e-7, periodMaxS: 1, pulseWidthMinS: 2.5e-7, transitionMinS: 5e-8, transitionMaxS: 33e-3, delayMinS: 0, delayStepS: 5e-8, minOffTimeS: 4e-8 } },
        pulseTiming: {
          '10': { sourceOnly: { periodMinS: 2e-8, periodMaxS: 1, pulseWidthMinS: 1e-8, transitionMinS: 1e-8, maxFrequencyHz: 5e7 }, withMeasurement: { periodMinS: 1.2e-7, periodMaxS: 1, pulseWidthMinS: 6e-8, transitionMinS: 2e-8, maxFrequencyHz: 8.3e6 } },
          '40': { sourceOnly: { periodMinS: 1e-7, periodMaxS: 1, pulseWidthMinS: 5e-8, transitionMinS: 3e-8, transitionMinSAbove10V: 1e-7, transitionCondition: '输出幅值绝对值小于10 V时为30 ns，大于10 V时为100 ns；恰为10 V时手册未明确', maxFrequencyHz: 1e7 }, withMeasurement: { periodMinS: 2.8e-7, periodMaxS: 1, pulseWidthMinS: 1.4e-7, transitionMinS: 1e-7, maxFrequencyHz: 3.5e6 } }
        },
        measurement: {
          currentRangesA: { '10': [1e-2, 2e-1], '40': [1e-4, 1e-2, 8e-1] },
          withRpmCurrentRangesA: { '10': [1e-7, 1e-6, 1e-5, 1e-4, 1e-3, 1e-2, 2e-1], '40': [1e-4, 1e-2, 8e-1] },
          
          minimumCurrentRangeA: 1e-7, currentMeasurementResolutionA: 2e-10,
          maxSampleRateHz: 2e8, minSampleRateHz: 1e3, maxClariusItmPointsPerChannel: 4096, maxClariusUtmPointsPerChannel: 65536, sampleCountFormula: 'measureWindowS × sampleRateHz × pulseCount × sweepPoints × stepPoints', maxKxciBufferPointsPerChannel: 65536, maxKxciGeneratedPointsPerChannel: 65536, kxciGeneratedPointBoundaryNote: 'Rev. E states generated points must be below 65536, but also defines fastestSampleRate = 65536 / TotalMeasureDuration and a 65536-point data buffer. Exact endpoint semantics are ambiguous; expose the documented 65536 capacity and flag this boundary rather than silently reducing it to 65535.', maxHardwareSamplesPerChannel: 999999, hardwareSampleCountUpperBoundExclusive: 1000000
        },
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-pmu-rev-c', 'tek-4200a-current-manual-index']
      },
      VPU: {
        type: 'VPU', family: 'PGU', role: 'pulse-generator-source-only', verificationStatus: 'documented', modelAliases: ['4220-PGU'], channelsPerCard: 2,
        kxciPulseTiming: { '10': { periodMinS: 2e-8, periodMaxS: 1, pulseWidthMinS: 1e-8, transitionMinS: 1e-8, transitionMaxS: 33e-3, delayMinS: 0, delayStepS: 1e-8, minOffTimeS: 4e-8 }, '40': { periodMinS: 5e-7, periodMaxS: 1, pulseWidthMinS: 2.5e-7, transitionMinS: 5e-8, transitionMaxS: 33e-3, delayMinS: 0, delayStepS: 5e-8, minOffTimeS: 4e-8 } },
        pulseTiming: {
          '10': { sourceOnly: { periodMinS: 2e-8, periodMaxS: 1, pulseWidthMinS: 1e-8, transitionMinS: 1e-8, maxFrequencyHz: 5e7 } },
          '40': { sourceOnly: { periodMinS: 1e-7, periodMaxS: 1, pulseWidthMinS: 5e-8, transitionMinS: 3e-8, transitionMinSAbove10V: 1e-7, transitionCondition: '输出幅值绝对值小于10 V时为30 ns，大于10 V时为100 ns；恰为10 V时手册未明确', maxFrequencyHz: 1e7 } }
        },
        output: { rangesV: [10, 40], sourceImpedanceOhm: 50, loadOhms: { min: 1, max: 1000000 }, maxShortCircuitCurrentA: { '10': 0.2, '40': 0.8 }, loadLine: 'Imax = Vrange / (50 Ω + Rload); Vmax = Imax × Rload' },
        segmentArb: { minSegmentsPerSequence: 3, maxSegmentsPerChannel: 2048, maxSequencesPerChannel: 512, kxciMaxArrayValuesPerCommand: 128, maxSequenceLoops: 1e12, timeResolutionS: 1e-8, maxSegmentTimeS: 40, kxciMaxSegmentTimeS: 1, minSegmentTimeS: { '10': 1e-8, '40': 2e-8 }, kxciMinSegmentTimeS: { '10': 1e-8, '40': 5e-8 }, hardwareMinSegmentNote: 'PGU 10 V 的 KXCI Rev. E 量程专属条目明确列出 10 ns；同一命令参数表的通用说明及 4200A 数据表给出 20 ns。此处采用更具体的 PGU 10 V 条目作为规划边界，并保留该规格冲突供外部审查。' },
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-pmu-rev-c', 'tek-4200a-current-manual-index']
      },
      CVU: {
        type: 'CVU', family: 'CVU', role: 'capacitance-voltage-measurement', verificationStatus: 'family-documented-variant-dependent',
        variants: {
          '4210-CVU': { frequencyHz: { min: 1000, max: 10000000 }, frequencyResolutionHz: 1000, acDriveVrms: { min: 0.01, max: 0.1 }, dcBiasV: { min: -30, max: 30 }, maxDcCurrentA: 0.01, maxMeasurementPoints: 4096, sourceImpedanceOhm: 100 },
          '4215-CVU': { frequencyHz: { min: 1000, max: 10000000 }, frequencyResolutionHz: 1000, acDriveVrms: { min: 0.01, max: 1 }, dcBiasV: { min: -30, max: 30 }, maxDcCurrentA: 0.01, maxMeasurementPoints: 4096, sourceImpedanceOhm: 100 }
        },
        common: { frequencyHz: { min: 1000, max: 10000000 }, dcBiasV: { min: -30, max: 30 }, maxDcCurrentA: 0.01, maxMeasurementPoints: 4096 },
        optionalPowerModule: { name: '4200-CVU-PWR', differentialMaxV: 400, maxAbsBiasV: 200, maxDcCurrentAByBiasSmu: { mediumPowerSmu: 0.1, highPowerSmu: 0.3 }, requiresBiasSmu: true, biasSmuChannelsFor200V: 1, biasSmuChannelsFor400VDifferential: 2, requiresExplicitOptionIdentification: true, sourceRefs: ['tek-4200-cvu-pwr-rev-f','tek-4200-cvu-pwr-appnote'] },
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-cvu-rev-b', 'tek-4200a-current-manual-index']
      },
      VS: { type: 'VS', family: 'VS', role: 'voltage-source-only', verificationStatus: 'role-only', kxci: { maxSupportedVoltageV: 20, physicalSmuBindingRequired: true }, sourceRefs: ['tek-4200a-kxci-rev-e', 'tek-4200a-current-manual-index'] },
      VM: { type: 'VM', family: 'VM', role: 'voltage-meter-only', verificationStatus: 'role-only', measurement: { nominalMaxVoltageV: 200, maxAbsVoltageV: 210, inputImpedanceOhm: 1e13, inputLeakageA: 30e-12 }, sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-current-manual-index'] },
      RPM: { type: 'RPM', family: 'RPM', role: 'low-current-measurement-accessory', verificationStatus: 'documented', measurement: { lowestCurrentRangeA: 1e-7, currentMeasurementResolutionA: 2e-10 }, sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-current-manual-index'] },
      PA: { type: 'PA', family: 'SMU-accessory', role: 'low-current-preamplifier', verificationStatus: 'documented', measurement: { lowestCurrentRangeA: 1e-12, currentMeasurementResolutionA: 1e-17 }, sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-current-manual-index'] },
      CVIV: {
        type: 'CVIV', family: 'switch-matrix', role: 'signal-routing-only', verificationStatus: 'documented',
        channels: 4, maxVoltageV: 210, maxCurrentA: 1, independentSource: false,
        biasTeeModes: {
          biasTSmuCvHiLo: { maximumDcBiasV: 200, maximumDcCurrentA: 1 },
          biasTSmuLoICvHiLo: { maximumDcBiasV: 200, maximumDcCurrentA: 1e-4 },
          biasTSmuAcGnd: { maximumDcBiasV: 200 }
        },
        specialDifferentialMode: {
          maximumDifferentialVoltageV: 400, maximumAbsoluteVoltagePerPathV: 200,
          requiresThreeSynchronizedSmuChannels: true, packagedDevicesOnly: true,
          waferLevelAllowed: false, requiresVerifiedBiasTeeConfiguration: true,
          note: '400 V 为器件端差分电压，由三个 SMU 按指定 Bias Tee 接法同步输出实现，不是 CVIV 单通道可直接输出 400 V。'
        },
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-cviv-rev-e', 'tek-4200a-cviv-400v-appnote', 'tek-4200a-current-manual-index']
      },
      GNDU: { type: 'GNDU', family: 'ground-unit', role: 'built-in-ground-unit', verificationStatus: 'documented', currentA: { dualMiniTriax: 2.6, bindingPosts: 9.5 }, independentSource: false, sourceRefs: ['tek-4200a-datasheet-2026'] }
    },
    safetyPolicies: {
      unknownModule: { policyBasis: 'fail-closed software policy; no numeric hardware capability is inferred for unidentified modules', applyGuessedNumericLimit: false, allowNonExecutablePlanning: true, allowHardwareOutput: false, requiredAction: 'Identify the exact installed module or mapped channel before enabling output.' },
      smu: { maximumSourceVoltageV: 210, voltageRangeOverrangePercent: 105, highVoltageNominalRangeV: 200, maximumOutputPowerWByPowerClass: { medium: 2.1, high: 21 }, applyVoltageDependentCompliancePowerLimit: true, interlockRequiredFor200VRange: true, interlockStatusAvailableThroughCurrentReadOnlyBridge: false, sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-kxci-rev-e', 'tek-4200a-setup-rev-f', 'tek-4200a-current-manual-index'], complianceMinimumA: { withoutPreamplifier: 1e-7, withPreamplifier: 1e-10 }, note: 'Reject a compliance request below the KXCI minimum instead of allowing KXCI to silently raise it.' },
      pulse: { allowedVoltageRangesV: [10, 40], sourceImpedanceOhm: 50, requireDutAndInterconnectLoad: true, maxLoadOhms: 1000000, requireAtLeastThreeSegmentsForSegmentArb: true, segmentArbTimeResolutionS: 1e-8, hardwareMaxSegmentTimeS: 40, currentKxciMinSegmentTimeSByRangeS: { PMU: { '10': 2e-8, '40': 5e-8 }, PGU: { '10': 1e-8, '40': 5e-8 } }, currentKxciCommandMaxSegmentTimeS: 1, currentKxciMaxArrayValuesPerCommand: 128, hardwareMaxSamplesPerChannel: 999999, hardwareSampleCountUpperBoundExclusive: 1000000, currentKxciBufferPointsPerChannel: 65536, currentKxciMaxGeneratedPointsPerChannel: 65536, clariusItmMaxPointsPerChannel: 4096, clariusUtmMaxPointsPerChannel: 65536, hardwareSampleCountFormula: 'measureWindowS × sampleRateHz × pulseCount × sweepPoints × stepPoints', kxciGeneratedPointBoundaryNote: 'Rev. E states generated points must be below 65536, but also defines fastestSampleRate = 65536 / TotalMeasureDuration and a 65536-point data buffer. Exact endpoint semantics are ambiguous; expose the documented 65536 capacity and flag this boundary rather than silently reducing it to 65535.', kxciInterfaceLimitsSourceRevision: '4200A-KXCI-907-01 Rev. E, March 2025', latestIndexListedKxciRevision: '4200A-KXCI-907-01F, 09 Oct 2026', latestKxciRevisionContentVerified: false, latestIndexListedPmuRevision: '4200A-PMU-900-01D, 22 Oct 2026', latestPmuRevisionContentVerified: false, pmuRevisionIndexConflictStatus: 'inconsistent-official-listings', numericPmuSpecsCurrentlyGroundedInRevision: '4200A-PMU-900-01C, May 2024', kxciInterfaceLimitsVerificationStatus: 'provisional-pending-rev-f-content-verification', sourceRefs: ['tek-4200a-kxci-rev-e', 'tek-4200a-current-manual-index'] },
      cvu: {
        requiresExactVariantIdentification: true,
        baseDcBiasRangeV: { min: -30, max: 30 },
        frequencyRangeHz: { min: 1000, max: 10000000 },
        maximumDcCurrentA: 0.01,
        maximumMeasurementPoints: 4096,
        sourceRefs: ['tek-4200a-cvu-rev-b', 'tek-4200a-current-manual-index'],
        acDriveVrmsByVariant: { '4210-CVU': 0.1, '4215-CVU': 1 },
        optionalPowerModule: {
          name: '4200-CVU-PWR', requiresExplicitOptionIdentification: true,
          unverifiedPowerOptionBlocksHighVoltageBias: true,
          maximumDifferentialVoltageV: 400, maximumAbsoluteBiasVoltageV: 200,
          requiresBiasSmu: true, biasSmuChannelsFor200V: 1, biasSmuChannelsFor400VDifferential: 2,
          maximumDcCurrentAByBiasSmu: { mediumPowerSmu: 0.1, highPowerSmu: 0.3 }
        }
      },
      vsVm: {
        VS: { logicalKxciRoleOnly: true, requiresPhysicalSmuBinding: true, maximumSourceVoltageV: 20, currentMeasurementSupported: false },
        VM: { logicalKxciRoleOnly: true, maximumAbsoluteMeasurementVoltageV: 210, sourceOutputSupported: false, inputImpedanceOhm: 1e13 },
        sourceRefs: ['tek-4200a-kxci-rev-e', 'tek-4200a-datasheet-2026', 'tek-4200a-current-manual-index']
      },
      accessories: {
        PA: { independentSource: false, allowedHostFamily: 'SMU', role: 'low-current-preamplifier', lowestCurrentRangeA: 1e-12 },
        RPM: { independentSource: false, allowedHostFamily: 'PMU', role: 'remote-preamplifier-and-switch', requiresPMU: true, noIndependentPulseOutput: true },
        sourceRefs: ['tek-4200a-pmu-rev-c', 'tek-4200a-kxci-rev-e', 'tek-4200a-current-manual-index']
      },
      switchMatrix: {
        sourceRefs: ['tek-4200a-cviv-rev-e', 'tek-4200a-cviv-400v-appnote', 'tek-4200a-current-manual-index'],
        CVIV: {
          maximumVoltagePerSignalPathV: 210, maximumCurrentA: 1, independentSource: false,
          requiresImpedanceLimitedSource: true, forbidDirectMainsConnection: true,
          requirePowerOffBeforeReconfiguration: true,
          biasTeeModes: {
            biasTSmuCvHiLo: { maximumDcBiasV: 200, maximumDcCurrentA: 1 },
            biasTSmuLoICvHiLo: { maximumDcBiasV: 200, maximumDcCurrentA: 1e-4 },
            biasTSmuAcGnd: { maximumDcBiasV: 200 }
          },
          sourceRefs: ['tek-4200a-cviv-rev-e', 'tek-4200a-cviv-400v-appnote', 'tek-4200a-current-manual-index'],
          specialDifferentialMode: {
            maximumDifferentialVoltageV: 400, maximumAbsoluteVoltagePerPathV: 200,
            requiresThreeSynchronizedSmuChannels: true, packagedDevicesOnly: true,
            waferLevelAllowed: false, requiresVerifiedBiasTeeConfiguration: true,
            sourceRefs: ['tek-4200a-cviv-400v-appnote']
          }
        }
      },
      groundUnit: {
        GNDU: { independentSource: false, currentA: { dualMiniTriax: 2.6, bindingPosts: 9.5 },
          doNotUseAsVoltageSource: true, role: 'ground-return-only' },
        sourceRefs: ['tek-4200a-datasheet-2026', 'tek-4200a-setup-rev-f']
      },
      chassis: { maximumPowerW: 500, blockPlanIfCompletePowerBudgetExceeded: true, doNotAssumeUnknownModulesConsumeZeroPower: true, sourceRefs: ['tek-4200a-pmu-rev-c', 'tek-4200a-kxci-rev-e'] },
      dataProvenance: { policyBasis: 'software data-integrity policy', callerSuppliedArraysAreRawInstrumentData: false, rawDataRequiresTrustedAcquisitionReceipt: true, currentBuildHasTrustedAcquisitionExecutor: false },
      execution: { policyBasis: 'fail-closed execution policy; only documented read-only identity and inventory commands are enabled', sourceRefs: ['tek-4200a-kxci-rev-e'], allOutputCommandsDisabled: true, allowedKxciCommands: ['*IDN?', '*OPT?', 'UL', 'EX SystemUtil instrumentinfo(,4096,)', 'GN result', 'EX SystemUtil remotemoduleinfo(,4096,)', 'GN result', 'DE'], requireSingleInstrumentLease: true, requireFailClosedOnDisconnect: true, requireEmergencyStop: true }
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
    const powerLimitedComplianceA = absV > 0 ? mod.electrical.ratedMaxPowerW / absV : null;
    const maxComplianceA = Math.min(range.maxComplianceA, powerLimitedComplianceA ?? Infinity);
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
    return Object.freeze({ minSegments: mod.segmentArb.minSegmentsPerSequence, maxSegments: mod.segmentArb.maxSegmentsPerChannel, maxSegmentsPerCommand: mod.segmentArb.kxciMaxArrayValuesPerCommand || 128, kxciMaxArrayValuesPerCommand: mod.segmentArb.kxciMaxArrayValuesPerCommand || 128, maxSequences: mod.segmentArb.maxSequencesPerChannel, maxSequenceLoops: mod.segmentArb.maxSequenceLoops, minSegmentS: mod.segmentArb.minSegmentTimeS[String(range)], maxSegmentS: mod.segmentArb.maxSegmentTimeS, kxciMinSegmentS: mod.segmentArb.kxciMinSegmentTimeS?.[String(range)] ?? mod.segmentArb.minSegmentTimeS[String(range)], hardwareMinSegmentNote: mod.segmentArb.hardwareMinSegmentNote || null, kxciMaxSegmentS: mod.segmentArb.kxciMaxSegmentTimeS || 1, kxciLimitVerificationStatus: DATABASE.safetyPolicies.pulse.kxciInterfaceLimitsVerificationStatus, timeResolutionS: mod.segmentArb.timeResolutionS });
  }
  function getPmuCurrentRanges(rangeV, withRpm = false) {
    const mod = getModuleCapability(withRpm ? 'PMURPM' : 'PMU');
    const ranges = mod.measurement[withRpm ? 'withRpmCurrentRangesA' : 'currentRangesA'][String(Number(rangeV))];
    if (!ranges) throw Error('未定义该 PMU 电压档的电流测量量程');
    return [...ranges];
  }
  function getPmuCaptureBudget(totalMeasureDurationS, measureWindowS, requestedRateHz, context = {}) {
    const mod = getModuleCapability('PMU'), totalDuration = Number(totalMeasureDurationS);
    if (!Number.isFinite(totalDuration) || totalDuration <= 0) throw Error('PMU 总测量窗口累计时长必须大于 0');
    const positiveCount = (value, label) => {
      const count = Number(value ?? 1);
      if (!Number.isSafeInteger(count) || count < 1) throw Error(label + ' 必须是大于 0 的安全整数');
      return count;
    };
    const pulseCount = positiveCount(context.pulseCount, 'PMU 脉冲数');
    const sweepPoints = positiveCount(context.sweepPoints, 'PMU 扫描点数');
    const stepPoints = positiveCount(context.stepPoints, 'PMU 步进点数');
    const measurementCount = pulseCount * sweepPoints * stepPoints;
    if (!Number.isSafeInteger(measurementCount)) throw Error('PMU 脉冲数、扫描点数和步进点数的乘积超出安全整数范围');
    const hardwareMaxPoints = mod.measurement.maxHardwareSamplesPerChannel;
    const interfaceBufferCapacity = mod.measurement.maxKxciBufferPointsPerChannel;
    const interfaceMaxGeneratedPoints = mod.measurement.maxKxciGeneratedPointsPerChannel;
    const interfaceMaxPoints = interfaceMaxGeneratedPoints;
    const hardwareMaxRateHz = Math.min(mod.measurement.maxSampleRateHz, hardwareMaxPoints / totalDuration);
    const kxciMaxRateHz = Math.min(mod.measurement.maxSampleRateHz, interfaceMaxPoints / totalDuration);
    const minimumRateHz = mod.measurement.minSampleRateHz;
    if (hardwareMaxRateHz < minimumRateHz) throw Error('PMU 总测量窗口累计时长超过硬件单通道严格少于一百万采样点在最低采样率下的容量');
    let minimumRequiredRateHz = minimumRateHz;
    if (measureWindowS !== undefined && measureWindowS !== null) {
      const windowS = Number(measureWindowS);
      if (!Number.isFinite(windowS) || windowS <= 0) throw Error('PMU 测量窗口无效');
      minimumRequiredRateHz = Math.max(minimumRateHz, 1 / windowS);
    }
    if (minimumRequiredRateHz > hardwareMaxRateHz) throw Error('PMU 最短测量窗口与总测量窗口累计时长超过硬件采样容量可同时满足的采样率范围');
    const selectedRateHz = requestedRateHz === undefined || requestedRateHz === null ? hardwareMaxRateHz : Number(requestedRateHz);
    if (!Number.isFinite(selectedRateHz) || selectedRateHz < minimumRequiredRateHz || selectedRateHz > hardwareMaxRateHz) throw Error('PMU 采样率必须在 ' + minimumRequiredRateHz + ' 至 ' + hardwareMaxRateHz + ' Sa/s 之间');
    const sampleCountAtSelectedRate = Math.ceil(selectedRateHz * totalDuration - 1e-9);
    const kxciCompatible = selectedRateHz <= kxciMaxRateHz + 1e-6 && sampleCountAtSelectedRate <= interfaceMaxPoints;
    return Object.freeze({
      totalMeasureDurationS: totalDuration, measureWindowS: measureWindowS == null ? null : Number(measureWindowS), totalMeasureDurationSource: context.totalMeasureDurationSource || 'caller-supplied', pulseCount, sweepPoints, stepPoints, measurementCount,
      sampleCountFormula: mod.measurement.sampleCountFormula,
      sampleCountAtSelectedRate,
      minSampleRateHz: minimumRequiredRateHz, maxSampleRateHz: hardwareMaxRateHz,
      selectedSampleRateHz: selectedRateHz, sampleIntervalS: 1 / selectedRateHz,
      maxPointsPerChannel: hardwareMaxPoints, hardwareMaxPointsPerChannel: hardwareMaxPoints, hardwareMaxPointsExclusivePerChannel: mod.measurement.hardwareSampleCountUpperBoundExclusive,
      interfaceMaxPointsPerChannel: interfaceMaxPoints, interfaceDataBufferCapacityPointsPerChannel: interfaceBufferCapacity, interfaceMaxGeneratedPointsPerChannel: interfaceMaxGeneratedPoints, kxciMaxSampleRateHz: kxciMaxRateHz,
      clariusItmMaxPointsPerChannel: mod.measurement.maxClariusItmPointsPerChannel, clariusUtmMaxPointsPerChannel: mod.measurement.maxClariusUtmPointsPerChannel,
      kxciBoundaryStatus: sampleCountAtSelectedRate === interfaceMaxPoints ? 'exact-upper-bound-ambiguous' : (kxciCompatible ? 'within-published-range' : 'over-interface-limit'),
      kxciPointLimitNote: mod.measurement.kxciGeneratedPointBoundaryNote,
      hardwareMaxSampleRateHz: mod.measurement.maxSampleRateHz, hardwareCompatible: sampleCountAtSelectedRate <= hardwareMaxPoints, clariusItmCompatible: sampleCountAtSelectedRate <= mod.measurement.maxClariusItmPointsPerChannel, clariusUtmCompatible: sampleCountAtSelectedRate <= mod.measurement.maxClariusUtmPointsPerChannel, kxciCompatible,
      interface: 'KXCI', interfaceLimitVerificationStatus: DATABASE.safetyPolicies.pulse.kxciInterfaceLimitsVerificationStatus, kxciInterfaceLimitsSourceRevision: DATABASE.safetyPolicies.pulse.kxciInterfaceLimitsSourceRevision, latestIndexListedKxciRevision: DATABASE.safetyPolicies.pulse.latestIndexListedKxciRevision, latestKxciRevisionContentVerified: DATABASE.safetyPolicies.pulse.latestKxciRevisionContentVerified, interfaceLimitation: kxciCompatible ? null : '当前 KXCI 波形生成点数上限为每通道 65536 点（数据缓冲容量同为 65536 点；手册对等于上限的文字表述存在歧义）；PMU 硬件单次采集点数必须严格少于 1000000 点',
      executionCompatibility: kxciCompatible ? 'hardware-and-kxci-compatible' : 'hardware-valid-kxci-limited'
    });
  }
  function getPulseTimingRecommendation(rangeV, measurementRangeA, withMeasurement = true, source = 'pmu', withRpm = false, peakVoltageV = null) {
    const key = String(source || 'pmu').toLowerCase() === 'pgu' ? 'VPU' : 'PMU';
    const mod = getModuleCapability(key), timingTable = getModuleCapability('PMU').typicalTimingByCurrentRangeA;
    const range = String(Number(rangeV)), mode = withMeasurement ? 'withMeasurement' : 'sourceOnly';
    if (key === 'VPU' && withMeasurement) throw Error('4220-PGU/VPU 不具备电流测量功能');
    const timing = mod.pulseTiming?.[range]?.[mode];
    if (!timing) throw Error('没有该模块/电压档/测量模式的硬件脉冲时序规格');
    if (withRpm && (key !== 'PMU' || !withMeasurement)) throw Error('4225-RPM 只适用于 PMU 电流测量模式');
    const peakAbs = peakVoltageV === null || peakVoltageV === undefined ? null : Math.abs(Number(peakVoltageV));
    if (peakAbs !== null && !Number.isFinite(peakAbs)) throw Error('脉冲峰值电压无效');
    let transitionMinS = timing.transitionMinS, transitionSelection = 'fixed';
    if (timing.transitionMinSAbove10V !== undefined) {
      if (peakAbs === null) {
        transitionMinS = null; transitionSelection = 'requires-output-amplitude';
      } else if (peakAbs < 10) {
        transitionMinS = timing.transitionMinS; transitionSelection = 'below-10V';
      } else if (peakAbs > 10) {
        transitionMinS = timing.transitionMinSAbove10V; transitionSelection = 'above-10V';
      } else {
        transitionMinS = null; transitionSelection = 'exactly-10V-not-specified-in-manual';
      }
    }
    const recommendation = {
      ...timing, transitionMinS, transitionSelection, peakAbsVoltageV: peakAbs,
      source: 'tek-4200a-datasheet-2026', measurementEnabled: Boolean(withMeasurement),
      hardwareSpecification: true, kxciInterfaceTiming: mod.kxciPulseTiming?.[range] || null, typicalTimingSource: 'tek-4200a-pmu-rev-c',
      kxciInterfaceSource: mod.kxciPulseTiming ? 'tek-4200a-kxci-rev-e' : null
    };
    if (measurementRangeA !== undefined && measurementRangeA !== null) {
      const current = Number(measurementRangeA);
      if (key !== 'PMU' || !getPmuCurrentRanges(Number(rangeV), Boolean(withRpm)).some(x => Math.abs(x - current) <= Math.max(1e-15, current * 1e-9))) throw Error('所选 PMU 电流量程与该电压档/前端模块不匹配');
      recommendation.measurementRangeA = current;
      recommendation.rpmEnabled = Boolean(withRpm);
      const rangeTable = timingTable?.[range] || {};
      recommendation.publishedTypicalTiming = Object.entries(rangeTable).find(([rangeKey]) => Number(rangeKey) === current)?.[1] || null;
      recommendation.typicalTimingStatus = recommendation.publishedTypicalTiming ? 'published-typical' : 'not-published-for-current-range';
      if (withRpm) {
        recommendation.rpmTypicalTiming = recommendation.publishedTypicalTiming;
        recommendation.rpmTimingStatus = recommendation.typicalTimingStatus;
      }
    } else if (withRpm) recommendation.rpmTimingStatus = 'current-range-required';
    if (!withMeasurement && measurementRangeA !== undefined && measurementRangeA !== null) throw Error('纯源模式不能设置电流测量量程');
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
  function getCvuCapabilities(variant, options = {}) {
    const mod = getModuleCapability('CVU'), key = String(variant || '').toUpperCase();
    const powerOptionRequested = typeof options === 'boolean' ? options : Boolean(options?.powerOptionRequested);
    const powerOptionVerified = typeof options === 'object' && options?.inventory?.hardwareLimitsVerified === true && Array.isArray(options?.inventory?.verifiedOptions) && options.inventory.verifiedOptions.includes('4200-CVU-PWR');
    if (!Object.hasOwn(mod.variants, key)) return Object.freeze({ known: false, variantRequired: true, common: mod.common, powerOption: null, powerOptionStatus: powerOptionRequested ? 'variant-and-option-identification-required' : 'not-identified', reason: 'KXCI *OPT? 只报告 CVU，不能区分 4210-CVU 与 4215-CVU；高压附件也必须单独确认' });
    return Object.freeze({
      known: true, variant: key, ...mod.variants[key],
      powerOption: powerOptionVerified ? mod.optionalPowerModule : null,
      powerOptionStatus: powerOptionVerified ? 'verified' : powerOptionRequested ? 'requested-but-not-verified-by-inventory' : 'not-identified',
      highVoltageBiasAllowed: powerOptionVerified
    });
  }
  function exportDatabase() { return JSON.parse(JSON.stringify(DATABASE)); }
  const api = Object.freeze({ DATABASE, exportDatabase, getModuleCapability, getSmuLimits, getSourceLimits, getPulseOutputLimits, getSegmentArbLimits, getPmuCurrentRanges, getPmuCaptureBudget, getPulseTimingRecommendation, calculateChassisPower, getCvuCapabilities });
  if (typeof window !== 'undefined') {
    window.DKTSHardwareCapabilities = api;
    if (window.DKDSPluginModules) window.DKDSPluginModules.define('com.dkds.keithley-4200', 'dkts-capabilities', api);
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})();