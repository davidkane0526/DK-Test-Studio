(() => {
  'use strict';
  const database={
  "schema": "dkts.4200a.capability-safety",
  "schemaVersion": 2,
  "databaseVersion": "1.2.0",
  "target": {
    "manufacturer": "Keithley Instruments / Tektronix",
    "family": "4200A-SCS",
    "supportedModes": [
      "4200A native KXCI"
    ],
    "notSupportedModes": [
      "4145B emulation"
    ]
  },
  "generated": {
    "date": "2026-11-05",
    "owner": "DK Test Studio",
    "canonical": true
  },
  "purpose": "Machine-readable source of truth for module capabilities and planning-time safety validation. This file is intentionally exportable for independent AI and human review.",
  "safetyModel": {
    "levels": [
      {
        "id": "instrument",
        "description": "Instrument/module electrical and timing limits documented by Keithley/Tektronix."
      },
      {
        "id": "dut",
        "description": "Device-under-test limits supplied by the operator or a DUT profile. Instrument ratings do not imply DUT safety."
      },
      {
        "id": "execution",
        "description": "Runtime interlocks, output-off state, abort behavior, wiring/fixture checks and hardware acceptance. These cannot be inferred from this database alone."
      }
    ],
    "unknownDataPolicy": "Use the exact capability data for the identified module or the identified hardware class. Never silently substitute a lower-rated model. When offline, require an explicit model selection for model-dependent SMU/CVU planning; fixed PMU/PGU families may use their own family specification. When connected, unresolved or missing inventory blocks that channel. All offline plans remain non-executable until revalidated against the live instrument.",
    "executionStatus": "planning-only; no output commands are enabled by this database",
    "humanSafety": {
      "shockHazardThresholds": {
        "dcV": 60,
        "acRmsV": 30,
        "acPeakV": 42.4
      },
      "highVoltageInterlockRequired": true,
      "highVoltageInterlockNote": "The 4200A-SCS interlock circuit must be positively activated for the high-voltage output to be enabled. The setup manual states that the SMU ±200 V ranges are enabled when the interlock is asserted. KXCI *OPT? and current SystemUtil inventory do not prove the physical interlock state.",
      "switchingWarning": "Do not connect switching cards directly to unlimited-energy sources or mains. Use impedance-limited sources and suitable protective devices.",
      "cableAndDutWarning": "Inspect cables and fixtures; discharge capacitors and remove power before changing connections. Treat unknown circuits as potentially hazardous.",
      "hazardThresholds": {
        "dcV": null,
        "acRmsV": null,
        "acPeakV": null,
        "note": "No generic numeric shock threshold is encoded here. Use the 4200A manual's interlock requirements and the laboratory electrical-safety procedure."
      }
    }
  },
  "system": {
    "mainframeSlots": {
      "maxSmus": 9,
      "kxciOptionQueryReturnsUpTo": 8,
      "channelNumbers": {
        "min": 1,
        "max": 9
      },
      "source": "datasheet2025,kxci2025",
      "note": "The datasheet specifies up to nine SMUs; the KXCI *OPT? response is documented as returning up to eight slot descriptors. Keep these separate."
    },
    "maxPmuCards": 6,
    "inventory": {
      "primaryCommand": "*OPT?",
      "mode": "4200A native KXCI only",
      "returns": "Up to eight comma-separated slot descriptors. The suffix n is the KXCI instrument/channel number 1..9.",
      "discovers": [
        "SMU medium/high class",
        "SMU preamplifier class encoded in SMUPA/HPSMUPA tokens",
        "CVU family",
        "PMU/PGU family",
        "RPM attachment/channel association when encoded in PMURPM tokens"
      ],
      "detailedReadOnlyQueries": [
        {
          "name": "instrumentinfo",
          "library": "SystemUtil",
          "purpose": "Exact installed instrument model, serial number, hardware/firmware versions, calibration date/due date and CVIV presence",
          "sequence": [
            "UL",
            "EX SystemUtil instrumentinfo(,4096,)",
            "GN result",
            "US"
          ],
          "source": "kxci2025",
          "status": "to be integrated"
        },
        {
          "name": "remotemoduleinfo",
          "library": "SystemUtil",
          "purpose": "Remote 4200-PA preamplifier and 4225-RPM attachment/association",
          "sequence": [
            "UL",
            "EX SystemUtil remotemoduleinfo(,4096,)",
            "GN result",
            "US"
          ],
          "source": "kxci2025",
          "status": "to be integrated"
        },
        {
          "name": "systeminfo",
          "library": "SystemUtil",
          "purpose": "Mainframe and Clarius system information",
          "sequence": [
            "UL",
            "EX SystemUtil systeminfo(,2048,)",
            "GN result",
            "US"
          ],
          "source": "kxci2025",
          "status": "to be integrated"
        }
      ],
      "doesNotDiscover": [
        "Physical interlock state",
        "DUT/load/cable ratings",
        "actual fixture wiring and earth bonding",
        "calibration validity unless the detailed SystemUtil response is successfully parsed"
      ],
      "secondaryOfficialQueries": {
        "instrumentinfo": {
          "purpose": "Read-only SystemUtil function for exact installed instrument cards and CVIV",
          "implementationStatus": "planned read-only query; current identity bridge only has *IDN? and *OPT?"
        },
        "remotemoduleinfo": {
          "purpose": "Read-only SystemUtil function for remote preamplifier and RPM modules",
          "implementationStatus": "planned read-only query; current identity bridge only has *IDN? and *OPT?"
        }
      }
    },
    "segmentArb": {
      "maxChannelsInClariusExample": 8,
      "correspondingPmuCards": 4,
      "source": "segmentArbAppNote2025",
      "note": "This is the published Clarius Segment ARB example/library channel count, not the mainframe's absolute PMU card capacity."
    }
  },
  "modules": {
    "4200-SMU": {
      "category": "SMU",
      "powerClass": "medium",
      "variants": [
        "4200-SMU",
        "4200-SMU-R"
      ],
      "capabilities": [
        "dc-iv",
        "source-voltage",
        "source-current",
        "measure-voltage",
        "measure-current",
        "four-quadrant",
        "two-wire",
        "four-wire",
        "sweep",
        "step",
        "constant-bias",
        "very-low-frequency-cv",
        "qscv"
      ],
      "sourceVoltageMaxV": 210,
      "sourceCurrentMaxA": 0.105,
      "maxPowerW": 2.1,
      "voltageSourceRanges": [
        {
          "rangeV": 200,
          "maxCurrentA": 0.0105
        },
        {
          "rangeV": 20,
          "maxCurrentA": 0.105
        },
        {
          "rangeV": 2,
          "maxCurrentA": 0.105
        },
        {
          "rangeV": 0.2,
          "maxCurrentA": 0.105
        }
      ],
      "currentSourceRanges": [
        {
          "rangeA": 0.1,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.01,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.001,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.0001,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.00001,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.000001,
          "maxComplianceV": 210
        },
        {
          "rangeA": 1e-7,
          "maxComplianceV": 210
        }
      ],
      "minCurrentRangeA": 1e-7,
      "hasPreamplifier": false,
      "loadCapacitance": {
        "maxF": 1e-8,
        "qualification": "4200-SMU/4210-SMU base model; use conservative 10 nF limit"
      },
      "evidence": [
        "datasheet2025",
        "setup2025"
      ]
    },
    "4201-SMU": {
      "category": "SMU",
      "powerClass": "medium",
      "variants": [
        "4201-SMU",
        "4201-SMU-R"
      ],
      "capabilities": [
        "dc-iv",
        "source-voltage",
        "source-current",
        "measure-voltage",
        "measure-current",
        "four-quadrant",
        "two-wire",
        "four-wire",
        "sweep",
        "step",
        "constant-bias",
        "high-capacitance-fixture"
      ],
      "sourceVoltageMaxV": 210,
      "sourceCurrentMaxA": 0.105,
      "maxPowerW": 2.1,
      "voltageSourceRanges": [
        {
          "rangeV": 200,
          "maxCurrentA": 0.0105
        },
        {
          "rangeV": 20,
          "maxCurrentA": 0.105
        },
        {
          "rangeV": 2,
          "maxCurrentA": 0.105
        },
        {
          "rangeV": 0.2,
          "maxCurrentA": 0.105
        }
      ],
      "currentSourceRanges": [
        {
          "rangeA": 0.1,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.01,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.001,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.0001,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.00001,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.000001,
          "maxComplianceV": 210
        },
        {
          "rangeA": 1e-7,
          "maxComplianceV": 210
        }
      ],
      "minCurrentRangeA": 1e-7,
      "hasPreamplifier": false,
      "loadCapacitance": {
        "byCurrentRange": [
          {
            "rangeA": 0.1,
            "maxF": 0.0001
          },
          {
            "minCurrentA": 1e-7,
            "maxCurrentA": 0.01,
            "maxF": 0.00001
          },
          {
            "minCurrentA": 1e-9,
            "maxCurrentA": 1e-8,
            "maxF": 0.00001,
            "requiresPreamplifier": true
          },
          {
            "minCurrentA": 1e-12,
            "maxCurrentA": 1e-10,
            "maxF": 0.000001,
            "requiresPreamplifier": true
          }
        ],
        "note": "Official maximum load capacitance: 100 µF on the 100 mA range; 10 µF on 100 nA–10 mA ranges; 10 µF on 1 nA–10 nA preamplifier ranges; 1 µF on 1 pA–100 pA preamplifier ranges."
      },
      "evidence": [
        "datasheet2025",
        "setup2025",
        "stableLowCurrent2019"
      ]
    },
    "4210-SMU": {
      "category": "SMU",
      "powerClass": "high",
      "variants": [
        "4210-SMU",
        "4210-SMU-R"
      ],
      "capabilities": [
        "dc-iv",
        "source-voltage",
        "source-current",
        "measure-voltage",
        "measure-current",
        "four-quadrant",
        "two-wire",
        "four-wire",
        "sweep",
        "step",
        "constant-bias",
        "very-low-frequency-cv",
        "qscv"
      ],
      "sourceVoltageMaxV": 210,
      "sourceCurrentMaxA": 1.05,
      "maxPowerW": 21,
      "voltageSourceRanges": [
        {
          "rangeV": 200,
          "maxCurrentA": 0.105
        },
        {
          "rangeV": 20,
          "maxCurrentA": 1.05
        },
        {
          "rangeV": 2,
          "maxCurrentA": 1.05
        },
        {
          "rangeV": 0.2,
          "maxCurrentA": 1.05
        }
      ],
      "currentSourceRanges": [
        {
          "rangeA": 1,
          "maxComplianceV": 21
        },
        {
          "rangeA": 0.1,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.01,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.001,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.0001,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.00001,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.000001,
          "maxComplianceV": 210
        },
        {
          "rangeA": 1e-7,
          "maxComplianceV": 210
        }
      ],
      "minCurrentRangeA": 1e-7,
      "hasPreamplifier": false,
      "loadCapacitance": {
        "maxF": 1e-8,
        "qualification": "4200-SMU/4210-SMU base model; use conservative 10 nF limit"
      },
      "evidence": [
        "datasheet2025",
        "setup2025"
      ]
    },
    "4211-SMU": {
      "category": "SMU",
      "powerClass": "high",
      "variants": [
        "4211-SMU",
        "4211-SMU-R"
      ],
      "capabilities": [
        "dc-iv",
        "source-voltage",
        "source-current",
        "measure-voltage",
        "measure-current",
        "four-quadrant",
        "two-wire",
        "four-wire",
        "sweep",
        "step",
        "constant-bias",
        "high-capacitance-fixture"
      ],
      "sourceVoltageMaxV": 210,
      "sourceCurrentMaxA": 1.05,
      "maxPowerW": 21,
      "voltageSourceRanges": [
        {
          "rangeV": 200,
          "maxCurrentA": 0.105
        },
        {
          "rangeV": 20,
          "maxCurrentA": 1.05
        },
        {
          "rangeV": 2,
          "maxCurrentA": 1.05
        },
        {
          "rangeV": 0.2,
          "maxCurrentA": 1.05
        }
      ],
      "currentSourceRanges": [
        {
          "rangeA": 1,
          "maxComplianceV": 21
        },
        {
          "rangeA": 0.1,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.01,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.001,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.0001,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.00001,
          "maxComplianceV": 210
        },
        {
          "rangeA": 0.000001,
          "maxComplianceV": 210
        },
        {
          "rangeA": 1e-7,
          "maxComplianceV": 210
        }
      ],
      "minCurrentRangeA": 1e-7,
      "hasPreamplifier": false,
      "loadCapacitance": {
        "byCurrentRange": [
          {
            "rangeA": 1,
            "maxF": 0.0001
          },
          {
            "rangeA": 0.1,
            "maxF": 0.0001
          },
          {
            "minCurrentA": 1e-7,
            "maxCurrentA": 0.01,
            "maxF": 0.00001
          },
          {
            "minCurrentA": 1e-9,
            "maxCurrentA": 1e-8,
            "maxF": 0.00001,
            "requiresPreamplifier": true
          },
          {
            "minCurrentA": 1e-12,
            "maxCurrentA": 1e-10,
            "maxF": 0.000001,
            "requiresPreamplifier": true
          }
        ]
      },
      "evidence": [
        "datasheet2025",
        "setup2025",
        "stableLowCurrent2019"
      ]
    },
    "4200-PA": {
      "category": "SMU-PREAMPLIFIER",
      "role": "Extends low-current source/measure ranges of an associated SMU; does not increase that SMU's voltage, current or power rating.",
      "addedCurrentRangesA": [
        1e-8,
        1e-9,
        1e-10,
        1e-11,
        1e-12
      ],
      "addedRangesLabels": [
        "10 nA",
        "1 nA",
        "100 pA",
        "10 pA",
        "1 pA"
      ],
      "minCurrentRangeA": 1e-12,
      "minCurrentComplianceA": 1e-13,
      "sourceResolutionAt1pARangeA": 1e-15,
      "measurementResolutionAt1pARangeA": 1e-17,
      "association": "A preamplifier is associated with a specific SMU. Obtain this association from remotemoduleinfo; do not infer from proximity.",
      "evidence": [
        "datasheet2025",
        "setup2025",
        "kxci2025"
      ]
    },
    "4225-PMU": {
      "category": "PMU",
      "channels": 2,
      "sourceAndMeasure": true,
      "simultaneousVoltageCurrentMeasure": true,
      "voltageRangesV": [
        10,
        40
      ],
      "sourceImpedanceOhm": 50,
      "shortCircuitCurrentByRangeA": {
        "10": 0.2,
        "40": 0.8
      },
      "outputLimit": "programmable; must be set no higher than min(DUT current limit, source-impedance/load-derived current capability)",
      "currentMeasureRangesA": {
        "10V": [
          0.01,
          0.2
        ],
        "40V": [
          0.0001,
          0.01,
          0.8
        ]
      },
      "sampling": {
        "maxRateSps": 200000000,
        "nominalSampleIntervalS": 5e-9,
        "maxSamplesPerChannel": 1000000,
        "adcBits": 14,
        "source": "datasheet2025",
        "minimumMeasureWindowS": 5e-9,
        "minimumMeasureWindowSource": "one ADC sample interval at the documented 200 MS/s maximum rate"
      },
      "waveform": {
        "segmentArb": {
          "maxSegmentsPerChannel": 2048,
          "maxSequencesPerChannel": 512,
          "maxSequenceLoops": {
            "libraryCommands": 1000000000000,
            "exampleLibrary": 1000000000
          },
          "minSegmentTimeS": 2e-8,
          "maxSegmentTimeS": 40,
          "timeResolutionS": 1e-8,
          "perSegmentControls": [
            "startV",
            "stopV",
            "durationS",
            "measurementWindow",
            "measurementType"
          ],
          "source": "datasheet2025",
          "minSegments": 1
        },
        "fullArb": {
          "supported": true,
          "numericLimitsStatus": "not-verified",
          "maxPoints": null,
          "minIntervalS": null,
          "maxIntervalS": null,
          "note": "Not included in DKTS input modes until the current official pulse manual's exact Full-ARB limits are extracted."
        },
        "pulseWidthSummary": {
          "sourceOnlyMinS": 2e-8,
          "sourceAndMeasureSummaryMinS": 6e-8
        },
        "clariusExampleProfile": {
          "minSegmentsPerSequence": 3,
          "maxSegmentsPerSequence": 2048,
          "maxSequences": 512,
          "maxSequenceLoops": 1000000000,
          "segmentTimeByRange": {
            "10V": {
              "minS": 2e-8,
              "maxS": 1
            },
            "40V": {
              "minS": 5e-8,
              "maxS": 1
            }
          },
          "maxChannels": 8,
          "correspondingPmuCards": 4,
          "constraints": [
            "same duration for corresponding segments across all active channels",
            "all input arrays in a sequence must have same length",
            "segment transitions must be seamless: previous stopV equals next startV"
          ],
          "source": "segmentArbAppNote2025",
          "role": "reference-example-only; not a hardware capability limit",
          "notEnforced": true
        }
      },
      "timing": {
        "currentMeasureNoRpm": {
          "10V": {
            "0.01": {
              "minPulseS": 1.6e-7,
              "minMeasureWindowS": 2e-8,
              "minTransitionS": 2e-8,
              "settlingS": 1e-7
            },
            "0.2": {
              "minPulseS": 7e-8,
              "minMeasureWindowS": 2e-8,
              "minTransitionS": 2e-8,
              "settlingS": 3e-8
            }
          },
          "40V": {
            "0.8": {
              "minPulseS": 7.7e-7,
              "minMeasureWindowS": 1e-7,
              "minTransitionS": 1e-7,
              "settlingS": 5e-7
            }
          }
        },
        "currentMeasureWithRpm": {
          "10V": {
            "0.0000001": {
              "minPulseS": 0.000134,
              "minMeasureWindowS": 0.00001,
              "minTransitionS": 0.000001,
              "settlingS": 0.0001
            },
            "0.000001": {
              "minPulseS": 0.0000204,
              "minMeasureWindowS": 0.00000164,
              "minTransitionS": 3.6e-7,
              "settlingS": 0.000015
            },
            "0.00001": {
              "minPulseS": 0.00000836,
              "minMeasureWindowS": 0.000001,
              "minTransitionS": 3.6e-7,
              "settlingS": 0.000006
            },
            "0.0001": {
              "minPulseS": 0.00000104,
              "minMeasureWindowS": 1.3e-7,
              "minTransitionS": 4e-8,
              "settlingS": 7.5e-7
            },
            "0.001": {
              "minPulseS": 3.7e-7,
              "minMeasureWindowS": 4e-8,
              "minTransitionS": 3e-8,
              "settlingS": 2.5e-7
            },
            "0.01": {
              "minPulseS": 1.6e-7,
              "minMeasureWindowS": 2e-8,
              "minTransitionS": 2e-8,
              "settlingS": 1e-7
            }
          },
          "40V": {
            "0.0001": {
              "minPulseS": 0.0000064,
              "minMeasureWindowS": 0.000001,
              "minTransitionS": 0.000001,
              "settlingS": 0.000004
            },
            "0.01": {
              "minPulseS": 7.7e-7,
              "minMeasureWindowS": 1e-7,
              "minTransitionS": 1e-7,
              "settlingS": 5e-7
            }
          }
        },
        "voltageMeasureNoRpm": {
          "10V": {
            "minPulseS": 7e-8,
            "minMeasureWindowS": 2e-8,
            "minTransitionS": 2e-8,
            "settlingS": 3e-8
          },
          "40V": {
            "minPulseS": 1.5e-7,
            "minMeasureWindowS": 2e-8,
            "minTransitionS": 1e-7,
            "settlingS": 3e-8
          }
        },
        "voltageMeasureWithRpm": {
          "10V": {
            "minPulseS": 1.6e-7,
            "minMeasureWindowS": 2e-8,
            "minTransitionS": 2e-8,
            "settlingS": 1e-7
          }
        }
      },
      "evidence": [
        "datasheet2025",
        "segmentArbAppNote2025",
        "pulseManual2020",
        "kxci2025"
      ],
      "standardPulseTiming": {
        "10V": {
          "sourceOnly": {
            "periodMinS": 2e-8,
            "periodMaxS": 1,
            "pulseWidthMinS": 1e-8,
            "transitionMinS": 1e-8,
            "transitionMaxS": 0.033
          },
          "withMeasure": {
            "periodMinS": 1.2e-7,
            "periodMaxS": 1,
            "pulseWidthMinS": 6e-8,
            "transitionMinS": 2e-8,
            "transitionMaxS": 0.033
          }
        },
        "40V": {
          "sourceOnly": {
            "periodMinS": 1e-7,
            "periodMaxS": 1,
            "pulseWidthMinS": 5e-8,
            "transitionMinS": 3e-8,
            "transitionMinVoltageV": 10,
            "transitionMinAboveThresholdS": 1e-7,
            "transitionMaxS": 0.033
          },
          "withMeasure": {
            "periodMinS": 2.8e-7,
            "periodMaxS": 1,
            "pulseWidthMinS": 1.4e-7,
            "transitionMinS": 1e-7,
            "transitionMaxS": 0.033
          }
        },
        "timingResolutionS": 1e-8
      },
      "timingPolicy": "The timing tables are typical/recommended measurement-performance guidance, not absolute Segment ARB hardware minimums. Do not reject a hardware-valid 20 ns segment solely because a recommended pulse width or settling value is longer. Enforce the hardware segment range and the PMU sample interval only."
    },
    "4225-RPM": {
      "category": "PMU-REMOTE-PREAMPLIFIER-SWITCH",
      "channelsPerUnit": 1,
      "functions": [
        "extends PMU low-current measurement ranges",
        "switches between SMU,CVU,PMU paths"
      ],
      "addedCurrentMeasureRangesA": {
        "10V": [
          1e-7,
          0.000001,
          0.00001,
          0.0001,
          0.001,
          0.01
        ],
        "40V": [
          0.0001,
          0.01
        ]
      },
      "constraints": [
        "Requires association with a 4225-PMU channel",
        "PMU/RPM current measurement timing is slower on low-current ranges",
        "When RPM is installed, do not connect directly to PMU CH1/CH2 SMA outputs"
      ],
      "evidence": [
        "datasheet2025",
        "rpmManual2023",
        "kxci2025"
      ],
      "sourceVoltageMaxV": 10,
      "currentMeasureRangesA": {
        "10V": [
          1e-7,
          0.000001,
          0.00001,
          0.0001,
          0.001,
          0.01
        ],
        "40V": [
          0.0001,
          0.01
        ]
      },
      "outputLimit": "Do not equate a PMU current-measurement range with the output-current limit. The PMU programmable output limit remains a separate parameter; apply the PMU 50-ohm load model and the operator's DUT current limit."
    },
    "4220-PGU": {
      "category": "PGU",
      "channels": 2,
      "sourceOnly": true,
      "measureCapability": false,
      "voltageRangesV": [
        10,
        40
      ],
      "sourceImpedanceOhm": 50,
      "shortCircuitCurrentByRangeA": {
        "10": 0.2,
        "40": 0.8
      },
      "outputLimit": "programmable; must be set no higher than min(DUT current limit, source-impedance/load-derived current capability)",
      "waveform": {
        "segmentArb": {
          "maxSegmentsPerChannel": 2048,
          "maxSequencesPerChannel": 512,
          "maxSequenceLoops": {
            "libraryCommands": 1000000000000,
            "exampleLibrary": 1000000000
          },
          "minSegmentTimeS": 2e-8,
          "maxSegmentTimeS": 40,
          "timeResolutionS": 1e-8,
          "perSegmentControls": [
            "startV",
            "stopV",
            "durationS"
          ],
          "source": "datasheet2025",
          "minSegments": 1
        },
        "fullArb": {
          "supported": true,
          "numericLimitsStatus": "not-verified",
          "maxPoints": null,
          "minIntervalS": null,
          "maxIntervalS": null,
          "note": "Not included in DKTS input modes until exact limits are extracted."
        },
        "pulseWidthSummary": {
          "sourceOnlyMinS": 2e-8
        },
        "clariusExampleProfile": {
          "minSegmentsPerSequence": 3,
          "maxSegmentsPerSequence": 2048,
          "maxSequences": 512,
          "maxSequenceLoops": 1000000000,
          "segmentTimeByRange": {
            "10V": {
              "minS": 2e-8,
              "maxS": 1
            },
            "40V": {
              "minS": 5e-8,
              "maxS": 1
            }
          },
          "maxChannels": null,
          "constraints": [
            "same duration for corresponding segments across active channels",
            "all input arrays in a sequence must have same length",
            "segment transitions must be seamless"
          ],
          "source": "segmentArbAppNote2025",
          "role": "reference-example-only; not a hardware capability limit",
          "notEnforced": true
        }
      },
      "evidence": [
        "datasheet2025",
        "segmentArbAppNote2025",
        "pulseManual2020",
        "kxci2025"
      ],
      "standardPulseTiming": {
        "10V": {
          "periodMinS": 2e-8,
          "periodMaxS": 1,
          "pulseWidthMinS": 1e-8,
          "transitionMinS": 1e-8,
          "transitionMaxS": 0.033
        },
        "40V": {
          "periodMinS": 1e-7,
          "periodMaxS": 1,
          "pulseWidthMinS": 5e-8,
          "transitionMinS": 3e-8,
          "transitionMinVoltageV": 10,
          "transitionMinAboveThresholdS": 1e-7,
          "transitionMaxS": 0.033
        },
        "timingResolutionS": 1e-8
      },
      "sampling": null
    },
    "4210-CVU": {
      "category": "CVU",
      "frequencyHz": {
        "min": 1000,
        "max": 10000000,
        "discreteCount": 37,
        "stepSchedule": [
          {
            "from": 1000,
            "to": 10000,
            "step": 1000
          },
          {
            "from": 20000,
            "to": 100000,
            "step": 10000
          },
          {
            "from": 200000,
            "to": 1000000,
            "step": 100000
          },
          {
            "from": 2000000,
            "to": 10000000,
            "step": 1000000
          }
        ]
      },
      "internalDcBiasV": {
        "min": -30,
        "max": 30
      },
      "externalSmuDcBiasV": {
        "min": -210,
        "max": 210
      },
      "acDriveVrms": {
        "min": 0.01,
        "max": 0.1
      },
      "acOutputImpedanceOhmTypical": 100,
      "acMeasureCurrentRangesA": [
        0.000001,
        0.00003,
        0.001
      ],
      "parameters": [
        "Z-Theta",
        "R+jX",
        "Cp-Gp",
        "Cs-Rs",
        "Cp-D",
        "Cs-D",
        "Y-Theta"
      ],
      "evidence": [
        "datasheet2025",
        "cvuManual2023",
        "kxci2025"
      ],
      "maxAcCurrentA": 0.01,
      "dcBiasMaxCurrentA": 0.01
    },
    "4215-CVU": {
      "category": "CVU",
      "frequencyHz": {
        "min": 1000,
        "max": 10000000,
        "step": 1000,
        "discreteCount": 10000
      },
      "internalDcBiasV": {
        "min": -30,
        "max": 30
      },
      "externalSmuDcBiasV": {
        "min": -210,
        "max": 210
      },
      "acDriveVrms": {
        "min": 0.01,
        "max": 1
      },
      "acOutputImpedanceOhmTypical": 100,
      "acMeasureCurrentRangesA": [
        0.000001,
        0.00003,
        0.001
      ],
      "parameters": [
        "Z-Theta",
        "R+jX",
        "Cp-Gp",
        "Cs-Rs",
        "Cp-D",
        "Cs-D",
        "Y-Theta"
      ],
      "evidence": [
        "datasheet2025",
        "cvuManual2023",
        "kxci2025"
      ],
      "maxAcCurrentA": 0.01,
      "dcBiasMaxCurrentA": 0.01
    },
    "4200A-CVIV": {
      "category": "SWITCH-MATRIX",
      "channels": 4,
      "sourceCapability": false,
      "measurementCapability": false,
      "voltageRatingV": 210,
      "currentRatingA": 1,
      "functions": [
        "switches up to four SMU channels",
        "routes CVU HI/LO/guard",
        "supports SMU/CVU and bias-tee routing",
        "can route GNDU to an output channel"
      ],
      "restrictions": [
        "not a source or measurement instrument",
        "bias-tee modes are for C-V only",
        "unused SMU input positions require channel blockers",
        "must be bonded to protective earth using both supplied ground cables",
        "Bias-tee DC bias is limited to ±200 V single-ended or 400 V differential; this is distinct from the switch general 210 V / 1 A rating."
      ],
      "discovery": "not reported by *OPT?; requires separate verified instrument information or explicit operator confirmation",
      "evidence": [
        "cvivManual2017",
        "datasheet2025"
      ],
      "biasTee": {
        "maxSingleEndedDcBiasV": 210,
        "maxDifferentialDcBiasV": 420,
        "maxComplianceAByMode": {
          "lowCurrent": 0.001,
          "cvMode": 1
        },
        "allowedFor": "C-V measurements only; use the SMU configuration mode for I-V",
        "evidence": [
          "datasheet2025",
          "cvivManual2017"
        ],
        "note": "Use the 2025 datasheet rating. Older CVIV manual revisions may show ±200 V/400 V; the newer datasheet lists ±210 V/420 V."
      },
      "channelConfiguration": {
        "outputs": 4,
        "accessories": [
          "4200A-CVIV-SPT",
          "channel-blocker"
        ],
        "requirements": [
          "one SPT or one 4200-PA per SMU channel connected through CVIV",
          "channel blockers must be installed in unused SMU inputs",
          "both supplied ground cables must be bonded to protective earth"
        ],
        "evidence": [
          "datasheet2025",
          "cvivManual2017"
        ]
      }
    },
    "4200A-CVIV-SPT": {
      "category": "CVIV-ACCESSORY",
      "role": "SMU pass-through module used inside 4200A-CVIV",
      "sourceCapability": false,
      "measurementCapability": false,
      "restrictions": [
        "not a standalone source",
        "does not increase the connected SMU's electrical rating"
      ],
      "evidence": [
        "cvivManual2017",
        "datasheet2025"
      ]
    },
    "GNDU": {
      "category": "GROUND-UNIT",
      "builtIn": true,
      "sourceCapability": false,
      "measurementCapability": false,
      "currentRatingA": {
        "triaxial": 2.6,
        "bindingPost": 9.5
      },
      "restrictions": [
        "current rating is not a source-current capability",
        "do not select GNDU as an SMU source channel",
        "binding-post and triaxial ratings are connection-specific"
      ],
      "evidence": [
        "datasheet2025",
        "setup2025"
      ],
      "currentRatingNote": "Current ratings are terminal-specific maximum ratings, not a source current capability."
    },
    "KXCI-VS": {
      "category": "LEGACY-KXCI-VOLTAGE-SOURCE",
      "voltageMaxV": 20,
      "supportStatus": "documented by KXCI but not part of the modern 4200A module profile; block until separately identified",
      "evidence": [
        "kxci2025"
      ]
    },
    "KXCI-VM": {
      "category": "LEGACY-KXCI-VOLTAGE-METER",
      "measurementOnly": true,
      "supportStatus": "documented by KXCI but not part of the modern 4200A module profile; block until separately identified",
      "evidence": [
        "kxci2025"
      ]
    },
    "4200-CVU-PWR": {
      "category": "CVU-HIGH-POWER-ACCESSORY",
      "function": "High-power C-V option for 4210-CVU/4215-CVU",
      "dcBiasV": {
        "singleEndedMax": 200,
        "differentialMax": 400
      },
      "maxDcCurrentA": 0.3,
      "evidence": [
        "datasheet2025"
      ],
      "discovery": "not returned by *OPT?; requires exact instrumentinfo or operator confirmation"
    }
  },
  "rules": {
    "inventory": {
      "unknownToken": "block selected channel use",
      "missingInventory": "require explicit SMU/CVU model selection for offline planning; never substitute a lower-rated model; PMU/PGU may use their exact family specification for offline planning; mark hardwareVerified=false",
      "exactSmuModelUnknown": "use the exact *OPT? hardware class rating when it is identified (SMU=medium, HPSMU=high); do not reduce the electrical limits; keep model-specific load-capacitance behavior unavailable until the exact model is identified",
      "cvuModelUnknown": "do not silently substitute 4210-CVU limits; require exact SystemUtil model identification when connected, or explicit 4210-CVU/4215-CVU selection for offline planning",
      "externalAccessories": "CVIV, CVU-PWR and GNDU physical configuration must be verified separately; do not infer from *OPT?",
      "detailedQueries": "instrumentinfo and remotemoduleinfo are read-only SystemUtil KULT queries; integrate with UL/EX/GN/US sequence and always restore US in finally."
    },
    "smu": {
      "voltageSourceRangeThresholdV": 21,
      "maxAbsVoltageV": 210,
      "voltageSourceMaxCurrentAByPowerClassAndRange": {
        "medium": {
          "2": 0.105,
          "20": 0.105,
          "200": 0.0105,
          "0.2": 0.105
        },
        "high": {
          "2": 1.05,
          "20": 1.05,
          "200": 0.105,
          "0.2": 1.05
        }
      },
      "maxPowerW": {
        "medium": 2.1,
        "high": 21
      },
      "enforcePowerEnvelope": true,
      "currentComplianceFraction": {
        "min": 0.1,
        "max": 1
      },
      "voltageComplianceFraction": {
        "min": 0.1,
        "max": 1
      },
      "minCurrentRangeA": {
        "withoutPreamplifier": 1e-7,
        "withPreamplifier": 1e-12
      },
      "minCurrentComplianceA": {
        "withoutPreamplifier": 1e-8,
        "withPreamplifier": 1e-13
      },
      "currentSourceMaxA": {
        "medium": 0.105,
        "high": 1.05
      },
      "currentSourceFullScaleA": {
        "medium": 0.1,
        "high": 1
      },
      "currentSourceVoltageComplianceMaxV": {
        "medium": 210,
        "high": 210
      },
      "interlockRequiredFor200VRange": true,
      "note": "Use the range table and power envelope together. Do not treat headline maximum voltage and current as a simultaneously available rectangular operating area. Compliance must be between 10% and 100% of the selected range.",
      "rangeOverrangeFactor": 1.05
    },
    "pulse": {
      "loadDefinition": "minimum expected total resistance at the pulse output connector, including DUT and interconnect",
      "sourceVoltageFormula": "Vmax = Vrange * Rload / (50 + Rload)",
      "sourceCurrentFormula": "Imax = Vrange / (50 + Rload)",
      "instrumentCurrentCeilingAByRange": {
        "10": 0.2,
        "40": 0.8
      },
      "requireUserDutCurrentLimit": true,
      "effectiveCurrentLimitFormula": "min(userDutCurrentLimitA, Vrange/(50+Rload), instrumentShortCircuitCurrentLimitA)",
      "effectiveVoltageLimitFormula": "min(Vrange*Rload/(50+Rload), effectiveCurrentLimitA*Rload)",
      "requireKnownLoadForSafetyValidation": true,
      "pmuCurrentMeasureRangeIsNotOutputCurrentLimit": true,
      "rpmTimingMustBeUsedWhenRpmDetected": true,
      "rpmOutputVoltageMaxV": 10
    },
    "waveform": {
      "segmentArb": {
        "hardware": {
          "minSegmentTimeS": 2e-8,
          "maxSegmentTimeS": 40,
          "timeResolutionS": 1e-8,
          "maxSegments": 2048,
          "maxSequences": 512,
          "maxLoopsLibrary": 1000000000000,
          "minSegments": 1
        },
        "clariusExampleProfile": {
          "minSegments": 3,
          "maxSegmentTimeByRange": {
            "10V": 1,
            "40V": 1
          },
          "minSegmentTimeByRange": {
            "10V": 2e-8,
            "40V": 5e-8
          },
          "maxSegments": 2048,
          "maxSequences": 512,
          "maxLoops": 1000000000,
          "role": "reference-example-only; not a hardware capability limit",
          "notEnforced": true
        },
        "enforceProfile": "hardware",
        "continuityRequired": true,
        "channelSegmentDurationsMustMatch": true,
        "note": "The software enforces the published Segment ARB hardware range (20 ns to 40 s per segment, 10 ns resolution). Clarius example-library values are examples, not instrument limits.",
        "timingPolicy": "Hard validation uses only published Segment ARB hardware limits (20 ns to 40 s per segment and 10 ns resolution). Typical/recommended PMU pulse width, transition and settling figures are displayed as performance guidance and warnings, not used to reduce the hardware timing range."
      },
      "fullArb": {
        "allowed": false,
        "reason": "Exact current limits have not been extracted and validated; do not accept Full-ARB values yet."
      },
      "smuArbitrary": "SMU custom point lists are stepped SDM sweeps, not nanosecond pulse waveforms. Point interval must include source delay and measurement integration; auto-ranging and settling may extend it."
    },
    "cvu": {
      "requireExplicitModelWhenUsing1VRms": true,
      "unknownModelUses4210Limits": true,
      "internalBiasLimitV": 30,
      "externalSmuBiasLimitV": 210,
      "acCurrentMeasureRangesA": [
        0.000001,
        0.00003,
        0.001
      ],
      "requirePowerPackageForHighPowerBias": true
    },
    "cviv": {
      "maxVoltageV": 210,
      "maxCurrentA": 1,
      "requireEarthBonding": true,
      "requireChannelBlockersForUnusedInputs": true,
      "neverTreatAsSource": true
    },
    "gndu": {
      "neverTreatAsSource": true
    }
  },
  "kxciOptionTokens": {
    "SMU": {
      "family": "SMU",
      "powerClass": "medium",
      "preamplifier": false
    },
    "HPSMU": {
      "family": "SMU",
      "powerClass": "high",
      "preamplifier": false
    },
    "SMUPA": {
      "family": "SMU",
      "powerClass": "medium",
      "preamplifier": true
    },
    "HPSMUPA": {
      "family": "SMU",
      "powerClass": "high",
      "preamplifier": true
    },
    "CVU": {
      "family": "CVU"
    },
    "VPU": {
      "family": "PGU",
      "model": "4220-PGU"
    },
    "PMU": {
      "family": "PMU",
      "model": "4225-PMU",
      "rpm": false
    },
    "PMURPM": {
      "family": "PMU",
      "model": "4225-PMU",
      "rpm": true,
      "rpmChannels": "unknown"
    },
    "PMUnRPM1": {
      "family": "PMU",
      "model": "4225-PMU",
      "rpm": true,
      "rpmChannels": [
        1
      ]
    },
    "PMUnRPM2": {
      "family": "PMU",
      "model": "4225-PMU",
      "rpm": true,
      "rpmChannels": [
        2
      ]
    },
    "PMUnRPM1-2": {
      "family": "PMU",
      "model": "4225-PMU",
      "rpm": true,
      "rpmChannels": [
        1,
        2
      ]
    },
    "VS": {
      "family": "KXCI-VS",
      "voltageMaxV": 20
    },
    "VM": {
      "family": "KXCI-VM",
      "measurementOnly": true
    },
    "": {
      "family": "empty"
    }
  },
  "sources": [
    {
      "id": "officialCatalog2026",
      "title": "Tektronix official 4200A-SCS support and downloads catalog",
      "document": "Current official document index",
      "revision": "checked 2026-11-05",
      "url": "https://www.tek.com/en/support/datasheets-manuals-software-downloads?series=Keithley+4200A-SCS+Parameter+Analyzer",
      "sections": [
        "4200A-SCS datasheet 1KW-60780-7, latest official catalog listing dated 2026-10-22",
        "4200A-PMU-900-01D Rev.D manual listing dated 2026-10-22 (direct manual page) and Rev.C dated 2024-06-07 (support-catalog listing); revision discrepancy requires verification",
        "4200A-LPT-907-01E dated 2026-10-09",
        "4200A-KXCI-907-01F dated 2026-10-09",
        "4200A-914-01G Clarius manual dated 2026-10-09",
        "4200A-908-01G Setup and Maintenance manual dated 2025-07-03",
        "4200A-CVIV-900-01F dated 2025-04-30",
        "4200A-CVU-900-01B dated 2023-03-31",
        "4200A-SMU-900-01A dated 2020-12-15"
      ],
      "note": "Official catalog snapshot only. Numeric data still require a revision-by-revision comparison against the latest downloadable 2026 datasheet/manual files. Search result and catalog page disagree on the pulse-manual revision (Rev.D vs Rev.C); do not claim the 2026 Rev.D numeric content has been verified until its PDF is obtained."
    },
    {
      "id": "datasheet2025",
      "title": "4200A-SCS Parameter Analyzer Datasheet",
      "document": "1KW-60780-7",
      "revision": "2025-03-20; official catalog lists a newer 2026-10-22 edition requiring revision comparison",
      "url": "https://download.tek.com/datasheet/1KW-60780-7_4200A-SCS_Parameter_Analyzer_Datasheet_20250320.pdf",
      "sections": [
        "Instruments and Modules",
        "Source Measure Units",
        "SMU Current/Voltage Specifications",
        "PMU",
        "PGU",
        "Segment ARB",
        "RPM",
        "Ground Unit"
      ],
      "note": "Accessible official numerical baseline. The official support catalog lists a later 1KW-60780-7 release dated 2026-10-22; this database's numeric extraction has not yet been diffed against that later revision."
    },
    {
      "id": "setup2025",
      "title": "Model 4200A-SCS Setup and Maintenance User's Manual",
      "document": "4200A-908-01 Rev. F",
      "revision": "2025-03",
      "url": "https://download.tek.com/manual/4200A-908-01F_Setup_Maint_March_2025.pdf",
      "sections": [
        "Safety precautions",
        "Source-measure unit",
        "Ground unit",
        "Capacitance-Voltage Unit",
        "Pulse source-measure hardware"
      ],
      "note": "Rev.F March 2025 source used for the interlock rule; official catalog lists Rev.G July 2025."
    },
    {
      "id": "kxci2025",
      "title": "Model 4200A-SCS KXCI Remote Control Programming",
      "document": "4200A-KXCI-907-01 Rev. E",
      "revision": "2025-03",
      "url": "https://download.tek.com/manual/4200A-KXCI-907-01E_March2025.pdf",
      "sections": [
        "KXCI common commands",
        "*OPT?",
        "instrumentinfo",
        "remotemoduleinfo"
      ]
    },
    {
      "id": "cvuManual2023",
      "title": "Model 4200A-SCS Capacitance-Voltage Unit User's Manual",
      "document": "4200A-CVU-900-01 Rev. B",
      "revision": "2023-03",
      "url": "https://download.tek.com/manual/4200A-CVU-900-01B_March_2023.pdf",
      "sections": [
        "CVU test signal",
        "frequency steps",
        "AC drive",
        "DC bias",
        "current measure ranges"
      ]
    },
    {
      "id": "cvivManual2017",
      "title": "Model 4200A-CVIV Multi-Switch User's Manual",
      "document": "4200A-CVIV-900-01 Rev. B",
      "revision": "2017-11",
      "url": "https://download.tek.com/manual/4200A-CVIV-900-01B_Nov2017.pdf",
      "sections": [
        "General ratings",
        "bias tee switching",
        "grounding",
        "channel blockers"
      ],
      "note": "Older manual retained for detailed installation/grounding context; current official catalog lists CVIV manual Rev.F April 2025, so review newer revision before relying on old installation details."
    },
    {
      "id": "rpmManual2023",
      "title": "Model 4225-RPM Remote Pulse Module Instructions",
      "document": "PA-1086 Rev. B",
      "revision": "2023-03",
      "url": "https://download.tek.com/manual/PA-1086B_Mar_2023_4225-RPM.pdf",
      "sections": [
        "RPM overview",
        "current ranges",
        "connections"
      ]
    },
    {
      "id": "pulseReference2017",
      "title": "Model 4200-SCS Semiconductor Characterization System Reference Manual",
      "document": "4200-901-01 Rev. S",
      "revision": "2017-05",
      "url": "https://download.tek.com/manual/4200-901-01S_May2017_Ref_0.pdf",
      "sections": [
        "Models 4220-PGU, 4225-PMU, 4225-RPM",
        "pulse modes",
        "PMU timing tables",
        "RPM safety connection warning"
      ]
    },
    {
      "id": "pulseManual2020",
      "title": "Model 4200A-SCS Pulse Card (PGU and PMU) User's Manual",
      "document": "4200A-PMU-900-01 Rev. A",
      "revision": "2020-12",
      "url": "https://www.tek.com/-/media/documents/4200a-pmu-900-01a_dec_2020.pdf",
      "sections": [
        "PGU/PMU concepts",
        "pulse modes",
        "Segment ARB"
      ]
    },
    {
      "id": "smuReference2017",
      "title": "Model 4200A-SCS Parameter Analyzer Reference Manual",
      "document": "4200A-901-01 Rev. D",
      "revision": "2017-11",
      "url": "https://download.tek.com/manual/4200A-901-01D_Reference_Manual_Nov2017.pdf",
      "sections": [
        "SMU source-delay-measure cycle",
        "SMU current and voltage compliance",
        "PMU/PGU modes",
        "PMU sample limits",
        "Full-ARB and Segment-ARB",
        "CVU operation"
      ]
    },
    {
      "id": "segmentArbAppNote2025",
      "title": "Utilizing Segment Arb Waveform for High Speed IV Measurements Using the 4225-PMU Ultra-Fast Pulse Measure Unit",
      "document": "1KW-74155-0",
      "revision": "2025-05-08",
      "url": "https://download.tek.com/document/1KW741550UtilizingSegmentArbWaveformHighSpeedIVMeasurements4225PMUApplicationNote050825.pdf",
      "sections": [
        "Clarius Segment ARB library tests",
        "Appendix A: time per segment, number of segments, sequences, channel limits, loop count and transition constraints"
      ]
    },
    {
      "id": "datasheet2026Catalog",
      "title": "Tektronix official 4200A-SCS Parameter Analyzer Datasheet catalog entry",
      "document": "1KW-60780-7",
      "revision": "listed 2026-10-22",
      "url": "https://www.tek.com/en/support/datasheets-manuals-software-downloads?model=4200A-SCS",
      "sections": [
        "Latest datasheet listing and revision date"
      ],
      "note": "Catalog confirms a newer 2026 release but does not expose the downloadable PDF URL or numeric table in the accessible page extract. Numeric values must be diffed against the PDF before the database is marked fully current."
    },
    {
      "id": "pulseManual2026Catalog",
      "title": "Tektronix official Model 4200A-SCS Pulse Card (PGU and PMU) User Manual catalog entry",
      "document": "4200A-PMU-900-01D Rev.D per official manual detail page; Rev.C per support catalog",
      "revision": "2026-10-22 (detail page listing; catalog discrepancy)",
      "url": "https://www.tek.com/en/manual/parametric-analyzer/model-4200a-scs-pulse-card-pgu-and-pmu-users-manual-4200a-scs-parameter-analyzer",
      "sections": [
        "4220-PGU",
        "4225-PMU",
        "4225-RPM",
        "Segment ARB",
        "measurement timing"
      ],
      "note": "The official detail-page search result identifies Rev.D dated 2026-10-22, while the support catalog page currently lists Rev.C dated 2024-06-07. Obtain and diff the Rev.D PDF before updating numeric tables."
    },
    {
      "id": "stableLowCurrent2019",
      "title": "Making Stable Low Current Measurements with High Test Connection Capacitance Using the 4201-SMU and 4211-SMU",
      "document": "Tektronix application note",
      "revision": "official online application note; accessed 2026-11-05",
      "url": "https://www.tek.com/en/documents/application-note/making-stable-low-current-measurements-high-test-connection-capacitance",
      "sections": [
        "4201-SMU and 4211-SMU maximum load capacitance",
        "100 mA–1 A ranges: 100 µF",
        "100 nA–10 mA ranges: 10 µF",
        "4200-PA low-current ranges"
      ],
      "note": "Used to resolve the 4201-SMU 100 mA load-capacitance value; use the published 100 µF rating rather than a reduced 10 µF value."
    }
  ],
  "limitations": [
    "This is a reviewable baseline, not a calibration certificate or a guarantee for any particular physical instrument.",
    "The latest official catalog lists a 2026-03-12 datasheet; its PDF contents have not yet been diffed against the detailed 2025 numeric baseline. The 2025 baseline is explicitly identified.",
    "The 4200A-CVIV and 4200-CVU-PWR are not necessarily reported by *OPT?; SystemUtil instrumentinfo or operator confirmation is required.",
    "Physical interlock, fixture lid, protective earth, channel blockers, cable condition and DUT wiring cannot be proven by the module inventory.",
    "PMU/PGU 50-ohm load equations are nominal Thevenin estimates; use minimum expected total load resistance and the programmable output limit.",
    "DUT voltage, current, power, energy, pulse-width and thermal limits must be separately supplied. Instrument maximum ratings are not DUT safety limits.",
    "PMU timing table values are typical recommended minima and depend on load, cables, measurement window and selected range; they are not a guarantee of accuracy.",
    "Full-ARB numeric limits are not included; DKTS must block that mode until verified from the current official manual.",
    "SMU point timing is an SDM cycle and depends on source delay, measurement integration, range, settling and auto-ranging."
  ],
  "reviewStatus": "partial; hardware limits in the accessible official 2025 datasheet and documented manuals are recorded; later 2026 document revisions are catalogued but not yet fully diffed"
};
  if(typeof window!=='undefined')window.DKTS4200ACapabilities=database;
  if(typeof module!=='undefined'&&module.exports)module.exports=database;
})();
