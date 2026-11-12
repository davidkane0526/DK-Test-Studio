'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('Core mainline release contains only isolated native preview packages and no external plugin override',()=>{
 const fast=read('.github/workflows/ui-update.yml');
 const full=read('.github/workflows/dkts-framework-contract.yml');
 const core=read('.github/workflows/dkts-framework-contract.yml');
 assert.match(fast,/hot_update_available/);
 assert.match(fast,/update_channel == 'ui-hot'/);
 assert.doesNotMatch(fast,/files=\(dist\/DKTS-UI-bundle\.json\)/);
 assert.match(full,/DKTS-Core-Preview-Windows/);
 assert.match(full,/DKTS-Core-Preview-Android-TEST-SIGNED/);
 assert.match(full,/DKTS-Core-Preview-Android-FIXED-SIGNED/);
 assert.match(full,/DKTS-Core-Fixed-Signed-Android/);
 assert.match(full,/android\/signing-certificate\.sha256/);
 assert.match(full,/SHA256SUMS\.txt/);
 assert.match(full,/DKTS-4200A-Hardware-Capability-Database-v1\.json/);
 assert.match(full,/sha256sum \*\.exe \*\.apk \*\.json/);
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
 assert.match(fragment,/needs: \[change-scope, android-core-preview\]/);
 assert.match(fragment,/continue-on-error: true/);
 assert.match(fragment,/DKTS_ANDROID_KEYSTORE_B64/);
 assert.match(fragment,/--ks-type PKCS12/);
 assert.match(fragment,/apksigner|\$signer/);
 assert.match(fragment,/signing certificate drift detected/);
 assert.match(fragment,/studio\.dk\.test\.corepreview/);
 assert.doesNotMatch(fragment,/Checkout pinned DKDS|repository: davidkane0526\/DK-Data-Studio/);
});

test('every DKTS main push builds genuine DKDS Core Windows/Android packages, not only selected files',()=>{
 const core=read('.github/workflows/dkts-framework-contract.yml').replace(/\r\n/g,'\n');
 const publisher=read('.github/workflows/dkts-framework-contract.yml');
 assert(core.includes('  push:\n    branches: [main]\n  workflow_dispatch:'));
 assert.doesNotMatch(core,/  push:\n    branches: \[main\]\n    paths:/);
 assert.match(publisher,/publish-core-preview:/);
 assert.match(publisher,/github\.event_name == 'push'/);
});

test('Core preview publisher supports scoped Release token fallback without exposing secrets to DKDS',()=>{
 const release=read('.github/workflows/dkts-framework-contract.yml');
 const core=read('.github/workflows/dkts-framework-contract.yml');
 const publish=release.slice(release.indexOf('  publish-core-preview:'));
 assert.match(publish,/secrets\.DKTS_RELEASE_TOKEN \|\| github\.token/);
 assert.match(publish,/gh release create/);
 assert.match(release,/Retain verified EXE, APK, SHA256 and provenance even if Release permission is denied/);
 assert(!core.slice(0,core.indexOf('  publish-core-preview:')).includes('DKTS_RELEASE_TOKEN'),
  'signing and untrusted upstream Core build must not receive Release token');
});

test('Core publisher checks out DKTS before downloading artifacts to avoid deleting built EXE/APK',()=>{
 const flow=read('.github/workflows/dkts-framework-contract.yml');
 const checkout=flow.indexOf('name: Checkout trusted DKTS fingerprint and source identity');
 const download=flow.indexOf('name: Download only artifacts of the successful DKTS Core build');
 const verify=flow.indexOf('name: Verify source identity and both Core Preview packages');
 assert(checkout>=0&&download>checkout&&verify>download,
   'checkout must precede artifact downloads and identity verification');
 assert.match(flow,/mkdir -p artifacts signed-artifacts out/);
});

test('Core release runs only after same main push native Windows and Android acceptance',()=>{
 const core=read('.github/workflows/dkts-framework-contract.yml');
 const old=read('.github/workflows/dkts-framework-contract.yml');
 const pub=core.slice(core.indexOf('  publish-core-preview:'));
 assert.match(pub,/needs: \[change-scope, framework-readonly-check, windows-core-preview, android-core-preview, android-core-fixed-sign-preview\]/);
 assert.match(pub,/github\.event_name == 'push'/);
 assert.match(pub,/needs\.android-core-preview\.result == 'success'/);
 assert.match(pub,/needs\.windows-core-preview\.result == 'success'/);
 assert.match(pub,/contents: write/);
 assert.match(pub,/github\.run_id/);
 assert.match(pub,/github\.sha/);
 assert.match(pub,/Retain verified EXE, APK, SHA256 and provenance/);
 assert.match(pub,/gh release create/);
 assert.equal(fs.existsSync(require('node:path').resolve(__dirname,'../.github/workflows/windows-preview.yml')),false);
 assert(!core.slice(0,core.indexOf('  publish-core-preview:')).includes('DKTS_RELEASE_TOKEN'));
});
