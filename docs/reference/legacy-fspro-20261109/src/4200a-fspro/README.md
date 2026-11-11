# FS-Pro / 4200A rebuild preview — current implementation

**Branch:** `feat/4200a-fspro-rebuild` on DKDS `4200` baseline. **Status: standalone UI prototype; NOT released, NOT instrument-enabled.**

## Launch the Windows UI preview

From the repository checkout with the normal DKDS Electron dependencies installed:

```powershell
npx electron desktop/4200a-fspro-main.cjs
```

This opens the dedicated `src/4200a-fspro/index.html` without loading DKDS's unrelated analytical plugins. A browser may also open this HTML file directly; append `?open=edit` to view Edit Page immediately.

**Implementation:** This isolated screen loads DKDS `core.css`, theme contract, semantic registry, component runtime and style-ownership gate from the same repository. FS-Pro-specific geometry lives in one `editor.css` owner and parameter/state composition in `editor.js`. It does not import the legacy DKTS UI or old plugin application. `window.DK4200FSPro` exposes only read-only model access, local validation, and a preview-only module inventory injection method. There is **no KXCI output bridge** in this prototype.

## Completed in the prototype

- Main menu (File/Instruments/Measurement/Tools/Window/Help) with trigger-anchored menus and an initially empty Visual Area 2x2 Frame grid.
- Nested Project > Device > Routine > Page/Spec navigation; main Measure and Repeat disabled.
- Edit Page Info row; Lock/Unlock, Reset, Set Connection, AutoScale and UnScale **in original order**. AutoScale and UnScale disabled until supported source/range semantics are defined.
- Sweep > Target > Strategy tabs, with independent draft editing, Cancel rollback and Save.
- Sweep rows for four template terminals, Xsweep/Psweep exclusivity, per-terminal source mode, relative references and segment +/- controls; Limits/Page Var/Associate Spec bottom triptych.
- Target formula text draft (not executed) and Plot X/Y/H/P; Strategy global/local, integration and delay, and editable per-terminal auto/fixed range fields.
- Separate Connection editor; resource list defaults to None until injected with an instrument-discovered inventory; no fabricated installed SMU options.
- JSON import/export with offline model validation. No imitation measurement curves or native-data claims.
- DKDS component semantic hydration, desktop and responsive narrow-width CSS.

## Automated checks

- `node tests/test-4200a-page-plan-guard.cjs`: offline typed PagePlan safety/role/reference assertions.
- `node tests/test-4200a-release-contract.cjs`: single manifest validation and hot/full selection; **signature verification itself is not implemented** and must be supplied by a pinned-key verifier before any downloads are applied.
- `tests/test-4200a-ui-visual.cjs`: headless Chromium route, assertions and six screenshot files. CI workflow `.github/workflows/4200a-fspro-contract.yml` is set to generate uploadable screenshots. **Do not claim this visual acceptance has passed until the CI artifact was inspected.**

## Screenshot evidence target

- `01-main-workspace.png`
- `02-edit-page-sweep.png`
- `03-edit-page-target.png`
- `04-edit-page-strategy.png`
- `05-set-connection.png`
- `06-edit-page-narrow.png`

Compare them side by side against the **user-supplied** V6 manual screenshots at a matched viewport. Source screenshots intentionally are not checked into Git to avoid redistributing manual extracts.

## Acceptance tracking (V6 IDs)

| Item | Current state | Remaining gate |
|---|---|---|
| UI-001–004 | Implemented structurally | Screenshot and plot-host check |
| UI-005–006 | Nested device/routine/page/spec visible; Quick/Wafer omitted under personal-lab scope | Context menu + Quick Project entry not done |
| UI-007–011 | Implemented structurally | Visual geometry inspection and input accessibility |
| UI-012 | Offline role validator implemented | Check multi-page/sweep plan lifecycle |
| UI-013–015 | Segment controls; Limits/Page Var/Spec; compliance label mapping | Native mode-specific range/limit interpretation |
| UI-016–018 | Target and Strategy controls | Target expression evaluation and measurement strategy compiler |
| UI-019–020 | Independent Connection dialog and warning | Native module discovery and shared-preset persistence |
| UI-021–022 | Buttons/Frames visibly present; hardware actions disabled | Native data ingestion and DKDS plot binding |
| UI-023 | Not implemented | DKDS scientific plot widget and native data viewer |
| UI-024–029 | Not implemented | IVT, PMU, pulse, waveform, stress UI and hardware backends |
| UI-030 | Responsive CSS implemented | Android WebView screenshot and interaction testing |
| UI-031–032 | Unknown modules hidden from selectable resources; unsupported controls disabled | Real module lookup and comprehensive capability reasons |
| UI-033–035 | CI browser capture/tests authored | Verify actual CI screenshots and complete control-to-TestPlan mapping |

## Update architecture status

`src/4200a-fspro/update/release-contract.js` defines a **single manifest schema** and offline `decideUpdate` policy:
- same nativeVersion and nativeAbi, newer UI -> hot-update resource;
- changed native version/ABI -> platform installer;
- older release/unsupported platform/unverified signature -> blocked or no-op.

This is **NOT** a deployed stable manifest URL, updater, signed release, hash-checked download, rollback mechanism or Android installer. Those require an actual host integration, stable endpoint, fixed signing keys and production CI. Do not describe the current module as a working in-app updater.

## Next implementation boundary

1. Inspect generated CI screenshot artifacts and correct geometry against the V6 references.
2. Build real DKDS ScientificPlot Frame host and original raw-data viewer (empty until instrument data).
3. Connect trusted module inventory and source-limit capability database to these forms.
4. Implement KXCI compiler, stop and raw-data acquisition behind an instrument-exclusive safety broker; separately verify on a real 4200A before enabling Measure.
5. Package distinct native shells and deploy a single published update-feed endpoint and signed/verified release pipeline.

## New native raw-data viewer

The main Tools menu now offers **Import Native Raw Capture**, **Export Raw CSV** and **Data Viewer**. Imported files must conform to `dkts.4200a.native.raw.v1` and preserve a KXCI byte-frame transcript; chart numeric projection uses DKDS ScientificPlot while the Data Viewer and CSV retain original numeric strings. Every imported capture is explicitly labeled **imported-file**, not a live instrument measurement. Unknown/mock sources and captures without raw frames are rejected.

No firmware KXCI read command is sent by the importer. Installed module discovery and safe SMU/PMU output remain separate, unimplemented milestones.

## Signed update manifest generation (offline CLI only)

`tools/4200a/build-release-manifest.cjs` now computes SHA-256 and byte lengths for real UI/Windows/Android release artifacts, canonically serializes the manifest and signs it with **Ed25519**. It also provides a public-key signature verifier. This addresses the cryptographic contract, not downloading, installation, atomic rollback or stable release hosting.

Build configuration example (real files and URLs must replace these illustrative paths, never create a manifest for missing artifacts):

```json
{
  "channel":"preview","nativeVersion":"0.3.0","uiRevision":"a1234",
  "sequence":1234,"nativeAbi":1,"commit":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "releaseId":"v0.3.0-a1234",
  "assets":{
    "ui":{"path":"dist/ui.zip","url":"https://release.example.org/ui.zip"},
    "windows":{"path":"dist/windows.exe","url":"https://release.example.org/windows.exe"},
    "android":{"path":"dist/android.apk","url":"https://release.example.org/android.apk"}
  }
}
```

Invoke with `DK4200_ED25519_PRIVATE_KEY_PEM` and `DK4200_SIGNING_KEY_ID` in CI secrets:

```sh
node tools/4200a/build-release-manifest.cjs dist/release-config.json dist/release-manifest.json
```

No production signing key is committed. **Never publish the `latest` URL until all installer assets and app installation/launch verification have passed.** The code does not yet ship a working in-app update client or a verified app Release.

## Standalone Windows portable PREVIEW

The dedicated Windows build does **not** use DKDS's main version update path (which enforces V3.72.3 for the data analysis application).

- Stager: `scripts/4200a/stage-windows-preview.cjs`; dedicated workflow: `.github/workflows/4200a-preview-windows.yml`.
- Product identity: **DK Test Studio 4200A Preview**; native version `V0.3.0`; each GitHub build has UI revision `aNNN`.
- Run command from an installed Electron development checkout: `npx electron desktop/4200a-fspro-main.cjs`.
- Initial validated preview build **V0.3.0 a3**: independent Windows x64 portable EXE from GitHub Actions run `42394444322`, artifact ID `13581959802`. File name/size/SHA-256 were validated by the workflow; this is **not yet a physical Windows launch test**.
- The preview executable is unsigned, portable and **read-only KXCI**: only `*IDN?` then `*OPT?` through proven DKTS Ethernet/Wi-Fi network-route selection, persistent TCP session, and explicit Disconnect. It cannot send source/sweep/ME1 commands. The standalone branch does **not replace DKDS**, and the preview executable must not be mistaken for a verified measurement application.
- Workflow can publish a separate `DKTS-FSPro-V0.3.0-aNNN-preview` GitHub prerelease only **after** the complete Windows build and file verification. Publishing does not imply a hardware safety acceptance.
- The **Android native build is not ready**; DKDS generic Windows/Android workflow failures are due to DKDS's separate `FULL_APP_VERSION_BUMP_REQUIRED` protection and are not evidence that this standalone Windows preview failed.

## Offline native SMU compiler and acquisition pipeline

Reference doc: `docs/4200A/KXCI_Native_DC_Review.md`.

- Native DC VAR1/VAR2 compiler emits `DE/CH`, `SS/VC/IC/VR/IR/VP/IP`, `IT4/DT`, `SM/DM2/LI`, `MD/ME1`, `SP`, `DO`, and the `ME4` cleanup command sequence in an immutable **offline program**.
- No arbitrary 3-terminal restriction: up to six selected `LI` measurement functions across more verified terminals, including four-terminal X/P configurations.
- The runner only accepts `kind:'offline-mock'`. Failure, cancellation, or unconfirmed source shutdown are never reported as a successful DUT measurement.
- The DO parser retains native compliance prefix `N/C`, exact numeric text and raw bytes, with per-channel compliance status in CSV.
- Hardware output is **not wired to the native host** until direct testing against the installed 4200A modules and current Rev F documentation.
