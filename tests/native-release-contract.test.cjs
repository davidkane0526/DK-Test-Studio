'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
test('DKTS standalone V/a Release contains no ambiguous DKDS external plugin',()=>{
 const fast=read('.github/workflows/ui-update.yml');
 const full=read('.github/workflows/windows-preview.yml');
 assert.match(fast,/files=\(dist\/DKTS-UI-bundle\.json\)/);
 assert.match(full,/release -type f \| wc -l\)" -eq 4/);
 assert.match(full,/DKTS standalone complete package/);
 for(const f of [fast,full]){
  assert.doesNotMatch(f,/release\/plugin\/\*\.dkplugin|files=\([^\n]*DKTS-4200A-(?:legacy|native)/);
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
