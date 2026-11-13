# DK Test Studio unified release and update contract

## One application identity

- The application version is the DKTS package version, currently `V0.3.13`.
- Each main-branch application build receives one monotonic `aNNN` identity from the existing `.github/workflows/ui-update.yml` workflow run number. The workflow file path is intentionally retained so its historical run-number sequence is not reset; it now allocates the release identity only and does not publish a separate UI Release.
- The Core build resolves the sequence run for the exact same source SHA. That single `aNNN` is stamped into the Windows package metadata, Android `versionCode=100000+N`, Release tag, Release notes, and optional CSS bundle.
- The Android application ID and Windows application identity are the existing DKTS identity. Android uses the pinned DKTS signing certificate. There is no second `corepreview` package and no separately numbered Core Preview application.

## One Release per application build

- Release tag: `dkts-vX.Y.Z-aNNN`.
- Windows portable: `DKTS-Windows-VX.Y.Z-aNNN.exe`.
- Android APK: `DKTS-Android-VX.Y.Z-aNNN.apk`, signed with the pinned DKTS certificate.
- Optional CSS hot-update asset: `DKDS-UI-bundle.json`.
- Additional assets: the 4200A hardware capability/safety database, `SHA256SUMS.txt`, and `PROVENANCE.txt`.

Both native updaters and both CSS hot-update managers read the same DKTS Release list and the same `dkts-vX.Y.Z-aNNN` tag. The Windows and Android native updaters compare semantic application version first and numeric `aNNN` second, so `V0.3.13 a185` is newer than `V0.3.13 a184`. Native update selection also checks that the Release notes contain the exact `Build identity: aNNN` and `Android versionCode: 100000+N` declarations. Historical Releases without those declarations are ignored.

## Full package and hot-update relationship

- Every successful main-branch application change builds both the complete Windows portable package and the complete fixed-signed Android APK.
- A CSS-only change additionally builds the four-file `dkds-ui-v2` bundle and attaches it to that same Release. It does not create a second UI Release or a second `aNNN`.
- JavaScript, plugin manifests, native bridges, measurement logic, updater logic, package metadata, and other runtime changes publish the full packages without a CSS-only hot bundle.
- Documentation-only and workflow-only changes do not create application packages.
- Applying the CSS bundle does not change the installed native application version. It updates the UI revision shown in the version/update panel. A user who has already applied the hot update is not forced to install the full package; the matching full package remains available in the same Release.

## Update verification

- Windows portable updates verify the GitHub asset SHA-256 and size, re-check the cached file before installation, and replace the running portable executable only after the current process exits. The replacement script preserves the previous executable for rollback.
- Android updates verify the Release asset SHA-256, exact package ID, application version, `versionCode`, and equality of the APK signer with the installed application signer. Android's system package installer performs the user-confirmed installation.
- CSS hot updates verify the GitHub asset digest, each CSS resource digest, the exact four-file allowlist, application version and `aNNN`. The previous verified bundle is retained for rollback. Cached UI older than the installed native package is rejected.
- A missing or mismatched fixed Android signing secret fails the release job. A test-signed APK is never substituted into the installable Release.

## Read-only framework boundary

DKDS is checked out at the pinned source SHA as read-only framework input. DKTS branding, the 4200A plugin, V/a metadata, and updater adaptations are applied only to a disposable staging copy. The DKDS repository is never committed to or modified by the DKTS pipeline.

## Acceptance boundary

CI validates source staging, package construction, updater selection, package identity, signing, hashes, and rollback code paths. It does not prove that an APK has been installed over the user's existing device build, that a Windows portable replacement has succeeded on the user's machine, or that a real Keithley 4200A measurement has passed. Those remain device/hardware acceptance items, not reasons to create a second application identity.
