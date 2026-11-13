#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(process.argv[2]||'dist/dkts-framework-staging');
const windows=require(path.join(root,'desktop/native-update.js'));
const android=fs.readFileSync(path.join(root,'mobile/plugins/DkdsAppUpdate.template'),'utf8');
const androidHot=fs.readFileSync(path.join(root,'mobile/plugins/DkdsUiHotUpdate.template'),'utf8');
const packageJson=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const appJson=JSON.parse(fs.readFileSync(path.join(root,'mobile/app.json'),'utf8'));
const profile=JSON.parse(fs.readFileSync(path.join(root,'DKTS_FRAMEWORK_STAGING.json'),'utf8'));
const updaterUi=fs.readFileSync(path.join(root,'src/app/modules/floating-docks.js'),'utf8');
const ipc=fs.readFileSync(path.join(root,'desktop/main-modules/online-update-ipc.js'),'utf8');
const digest='sha256:'+'a'.repeat(64);
function release(version,buildId,options={}){
 const tag=`dkts-v${version}-${buildId}`;
 const asset=`DKTS-Windows-V${version}-${buildId}.exe`;
 const body=options.body===undefined
  ? `Build identity: ${buildId}\nAndroid versionCode: ${100000+Number(buildId.slice(1))}`
  : options.body;
 const name=options.assetName||asset;
 return {tag_name:tag,body,draft:!!options.draft,assets:[{name,browser_download_url:`https://github.com/davidkane0526/DK-Test-Studio/releases/download/${tag}/${name}`,size:options.size||90000000,digest:options.digest||digest}]};
}
const a184=release('0.3.13','a184'),a185=release('0.3.13','a185');
const legacy=release('0.3.13','a184',{body:'Legacy release created before the V/a and Android versionCode counters were unified.'});
assert.equal(windows.pickRelease([legacy],'0.3.13','a179'),null);
assert.equal(windows.pickRelease([a184],'0.3.13','a184'),null);
assert.equal(windows.pickRelease([a184,a185],'0.3.13','a184').buildId,'a185');
assert.equal(windows.pickRelease([release('0.3.13','a1000')],'0.3.13','a999').buildId,'a1000');
assert.equal(windows.pickRelease([release('0.3.14','a1')],'0.3.13','a999').version,'0.3.14');
assert.equal(windows.pickRelease([release('0.3.13','a185',{assetName:'wrong.exe'})],'0.3.13','a184'),null);
assert.equal(windows.pickRelease([release('0.3.13','a185',{digest:'sha256:bad'})],'0.3.13','a184'),null);
assert.equal(windows.RELEASES,'https://api.github.com/repos/davidkane0526/DK-Test-Studio/releases?per_page=100');
assert.equal(packageJson.dktsBuildId,profile.buildId);
assert.equal(appJson.expo.version,packageJson.version);
assert.equal(appJson.expo.android.versionCode,profile.androidVersionCode);
assert.equal(appJson.expo.android.versionCode,100000+Number(packageJson.dktsBuildId.slice(1)));
assert.equal(appJson.expo.android.package,'studio.dk.test');
assert.equal(profile.appId,'studio.dk.test');
assert.match(android,/dkts-v/);
assert.match(android,/DKTS-Android/);
assert.match(android,/Build identity: /);
assert.match(android,/Android versionCode: /);
assert.match(android,/compareBuildIds\(found\.buildId,installedBuildId\(\)\)/);
assert.match(android,/archive\.versionCode!=100000\+Integer\.parseInt\(expectedBuildId\.substring\(1\)\)/);
assert.match(android,/MessageDigest\.isEqual/);
assert.match(androidHot,/dkts-v/);
assert.match(androidHot,/DK-Test-Studio/);
assert.match(updaterUi,/result\.buildId/);
assert.match(ipc,/currentBuildId=require\('\.\.\/\.\.\/package\.json'\)\.dktsBuildId/);
assert.match(ipc,/createPortableUpdater\(\{[^\n]*currentBuildId\}/);
assert.doesNotMatch(android,/davidkane0526\/DK-Data-Studio/);
assert.doesNotMatch(androidHot,/davidkane0526\/DK-Data-Studio/);
console.log(JSON.stringify({result:'PASS',packageVersion:packageJson.version,buildId:packageJson.dktsBuildId,androidVersionCode:appJson.expo.android.versionCode},null,2));
