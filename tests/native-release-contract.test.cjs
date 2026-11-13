'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');

test('Windows and Android share one stable DKTS application identity',()=>{
 const stage=read('tools/stage-dkds-host.cjs');
 const flow=read('.github/workflows/dkts-framework-contract.yml');
 assert.ok(stage.includes("const appId='studio.dk.test'"));
 assert.ok(stage.includes('pkg.build.appId=appId'));
 assert.ok(stage.includes('mobile.expo.android.package=appId'));
 assert.ok(stage.includes('DKTS-Windows-V'));
 assert.ok(stage.includes('DKTS-Android-V'));
 assert.ok(stage.includes('dkts-v'));
 assert.ok(flow.includes("name='studio.dk.test'"));
 assert.ok(flow.includes('DKTS-Windows-V\${app_version}'));
 assert.ok(flow.includes('DKTS-Android-V\${app_version}'));
 assert.ok(flow.includes('tag="dkts-v\${app_version}-$UI_REV"'));
 assert.ok(!flow.includes('studio.dk.test.corepreview'));
});

test('the existing pinned Android signing identity is mandatory for a releasable APK',()=>{
 const flow=read('.github/workflows/dkts-framework-contract.yml');
 const fragment=flow.split('  android-core-fixed-sign-preview:')[1];
 assert.ok(fragment);
 assert.ok(fragment.includes('DKTS_ANDROID_KEYSTORE_B64'));
 assert.ok(fragment.includes('fixed DKTS Android signing identity is required'));
 assert.ok(!fragment.includes('continue-on-error'));
 assert.ok(!fragment.includes('TEST-SIGNED'));
 assert.ok(fragment.includes("studio.dk.test"));
 assert.ok(fragment.includes('100000+DKTS_BUILD_NUMBER'));
 assert.ok(fragment.includes('signing certificate drift detected'));
});

test('CSS-only changes still build full native packages and attach the hot bundle to the same Release',()=>{
 const flow=read('.github/workflows/dkts-framework-contract.yml');
 const sequence=read('.github/workflows/ui-update.yml');
 assert.ok(flow.includes("update_channel == 'ui-hot'"));
 assert.ok(flow.includes("hot_update_available == 'true'"));
 assert.ok(flow.includes('DKTS-Core-UI-a'));
 assert.ok(flow.includes('actions/download-artifact@v4'));
 assert.ok(flow.includes('tag="dkts-v'));
 assert.ok(!flow.includes('dkts-ui-v'));
 assert.ok(sequence.includes('DKTS canonical release sequence'));
 assert.ok(sequence.includes('github.run_number'));
 assert.ok(!sequence.includes('gh release create'));
});

test('DKTS keeps the external-plugin and read-only DKDS ownership boundary',()=>{
 const native=JSON.parse(read('integrations/dkds-native/plugin.json'));
 const legacy=JSON.parse(read('integrations/dkds/plugin.json'));
 assert.equal(native.id,legacy.id);
 assert.equal(native.pluginType,'workbench');
 assert.equal(legacy.pluginType,'developer');
 assert.ok(read('AGENTS.md').includes('Do NOT write any DKDS source'));
 assert.ok(read('docs/ARCHITECTURE_TARGET.md').includes('DKDS Core host'));
});

test('one Release contains the portable EXE, pinned APK, checksums and optional CSS bundle',()=>{
 const flow=read('.github/workflows/dkts-framework-contract.yml');
 const publisher=flow.slice(flow.indexOf('  publish-core-preview:'));
 assert.ok(publisher.includes('DKTS-Windows-V'));
 assert.ok(publisher.includes('DKTS-Android-V'));
 assert.ok(publisher.includes('sha256sum *.exe *.apk *.json'));
 assert.ok(publisher.includes('Build identity: $UI_REV'));
 assert.ok(publisher.includes('Android versionCode: $((100000+\${UI_REV#a}))'));
 assert.ok(publisher.includes('gh release create'));
 assert.ok(publisher.includes('--prerelease'));
 assert.ok(publisher.includes("needs.android-core-fixed-sign-preview.result == 'success'"));
 assert.ok(!publisher.includes('NOT a production in-place upgrade'));
});
