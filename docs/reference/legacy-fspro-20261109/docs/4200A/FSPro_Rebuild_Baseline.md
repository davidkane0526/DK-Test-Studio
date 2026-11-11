# 4200A / FS-Pro Standalone Rebuild — Engineering Baseline

Status: **architecture initialization only**. This branch is isolated from DKDS main and DKTS main. It is **not** an instrument-ready build.

## Immutable source baselines

- Base repository: `davidkane0526/DK-Data-Studio`, branch `4200` (DKDS 3.72.3), original base commit `20f056851a61d2144e9524c3ed568628d4b8557c`.
- Reference UI/specification: user-supplied `DKTS_FSPro_V6_full_retry.zip` (LabExpress/FS-Pro 2022.01). Primary reference: `ui_fidelity_v6/AGENT_UI_FIDELITY_V6.md`, `FSPro_UI_Blueprint_V6.json`, 35-row UI acceptance CSV, screenshots of manual pp. 7, 18–21, 43, 61–62. The user package is not included in Git history without an explicit source-artifact import.
- Offline semantic proof: user package V5 offline compiler, **65 pytest tests passed on 2026-11-07**; **zero instrument output tests**. Never treat this as hardware evidence.
- Hardware authority: Tektronix **4200A-KXCI-907-01F** (2026-10-09), and PMU user manual **4200A-PMU-900-01D** (2026-10-22), plus instrument firmware and installed slot/module enumeration. Older command index Rev E is not authoritative for release.

## Product boundary

Build a separate **DK Test Studio for 4200A** executable (Windows portable + independently signed Android app) from DKDS Core. Do not graft new forms onto the existing DKTS app or expose unrelated DKDS analytical workspaces.

Retain/reuse in-process DKDS Core: theme/presentation semantics, component dimensions and menus, DPI/touch handling, scientific plot/viewport/legend/export, project persistence, native file IO, task lifecycle, platform hosts, logging, update verification and release infrastructure.

Remove from **this product's composition**, not destructively from shared DKDS Core: plugin marketplace/manager, unrelated algorithms, resonance/TER/peak analysis, agent/MCP features, unrelated importers and multi-workspace scientific toolbars. There must be **no installable user plugin system** in the standalone 4200A build. Domain pages may use internal modules with explicit interfaces; these are not public plugins.

## UI source of truth

FS-Pro defines **structure and interaction semantics**, DKDS defines **visual tokens, rendering and control implementations**, 4200A defines **hardware limits and commands**.

Main screen: menu > toolbar > left Project/Device/Routine/Page tree > right multi-frame Visual Area > messages/test log/strategy. Do not replace the tree with cards.

Edit Page: `Info(Type,Polarity,Group,TestType,Name)` > `Unlock/Reset/Set Connection/AutoScale/UnScale` > `Sweep | Target | Strategy`.
Sweep: `RefNode | reference voltage | Outputs` > terminal-by-terminal vertically stacked source/reference/Condition/Xsweep/Psweep/segmented-generator rows > `Limits | Page Var | Associate Spec` bottom triptych > `OK | Cancel`.
Target: formula editor + Function Info; bottom Plot(X/Y/H/P), Page Var, Quote Var.
Strategy: Global/Local Setting and matching source/integration/range/hold/delay options.
Waveform editor: tree + operation rail left, setting/preview/channel tabs and segment table, measurement-event strip **at the bottom**.

Desktop geometry follows reference screenshots at the same viewport. Android narrow layouts may wrap inside rows/scroll but must preserve grouping and reading order. No self-invented explanatory paragraphs or redundant connection controls in test screens. Compare screenshots manually and programmatically where feasible; retain evidence for all 35 V6 UI acceptance criteria, recording intentional personal-lab scope exceptions.

## Deliberate simplification for individual research

- Keep **Project > Sample/Device > Routine > Page** and optional Spec/page variables as lightweight local files.
- Quick Project can be a shortcut into the **same Page model**, not a separately maintained measurement engine.
- Exclude for MVP: wafer/lot/batch production tracking, factory yield statistics, operator accounts/permissions, enterprise database and queue, multi-site scheduling and automatic probe station control.
- Do **not** remove DC, segmented sweeps, relative-reference, compliance, measurement range, IVT, pulse or waveform configuration merely because enterprise features are omitted.
- Preserve FS-Pro editors' positions for hardware-unsupported fields; show precise disabled reason, never dummy data.

## Architecture boundary (enforced)

```
Windows Electron / Android native host
    -> dedicated 4200A shell (DKDS component and plot runtimes)
        -> FS-Pro page / project / data-view models
            -> immutable TestPlan snapshot + typed validation
                -> mode-specific compiler (SMU / PMU / CVU)
                    -> exclusive broker / instrument capability gates
                        -> KXCI transport and execution/abort/recovery
                    -> raw data store (bytes, times, values, status, errors)
        -> DKDS scientific plot adapter (view of raw data only)
```

- GUI edits never send commands. Parameter field -> one typed TestPlan path; cannot use numeric ranges taken from simulated fixtures.
- Resource identity comes from real module inventory; unused channels may be `None`; source range, measurement range and compliance are **separate**.
- DC: exactly one Xsweep, at most one Psweep, remaining Condition. Nested P advances only after completing X according to the configured repetition, preserving pulse/ferroelectric ordering.
- The compiler may emit a **dry-run command preview** only; `executionAuthorized` remains false without validated hardware model, slot mapping, module-specific bounds, execution and safe-abort states.
- Per-process and cross-host hardware lease, no concurrent tests; lifecycle: PREPARE > VALIDATE > ARM > RUN > READ > FINALIZE, with STOP/FAULT/DISCONNECTED and instrument output verification.
- Keep device-native data distinct from computed plots. Persist snapshot hash, command trace, all raw readouts, device error/status and interruption info.
- 20 ns and other timing capabilities are enabled only when the **installed hardware and selected mode** genuinely support them, without arbitrary software conservatism.

## Update/release contract (single authoritative channel)

One release CI job creates **every commit's** Windows portable and signed Android APK, plus optional UI-only package and a **single signed/checksummed `release-manifest.json`**. All assets use one tuple `(nativeVersion, uiRevision=a<run>, nativeApi, commit)`; verify hashes and signatures before marking the release eligible. Do not advance the public `latest` pointer until all mandatory assets pass installation/launch/smoke checks.

Both hosts query one stable HTTPS manifest URL. This URL is configuration, **not** multiple guessed GitHub endpoints. Compare installed native capability to the release's required native API:
1. UI-compatible -> download, SHA-256 verify, stage atomically, activate and roll back on failure; **do not offer full installation** merely because a matching full build exists.
2. Native change required -> download verified platform installer/APK, preserving stable Android application id and release signing identity; use system installer on Android.
3. Network or bad manifest -> continue last verified cache; surface concise error. Never update active KXCI executor during a measurement.
4. Each commit still publishes complete installers and UI assets; UI-only users never need to reinstall.

Current branch is a clean baseline only: **CI is not yet wired to this manifest contract**, no build or Release is claimed.

## Order of implementation and gates

1. **Shell isolation**: dedicated build composition using DKDS Core, one instrument application. Verify desktop + Android launch and form controls visually; remove public plugin UI from this build.
2. **UI vertical slice**: reproduce FS-Pro Edit Page Sweep/Target/Strategy plus Connection dialog; bind typed data model; compare screenshots at reference viewport; fixed control widths/height, anchored menus, shared keypad on Android.
3. **Project/result workflow**: single-lab project tree, routine/page, multi-frame DKDS plots, native/raw export; 35 UI checks.
4. **SMU**: KXCI Rev F command mapping, installed-module capability map, full source/sweep/measure/stop and raw data under bench gate.
5. **IVT and PMU**, then CVU only if installed; waveforms follow actual hardware capabilities.
6. **Unified update pipeline**: one manifest, signature/hash checks, staging/rollback, Android installation and Windows portable verification.
7. CI: unit/integration + real screenshot snapshots; Windows and Android instrument-free smoke tests. Actual hardware tests run only with authorized instrument and DUT protection.

## Definition of done

No acceptance based solely on mocked measurements, passing unit tests or a green GitHub Action. Report separately: (a) UI reference screenshot parity, (b) offline plan compiler, (c) transport tests, (d) actual SMU/PMU/CVU verified operations, (e) safely stopped outputs, (f) complete published Release and hash-verified update tests.
