'use strict';
// Regression: reactivecircus/android-emulator-runner runs each inline script
// line in its own /bin/sh process. The emulator smoke MUST be one executable.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const child=require('node:child_process');
const root=path.resolve(__dirname,'..');
const workflow=fs.readFileSync(
 path.join(root,'.github/workflows/dkts-framework-contract.yml'),'utf8');
const scriptPath=path.join(root,'tools/run-core-android-smoke.sh');
const script=fs.readFileSync(scriptPath,'utf8');

test('Android 16 emulator launches one shell with shared APK/Activity variables',()=>{
 assert.match(workflow,/script: bash tools\/run-core-android-smoke\.sh/);
 assert.doesNotMatch(workflow,/script: \|\n\s+set -eu\n\s+apk=/);
 assert.match(script,/^#!\/usr\/bin\/env bash$/m);
 assert.match(script,/^set -euo pipefail$/m);
 assert.match(script,/^adb install -r "\$APK"/m);
 assert.match(script,/^adb shell am start -W -n "\$PACKAGE\/\$ACTIVITY"/m);
 assert.match(script,/^adb shell pidof "\$PACKAGE"/m);
 assert.match(script,/^adb exec-out screencap -p > "\$OUT\/phone\.png"/m);
 assert.match(script,/^adb exec-out screencap -p > "\$OUT\/tablet-landscape\.png"/m);
 assert.match(script,/^adb exec-out screencap -p > "\$OUT\/phone-scrolled\.png"/m);
 assert.match(script,/Viewing full screen/);
 assert.match(script,/CORE_SYSTEM_OVERLAY_NOT_DISMISSED/);
 assert.match(script,/wm size 1024x768/);
 assert.match(script,/wm density 160/);
 assert.match(script,/adb shell am force-stop "\$PACKAGE"/);
 assert.match(script,/adb shell am start -W -n "\$PACKAGE\/\$ACTIVITY" \| tee "\$OUT\/tablet-startup\.txt"/);
 assert.match(script,/^adb logcat -d -b crash/m);
 assert.match(workflow,/assembleRelease -PreactNativeArchitectures=arm64-v8a,x86_64/);
 assert.match(workflow,/grep -Fxq 'assets\/index\.android\.bundle'/);
 assert.match(workflow,/apksigner.*verify --print-certs/);
 assert.doesNotMatch(workflow,/assembleDebug/);
});
test('Android offline launcher has valid Bash syntax',()=>{
 if(process.platform==='win32')return; // Ubuntu CI checks this directly.
 const check=child.spawnSync('bash',['-n',scriptPath],{encoding:'utf8'});
 assert.equal(check.status,0,check.stderr);
});

test('system UiAutomation FATAL EXCEPTION cannot fail DKTS unless its own process crashed',()=>{
 const cmd=script.match(/if grep -Eiq '([^']+)' "\$OUT\/runtime-errors\.txt"; then/);
 assert.ok(cmd,'offline bundle failure filter must exist');
 assert.doesNotMatch(cmd[1],/FATAL EXCEPTION/);
 assert.match(cmd[1],/Unable to load script/);
 assert.match(script,/if grep -Fq "Process: \$PACKAGE" "\$OUT\/crash\.log"; then/);
 assert.match(script,/UiAutomation/);
});
