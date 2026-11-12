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
# Confirm immersive mode before starting the app, so first-run Android system
# onboarding cannot occlude the actual DKTS UI screenshot.
adb shell settings put secure immersive_mode_confirmations confirmed >/dev/null || true
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

# uiautomator exposes Android system dialogs. The overlay can be present even
# when the React Native Activity is alive. Do not accept an occluded screenshot.
adb shell uiautomator dump /sdcard/dkts-core-viewport.xml >/dev/null 2>&1 || true
adb exec-out cat /sdcard/dkts-core-viewport.xml > "$OUT/phone-hierarchy.xml" 2>/dev/null || true
if grep -Fq 'Viewing full screen' "$OUT/phone-hierarchy.xml"; then
  # CI emulator is configured as 320x640. Never tap a guessed position on an
  # unrecognized screen size, where the tap could hit a test action instead.
  physical="$(adb shell wm size | tr -d '\r' | sed -n 's/^Physical size: //p' | head -n 1)"
  if [[ "$physical" != "320x640" ]]; then
    echo "CORE_SYSTEM_OVERLAY_UNEXPECTED_VIEWPORT: $physical" >&2
    exit 1
  fi
  adb shell input tap 260 208
  sleep 2
  adb shell uiautomator dump /sdcard/dkts-core-viewport.xml >/dev/null 2>&1 || true
  adb exec-out cat /sdcard/dkts-core-viewport.xml > "$OUT/phone-hierarchy.xml" 2>/dev/null || true
fi
if grep -Fq 'Viewing full screen' "$OUT/phone-hierarchy.xml"; then
  echo "CORE_SYSTEM_OVERLAY_NOT_DISMISSED: Android modal obstructs Core workbench" >&2
  exit 1
fi
adb exec-out screencap -p > "$OUT/phone.png"
if [[ $(wc -c < "$OUT/phone.png") -le 4000 ]]; then
  echo "CORE_PHONE_SCREENSHOT_EMPTY: inspect emulator display" >&2
  exit 1
fi
# In the one-column phone layout the Project Explorer precedes the editor.
# Scroll the actual app, then capture evidence that parameter content is reachable.
adb shell input swipe 275 550 275 170 500
sleep 2
adb exec-out screencap -p > "$OUT/phone-scrolled.png"
if [[ $(wc -c < "$OUT/phone-scrolled.png") -le 4000 ]]; then
  echo "CORE_PHONE_SCROLLED_SCREENSHOT_EMPTY" >&2
  exit 1
fi

# Cold-start at tablet-landscape dimensions so the viewport changes without
# inheriting the phone's deliberate page-scroll position. Verify persistence
# and a second clean launch, while preserving phone logs and screenshots.
adb shell wm size 1024x768
adb shell wm density 160
adb shell am force-stop "$PACKAGE"
adb shell am start -W -n "$PACKAGE/$ACTIVITY" | tee "$OUT/tablet-startup.txt"
sleep 10
adb shell pidof "$PACKAGE" > "$OUT/pid-tablet.txt"
test -s "$OUT/pid-tablet.txt"
adb exec-out screencap -p > "$OUT/tablet-landscape.png"
if [[ $(wc -c < "$OUT/tablet-landscape.png") -le 6000 ]]; then
  echo "CORE_TABLET_SCREENSHOT_EMPTY: inspect responsive DKDS layout" >&2
  exit 1
fi
# PNG IHDR encodes actual display dimensions, not a label invented in CI.
node -e "const fs=require('fs');for(const [p,w,h] of [['$OUT/phone.png',300,600],['$OUT/tablet-landscape.png',900,700]]){const b=fs.readFileSync(p);if(b.toString('ascii',1,4)!=='PNG'||b.readUInt32BE(16)<w||b.readUInt32BE(20)<h)throw Error('Invalid rendered screenshot: '+p)}"
adb shell wm size reset
adb shell wm density reset

# Preserve original runtime evidence. These are *error* checks, not proof
# that the rendered WebView matches FS-Pro on a physical Android tablet.
adb logcat -d -s ReactNativeJS:E ReactNative:E AndroidRuntime:E > "$OUT/runtime-errors.txt" || true
adb logcat -d -b crash > "$OUT/crash.log" || true
if grep -Eiq '(Unable to load script|Could not connect to development server|Unable to resolve module|FATAL EXCEPTION|Invariant Violation:.*bundle)' "$OUT/runtime-errors.txt"; then
  echo "CORE_OFFLINE_RUNTIME_FAILURE: Android emulator logcat matched fatal offline runtime error" >&2
  grep -Ein -C 2 "(Unable to load script|Could not connect to development server|Unable to resolve module|FATAL EXCEPTION|Invariant Violation:.*bundle)" "$OUT/runtime-errors.txt" | tail -n 65 >&2 || true
  exit 1
fi
if grep -Fq "Process: $PACKAGE" "$OUT/crash.log"; then
  echo "CORE_ANDROID_CRASH: emulator crash evidence" >&2
  tail -n 65 "$OUT/crash.log" >&2 || true
  exit 1
fi

echo "CORE_ANDROID_OFFLINE_EMULATOR_PASS: API 36 offline install, activity, process, unoccluded phone/tablet screenshots and error checks"
