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
  assert(fs.existsSync(path.join(out,'dkts-external-plugins/4200A/plugin.json')));
  const pkg=JSON.parse(fs.readFileSync(path.join(out,'package.json'),'utf8'));
  assert.equal(pkg.name,'dk-test-studio-host');
  assert.equal(pkg.version,require('../package.json').version);
  const mobile=JSON.parse(fs.readFileSync(path.join(out,'mobile/app.json'),'utf8'));
  assert.equal(mobile.expo.android.package,'studio.dk.test');
  assert.equal(fs.readFileSync(path.join(f.root,'src/plugins/pulse-analysis/plugin.json'),'utf8'),before);
  assert(fs.existsSync(path.join(f.root,'src/generated/plugin-index.js')));
 }finally{fs.rmSync(f.top,{recursive:true,force:true});}
});
