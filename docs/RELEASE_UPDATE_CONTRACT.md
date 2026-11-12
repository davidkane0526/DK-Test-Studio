# DK Test Studio Core Preview release and update contract

## One canonical V/a identity

- The visible application version is the package semver, currently `V0.3.13`.
- The canonical build identity `aNNN` comes from the **DKTS Core Preview workflow run number**. The separate UI workflow must resolve that same Core run number for the same commit; it must never use its own workflow run number.
- Windows package metadata stores `dktsBuildId=aNNN`.
- Android `versionCode` is `100000 + N`, where N is the numeric suffix of the same `aNNN`.
- The same V/a pair is stamped into package metadata, release tags, Windows and Android assets, updater status, and UI hot-update bundles.

## Core Preview assets

- Full Core Preview release tag: `dkts-core-preview-v0.3.13-aNNN`.
- Windows portable: `DKTS-Core-Preview-Windows-V0.3.13-aNNN.exe`.
- Android fixed-signed APK: `DKTS-Core-Preview-Android-FIXED-SIGNED-V0.3.13-aNNN.apk`.
- Android package ID: `studio.dk.test.corepreview`.
- The Android Core Preview is intentionally isolated from the stable `studio.dk.test` application. It must not overwrite or require uninstalling the stable application.
- Android in-app native updates are offered only when the release contains an APK signed by the pinned DKTS certificate. Unsigned or test-signed artifacts are never accepted by the updater.

The Windows and Android native updaters compare application semver first and numeric build identity second. A newer `aNNN` is therefore a valid update even when the visible version remains `V0.3.13`.

## CSS-only hot-update channel

- A change limited to `integrations/dkds-native/ui-shell.css` publishes only a Core UI hot update. It does not build a new APK or EXE.
- Hot-update tag: `dkts-ui-v0.3.13-aNNN`, asset: `DKDS-UI-bundle.json`.
- Bundle schema: `dkds-ui-v2`, repository: `davidkane0526/DK-Test-Studio`.
- The bundle contains the three approved DKDS Core CSS resources and the DKTS 4200A workspace stylesheet at `src/plugins/dkts-4200a/ui-shell.css`.
- Desktop and Android validate the application version, build identity, GitHub asset SHA-256, per-file SHA-256, and exact CSS allowlist before activation.
- A cached hot update older than the installed native package is ignored. The previous verified bundle is retained for rollback.

JavaScript, plugin manifests, native bridges, measurement logic, updater logic, package metadata, and other runtime changes require a full Core Preview package. If a commit changes both CSS and runtime code, the full package contains the CSS and a separate hot update is not published. Documentation- and workflow-only changes do not create an application package.

## Read-only framework boundary

DKDS is checked out at a pinned commit as read-only framework source. DKTS branding, the 4200A plugin, V/a metadata, and updater adaptations are applied only to a disposable staging copy. The DKDS repository is never committed to or modified by the DKTS pipeline.
