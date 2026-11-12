'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {buildIdentity,fromRunNumber}=require('../tools/core-build-identity.cjs');
const {classify}=require('../tools/classify-core-update.cjs');
const root=path.resolve(__dirname,'..');

test('one canonical aNNN maps to the same Android versionCode without changing V',()=>{
  assert.deepEqual(buildIdentity('a184'),{buildId:'a184',buildNumber:184,versionCode:100184});
  assert.deepEqual(fromRunNumber('185'),{buildId:'a185',buildNumber:185,versionCode:100185});
  assert.throws(()=>buildIdentity('a0'),/positive aNNN/);
  assert.throws(()=>buildIdentity('a185x'),/positive aNNN/);
  assert.throws(()=>fromRunNumber('0'),/positive integer/);
});

test('a change limited to the DKTS workspace stylesheet uses only the hot channel',()=>{
  const result=classify(['integrations/dkds-native/ui-shell.css']);
  assert.equal(result.updateChannel,'ui-hot');
  assert.equal(result.hotUpdateAvailable,true);
});

test('mixed UI and application changes require a full native package, not a hot-only release',()=>{
  const result=classify(['integrations/dkds-native/ui-shell.css','integrations/dkds-native/plugin.js']);
  assert.equal(result.updateChannel,'full-app');
  assert.equal(result.hotUpdateAvailable,false);
});

test('documentation and workflow edits do not produce a new application package',()=>{
  assert.equal(classify(['README.md','.github/workflows/ui-update.yml','docs/RELEASE_UPDATE_CONTRACT.md']).updateChannel,'none');
});

test('DKTS Core staging stamps the same identity into Windows and Android',()=>{
  const stage=fs.readFileSync(path.join(root,'tools/stage-dkds-host.cjs'),'utf8');
  assert.match(stage,/pkg\.dktsBuildId=identity\.buildId/);
  assert.match(stage,/mobile\.expo\.android\.versionCode=identity\.versionCode/);
  assert.match(stage,/const previewId='studio\\.dk\\.test\\.corepreview'/);
  assert.match(stage,/DKTS-Core-Preview-Windows-V/);
  assert.match(stage,/currentBuildId=require\('\.\.\/\.\.\/package\.json'\)\.dktsBuildId/);
  assert.match(stage,/DKTS-Core-Preview-Android-FIXED-SIGNED-V/);
  assert.match(stage,/dkts-ui-v/);
  assert.doesNotMatch(stage,/previewVersionCode/);
  assert.equal(require('../package.json').version,'0.3.13');
  const coreWorkflow=fs.readFileSync(path.join(root,'.github/workflows/dkts-framework-contract.yml'),'utf8');
  assert.match(coreWorkflow,/update_channel == 'full-app'/);
  assert.match(coreWorkflow,/revision=\"\$GITHUB_RUN_NUMBER\"/);
  const uiWorkflow=fs.readFileSync(path.join(root,'.github/workflows/ui-update.yml'),'utf8');
  assert.match(uiWorkflow,/dkts-ui-v/);
  assert.match(uiWorkflow,/build-ui-hot-bundle.js/);
  assert.match(uiWorkflow,/update_channel == 'ui-hot'/);
});
