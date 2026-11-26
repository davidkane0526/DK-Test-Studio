'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'../integrations/dkds-native');
const manifest=JSON.parse(fs.readFileSync(root+'/plugin.json','utf8'));
const js=fs.readFileSync(root+'/plugin.js','utf8'),model=fs.readFileSync(root+'/model.js','utf8'),shell=fs.readFileSync(root+'/ui-shell.js','utf8'),css=fs.readFileSync(root+'/ui-shell.css','utf8');
assert.equal(manifest.id,'com.dkts.keithley-4200');
assert.equal(manifest.version,'0.8.36');
assert.ok(manifest.requiresCore.includes('ui.dom'),'native timing uses DKDS-owned lifecycle-managed timers');
assert.equal(manifest.apiVersion,'1.19.0');
assert.equal(manifest.pluginType,'workbench');
assert.equal(manifest.workspace.role,'top');
assert.equal(manifest.workspace.defaultSuper,true);
assert.deepEqual(manifest.data.accepts,['science.transport.iv','data.table']);
assert.equal(manifest.window.artifactHydration,'live');
assert.ok(manifest.requiresCore.includes('ui.unit-templates'));
assert.ok(manifest.requiresCore.includes('capabilities'));
assert.ok(manifest.requiresCore.includes('ui.settings'));
assert.ok(manifest.requiresCore.includes('ui.dialogs'));
assert.deepEqual(manifest.pluginDependencies,[{id:'builtin.connectivity-center'}]);
assert.ok(manifest.requiresCore.includes('data.artifacts'));
assert.ok(manifest.requiresCore.includes('ui.scientific-plot'));
assert.deepEqual(manifest.styles,['ui-shell.css']);
assert.doesNotMatch(css,/\.dkds-(?:plugin-workspace|analysis-|scientific-)/);
assert.doesNotMatch(shell,/\bdocument\.(?:createElement|querySelector|getElementById)/);
assert.deepEqual(manifest.scripts,['hardware-capabilities.js','kxci-protocol.js','identity-core.js','measurement-plan.js','kxci-measurement.js','model.js','measurement-data.js','measurement-runtime.js','ui-shell.js','plugin.js']);
for(const file of manifest.scripts){
 const source=fs.readFileSync(root+'/'+file,'utf8');
 assert.doesNotMatch(source,/\b(?:requestAnimationFrame|cancelAnimationFrame|setInterval|clearInterval|setTimeout|clearTimeout|queueMicrotask)\s*\(/,
  file+' must use a supported Core/native scheduling contract, not raw browser timers');
}
assert.match(shell,/data-dkts-nav-open/);
assert.match(css,/max-width:900px/);
assert.match(css,/data-dkts-plot-group/);
assert.match(css,/data-dkts-plot-frame.*data-dkds-unit-panel-body/s);
assert.match(js,/data-dkts-raw-host/);
assert.doesNotMatch(js,/contentAspectRatio:2\.25/);
assert.match(css,/data-dkts-port-mobile/);
assert.match(css,/max-width:990px[\s\S]*data-dkts-port-mobile/);
assert.match(css,/--dkds-grid-auto-rows:minmax\(164px,1fr\)/);
assert.ok(!/\bfetch\s*\(/.test(shell));
assert.ok(/ctx\.ui\.topWorkspace\.register/.test(js));
assert.doesNotMatch(js,/units\.prime\.build|portPrime|portFields/);
assert.match(js,/primes:\[\]/);
assert.match(js,/selected:plotScope==='routine'&&routine\.id===s\.activeRoutineId/);
assert.match(js,/selected:plotScope==='page'&&page\.id===s\.activeId/);
assert.match(js,/addEventListener\?\.\('dblclick',\(\)=>showEditor/);
assert.match(js,/units\.tabs\.create\(editorTabs,\{variant:'compact'/);
assert.ok(js.includes("const PAGE_TABS=[['sweep','Sweep'],['target','Target'],['strategy','Strategy']]"));
assert.doesNotMatch(js,/renderSweepTriptych|pageInfoRegion/);
assert.match(js,/renderPageInfo\(parameters,p,s\)/);
for(const name of ['renderTargetPanel','renderStrategyPanel','renderLimitsPanel','renderVariablesPanel','renderAssociateSpecPanel'])
 assert.match(js,new RegExp('function '+name+'\\('));
assert.match(js,/renderSweepAxis\(input.body,p,'X'\)/);
assert.match(js,/renderSweepAxis\(input.body,p,'P'\)/);
assert.match(js,/className:'dkts-terminal-toolbar'/);
assert.match(js,/controlOnly:true,controlClassName:'dkts-terminal-field'/);
assert.match(js,/const logicals=p.kind==='dc'\?\['S','D','G','B'\]:\['S','D','G'\]/);
assert.match(js,/id:'mobile-port-map'/);
assert.match(js,/id:'apply-port-map'/);
assert.match(js,/className:'dkts-terminal-strip'/);
assert.match(js,/id:'dkts-workspace-connect'/);
assert.match(js,/id:'dkts-workspace-scan'/);
assert.doesNotMatch(js,/id:'dkts-return-data-plots'/);
assert.match(js,/addEventListener\?\.\('dblclick',\(\)=>renameDevice/);
assert.match(js,/data-dkts-editor-open/);
assert.doesNotMatch(js,/workRegion\.replaceChildren/);
assert.match(js,/const assigned=model\.visible\(p\)/);
assert.match(js,/disabled:channelOptions\.length===0/);
assert.match(js,/TEST_TYPE_LABELS=Object\.freeze\(\{DC:'直流',Pulse:'脉冲'/);
assert.ok(/units\.scientificPlot\.create/.test(js));
assert.match(js,/units\.plotGroup\.create\(/);
assert.match(js,/frameGroup\.adoptPlot\(/);
assert.match(js,/id:'dkts-frame-kind-'/);
assert.ok(js.split('units.panel.create(').slice(1).every(x=>!x.slice(0,130).includes("variant:'standard'")));
assert.ok(/ctx\.data\.sources\.list/.test(js));
assert.match(js,/model\.curvesFromArtifacts\(available,ctx\.data\.artifacts,\{axis:isTargetPlot\(axis\)\?'target':axis,target\}\)/);
const plotReadSection=js.slice(js.indexOf('function curves('),js.indexOf('function graphSettings('));
assert.ok(!/ctx\.data\.artifacts\.get\(/.test(plotReadSection));
assert.match(js,/ctx\.data\.artifacts\.get\(ref\.artifactId\)/);
assert.match(js,/ctx\.io\.saveCsv\(rows,/);
assert.ok(manifest.requiresCore.includes('io')&&manifest.requiresCore.includes('data.model'));
assert.ok(!/\biframe\b|createElement\(\s*['"]iframe|window\.electronAPI|\bfetch\s*\(/.test(js));
assert.ok(!/\bME1\b|\bDV\b|\bUS\b|\bRV\b/.test(js),'no output instructions in workbench');
let api;
vm.runInNewContext(model,{window:{DKDSPluginModules:{define:(id,name,instance)=>{
 assert.equal(id,manifest.id);assert.equal(name,'model');api=instance;
}}}});
assert.ok(api);
// Start the existing I–V regression cases from a pre-DC saved project.
const legacySeed=api.initial();
legacySeed.pages=legacySeed.pages.slice(0,1);
legacySeed.sequence=1;
const orig=api.editPage(legacySeed,{kind:'iv'});
const nativeTime=api.add(orig,'time');
assert.equal(nativeTime.pages.at(-1).timing.mode,'native-fixed');
const time=api.editTiming(nativeTime,{mode:'linear-step'});
const timeSettings=time.pages.at(-1).timing;
assert.equal(api.timedSummary('time',timeSettings).points,9);
const timeGrid=api.timedSummary('time',{...timeSettings,sampleStepS:'0.01'});
assert.equal(timeGrid.durationS,1);
assert.equal(timeGrid.segmentCount,10);
assert.equal(timeGrid.samplePoints,100);
const oldTime=JSON.parse(JSON.stringify(time));
delete oldTime.pages.at(-1).timing.sourceModes;
delete oldTime.pages.at(-1).timing.segments[0].currentBias;
oldTime.pages.at(-1).timing.segments[0].bias.D='0.6';
const migratedTime=api.validate(oldTime).pages.at(-1).timing;
assert.equal(migratedTime.sourceModes.D,'voltage');
assert.equal(migratedTime.segments[0].bias.D,'0.6');
assert.equal(migratedTime.segments[0].currentBias.D,'0');
const currentTime={...migratedTime,sourceModes:{...migratedTime.sourceModes,D:'current'}};
currentTime.segments[0].currentBias.D='-0.001';
assert.equal(api.editTiming(oldTime,currentTime).pages.at(-1).timing.segments[0].currentBias.D,'-0.001');
currentTime.segments[0].currentBias.D='2';
assert.throws(()=>api.timedSummary('time',currentTime),error=>error.field==='segments.0.currentBias.D');
assert.throws(()=>api.timedSummary('time',{...timeSettings,sampleStepS:'0.5'}),error=>error.field==='events.0.intervalS');
assert.equal(api.SMU_INTEGRATION_PLC.short,0.1);
assert.equal(api.timedSummary('time',{...timeSettings,integrationPreset:'medium'}).points,9);
assert.throws(()=>api.timedSummary('time',{...timeSettings,integrationPreset:'long'}),/integration time must fit/);
assert.equal(api.editTiming(time,{integrationS:'0.01'}).pages.at(-1).timing.integrationS,'0.01');
assert.throws(()=>api.editTiming(time,{integrationPreset:'unsupported'}),/supported SMU integration preset/);
assert.throws(()=>api.editTiming(time,{switchStepS:'0.3'}),/multiple of Switching Step/);
assert.throws(()=>api.editTiming(time,{events:[{...timeSettings.events[0],points:'12'}]}),/exceeds the cycle/);
assert.equal(api.timedSummary('time',api.editTiming(time,{cycles:'2'}).pages.at(-1).timing).points,18);
orig.pages=orig.pages.slice(0,1);
orig.sequence=1;
let retention=api.add(orig,'retention');
assert.equal(api.timedSummary('retention',retention.pages.at(-1).timing).points,10);
assert.throws(()=>api.editTiming(retention,{windowS:'30'}),/windows overlap/i);
retention=api.editTiming(retention,{firstS:'0',lastS:'0',points:'1',spacing:'linear'});
assert.equal(retention.pages.at(-1).timing.firstS,'0');
const pulse=api.add(orig,'pulse');
assert.equal(api.timedSummary('pulse',pulse.pages.at(-1).timing).points,10);
assert.throws(()=>api.editTiming(pulse,{windowStopUs:'501'}),/flat top/);
const legacyPulse=api.editTiming(pulse,{windowStartUs:'75',windowStopUs:'425'}).pages.at(-1).timing;
assert.equal(legacyPulse.windowTimeUs,'350');
assert.equal(Object.hasOwn(legacyPulse,'windowStopUs'),false);
const autoPulse=api.editTiming(pulse,{windowStartUs:'',windowTimeUs:'',holdUs:'10',baseDelayUs:'25'}).pages.at(-1).timing;
assert.equal(api.timedSummary('pulse',autoPulse).windowS,0.0005);
assert.throws(()=>api.editTiming(pulse,{holdUs:'-1'}),/Hold Time and Base Delay/);
assert.throws(()=>api.editTiming(pulse,{sweep:'base',start:'8',stop:'9',step:'1'}),error=>error.field==='basePeakV');
assert.throws(()=>api.editTiming(pulse,{sweep:'base',basePeakV:'14',start:'8',stop:'9',step:'1'}),/voltage range/);
assert.throws(()=>api.editTiming(pulse,{loadOhms:'0'}),/Load must/);
assert.equal(api.editPage(pulse,{kind:'retention'}).pages.at(-1).timing.spacing,'log');
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
assert.equal(secondDevice.pages.length,3);
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
assert.equal(api.summary(orig.pages[0]).ready,true,'FS-Pro sample defaults to Drain=SMU1 and Gate=SMU2 for offline planning');
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
assert.equal(api.visible(orig.pages[0]).length,2,'only assigned SMU1/SMU2 appear; GNDU and None are not parameter rows');
// Native FS-Pro Page tabs store real validated project data.
const renamed=api.editPage(orig,{name:'Neuromorphic I–V',note:'Sweep protocol'});
assert.equal(renamed.pages[0].name,'Neuromorphic I–V');
assert.equal(orig.pages[0].name,'I–V 扫描','metadata edit is immutable');
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
const shared=api.edit(api.edit(mapped,'G',{bias:'0.5'}),'D',{resource:'SMU4'});
assert.equal(shared.portMapping.D,'SMU4');
assert.ok(shared.pages.every(p=>p.terminals.find(t=>t.logical==='D').resource==='SMU4'));
assert.equal(shared.pages[0].terminals.find(t=>t.logical==='G').bias,'0.5');
assert.equal(shared.pages[1].terminals.find(t=>t.logical==='G').bias,'0');
assert.equal(api.add(shared,'iv').pages[2].terminals.find(t=>t.logical==='D').resource,'SMU4');
const legacyMapping=JSON.parse(JSON.stringify(shared));
delete legacyMapping.portMapping;
legacyMapping.pages[1].terminals.find(t=>t.logical==='D').resource='SMU3';
const migratedMapping=api.validate(legacyMapping);
assert.equal(migratedMapping.pages[1].terminals.find(t=>t.logical==='D').resource,'SMU4');
assert.equal(migratedMapping.pages[1].previousPortMapping.D,'SMU3');
const pmu=api.edit(shared,'G',{resource:'PMU1'});
assert.ok(pmu.pages.every(p=>p.terminals.find(t=>t.logical==='G').resource==='PMU1'));
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
const oriented=api.editSegment(programmed,'X',0,{step:'-0.1'});
assert.equal(oriented.pages[0].sweep.xSegments[0].step,'0.1');
const descending=api.editSegment(extra,'X',0,{stop:'-2'});
assert.deepEqual(Array.from(descending.pages[0].sweep.xSegments,({start,stop,step})=>[start,stop,step]),
 [['0','-2','-0.25'],['-2','-2','0']]);
const forwardSecond=api.editSegment(descending,'X',1,{stop:'-1',step:'0.25'});
const reconnected=api.editSegment(forwardSecond,'X',0,{stop:'0.5'});
assert.deepEqual(Array.from(reconnected.pages[0].sweep.xSegments,({start,stop,step})=>[start,stop,step]),
 [['0','0.5','0.25'],['0.5','-1','-0.25']]);
const withRoutine=api.addRoutine(programmed);
const withDevice=api.addDevice(withRoutine);
assert.equal(withDevice.devices.length,2);
assert.equal(withDevice.routines.length,3);
assert.equal(withDevice.pages.length,withRoutine.pages.length+2);
assert.equal(withDevice.pages[0].sweep.xSegments[0].stop,'1');
const withLoops=api.setRoutineLoops(withDevice,withRoutine.activeRoutineId,'6');
assert.equal(api.validate(withLoops).routines[1].loops,'6');
assert.equal(withLoops.routines[0].loops,'1');
assert.equal(withLoops.pages[0].sweep.loops,'3');
assert.throws(()=>api.setRoutineLoops(withLoops,withRoutine.activeRoutineId,'0'),/positive integer/);
assert.throws(()=>api.setRoutineLoops(withLoops,withRoutine.activeRoutineId,'10001'),/planning bound/);
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
assert.equal(api.visible(mapped.pages[0]).length,2);
const reset=api.edit(mapped,'D',{resource:'None'});
assert.equal(api.visible(reset.pages[0]).length,1);
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
const newProject=api.validate(api.initial());
assert.deepEqual(Array.from(newProject.pages,row=>row.kind),['dc','time']);
const newRoutine=api.addRoutine(newProject);
assert.deepEqual(Array.from(newRoutine.pages.filter(p=>p.routineId===newRoutine.activeRoutineId),p=>p.kind),['dc','time']);
assert.deepEqual(Array.from(api.validate(orig).pages,p=>p.kind),['iv'],'load saved routines without inserting tests');
const dcProject=api.add(orig,'dc');
const dcPage=dcProject.pages.find(row=>row.id===dcProject.activeId);
const settings=JSON.parse(JSON.stringify(dcPage.dc));
assert.deepEqual(Array.from(api.dcTerminals(dcPage),row=>row.logical),['D','G','S']);
assert.equal(api.dcSummary(dcPage).x,'D');
const mixedMethods=JSON.parse(JSON.stringify(dcProject));
const mixedDc=mixedMethods.pages.find(p=>p.kind==='dc').dc;
mixedDc.terminals.D.segments.push({...mixedDc.terminals.D.segments[0],method:'points'});
assert.equal(api.validate(mixedMethods).pages.find(p=>p.kind==='dc').dc.terminals.D.segments[1].method,'points');
assert.throws(()=>api.editDc(mixedMethods,mixedDc),/single method/);
assert.equal(dcPage.dc.terminals.D.segments[0].method,'step');
assert.equal(dcPage.dc.terminals.G.role,'CONDITION');
assert.equal(dcPage.dc.terminals.G.segments[0].method,'constant');
assert.equal(settings.reference,'S');
const withBody=api.editDcBody(dcProject,'SMU3');
assert.deepEqual(Array.from(api.dcTerminals(withBody.pages[1]),row=>row.logical),['D','G','S','B']);
assert.equal(JSON.stringify(withBody.pages[0]),JSON.stringify(dcProject.pages[0]));
assert.equal(withBody.portMapping.B,'None');
assert.throws(()=>api.editDcBody(dcProject,'SMU1'),/already assigned/);
assert.throws(()=>api.editDcBody(dcProject,'PMU1'),/SMU, GNDU or None/);
settings.terminals.G.segments[0].value='0.04*scale()';
settings.polarity='PMOS';
settings.terminals.D.segments[0].method='points';
settings.terminals.D.segments[0].points='6';
settings.preset='point-by-point';
settings.strategy.hold='0.5';
settings.strategy.onLimit='skip';
settings.strategy.direction='forward-reverse';
const dcSaved=api.editDc(dcProject,settings);
assert.equal(dcSaved.pages[1].dc.terminals.D.segments[0].points,'6');
assert.equal(dcSaved.pages[1].dc.strategy.onLimit,'skip');
assert.equal(api.dcSummary(dcSaved.pages[1]).preset,'point-by-point');
const invalidHold=JSON.parse(JSON.stringify(settings));
invalidHold.strategy.hold='1001';
assert.throws(()=>api.editDc(dcProject,invalidHold),/Hold time/);
const prior=JSON.parse(JSON.stringify(dcProject));
const priorDc=prior.pages[1].dc;
delete priorDc.preset;
delete priorDc.strategy.hold;
delete priorDc.strategy.onLimit;
delete priorDc.strategy.direction;
for(const terminal of Object.values(priorDc.terminals))delete terminal.segments[0].range;
priorDc.terminals.D.role='CONDITION';
priorDc.terminals.D.segments[0].method='constant';
priorDc.terminals.G.role='X';
priorDc.terminals.G.segments[0].method='step';
const migratedPreset=api.validate(prior).pages[1];
assert.equal(migratedPreset.dc.preset,'optimized');
assert.equal(api.dcSummary(migratedPreset).x,'G','preserve the previously saved axis');
assert.equal(migratedPreset.dc.terminals.G.segments[0].range,'auto');
assert.equal(JSON.stringify(dcSaved.pages[0]),JSON.stringify(dcProject.pages[0]));
const bad=JSON.parse(JSON.stringify(settings));
bad.terminals.D.ref='G';
bad.terminals.G.ref='D';
assert.throws(()=>api.editDc(dcProject,bad),/without a cycle/);
bad.terminals.G.role='X';
assert.throws(()=>api.editDc(dcProject,bad),/exactly one Xsweep/);
const dcWithSpecs=api.addSpec(api.addSpec(dcSaved));
assert.deepEqual(Array.from(dcWithSpecs.pages[1].dc.specIds),['spec-1','spec-2']);
assert.deepEqual(Array.from(api.removeDcSpec(dcWithSpecs,'spec-1').pages[1].dc.specIds),['spec-2']);
console.log('DKTS Core-native plugin: manifest, project state, independent DC plans and SMU range guards PASS');

assert.match(css,/dkts-parameter-content/,'Page parameters own a bounded scroll region');
assert.match(css,/dkts-sweep-segment/,'sweep rows use compact Unit layout rows');
assert.doesNotMatch(css,/body\s*\{|\.dkds-plugin-workspace/);
assert.match(css,/container-type:inline-size/,'scan rows adapt to their actual content width');
const importantRules=[...css.matchAll(/#[^{]+\{[^{}]*!important[^{}]*\}/g)].map(x=>x[0]);
assert(importantRules.length>0&&importantRules.every(rule=>
 /\[data-dkts-(?:nav-toggle|port-desktop|port-mobile)\]|\.dkts-sweep-segment \.dkds-field-label-row|\.dkts-(?:page-editor|project-plot-area)\[hidden\]/.test(rule)),
 'responsive visibility may override Unit inline display, never its geometry or paint');
assert.doesNotMatch(css,/grid-template-columns:240px/);
assert.match(js,/variant:'identity',className:'dkts-main-grid'/);
