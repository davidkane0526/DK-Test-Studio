# DKTS architecture target — DKDS Core host with FS-Pro testing

Status: **binding target, migration in progress**, not a claim that existing standalone DKTS already uses the full DKDS host.

## Ownership and composition

```text
DK-Data-Studio upstream (read-only, pinned commit)
  ├── generic communication / TCP/SMB/AI services
  ├── UI theme, Unit controls, plot/data center, memory/history, web service
  ├── UI hot updater + local full-package updater
  └── non-analysis built-in plugins
       │ checked out/copied/filtered by DKTS CI; never commits upstream changes
       ▼
DK Test Studio source + branded distribution
  ├── DKDS Core renderer and workspaces (same actual framework, not clone)
  ├── all non-analysis DKDS plugins (manifest-driven exclusion)
  ├── FS-Pro navigation/editor layout under DKTS-owned workspace
  ├── KXCI 4200A transport adapters, strict safety and capability database
  ├── data collection, source-preserving raw artifacts, DKDS scientific plot
  └── Windows Portable / Android APK / hot UI / local full installer
```

## Upstream plugin retention policy
Do not remove DKDS Core, Data Center, scientific plotting/Unit controls, import, theme, communication, status bar, memory, SMB, AI, history, project and LAN/web infrastructure.
When creating **DKTS build staging only**, omit built-in analysis feature plugins (manifest `analysis.*` capabilities and named analysis workbenches/algorithm providers). Do not delete those plugins in the DKDS repository. Non-analysis plugins remain. The retained/excluded manifest and upstream SHA must be emitted as auditable build artifacts.

## FS-Pro / LabExpress source of truth
Work hierarchy: Project → Device → Routine → Page / Spec. Edit Page preserves Info/tools, Sweep, Target, Strategy, per-terminal rows, Limits, Page Var and Associate Spec. Terminal assignment must be visible at the test title and independently editable. Xsweep is the inner scan; Psweep is optional outer scan with its own start/end/step/range/speed and repetition policy. Pulse, IVT, PMU, PUND, arbitrary waveforms, endurance and retention follow the hardware capability database, not FS-Pro's source-meter electrical limits. Distinguish *read-only planned* from *verified executable*.

## UI / interactions
Keep DKDS plot engine, group-chart title/action styling, data center and canonical themes. Preserve original icons, taskbar icons, frameless native chrome, titlebar tabs, status bar, in-built scientific keypad, unified dropdown and controls. Remove click shadows. Default parameter inspector unlocked. Closing the port panel must never re-open parameters. None ports appear in port mapping only, never in parameters. Wide layouts place logically dependent controls on one row; narrow layouts wrap without changing control ownership. Add/select test types from project navigation.

## Instrument safety / provenance
A single resource lease controls instrument output. Modules, quadrants, range, compliance, power, time/pulse limit and cable/interlock are revalidated before output. KXCI raw collection is not a locally fabricated curve. Stop, connection loss and abnormal states must attempt safe shutdown and report uncertain output states explicitly.

## Migration acceptance gates (do not claim done until all pass)
A. DKDS host stages in a DKTS-owned directory with the upstream checkout unchanged and non-analysis plugin manifest verified.
B. DKTS-branded Windows/Android host runs with themes, memory, SMB, AI, history, LAN/web, Data Center, scientific plot, hot-update, and local full updater; visual evidence on desktop and Android.
C. One shared FS-Pro Edit Page/Scan/Port component and one domain model, with regression tests for X/P loops, None, panel independence, keyboard and chart headers.
D. Real 4200A read-only connection, KXCI instrument-output safety and raw capture independently validated. A build cannot substitute for instrument validation.

## No upstream writes
Developers may read/check out DKDS to build DKTS. No agent may push an upstream DKDS branch, PR, plugin, release, or fix in response to DKTS work without a fresh user instruction explicitly permitting it.
