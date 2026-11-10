'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const native=JSON.parse(read('integrations/dkds-native/plugin.json'));
const legacy=JSON.parse(read('integrations/dkds/plugin.json'));
test('the same plugin ID requires explicit mutually exclusive release names',()=>{
 assert.equal(native.id,legacy.id,'Do not silently fork the DKDS plugin identity');
 assert.equal(native.pluginType,'workbench');
 assert.equal(legacy.pluginType,'developer');
 const expected=['DKTS-4200A-native-v'+native.version+'.dkplugin',
  'DKTS-4200A-legacy-v'+legacy.version+'.dkplugin'];
 const fast=read('.github/workflows/ui-update.yml');
 const full=read('.github/workflows/windows-preview.yml');
 for(const wf of [fast,full])
  for(const name of expected)assert.ok(wf.includes(name),'missing explicit package '+name);
 assert.match(fast,/TWO MUTUALLY EXCLUSIVE DKDS plugin alternatives/);
 assert.match(full,/two required|six required release assets/);
 assert.match(full,/find release\/plugin -name '\*\.dkplugin' \| wc -l\)" -eq 2/);
 assert.ok(!fast.includes('dist/DK-Test-Studio-4200.dkplugin'),
  'Do not publish the legacy plugin under an ambiguous filename');
});
test('native preview always uses DKDS Core and does not claim real KXCI output',()=>{
 const workflow=read('.github/workflows/dkds-native-core-plugin.yml');
 const model=read('integrations/dkds-native/model.js');
 const plugin=read('integrations/dkds-native/plugin.js');
 assert.ok(workflow.includes('branches: [main, feat/native-artifact-coverage-release]'));
 assert.ok(workflow.includes('refs/heads/main'));
 assert.ok(plugin.includes('scientificPlot.create'));
 assert.ok(plugin.includes('plotView.adopt'));
 assert.ok(model.includes('stratified-intervals'));
 assert.match(plugin,/ctx\.status\.set\('4200A 工作区已加载；原生输出禁用'\)/);
 assert.doesNotMatch(plugin,/\bME1\b|\bDV\b|\bUS\b|\bRV\b/);
});
