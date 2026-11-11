#!/usr/bin/env bash
# This script runs as ONE process. reactivecircus/android-emulator-runner executes
# each inline "script:" line in a fresh shell; shell variables cannot survive it.
# This is a preview-only OFFLINE Android runtime test. No 4200A output is allowed.
set -euo pipefail

APK="${DKTS_CORE_PREVIEW_APK:-dist/dkts-framework-staging/mobile/android/app/build/outputs/apk/release/app-release.apk}"
PACKAGE="studio.dk.test.corepreview"
OUT="dist/core-android-smoke"
AAPT="${ANDROID_HOME:?Android SDK must be configured}/build-tools/36.0.0/aapt"

mkdir -p "$OUT"
if [[ ! -s "$APK" ]]; then
  echo "CORE_APK_MISSING: release APK not found: $APK" >&2
  exit 1
fi
if [[ ! -x "$AAPT" ]]; then
  echo "CORE_AAPT_MISSING: SDK 36 build tools are required" >&2
  exit 1
fi

# Use the manifest declared launchable Activity. Do not guess the React Native
# Activity class or infer success from a successful Gradle build.
"$AAPT" dump badging "$APK" > "$OUT/apk-badging.txt"
if ! grep -Fq "name='$PACKAGE'" "$OUT/apk-badging.txt"; then
  echo "CORE_PACKAGE_MISMATCH: refusing to install APK under another identity" >&2
  exit 1
fi
ACTIVITY="$(sed -n "s/^launchable-activity: name='\([^']*\)'.*/\1/p" "$OUT/apk-badging.txt" | head -n 1)"
if [[ -z "$ACTIVITY" ]]; then
  echo "CORE_ACTIVITY_MISSING: APK has no launchable activity" >&2
  exit 1
fi
printf 'package=%s\nactivity=%s\n' "$PACKAGE" "$ACTIVITY" > "$OUT/identity.txt"

adb wait-for-device
adb install -r "$APK" | tee "$OUT/install.txt"
adb logcat -c
adb shell am start -W -n "$PACKAGE/$ACTIVITY" | tee "$OUT/startup.txt"
if grep -Eiq '(Error type|does not exist|SecurityException)' "$OUT/startup.txt"; then
  echo "CORE_ACTIVITY_START_FAILED: inspect startup.txt" >&2
  exit 1
fi

# Allow the offline Hermes/React Native bundle and embedded DKDS WebView to boot.
sleep 18
adb shell pidof "$PACKAGE" | tee "$OUT/pid.txt"
test -s "$OUT/pid.txt"
adb shell dumpsys activity activities > "$OUT/activity-state.txt"
adb exec-out screencap -p > "$OUT/screen.png"
if [[ $(wc -c < "$OUT/screen.png") -le 4000 ]]; then
  echo "CORE_SCREENSHOT_EMPTY: inspect emulator display" >&2
  exit 1
fi

# Preserve original runtime evidence. These are *error* checks, not proof
# that the rendered WebView matches FS-Pro on a physical Android tablet.
adb logcat -d -s ReactNativeJS:E ReactNative:E AndroidRuntime:E > "$OUT/runtime-errors.txt" || true
adb logcat -d -b crash > "$OUT/crash.log" || true
if grep -Eiq '(Unable to load script|Could not connect to development server|Unable to resolve module|FATAL EXCEPTION|Invariant Violation:.*bundle)' "$OUT/runtime-errors.txt"; then
  echo "CORE_OFFLINE_RUNTIME_FAILURE: inspect runtime-errors.txt" >&2
  exit 1
fi
if grep -Fq "Process: $PACKAGE" "$OUT/crash.log"; then
  echo "CORE_ANDROID_CRASH: inspect crash.log" >&2
  exit 1
fi

echo "CORE_ANDROID_OFFLINE_EMULATOR_PASS: API 36 install, activity, process, screenshot and error checks"
