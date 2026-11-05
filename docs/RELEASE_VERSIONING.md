# DK Test Studio version identity

DKTS uses two independent identifiers for every development commit.

- **Program version `Vx.y.z`** is the complete downloadable package version. It is the Android `versionName` and the Electron package version. A UI-only hot update never changes it. Increment it, and Android `versionCode`, only when a new full-package version is intentionally released.
- **UI hot-update ID `aN`** is assigned from the `Fast UI Hot Update` GitHub Actions `run_number`. It advances for each UI development run and is independent of the program version.

For a given successful main-branch development run, both Actions workflows and both Releases must use the same pair, for example `V0.3.12 a1234`:

1. `Fast UI Hot Update` builds and publishes the UI bundle under a title containing `V0.3.12 a1234`.
2. `Native Shell Windows Android and DKDS Release` is triggered by `workflow_run`. It reuses the upstream run number and commit SHA, then publishes the complete Windows Portable, Android APK, DKDS plugin, UI bundle, and exportable 4200A hardware capability database under the same `V0.3.12 a1234` identity.
3. The installed application checks and installs **only** the `aN` UI hot update. It never presents a full-package upgrade prompt.
4. The full package remains available for manual download from GitHub Releases.

The UI bundle stores the full commit SHA for ancestry and rollback protection, `uiVersion` for the visible short hot-update ID, and `packageVersion` for the complete package identity. The app's header shows `Vx.y.z`; the `aN` identifier appears only inside the normally hidden update panel.

When bumping the complete program version, update `package.json`, Android `versionName` and `versionCode`, and the workflow `run-name` labels together. For UI-only commits, leave all three package-version fields unchanged.
