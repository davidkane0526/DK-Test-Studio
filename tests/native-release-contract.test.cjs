'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');

test('Windows and Android share one stable DKTS application identity',()=>{
 const stage=read('tools/stage-dkds-host.cjs');
 const flow=read('.github/workflows/dkts-framework-contract.yml');
 assert.match(stage,/const appId='studio\\.dk\\.test'/);
 assert.match(stage,/pkg\\.build\\.appId=appId/);
 assert.match(stage,/mobile\\.expo\\.android\\.package=appId/);
 assert.match(stage,/DKTS-Windows-V/);
 assert.match(stage,/DKTS-Android-V/);
 assert.match(stage,/dkts-v/);
 assert.match(flow,/name='studio\\.dk\\.test'/);
 assert.match(flow,/DKTS-Windows-V\\$\\{app_version\\}/);
 assert.match(flow,/DKTS-Android-V\\$\\{app_version\\}/);
 assert.match(flow,/tag="dkts-v\\$\\{app_version\\}-\\$UI_REV"/);
 assert.doesNotMatch(flow,/studio\\.dk\\.test\\.corepreview/);
});

test('the existing pinned Android signing identity is mandatory for a releasable APK',()=>{
 const flow=read('.github/workflows/dkts-framework-contract.yml');
 const fragment=flow.split('  android-core-fixed-sign-preview:')[1];
 assert.ok(fragment);
 assert.match(fragment,/DKTS_ANDROID_KEYSTORE_B64/);
 assert.match(fragment,/fixed DKTS Android signing identity is required/);
 assert.doesNotMatch(fragment,/continue-on-error/);
 assert.doesNotMatch(fragment,/TEST-SIGNED/);
 assert.match(fragment,/studio\\.dk\\.test/);
 assert.match(fragment,/100000\\+DKTS_BUILD_NUMBER/);
 assert.match(fragment,/signing certificate drift detected/);
});

test('CSS-only changes still build full native packages and attach the hot bundle to the same Release',()=>{
 const flow=read('.github/workflows/dkts-framework-contract.yml');
 const sequence=read('.github/workflows/ui-update.yml');
 assert.match(flow,/update_channel == 'ui-hot'/);
 assert.match(flow,/hot_update_available == 'true'/);
 assert.match(flow,/DKTS-Core-UI-a/);
 assert.match(flow,/actions\\/download-artifact@v4/);
 assert.match(flow,/tag="dkts-v/);
 assert.doesNotMatch(flow,/dkts-ui-v/);
 assert.match(sequence,/DKTS canonical release sequence/);
 assert.match(sequence,/github\\.run_number/);
 assert.doesNotMatch(sequence,/gh release create/);
});

test('DKTS keeps the external-plugin and read-only DKDS ownership boundary',()=>{
 const native=JSON.parse(read('integrations/dkds-native/plugin.json'));
 const legacy=JSON.parse(read('integrations/dkds/plugin.json'));
 assert.equal(native.id,legacy.id);
 assert.equal(native.pluginType,'workbench');
 assert.equal(legacy.pluginType,'developer');
 assert.match(read('AGENTS.md'),/Do NOT write any DKDS source/);
 assert.match(read('docs/ARCHITECTURE_TARGET.md'),/DKDS Core host/);
});

test('one Release contains the portable EXE, pinned APK, checksums and optional CSS bundle',()=>{
 const flow=read('.github/workflows/dkts-framework-contract.yml');
 const publisher=flow.slice(flow.indexOf('  publish-core-preview:'));
 assert.match(publisher,/DKTS-Windows-V/);
 assert.match(publisher,/DKTS-Android-V/);
 assert.match(publisher,/sha256sum \\*\\.exe \\*\\.apk \\*\\.json/);
 assert.match(publisher,/Build identity: \\$UI_REV/);
 assert.match(publisher,/Android versionCode: \\$\\(\\(100000\\+\\$\\{UI_REV#a\\}\\)\\)/);
 assert.match(publisher,/gh release create/);
 assert.match(publisher,/--prerelease/);
 assert.match(publisher,/needs\\.android-core-fixed-sign-preview\\.result == 'success'/);
 assert.doesNotMatch(publisher,/NOT a production in-place upgrade/);
});
