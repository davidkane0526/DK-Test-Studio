# P0 original command audit — 2026-11-25
Scope: existing FS-Pro-style DC / Time / Pulse / Segment Arb / Routine and data pipeline, not derived measurement templates. Source review does not constitute commissioning.

## Evidence
- User-supplied 4200A-KXCI-907-01F, September 2026, pp. 38–44 (printed 4-7–4-13): UL/EX/EF/GD/GN/GR/AB; EX initializes, EF preserves configuration; GN output arrays below 16000 elements, semicolon separated; GD describes a named library/module. User libraries must exist on the instrument. pulse_measrt and PostDataDoubleBuffer are incompatible with KXCI-called UTMs.
- Same manual pp. 100–102 (5-51–5-53): RG lowest autorange; RI immediate current range and compliance; RK skips ranges. No explicit guarantee of a persistent fixed measurement range across a ME1 sweep.
- Same manual pp. 142–144 (7-7–7-9): PMU COUNT? and DATA:GET during execution, nondestructive indexed reads, shorter replies allowed; final drain after output-off; one instrument start, host only receives data.
- Same manual printed 7-29: STEP:PULSE:BASE documented for pulse I-V. Do not assume waveform nested STEP support.
- [Keithley LPT programming Rev D](https://download.tek.com/manual/4200A-LPT-907-01D_LPT_May_2024.pdf): rangei/rangev and setauto distinguish fixed measurement range from automatic ranging; pulse_exec, pulse_exec_status, pulse_fetch and dev_abort support local pulse lifecycle. No promise of independent SMU and PMU common nanosecond trigger.
- [Keithley PMU user manual Rev B](https://download.tek.com/manual/4200A-PMU-900-01B_March_2023.pdf), 3-47: PMU_IV_sweep_Example permits auxiliary SMU DC bias during pulse I-V, but that SMU cannot be associated with RPM. This is proof of supported mixed bias in a user module, not proof that a particular installed KXCI library is callable or that arbitrary synchronized waveforms are supported.
- Current DKDS ScientificPlot implementation is single-Y-axis. Target H is exposed as a separate plot frame without editing DKDS; same-frame twin axis not claimed.

## Implementation status
| Area | Source implementation | Remaining acceptance/implementation |
| --- | --- | --- |
| Generator | affine VAR1 prime; nonlinear getx/getp compiled as native VL/IL lists with original point provenance, 4096 list limit | Multi-channel list commissioning, further function coverage |
| Pulse | amplitude/base including outer base step; two-channel equal-length waveform/fixed companion plan | Actual firmware and topology acceptance, nested waveform not inferred |
| PMU acquisition | live per-channel cursor, bounded reads, final drain, abort/off sequencing, raw channel provenance | Firmware response framing and count semantics under actual operation |
| Target | H separate frame, P filter by planned source values, scalar formula, derived full-resolution CSV | Core vector generation, sum, derivatives and integral now integrated on recovery branch; remaining linefit/threshold/query/smoothing algorithms and same-frame second axis |
| SMU range | Auto and limited-auto, immediate RI path | Persistent range lock via instrument LPT user module, not by relabeling RI |
| Time | multi-segment native lists, shared clock | Independent event clocks need instrument-side scheduling; preserve actual sample timestamps |
| Mixed SMU/PMU | sequential routine | Compatible auxiliary SMU DC-bias UTM and real instrument deployment; no simultaneous RPM path claim |

## Required hardware verification
Check actual installed Clarius/KXCI revision, module IDs and wiring; Rev F documentation alone does not certify an older installed version. Use known safe test loads and verify routing, range, waveform, timestamps, returned counts and output-off state. Do not issue an unverified EX/EF library name or module signature. Read the installed module metadata and validate compatibility first. For native mixed-output and fixed-range UTM work, use the instrument's matching KULT/LPT SDK, compile/install only under explicit user approval, verify each path on the instrument, and ensure AB / error / disconnect behavior. No new safety gate was opened by this audit. Do not mark P0 complete merely because an API exists.
