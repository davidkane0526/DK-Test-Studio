'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const {pickRelease,newer,trusted}=require('../desktop/native-update.cjs');
const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
const app=fs.readFileSync(path.join(root,'web/app.js'),'utf8');
const css=fs.readFileSync(path.join(root,'web/styles.css'),'utf8');
test('semver compare works without lexical mis-ordering',()=>{
  assert.equal(newer('0.2.10','0.2.9'),true);
  assert.equal(newer('0.2.8','0.2.8'),false);
  assert.equal(newer('0.2.5','0.2.8'),false);
  assert.equal(newer('1.0.0','0.9.99'),true);
});
test('portable updater selects only original GitHub releases with a SHA-256 digest',()=>{
  const asset=(v,sha=true)=>({
    name:'DK-Test-Studio-Portable-'+v+'-x64.exe',
    browser_download_url:'https://github.com/davidkane0526/DK-Test-Studio/releases/download/dkts-preview-123/DK-Test-Studio-Portable-'+v+'-x64.exe',
    size:90000000,digest:sha?'sha256:'+'a'.repeat(64):''
  });
  const releases=[
    {tag_name:'dkts-preview-999',draft:true,assets:[asset('8.0.0')]},
    {tag_name:'dkts-preview-123',assets:[asset('0.2.7'),asset('0.2.9'),asset('0.3.0',false)]},
    {tag_name:'dkts-ui-999',assets:[asset('9.9.9')]}
  ];
  const result=pickRelease(releases,'0.2.8');
  assert.equal(result.version,'0.2.9');
  assert.equal(result.size,90000000);
  assert.equal(result.digest,'a'.repeat(64));
  assert.equal(pickRelease(releases,'0.2.10'),null);
  assert.equal(trusted(new URL('http://github.com/a')),false);
  assert.equal(trusted(new URL('https://fakegithubusercontent.com/x')),false);
});
test('tabs use symmetrical text padding and no native title hover tooltip',()=>{
  assert.doesNotMatch(app,/select\.title=TEST_MODES\[kind\]\.title/);
  assert.doesNotMatch(app,/close\.title='关闭标签'/);
  assert.match(css,/padding-inline:9px!important/);
  assert.match(css,/\.workspace-tab-item:hover\{/);
  assert.match(css,/\.workspace-tab-item \.workspace-tab-close/);
});
test('scientific toolbar shrinks to 80 percent and uses lightweight strokes',()=>{
  assert.match(css,/width:22px!important;height:22px!important/);
  assert.match(css,/width:13\.6px!important;height:13\.6px!important/);
  assert.match(css,/stroke-width:1\.3!important/);
  assert.match(css,/\.dkds-scientific-nav-drag svg/);
});
test('native update UI is explicit and separate from UI-only hot update',()=>{
  assert.match(html,/id="native-app-update-state"/);
  assert.match(html,/id="native-app-update-action" hidden/);
  assert.match(app,/nativeAppApi\.installAppUpdate\(\)/);
  assert.match(app,/nativeAppApi\.checkAppUpdate\(\)/);
  assert.match(app,/void checkUiUpdateNow\(\)/);
  assert.match(app,/void checkNativeAppUpdate\(\)/);
});
test('Android update uses system installer, installed certificate and GitHub digest',()=>{
  const source=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/NativeAppUpdateManager.java'),'utf8');
  const manifest=fs.readFileSync(path.join(root,'android/app/src/main/AndroidManifest.xml'),'utf8');
  const bridge=fs.readFileSync(path.join(root,'android/app/src/main/java/studio/dk/test/InstrumentBridge.java'),'utf8');
  const client=fs.readFileSync(path.join(root,'android/web/native-client.js'),'utf8');
  const paths=fs.readFileSync(path.join(root,'android/app/src/main/res/xml/dkts_update_paths.xml'),'utf8');
  assert.match(source,/APK SHA-256 校验失败/);
  assert.match(source,/GET_SIGNING_CERTIFICATES/);
  assert.match(source,/getApkContentsSigners/);
  assert.match(source,/FileProvider\.getUriForFile/);
  assert.match(source,/Intent\.ACTION_VIEW/);
  assert.match(source,/canRequestPackageInstalls/);
  assert.match(source,/resumeInstaller/);
  assert.match(manifest,/REQUEST_INSTALL_PACKAGES/);
  assert.match(manifest,/androidx\.core\.content\.FileProvider/);
  assert.match(paths,/cache-path name="native-updates"/);
  for(const op of ['app-update-check','app-update-install','app-update-status'])
    assert(bridge.includes('case "'+op+'"'));
  assert.match(client,/checkAppUpdate:async/);
  assert.match(client,/installAppUpdate:async/);
});
test('portable app replaces executable only via bundled script after parent exits',()=>{
  const updater=fs.readFileSync(path.join(root,'desktop/native-update.cjs'),'utf8');
  const script=fs.readFileSync(path.join(root,'desktop/apply-portable-update.ps1'),'utf8');
  const main=fs.readFileSync(path.join(root,'desktop/main.cjs'),'utf8');
  const preload=fs.readFileSync(path.join(root,'desktop/preload.cjs'),'utf8');
  assert.match(updater,/PORTABLE_EXECUTABLE_FILE/);
  assert.match(updater,/sha256/);
  assert.match(updater,/writeFile\(preparedScript/);
  assert.match(updater,/setTimeout\(\(\)=>app\.quit\(\),350\)/);
  assert.match(script,/Get-Process -Id \$ParentPid/);
  assert.match(script,/Move-Item -LiteralPath \$Target -Destination \$backup/);
  assert.match(script,/Start-Process -FilePath \$Target/);
  assert.match(script,/Original portable launcher is still locked/);
  assert.match(main,/dkts:app-update/);
  assert.match(preload,/installAppUpdate:/);
});
