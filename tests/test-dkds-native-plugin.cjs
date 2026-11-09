'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'../integrations/dkds-native');
const manifest=JSON.parse(fs.readFileSync(root+'/plugin.json','utf8'));
const js=fs.readFileSync(root+'/plugin.js','utf8'),model=fs.readFileSync(root+'/model.js','utf8');
assert.equal(manifest.id,'com.dkts.keithley-4200');
assert.equal(manifest.version,'0.7.0');
assert.equal(manifest.apiVersion,'1.19.0');
assert.equal(manifest.pluginType,'workbench');
assert.equal(manifest.workspace.role,'top');
assert.deepEqual(manifest.data.accepts,['science.transport.iv','data.table']);
assert.equal(manifest.window.artifactHydration,'live');
assert.ok(manifest.requiresCore.includes('ui.unit-templates'));
assert.ok(manifest.requiresCore.includes('data.artifacts'));
assert.ok(manifest.requiresCore.includes('ui.scientific-plot'));
assert.ok(!manifest.styles?.length,'global CSS/visual themes belong to DKDS');
assert.ok(/ctx\.ui\.topWorkspace\.register/.test(js));
assert.ok(/units\.prime\.build/.test(js));
assert.ok(/units\.scientificPlot\.create/.test(js));
assert.ok(/ctx\.data\.sources\.list/.test(js));
assert.ok(/model\.curvesFromArtifacts\(rows,ctx\.data\.artifacts\)/.test(js));
assert.ok(!/ctx\.data\.artifacts\.get\(/.test(js),'must never copy entire Artifact for chart rendering');
assert.ok(!/\biframe\b|createElement\(\s*['"]iframe|window\.electronAPI|\bfetch\s*\(/.test(js),'no iframe, private transport or private data client');
assert.ok(!/\bME1\b|\bDV\b|\bUS\b|\bRV\b/.test(js),'no output instructions in workbench');
let api;
vm.runInNewContext(model,{window:{DKDSPluginModules:{define:(id,name,instance)=>{
 assert.equal(id,manifest.id);assert.equal(name,'model');api=instance;
}}}});
assert.ok(api);
const orig=api.initial();
assert.equal(orig.pages.length,1);
assert.equal(api.visible(orig.pages[0]).length,0,'None terminals never appear in parameter editor');
const generated=api.add(orig,'pulse');
assert.equal(generated.pages.length,2);
assert.equal(generated.pages[1].testType,'Pulse');
assert.equal(generated.activeId,'page-2');
assert.equal(orig.pages.length,1,'model transactions are immutable');
const chosen=api.select(generated,'page-1');
assert.equal(chosen.activeId,'page-1');
const mapped=api.edit(chosen,'D',{resource:'SMU1'});
assert.equal(api.visible(mapped.pages[0]).length,1);
const reset=api.edit(mapped,'D',{resource:'None'});
assert.equal(api.visible(reset.pages[0]).length,0);
const floor=api.edit(mapped,'D',{rangeMode:'minimum',rangeValue:'1e-6'});
assert.equal(floor.pages[0].terminals[0].rangeMode,'minimum');
const safeModeSwitch=api.edit(floor,'D',{sourceMode:'current',rangeMode:'minimum'});
assert.equal(safeModeSwitch.pages[0].terminals[0].rangeMode,'auto',
 'source-mode switch clears stale unsupported current-autorange minimum');
const switched=api.edit(floor,'D',{sourceMode:'current'});
assert.equal(switched.pages[0].terminals[0].rangeMode,'auto');
assert.equal(switched.pages[0].terminals[0].rangeValue,'2');
assert.equal(switched.pages[0].terminals[0].stop,'0.01','2 V sweep cannot remain a 2 A sweep');
assert.equal(switched.pages[0].terminals[0].compliance,'2','current-source requires voltage compliance units');
assert.throws(()=>api.edit(mapped,'D',{compliance:'1000000000000e1000'}),/Invalid numeric input/);
assert.throws(()=>api.add(orig,'invented'),/Unknown test type/);
// Numeric safety is checked in the project model, before any native compiler.
assert.throws(()=>api.edit(mapped,'D',{bias:'1000'}),/HARDWARE_ENVELOPE/);
assert.throws(()=>api.edit(mapped,'D',{stop:'1000'}),/HARDWARE_ENVELOPE/);
assert.throws(()=>api.edit(mapped,'D',{compliance:'2'}),/HARDWARE_ENVELOPE/);
assert.throws(()=>api.edit(mapped,'D',{bias:'22',compliance:'0.2'}),/HARDWARE_POWER_ENVELOPE/);
assert.throws(()=>api.edit(mapped,'D',{rangeMode:'fixed',rangeValue:'3'}),/HARDWARE_RANGE_ENVELOPE/);
assert.throws(()=>api.edit(mapped,'D',{bias:''}),/Invalid numeric input/);
assert.throws(()=>api.edit(mapped,'D',{bias:'NaN'}),/Invalid numeric input/);
const safe210=api.edit(mapped,'D',{bias:'210',compliance:'0.1'});
assert.equal(safe210.pages[0].terminals[0].bias,'210');
assert.throws(()=>api.edit(switched,'D',{bias:'0.11',compliance:'25'}),/HARDWARE_POWER_ENVELOPE/);
assert.throws(()=>api.edit(switched,'D',{bias:'2'}),/HARDWARE_ENVELOPE/);
const legal=api.edit(mapped,'D',{bias:'-2.0e+1',compliance:'1.05'});
assert.equal(legal.pages[0].terminals[0].bias,'-2.0e+1');
// DKDS bounded raw reads: do not materialize the full Artifact via get().
const x=[0,1,2,3,4,5,6,7],y=[0,5,2,-4,1,7,0,2];
const calls=[];
const artifactStore={
 get(){throw Error('Whole Artifact get forbidden')},
 columnMetadata(id){return id==='t1'?[
  {id:'colX',key:'Vd',length:x.length,role:'x'},
  {id:'colY',key:'Id',length:y.length,role:'y'}]:null},
 readColumnRange(id,col,{start,limit}){
  calls.push({id,col,start,limit});
  return {values:(col==='colX'?x:y).slice(start,start+limit)}
 }
};
const curves=api.curvesFromArtifacts([{artifactId:'t1',name:'Real 4200A'},
 {artifactId:'skip',name:'excluded',excluded:true}],artifactStore,{maxRead:8,maxDisplay:4});
assert.equal(curves.length,1);
assert.equal(curves[0].artifactId,'t1');
assert.equal(curves[0].points.some(p=>p.y===-4),true,'display sampling retains negative peak');
assert.equal(curves[0].points.some(p=>p.y===7),true,'display sampling retains positive peak');
assert.equal(calls.length,2);
assert.ok(calls.every(row=>row.limit<=65536));
const preview=api.curvesFromArtifacts([{artifactId:'t1',name:'A'}],artifactStore,
 {maxRead:4,maxDisplay:16})[0];
assert.equal(preview.source.truncated,true);
assert.equal(preview.source.totalRows,8);
assert.equal(preview.source.readRows,4);
assert.match(preview.label,/preview 4\/8/);
console.log('DKTS Core-native plugin: manifest, 5 types, project state, None/SMU mapping, range guards PASS');
