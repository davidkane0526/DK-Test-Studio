'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const manifest=require('../integrations/dkds/plugin.json');
const BUILTIN=Object.freeze({
  id:'com.dkds.keithley-4200',
  activity:'keithley-4200',
  pageId:'keithley4200Page',
  projectSlice:'keithley-4200',
  capability:'instrument.keithley-4200'
});
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('DK Test Studio installs as a distinct external DKDS plugin, not a builtin override',()=>{
  assert.equal(manifest.id,'com.dkts.keithley-4200');
  assert.notEqual(manifest.id,BUILTIN.id);
  assert.equal(manifest.version,'0.5.0');
  assert.equal(manifest.apiVersion,'1.19.0');
  assert.equal(manifest.workspace.activity,'dkts-keithley-4200');
  assert.equal(manifest.window.activity,'dkts-keithley-4200');
  assert.notEqual(manifest.workspace.activity,BUILTIN.activity);
  assert.notEqual(manifest.window.activity,BUILTIN.activity);
  assert(manifest.capabilities.includes('instrument.dkts-keithley-4200'));
  assert(!manifest.capabilities.includes(BUILTIN.capability));
});

test('all registered workspace/page/project/capability IDs are isolated from the builtin 4200A',()=>{
  const js=read('integrations/dkds/plugin.js');
  const presentation=read('integrations/dkds/presentation.js');
  assert.match(js,/id:'dkts-keithley-4200'/);
  assert.match(js,/pageId:'dktsKeithley4200Page'/);
  assert.match(js,/registerSlice\('dkts-keithley-4200'/);
  assert.match(js,/capabilities\.register\('instrument\.dkts-keithley-4200'/);
  assert.doesNotMatch(js,/openPage\('keithley4200Page'\)/);
  assert.match(presentation,/activity:'dkts-keithley-4200'/);
  assert.match(presentation,/DKDSPluginModules\.define\('com\.dkts\.keithley-4200'/);
});

test('no plugin module registers itself under the built-in ID',()=>{
  for(const source of ['src/shared/kxci-protocol.js','src/shared/measurement-plan.js',
    'src/shared/waveform.js','src/shared/identity-core.js','integrations/dkds/presentation.js']){
    const text=read(source);
    assert(!text.includes("define('com.dkds.keithley-4200'"),source);
    assert(text.includes("com.dkts.keithley-4200"),source);
  }
  const bridge=read('src/shared/interop.js');
  assert.match(bridge,/LEGACY_PLUGIN_ID='com\.dkds\.keithley-4200'/);
  assert.match(bridge,/envelope\.pluginId/);
});

test('official package builder refuses repackaging under the built-in ID',()=>{
  const build=read('tools/build-dkds-plugin.cjs');
  assert.match(build,/manifest\.id!=='com\.dkts\.keithley-4200'/);
  assert.match(build,/manifest\.version!=='0\.5\.0'/);
});
