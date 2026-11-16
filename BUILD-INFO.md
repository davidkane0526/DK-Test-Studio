# DKTS Cloud Workspace snapshot

- **Application version:** `V0.3.21`
- **Development identity:** `a201` (provisional local number; official monotonic number must be confirmed by the matching `ui-update.yml` run on `main`)
- **Baseline source ZIP:** `DK-Test-Studio-V0.3.20-final-build-policy-source.zip`
- **Baseline source ZIP SHA-256:** `8ac8abe8e7967955e97aa083562d6ebedc010e9caeb5d478eb308db9ee123582`
- **Pinned read-only DKDS source:** `20f056851a61d2144e9524c3ed568628d4b8557c`
- **Pinned DKDS ZIP SHA-256:** `ebf283772098f0de6182c7472c9360dec88ec40de13248bd930cc2b54af73225`
- **DKTS native plugin:** `0.8.8` (Plugin API 1.19; not the DKTS application version)
- **Staged Android versionCode:** `100201`

## This round (2026-11-14)

- Baseline source ZIP: `DK-Test-Studio-V0.3.19-a199-source.zip` (not the older a198 source).
- Improved graph PlotView header density: `显示` is a native DKDS Action menu with a checked graph type; `数据` remains a separate native menu with scoped Data Center sources and full-resolution raw CSV export.
- At widths <=980px the Page titlebar uses the existing compact `端口` Popover instead of four inline S/D/G/B controls. Wider hosts keep four controls in one row.
- Avoided needless full Page rebuilds on unchanged numeric, Page name and Page note fields. Page Variable unit is now committed on blur instead of each keystroke.
- Removed redundant Sweep instructional text and success notice, retaining the warning for unready scan configurations.
- Real Chromium CSS-only geometry fixture passed at 1200x768, 744x600 and 390x844; these are **not** Electron host or Android app screenshots.

## Local verification

- Full Node tests: 190/198 passing. Eight test failures depend on absent pinned `d3@7.9.0` and its generated UI assets.
- DKDS SDK 1.19 official plugin package normalizer: PASS for plugin 0.8.7.
- Native plugin VM tests and release identity tests: PASS.
- CSS-only Chromium geometry fixture: PASS for desktop, tablet and phone (not a host acceptance test).
- Real Electron / Windows Portable / Android APK build and physical device acceptance: not performed.
- No GitHub branches created and no push to `main`. DKDS upstream ZIP remains unmodified.

## 2026-11-16 · Final-only GitHub Actions policy checkpoint

- Program identity stays `V0.3.20` (no new native/UI runtime changes); previous local provisional `a200` remains a historical workspace identifier, **not a published Release**.
- Based directly on the complete V0.3.20 a200 source ZIP. DKDS pinned ZIP stays read-only.
- All cloud interim changes remain in a clean DKTS ZIP; no intermediate Windows/Android install builds and no GitHub pushes.
- Unified Core Release only compiles on the final `main` commit containing `[DKTS-FINAL-BUILD]` (no workflow_dispatch for this release). Build-heavy other workflows are manual only. The existing UI workflow retains the monotonic build counter.
- This checkpoint is a workflow configuration update only: **EXE/APK not compiled, GitHub main not updated, no Release published**.
- Focused source regression: 21/21; native plugin VM and host mock PASS; 13 GitHub workflow YAML configurations parsed successfully.

## 2026-11-16 · V0.3.21 a201 / Same-Core desktop browser preview

- Found two SDK geometry violations which prevented real DKDS Core from activating the DKTS TOP plugin: responsive `gap:0` and an unapproved 6-column grid. Corrected to `gap:0px` and the approved `repeat(6,minmax(80px,1fr))` geometry.
- Rendered the **same generated DKDS Core and DKTS native plugin** in browser DOM mode; Project Explorer, four PlotViews and Edit Page loaded with no JavaScript error after the fix. D3 was replaced by a test stub only for the internal screenshot pass (NOT a scientific renderer acceptance test).
- Improved compact headers and made S/D/G/B explicit in desktop selector display.
- Source version 0.3.21 and native plugin 0.8.8; a201 provisional pending actual main Actions.
- Local preview bundle uses the exact DKTS-derived DKDS Core HTML/CSS/JS; D3 7.9.0 must be downloaded on first launch. No EXE/APK compiled, no GitHub push, DKDS upstream untouched.

## Latest verification (2026-11-16)

- Node suite: **193/201 pass**; eight blocked by absent pinned D3 7.9.0 / dependent UI assets.
- Official DKDS Plugin API 1.19 validator, package normalizer and TOP installer: **PASS**, plugin v0.8.8.
- Browser DOM of derived DKDS Core: startup, graph workspace and Page editor **PASS** with a temporary D3 placeholder used only inside the screenshot test; real D3 plots and external downloads were not checked in this sandbox.
- Windows one-click `start-preview.cmd` provided but not executed on Windows in this Linux-only sandbox.
- GitHub and Windows/Android native builds intentionally NOT invoked.
