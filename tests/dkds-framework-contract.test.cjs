'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {verify}=require('../tools/dkds-host-profile.cjs');
const {stage}=require('../tools/stage-dkds-host.cjs');
const repo=path.resolve(__dirname,'..');
function fixture(){
 const top=fs.mkdtempSync(path.join(os.tmpdir(),'dkts-framework-'));
 const root=path.join(top,'DKDS');
 const write=(file,data)=>{const dest=path.join(root,file);fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,data);};
 write('package.json',JSON.stringify({name:'dk-data-studio',version:'3.72.3',
  build:{productName:'DK Data Studio',appId:'com.dk.datastudio'}}));
 write('mobile/app.json',JSON.stringify({expo:{name:'DK Data Studio',
  slug:'dk-data-studio',version:'3.72.3',android:{package:'com.dk.datastudio'}}}));
 write('mobile/package.json',JSON.stringify({name:'dk-data-studio-mobile',version:'3.72.3'}));
 for(const f of [
  'src/index.html','src/app/placeholder.js','src/core/placeholder.js',
  'desktop/native-update.js','desktop/ui-hot-update.js','desktop/apply-portable-update.ps1',
  'mobile/plugins/DkdsLanTcp.template','mobile/plugins/DkdsAppUpdate.template',
  'mobile/plugins/DkdsUiHotUpdate.template','sdk/tools/dkds-plugin.js'
 ])write(f,'\n');
 const keep=[
  ['connectivity-center','builtin.connectivity-center','foundation'],
  ['data-center','builtin.data-center','foundation'],
  ['status-monitor','builtin.status-monitor','foundation'],
  ['shell-navigation','builtin.shell-navigation','foundation'],
  ['scientific-data-contracts','builtin.scientific-data-contracts','foundation'],
  ['workspace-safeguards','builtin.workspace-safeguards','foundation'],
  ['thin-glass-theme','com.dkds.theme.liquid-glass','theme'],
  ['aurora-pop-theme','com.dkds.theme.aurora-pop','theme'],
  ['flexible-import','builtin.flexible-import','data']
 ];
 const analysis=[
  ['pulse-analysis','builtin.pulse-analysis','workbench',['analysis.pulse']],
  ['ter-analysis','builtin.ter-analysis','workbench',['analysis.ter']]
 ];
 for(const [folder,id,pluginType,capabilities=[]] of [...keep,...analysis])
  write('src/plugins/'+folder+'/plugin.json',JSON.stringify({id,pluginType,capabilities}));
 write('src/generated/plugin-index.js','OLD-CATALOG');
 return {top,root,write};
}
test('DKTS profiles ALL non-analysis plugin types but excludes analysis workbenches',()=>{
 const f=fixture();
 try{
  const p=verify(f.root);
  assert.equal(p.counts.total,11);
  assert.equal(p.counts.retained,9);
  assert.equal(p.counts.excluded,2);
  assert(p.included.some(x=>x.id==='builtin.data-center'));
  assert(p.excluded.some(x=>x.id==='builtin.pulse-analysis'));
  f.write('src/plugins/keithley/plugin.json',
   JSON.stringify({id:'com.dkds.keithley-4200',name:'Keithley',pluginType:'workbench'}));
  assert.throws(()=>verify(f.root),/prohibited built-in instrument plugin/);
 }finally{fs.rmSync(f.top,{recursive:true,force:true});}
});
test('stage DKDS Core into DKTS directory without touching upstream or shipping analysis plugins',()=>{
 const f=fixture();
 try{
  const out=path.join(f.top,'DKTS-BUILD'),before=fs.readFileSync(
   path.join(f.root,'src/plugins/pulse-analysis/plugin.json'),'utf8');
  const p=stage(f.root,out,{dktsRoot:repo});
  assert.equal(p.derivedDistribution,true);
  assert.equal(p.outputReady,false,'staging is not deployable');
  assert(fs.existsSync(path.join(out,'src/plugins/data-center/plugin.json')));
  assert(!fs.existsSync(path.join(out,'src/plugins/pulse-analysis')));
  assert(fs.existsSync(path.join(out,'src/core/placeholder.js')));
  assert(!fs.existsSync(path.join(out,'src/generated/plugin-index.js')));
  assert(fs.existsSync(path.join(out,'src/plugins/dkts-4200a/plugin.json')));
  assert(!fs.existsSync(path.join(f.root,'src/plugins/dkts-4200a')),
   'DKDS upstream must never acquire the owned DKTS 4200 plugin');
  assert.match(fs.readFileSync(path.join(out,'src/index.html'),'utf8'),
   /DK Test Studio/);
  assert(!fs.readFileSync(path.join(out,'src/index.html'),'utf8')
   .includes('DK Data Studio'),'upstream brand must not remain on DKTS host screen');
  assert.match(fs.readFileSync(path.join(out,'desktop/main.js'),'utf8'),
   /const APP_NAME = 'DK Test Studio Core Preview'/);
  assert(!fs.readFileSync(path.join(out,'desktop/native-update.js'),'utf8')
   .includes('repos/davidkane0526/DK-Data-Studio/releases'),
   'preview native updater must not download DKDS releases');
  assert(fs.readFileSync(path.join(out,'mobile/plugins/DkdsAppUpdate.template'),'utf8')
   .includes('davidkane0526/DK-Test-Studio'));
  assert(fs.existsSync(path.join(out,'tools/dkts-icon-generator.cjs')));
  assert(fs.existsSync(path.join(out,'tools/dkts-core-brand.cjs')));
  assert(fs.existsSync(path.join(out,'desktop/dkts-core-boot-smoke.cjs')));
  const summary=JSON.parse(fs.readFileSync(path.join(out,'DKTS_FRAMEWORK_STAGING.json')));
  assert.equal(summary.instrumentPlugin,'src/plugins/dkts-4200a (DKTS build only; absent upstream)');
  assert.equal(summary.previewAppId,'studio.dk.test.corepreview');
  const pkg=JSON.parse(fs.readFileSync(path.join(out,'package.json'),'utf8'));
  assert.equal(pkg.name,'dk-test-studio-host');
  assert.equal(pkg.version,require('../package.json').version);
  const mobile=JSON.parse(fs.readFileSync(path.join(out,'mobile/app.json'),'utf8'));
  assert.equal(mobile.expo.android.package,'studio.dk.test.corepreview');
  assert.equal(fs.readFileSync(path.join(f.root,'src/plugins/pulse-analysis/plugin.json'),'utf8'),before);
  assert(fs.existsSync(path.join(f.root,'src/generated/plugin-index.js')));
  assert(!fs.existsSync(path.join(f.root,'desktop/dkts-core-boot-smoke.cjs')));
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.root,'mobile/app.json'),'utf8')).expo.android.package,
   'com.dk.datastudio');
 }finally{fs.rmSync(f.top,{recursive:true,force:true});}
});
