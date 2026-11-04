'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
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
  assert.equal(manifest.version,'0.6.2');
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

test('generated plugin modules use external identity while standalone modules remain unchanged',()=>{
  const stage=require('../tools/build-dkds-plugin.cjs').folder;
  for(const source of ['kxci-protocol.js','measurement-plan.js',
    'waveform.js','identity-core.js']){
    const original=read('src/shared/'+source),emitted=fs.readFileSync(path.join(stage,source),'utf8');
    assert(original.includes("com.dkds.keithley-4200"),source+' standalone source changed');
    assert(emitted.includes("com.dkts.keithley-4200"),source+' plugin source not adapted');
    assert(!emitted.includes("com.dkds.keithley-4200"),source+' still registers builtin ID');
  }
  const packagedInterop=fs.readFileSync(path.join(stage,'interop.js'),'utf8');
  assert.match(packagedInterop,/const PLUGIN_ID='com\.dkts\.keithley-4200'/);
  assert.match(packagedInterop,/LEGACY_PLUGIN_ID='com\.dkds\.keithley-4200'/);
  assert.match(read('src/shared/interop.js'),/const PLUGIN_ID='com\.dkds\.keithley-4200'/);
  assert.match(read('integrations/dkds/presentation.js'),/DKDSPluginModules\.define\('com\.dkts\.keithley-4200'/);
});

test('external module registrations replace stale definitions when the same package is reloaded',()=>{
  const staging=require('../tools/build-dkds-plugin.cjs');
  const pkg=JSON.parse(fs.readFileSync(staging.artifact,'utf8'));
  const registry=new Map();
  const sandbox={atob,btoa,window:{DKDSPluginModules:{define(id,name,value,options={})=>{
    assert.equal(id,manifest.id);
    const key=id+'/'+name;
    if(registry.has(key)&&options.replace!==true)
      throw Error('Plugin module already defined: '+key);
    registry.set(key,value);
  }}}};
  const modules=['kxci-protocol.js','measurement-plan.js','waveform.js',
    'identity-core.js','interop.js','standalone-shell.js','presentation.js'];
  for(let version=0;version<2;version++){
    for(const file of modules)
      vm.runInNewContext(pkg.files[file],sandbox,{filename:file,timeout:15000});
  }
  assert.equal(registry.size,modules.length);
  for(const file of modules){
    const source=pkg.files[file],start=source.indexOf('window.DKDSPluginModules.define(');
    assert(start>=0,file+' must register its module through the DKDS registry');
    const end=source.indexOf(';',start),call=source.slice(start,end);
    assert.match(call,/,\{replace:true\}\)$/ ,file+' must replace its previous version during upgrade');
  }
});

test('official package builder refuses repackaging under the built-in ID',()=>{
  const build=read('tools/build-dkds-plugin.cjs');
  assert.match(build,/manifest\.id!=='com\.dkts\.keithley-4200'/);
  assert.match(build,/manifest\.version!=='0\.6\.2'/);
});

test('full plugin shell is built from canonical App assets, not a separate DKDS UI',()=>{
  const staging=require('../tools/build-dkds-plugin.cjs');
  const pkg=JSON.parse(fs.readFileSync(staging.artifact,'utf8'));
  const shell=pkg.files['standalone-shell.js'];
  const app=read('web/app.js'),css=read('web/styles.css'),html=read('web/index.html');
  assert(typeof shell==='string'&&shell.length>app.length+css.length);
  const registry=new Map();
  const sandbox={window:{DKDSPluginModules:{define:(id,name,api)=>{
    assert.equal(id,manifest.id);registry.set(name,api);
  }}}};
  require('node:vm').runInNewContext(shell,sandbox,{timeout:15000});
  const page=registry.get('standalone-shell').createDocument('a'.repeat(32),false);
  assert(page.includes(app),'Plugin must contain exact standalone app.js');
  assert(page.includes(css),'Plugin must contain exact standalone styles.css');
  assert(page.includes('id="workspace-tabs"'));
  assert(page.includes('id="measurement-plot"'));
  assert(page.includes('DKDSCharts'));
  assert(page.includes('DKTS-PlotReady')===false);
  assert.doesNotMatch(read('integrations/dkds/presentation.js'),/dkts-placeholder-chart|dkts-mode-item|dkts-inline-inner/);
  assert.equal(pkg.manifest.scripts.filter(name=>name==='standalone-shell.js').length,1);
});
