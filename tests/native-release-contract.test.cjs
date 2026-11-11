'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('Core mainline release contains only isolated native preview packages and no external plugin override',()=>{
 const fast=read('.github/workflows/ui-update.yml');
 const full=read('.github/workflows/windows-preview.yml');
 const core=read('.github/workflows/dkts-framework-contract.yml');
 assert.match(fast,/hotUpdateAvailable/);
 assert.doesNotMatch(fast,/files=\(dist\/DKTS-UI-bundle\.json\)/);
 assert.match(full,/DKTS-Core-Preview-Windows/);
 assert.match(full,/DKTS-Core-Preview-Android-TEST-SIGNED/);
 assert.match(full,/DKTS-Core-Preview-Android-FIXED-SIGNED/);
 assert.match(full,/DKTS-Core-Fixed-Signed-Android/);
 assert.match(full,/android\/signing-certificate\.sha256/);
 assert.match(full,/SHA256SUMS\.txt/);
 assert.match(full,/gh run download/);
 assert.match(full,/--prerelease/);
 assert.match(full,/NOT a production in-place upgrade/);
 assert.match(core,/Actual DKDS Core Electron boot/);
 assert.match(core,/studio\.dk\.test\.corepreview/);
 for(const src of [fast,full]){
  assert.doesNotMatch(src,/release\/plugin\/\*\.dkplugin|files=\([^\n]*DKTS-4200A-(?:legacy|native)/);
 }
 const manual=read('.github/workflows/dkds-native-core-plugin.yml');
 assert.match(manual,/github.event_name == 'workflow_dispatch'/);
});
test('DKTS retains optional plugin source but not a built-in DKDS copy',()=>{
 const native=JSON.parse(read('integrations/dkds-native/plugin.json'));
 const legacy=JSON.parse(read('integrations/dkds/plugin.json'));
 assert.equal(native.id,legacy.id);
 assert.equal(native.pluginType,'workbench');
 assert.equal(legacy.pluginType,'developer');
 assert.match(read('AGENTS.md'),/Do NOT write any DKDS source/);
 assert.match(read('docs/ARCHITECTURE_TARGET.md'),/DKDS Core host/);
});

test('optional pinned signer receives no DKDS source and verifies the real APK certificate',()=>{
 const y=read('.github/workflows/dkts-framework-contract.yml');
 const fragment=y.split('  android-core-fixed-sign-preview:')[1];
 assert.ok(fragment,'fixed certificate step must exist');
 assert.match(fragment,/needs: android-core-preview/);
 assert.match(fragment,/continue-on-error: true/);
 assert.match(fragment,/DKTS_ANDROID_KEYSTORE_B64/);
 assert.match(fragment,/--ks-type PKCS12/);
 assert.match(fragment,/apksigner|\$signer/);
 assert.match(fragment,/signing certificate drift detected/);
 assert.match(fragment,/studio\.dk\.test\.corepreview/);
 assert.doesNotMatch(fragment,/Checkout pinned DKDS|repository: davidkane0526\/DK-Data-Studio/);
});
