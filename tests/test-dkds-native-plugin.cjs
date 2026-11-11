'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'../integrations/dkds-native');
const manifest=JSON.parse(fs.readFileSync(root+'/plugin.json','utf8'));
const js=fs.readFileSync(root+'/plugin.js','utf8'),model=fs.readFileSync(root+'/model.js','utf8');
assert.equal(manifest.id,'com.dkts.keithley-4200');
assert.equal(manifest.version,'0.8.1');
assert.equal(manifest.apiVersion,'1.19.0');
assert.equal(manifest.pluginType,'workbench');
assert.equal(manifest.workspace.role,'top');
assert.equal(manifest.workspace.defaultSuper,true,
 'DKTS 4200A TOP must be startup-critical to avoid a neutral main screen');
assert.deepEqual(manifest.data.accepts,['science.transport.iv','data.table']);
assert.equal(manifest.window.artifactHydration,'live');
assert.ok(manifest.requiresCore.includes('ui.unit-templates'));
assert.ok(manifest.requiresCore.includes('data.artifacts'));
assert.ok(manifest.requiresCore.includes('ui.scientific-plot'));
assert.ok(!manifest.styles?.length,'global CSS/visual themes belong to DKDS');
assert.ok(/ctx\.ui\.topWorkspace\.register/.test(js));
assert.ok(/units\.prime\.build/.test(js));
const portPrimeSource=js.slice(js.indexOf('const portPrime=units.prime.build('),js.indexOf('wb.compose('));
assert.ok(portPrimeSource.includes("placementControl:'surface'"),
 'inspector PRIME must expose DKDS surface-owned canonical controls');
assert.ok(portPrimeSource.includes("chrome:'auto'")&&portPrimeSource.includes("portPrime.chrome='auto'"),
 'generated Core inspector chrome must remain compatible with movable existingNode runtime');
assert.ok(!portPrimeSource.includes("header:{mode:'generate'"),
 'let unitTemplates generate the canonical movable PRIME header');
assert.ok(/if\(t\.role==='CONDITION'\)numericField\(controls/.test(js),
 'the port row must not duplicate the X/P start-stop-step controls');
assert.ok(/units\.scientificPlot\.create/.test(js));
assert.ok(js.split('units.panel.create(').slice(1).every(x=>!x.slice(0,130).includes("variant:'standard'")),
 'DKDS panel Unit supports headed/plot-card, never the nonexistent standard variant');
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
assert.equal(orig.devices.length,1);
assert.equal(orig.devices[0].name,'MOSFET');
assert.equal(orig.routines[0].deviceId,orig.devices[0].id);
assert.equal(orig.activeDeviceId,orig.devices[0].id);
const oldDeviceProject=api.initial();
delete oldDeviceProject.devices;
delete oldDeviceProject.activeDeviceId;
delete oldDeviceProject.routines[0].deviceId;
const migratedDevice=api.validate(oldDeviceProject);
assert.equal(migratedDevice.devices[0].id,'device-1');
assert.equal(migratedDevice.routines[0].deviceId,'device-1');
assert.equal(oldDeviceProject.devices,undefined,'legacy Device migration is immutable');
const secondDevice=api.addDevice(orig);
assert.equal(secondDevice.devices.length,2);
assert.equal(secondDevice.routines.length,2);
assert.equal(secondDevice.pages.length,2);
assert.equal(secondDevice.activeDeviceId,secondDevice.devices[1].id);
assert.equal(secondDevice.routines[1].deviceId,secondDevice.devices[1].id);
assert.equal(secondDevice.pages[1].routineId,secondDevice.routines[1].id);
const specOnSecond=api.addSpec(secondDevice);
assert.equal(specOnSecond.specs[0].deviceId,specOnSecond.devices[1].id);
assert.equal(specOnSecond.pages[1].associateSpecId,specOnSecond.specs[0].id);
const firstAgain=api.selectDevice(specOnSecond,specOnSecond.devices[0].id);
assert.equal(firstAgain.activeId,'page-1');
assert.equal(firstAgain.activeDeviceId,'device-1');
assert.throws(()=>api.associateSpec(firstAgain,'spec-1'),/another Device/);
const injected=api.initial();
injected.specs=[{id:'spec-1',name:'Foreign',deviceId:'device-2'}];
assert.throws(()=>api.validate(injected),/Invalid Spec or Device ownership/);
const crossDevice=JSON.parse(JSON.stringify(specOnSecond));
crossDevice.pages[0].associateSpecId='spec-1';
assert.throws(()=>api.validate(crossDevice),/same Device/);
assert.equal(orig.pages.length,1);
assert.equal(orig.pages[0].sweep.loops,'1');
assert.equal(orig.pages[0].sweep.xSegments.length,1);
assert.equal(orig.pages[0].sweep.pEnabled,false);
assert.equal(api.summary(orig.pages[0]).ready,false,'X requires assigned SMU');
const legacy=api.initial();
delete legacy.pages[0].sweep;
assert.equal(api.validate(legacy).pages[0].sweep.xSegments.length,1,'migrate v0.7 project snapshots');
assert.equal(legacy.pages[0].sweep,undefined,'migration does not mutate stored input');
const oldSingle=api.initial();
oldSingle.pages[0].sweep.xSegments.push({
 start:'2',stop:'2',step:'0.1',delayMs:'20',range:'auto'
});
delete oldSingle.pages[0].sweep.contractVersion;
const migrated=api.validate(oldSingle);
assert.equal(migrated.pages[0].sweep.contractVersion,2);
assert.equal(migrated.pages[0].sweep.xSegments[1].step,'0',
 'legacy appended one-point scan is normalized exactly once');
assert.equal(oldSingle.pages[0].sweep.xSegments[1].step,'0.1',
 'migration must not modify the source snapshot');
assert.equal(orig.pages[0].terminals[0].role,'X','drain is default Xsweep');
assert.equal(orig.pages[0].terminals[1].role,'CONDITION','gate is fixed unless Psweep is selected');
assert.equal(api.visible(orig.pages[0]).length,0,'None terminals never appear in parameter editor');
// Native FS-Pro Page tabs store real validated project data.
const renamed=api.editPage(orig,{name:'Neuromorphic I–V',note:'Sweep protocol'});
assert.equal(renamed.pages[0].name,'Neuromorphic I–V');
assert.equal(orig.pages[0].name,'I–V Sweep','metadata edit is immutable');
assert.throws(()=>api.editPage(orig,{name:''}),/Invalid Page name/);
assert.throws(()=>api.editPage(orig,{name:'x'.repeat(65)}),/Invalid Page name/);
const target=api.editTarget(orig,{logical:'G',quantity:'Voltage'});
assert.equal(target.pages[0].target.logical,'G');
assert.throws(()=>api.editTarget(orig,{quantity:'Invented'}),/Invalid Target plan/);
const variable=api.addVariable(orig);
assert.equal(variable.pages[0].variables[0].name,'var1');
const variableEdited=api.editVariable(variable,0,{name:'threshold',value:'1e-3',unit:'V'});
assert.equal(variableEdited.pages[0].variables[0].value,'1e-3');
assert.throws(()=>api.editVariable(variable,0,{value:'1000x'}),/Invalid numeric input/);
assert.throws(()=>api.editVariable(variable,0,{name:'1invalid'}),/Invalid or duplicate/);
assert.equal(api.removeVariable(variableEdited,0).pages[0].variables.length,0);
const legacyMetadata=api.initial();
delete legacyMetadata.pages[0].target;delete legacyMetadata.pages[0].variables;
assert.equal(api.validate(legacyMetadata).pages[0].target.logical,'D');
assert.deepEqual(Array.from(api.validate(legacyMetadata).pages[0].variables),[]);
const generated=api.add(orig,'pulse');
assert.equal(generated.pages.length,2);
assert.equal(generated.pages[1].testType,'Pulse');
assert.equal(generated.activeId,'page-2');
assert.equal(orig.pages.length,1,'model transactions are immutable');
const chosen=api.select(generated,'page-1');
assert.equal(chosen.activeId,'page-1');
const mapped=api.edit(chosen,'D',{resource:'SMU1'});
assert.equal(mapped.pages[0].terminals[0].role,'X');
assert.equal(api.summary(mapped.pages[0]).ready,true);
const repeated=api.editSweep(mapped,{loops:'3',xRepeats:'2'});
const programmed=api.editSegment(repeated,'X',0,{start:'0',stop:'1',step:'0.25'});
assert.equal(api.summary(programmed.pages[0]).total,30,'5 X points × 2 repeats × 3 cycles');
const extra=api.addSegment(programmed,'X');
assert.equal(extra.pages[0].sweep.xSegments.length,2);
assert.equal(api.summary(extra.pages[0]).total,36,'new 1-point segment included');
const compact=api.removeSegment(extra,'X',1);
assert.equal(api.summary(compact.pages[0]).total,30);
assert.throws(()=>api.removeSegment(compact,'X',0),/At least one segment/);
const twoAxes=api.edit(programmed,'G',{resource:'SMU2',role:'P'});
const pOn=api.editSweep(twoAxes,{pEnabled:true,pRepeats:'2'});
const dual=api.editSegment(pOn,'P',0,{start:'0',stop:'0.2',step:'0.1'});
const dualSummary=api.summary(dual.pages[0]);
assert.equal(dualSummary.ready,true);
assert.equal(dualSummary.total,180,'X 5 × 2 repeats × P 3 × 2 repeats × 3 cycles');
assert.equal(dualSummary.pTerminal,'G');
assert.throws(()=>api.editSegment(programmed,'X',0,{step:'-0.1'}),/SWEEP_DIRECTION/);
assert.throws(()=>api.editSegment(programmed,'X',0,{stop:'300'}),/HARDWARE_ENVELOPE/);
assert.throws(()=>api.editSegment(programmed,'X',0,{delayMs:'-1'}),/Invalid sweep delay/);
assert.throws(()=>api.editSegment(programmed,'X',0,{delayMs:'6554'}),/Invalid sweep delay/);
assert.throws(()=>api.editSegment(programmed,'X',0,{step:'0.3'}),/SWEEP_ENDPOINT/);
assert.throws(()=>api.editSegment(programmed,'X',0,{start:'0',stop:'210',step:'0.01'}),/SWEEP_POINTS/);
const onePoint=api.addSegment(programmed,'X');
assert.equal(onePoint.pages[0].sweep.xSegments[1].step,'0');
assert.equal(api.summary(onePoint.pages[0]).total,36);
assert.throws(()=>api.editSegment(onePoint,'X',1,{step:'0.1'}),/SWEEP_STEP/);
assert.throws(()=>api.editSegment(programmed,'X',0,{range:'2'}),/HARDWARE_RANGE_ENVELOPE/);
assert.throws(()=>api.editSweep(programmed,{loops:'0'}),/positive integer/);
assert.throws(()=>api.editSweep(programmed,{xRepeats:'10001'}),/planning bound/);
assert.throws(()=>api.editSweep(programmed,{pEnabled:'yes'}),/Invalid Psweep enable state/);
assert.throws(()=>api.edit(mapped,'G',{resource:'SMU1'}),/Duplicate SMU assignment/);
const removed=api.remove(generated,'page-2');
assert.equal(removed.pages.length,1);
assert.equal(removed.activeId,'page-1');
assert.equal(generated.pages.length,2,'removal is immutable');
assert.throws(()=>api.remove(removed,'page-1'),/Cannot remove the last test/);
const removedActive=api.remove(generated,'page-1');
assert.equal(removedActive.activeId,'page-2');
assert.equal(api.visible(mapped.pages[0]).length,1);
const reset=api.edit(mapped,'D',{resource:'None'});
assert.equal(api.visible(reset.pages[0]).length,0);
const floor=api.edit(mapped,'D',{rangeMode:'minimum',rangeValue:'1e-6'});
assert.equal(floor.pages[0].terminals[0].rangeMode,'minimum');
const safeModeSwitch=api.edit(floor,'D',{sourceMode:'current',rangeMode:'minimum'});
assert.equal(safeModeSwitch.pages[0].terminals[0].rangeMode,'auto',
 'source-mode switch clears stale unsupported current-autorange minimum');
const switched=api.edit(floor,'D',{sourceMode:'current'});
assert.equal(switched.pages[0].sweep.xSegments[0].stop,'0.01',
 'source change must reset incompatible current-source sweep segments');
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
assert.equal(preview.source.coverage,'stratified-intervals');
assert.equal(preview.source.windows.length,2);
assert.equal(preview.source.windows[0].start,0);
assert.equal(preview.source.windows[1].start,6);
assert.equal(preview.points.at(-1).x,7,'the preview includes the final raw row');
// Large data tables MUST show start/middle/end, while never fetching a whole
// Artifact or exceeding maxRead samples per column. Unread gaps stay disclosed.
const sampleCalls=[],N=1000000;
const virtual={
 get(){throw Error('forbidden full-table read')},
 columnMetadata(){return [
  {id:'xx',key:'VdSet',role:'x',length:N},
  {id:'yy',key:'Id',role:'y',length:N}
 ]},
 readColumnRange(id,key,{start,limit}){
  sampleCalls.push({id,key,start,limit});
  return {values:Array.from({length:limit},(_,i)=>key==='xx'?
   start+i:(start+i===N-1?999:Math.sin((start+i)/35000)))};
 }
};
const longCurve=api.curvesFromArtifacts([{artifactId:'big',name:'Million rows'}],virtual,
 {maxRead:4096,maxDisplay:256})[0];
assert.ok(longCurve);
assert.equal(longCurve.source.totalRows,N);
assert.equal(longCurve.source.readRows,4096);
assert.equal(longCurve.source.coverage,'stratified-intervals');
assert.ok(longCurve.source.windows.length>2,'read multiple distant table regions');
assert.equal(longCurve.source.windows[0].start,0);
assert.equal(longCurve.source.windows.at(-1).start+
 longCurve.source.windows.at(-1).rows,N,'the tail region reaches the final row');
assert.equal(longCurve.points[0].x,0);
assert.equal(longCurve.points.at(-1).x,N-1);
assert.equal(longCurve.points.at(-1).y,999,'include latest extreme, not first-only preview');
const typed={
 columnMetadata:virtual.columnMetadata,
 readColumnRange:(id,key,span)=>({values:Float64Array.from(
  virtual.readColumnRange(id,key,span).values)})
};
const typedCurve=api.curvesFromArtifacts([{artifactId:'typed'}],typed,
 {maxRead:48,maxDisplay:32})[0];
assert.equal(typedCurve.source.readRows,48,
 'Data Center may provide typed numeric column slices');
assert.ok(longCurve.points.length<=256,'display budget respected');
assert.ok(sampleCalls.every(c=>c.limit<=65536));
assert.equal(sampleCalls.filter(c=>c.key==='xx').reduce((n,c)=>n+c.limit,0),4096+48,
 'separate 4096-row preview and 48-row TypedArray smoke each honor their budget');
assert.match(preview.label,/preview 4\/8/);
console.log('DKTS Core-native plugin: manifest, 5 types, project state, None/SMU mapping, range guards PASS');
