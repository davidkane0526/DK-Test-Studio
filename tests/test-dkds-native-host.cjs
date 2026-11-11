'use strict';
// Exercise the actual plugin registration and Unit-first rendering contract.
// This is a mock DKDS Core runtime, not evidence of a real GUI host install.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'../integrations/dkds-native');
const registry=new Map(),definitions=[];
const sandbox={
 window:{matchMedia:()=>({matches:true}),DKDSPluginModules:{define:(id,name,value)=>registry.set(id+':'+name,value)}},
 DKDSPlugins:{define:(manifest,activate)=>definitions.push({manifest,activate})},
 console
};
vm.runInNewContext(fs.readFileSync(dir+'/model.js','utf8'),sandbox,{filename:'model.js'});
vm.runInNewContext(fs.readFileSync(dir+'/measurement-data.js','utf8'),sandbox,{filename:'measurement-data.js'});
vm.runInNewContext(fs.readFileSync(dir+'/plugin.js','utf8'),sandbox,{filename:'plugin.js'});
assert.equal(definitions.length,1);
const record={actions:[],fields:[],panels:[],plots:[],plotViews:[],headers:[],
 listItems:[],popovers:[],plotGroups:[],tables:[],closedPads:0,top:null,activity:null,composed:null,disposals:0,captures:0,status:[],pageHeaders:0,fullReads:0,exports:[]};
const el=()=>({children:[],textContent:'',replaceChildren(){this.children=[];}});
const units={
 pageHeader:{create:()=>{record.pageHeaders++;return {actions:el()}}},page:{create:()=>({element:el()})},
 header:{create:(host,spec)=>{record.headers.push(spec);return{element:el(),actions:el()}}},
 plotView:{adopt:(id,card,spec)=>{record.plotViews.push({id,spec});return {dispose:()=>record.disposals++}}},
  table:{mount:(id,host,spec)=>{
   const row={id,spec,updates:[],setData:(columns,rows)=>row.updates.push({columns,rows}),
    dispose:()=>record.disposals++};record.tables.push(row);return row;
  }},
  plotGroup:{create:(host,spec)=>{record.plotGroups.push(spec);return{
   adoptPlot:(id,card,config)=>{record.plotViews.push({id,spec:config});return{dispose:()=>record.disposals++}},
   setColumns:count=>{record.groupColumns=count},dispose:()=>record.disposals++};}},
 popover:{create:(host,spec)=>{record.popovers.push(spec);return {
  body:el(),close:()=>{record.closedPads++;}}}},
 layout:{create:(host,spec)=>{
   record.layouts=(record.layouts||[]);record.layouts.push(spec.variant);
   // The pinned SDK allows canonical layout recipes; arbitrary geometry
   // values are not guaranteed and previously failed real Core activation.
   assert.ok(['identity','form-grid-2','form-grid-4','row-wrap',
     'stack-comfortable','stack-compact','sidebar-main-compact','scroll-pane',
     'responsive-two-column',
     'plot-card-fill','action-grid-4'].includes(spec.variant),
     'Unknown DKDS Unit layout recipe: '+String(spec.variant));
   if(spec.variant==='form-grid-4'&&spec.responsiveGeometry){
    assert.deepEqual(Array.from(spec.responsiveGeometry,row=>Number(row.maxWidth)),[620,520]);
    assert.equal(spec.responsiveGeometry[0].geometry.gridTemplateColumns,
     'repeat(4,minmax(0,1fr))');
    assert.equal(spec.responsiveGeometry[1].geometry.gridTemplateColumns,
     'repeat(2,minmax(0,1fr))');
   }
   if(spec.variant==='responsive-two-column'){
    assert.ok(['minmax(0,1.25fr) minmax(320px,.75fr)',
      'repeat(2,minmax(0,1fr))'].includes(spec.geometry?.gridTemplateColumns));
    assert.equal(spec.responsiveGeometry?.[0]?.maxWidth,680);
    assert.equal(spec.responsiveGeometry?.[0]?.geometry?.gridTemplateColumns,
     'minmax(0,1fr)');
   }else if(spec.variant==='sidebar-main-compact'){
    assert.equal(spec.geometry,undefined);
    assert.deepEqual(Array.from(spec.responsiveGeometry,row=>Number(row.maxWidth)),[620]);
    assert.equal(spec.responsiveGeometry[0].geometry.gridTemplateColumns,
     'minmax(0,1fr)','mobile project tree must stack above the editor');
   }else{
    assert.equal(spec.geometry,undefined,
     'DKTS native plugin must not introduce unregistered layout geometry');
    if(spec.responsiveGeometry)
     assert.deepEqual(Array.from(spec.responsiveGeometry,row=>Number(row.maxWidth)),[620,520]);
   }
   return el();
 }},
 action:{create:(host,spec)=>{record.actions.push(spec);host.children.push(spec);return{element:el()}}},
 tabs:{create:(host,spec)=>{record.tabs=record.tabs||[];record.tabs.push(spec);
  host.children.push(spec);return{element:el()}}},
 list:{create:host=>{const list=el();host.children.push(list);return {
  item:spec=>{record.listItems.push(spec);list.children.push(spec);return spec;}
 }}},
 note:{create:(host,spec)=>{const n=el();n.textContent=spec.text;host.children.push(n);return n}},
 emptyState:{create:(host,spec)=>{host.children.push(spec);return{element:el()}}},
 panel:{detached:spec=>({element:el(),body:el()}),create:(host,spec)=>{
   // Pinned DKDS Core 20f05685 SDK: panel variants do NOT include "standard".
   // Workspace "standard" is valid, but panel "standard" fails real activation.
   assert.ok(['plain','headed','portable','control-card','plot-card','accepted-portable']
     .includes(spec.variant||'plain'),'Unknown DKDS SDK panel variant: '+String(spec.variant));
   record.panels.push(spec);
   const body=el();host.children.push(body);return{body,element:el()}
 }},
 field:{create:(host,spec)=>{const control={value:spec.value,disabled:spec.disabled};
   record.fields.push({spec,control});host.children.push(control);return{control,element:el()}}},
 scientificPlot:{create:(host,spec)=>{record.plots.push(spec);return{
   requestRender:()=>{record.refreshCount=(record.refreshCount||0)+1;},
   dispose:()=>record.disposals++}}},
 prime:{build:spec=>spec},
 workspace:{create:()=>({compose:spec=>{record.composed=spec},dispose:()=>record.disposals++})}
};
let state;
const artifacts=[{artifactId:'a1',name:'Raw IV'}];
const table={kind:'data.table',rowCount:3,name:'Raw IV',columns:[
 {id:'v',key:'VdSet',role:'x',values:[0,0.1,0.2]},
 {id:'i',key:'Id',role:'y',values:[1e-9,2e-9,3e-9]}
]};
const reads=[];
let revision=1;
const artifactStore={
 get:id=>{record.fullReads++;return id==='a1'?table:null;},
 artifactRevision:()=>revision,
 columnMetadata:id=>id==='a1'?table.columns.map(x=>({
   id:x.id,key:x.key,role:x.role,length:x.values.length
 })):null,
 readColumnRange:(id,key,{start,limit})=>{
  reads.push({id,key,start,limit});
  const column=table.columns.find(x=>x.id===key||x.key===key);
  return id==='a1'&&column?{values:column.values.slice(start,start+limit)}:null;
 }
};
const ctx={
 modules:{require:name=>registry.get('com.dkts.keithley-4200:'+name)},
 state:{create:(init,options)=>{assert.equal(options.projectSlice,'settings');state=init;
  return {get:()=>state,patch:delta=>{state={...state,...delta};}}}},
 project:{capture:()=>record.captures++},
 status:{set:text=>record.status.push(text)},
 workspace:{openPage:id=>record.opened=id},
 events:{on:(kind,cb)=>{record.onEvent={kind,cb};return()=>record.disposals++}},
 io:{saveCsv:async(rows,name)=>{record.exports.push({rows,name});return name;}},
 data:{sources:{list:()=>artifacts},artifacts:artifactStore,
  model:{rows:table=>table.columns[0].values.map((_,i)=>Object.fromEntries(
   table.columns.map(col=>[col.key,col.values[i]])))}},
 ui:{unitTemplates:units,
  activities:{add:spec=>{record.activity=spec}},
  pages:{add:()=>el()},
  topWorkspace:{register:spec=>{record.top=spec}}}
 };
(async()=>{
 const instance=await definitions[0].activate(ctx);
 assert.equal(record.top.activity,'dkts-keithley-4200');
 assert.equal(record.pageHeaders,0,'the SUPER host top bar already identifies 4200A; no duplicate 42px page header');
 assert.ok(record.layouts.includes('sidebar-main-compact'),
  'native DKDS workbench must use host-managed FS-Pro project sidebar');
 assert.ok(record.layouts.includes('stack-compact'),
  'Project Explorer uses compact native DKDS Unit sizing');
 const projectHeader=record.headers.find(x=>x.eyebrow==='项目');
 assert.ok(projectHeader);
 assert.equal(projectHeader.meta,'','Device selector already displays selected device; do not repeat it');
 assert.equal(record.listItems.find(x=>x.title==='Routine 1')?.selected,false,
  'only active Page is highlighted; Routine remains an ancestor');
 assert.equal(record.top.layout.prime.length,1);
 assert.equal(record.composed.primary.titlePolicy,'host-only');
 assert.equal(record.composed.primes.length,1);
 assert.ok(record.layouts.includes('responsive-two-column'));
 assert.ok(record.panels.some(x=>x.title==='端口设置'));
 assert.equal(record.tabs.at(-1).items.length,7);
 record.tabs.at(-1).onChange('info');
 assert.ok(record.panels.some(x=>x.title==='页面信息'));
 record.tabs.at(-1).onChange('sweep');

 assert.equal(record.panels.some(x=>x.title==='D · SMU1'),false,'None port does not render parameter panel');
 assert.equal(record.plotGroups.length,1,'four plot windows share canonical DKDS managed PlotGroup');
  assert.equal(record.tables.length,4,'raw tables must use DKDS Unit Table, not HTML placeholders');
  assert.equal(record.plots.length,4,'four actual DKDS scientific plots');
 assert.equal(record.headers.some(x=>x.kind==='plot'&&x.variant==='plot'),true,
   'DKDS Core owns the canonical chart title');
 assert.equal(record.plotViews.length,4,'four independent DKDS PlotView hosts');
 assert.deepEqual([...new Set(record.plotViews.map(x=>x.id))].length,4);
 assert.ok(record.fields.some(x=>x.spec.label==='图窗布局'),'native project graph layout selector');
 const showKind=record.fields.find(x=>x.spec.label==='显示');
 assert.ok(showKind,'independent per-window plot selector');
 assert.deepEqual(Array.from(showKind.spec.options,row=>row.value),['iv','transfer','it','raw']);
 assert.equal(record.plotViews[0].spec.variant,'complete');
 assert.deepEqual([...record.plotViews[0].spec.placements],['home','left','right','bottom','float','global']);
 assert.equal(record.plotViews[0].spec.images,true);
 assert.equal(record.plotViews[0].spec.csv,false,
   'do not export downsampled chart points as instrument original CSV');
 const beforePlotReads=reads.length; // Raw data Table Unit has already requested bounded previews.
 assert.equal(record.plots[0].getCurves().length,1,'reads canonical DKDS artifact');
 assert.equal(record.fullReads,0,'plot never materializes full raw Artifact');
 assert.equal(record.plots[0].getCurves()[0].points.length,3);
 assert.equal(reads.length,beforePlotReads+2,'plot adds exactly two bounded read columns');
 record.plots[0].getCurves();
 assert.equal(reads.length,beforePlotReads+2,'unchanged Artifact revisions reuse cached curves');
 revision++;
 record.plots[0].getCurves();
 assert.equal(reads.length,beforePlotReads+4,'Artifact revision change invalidates curves');
 assert.ok(reads.every(r=>r.limit<=65536));
 const exportButton=record.actions.find(x=>x.id==='dkts-export-original-1');
 assert.ok(exportButton,'export runs via DKDS unit action');
 await exportButton.onInvoke();
 assert.equal(record.exports.length,1,'raw data exported only through DKDS IO');
 assert.equal(record.exports[0].rows.length,3);
 assert.deepEqual(record.exports[0].rows[2],{VdSet:0.2,Id:3e-9});
 assert.match(record.exports[0].name,/DKTS_4200A_Raw_IV.csv/);
 assert.equal(record.fullReads,1,'only explicit export requests full canonical Artifact');
 const map=record.fields.find(x=>x.spec.label==='D 端口');
 assert.ok(map,'port assignment is a Core field');
 map.spec.onChange({target:{value:'SMU1'}});
 assert.equal(state.pages[0].terminals[0].resource,'SMU1');
 assert.equal(state.ui.graphs.count,4,'window layout persists in project slice');
 assert.ok(record.panels.some(x=>x.title==='端口参数'),
  'assigned ports now share one compact Core-owned Terminal Settings panel');
 assert.ok(record.panels.some(x=>x.title==='Xsweep · D / SMU1'),
  'assigned X port has its own Core-rendered scan segments');
 const addSegment=[...record.actions].reverse().find(x=>x.id==='add-segment-X');
 assert.ok(addSegment,'each assigned sweep has add-segment action');
 addSegment.onInvoke();
 assert.equal(state.pages[0].sweep.xSegments.length,2);
 const removeSegment=[...record.actions].reverse().find(x=>x.id==='remove-X-1');
 assert.ok(removeSegment);
 removeSegment.onInvoke();
 assert.equal(state.pages[0].sweep.xSegments.length,1);
 const scalar=[...record.fields].reverse().find(x=>x.spec.label==='整体循环');
 assert.ok(scalar,'global cycles are editable in Core inspector');
 scalar.spec.onChange({target:{value:'2'}});
 assert.equal(state.pages[0].sweep.loops,'2');
 const choice=[...record.fields].reverse().find(x=>x.spec.label==='新增测试类型');
 choice.control.value='pulse';
 const add=[...record.actions].reverse().find(x=>x.id==='add-test');
 add.onInvoke();
 assert.equal(state.pages.length,2);
 assert.equal(state.pages[1].testType,'Pulse');
 assert.equal(state.activeId,'page-2');
 assert.ok([...record.actions].reverse().some(x=>x.id==='close-page-2'),
  'project tabs can be closed');
 assert.ok(record.captures>=2,'project history captured on mutation');
 // Navigating back must refresh the current Page's port selector, not reuse
 // the previous Page's stale None/SMU assignment.
 const select=[...record.listItems].reverse().find(x=>x.title==='I–V Sweep');
 select.onInvoke();
 assert.equal(state.activeId,'page-1');
 const lastD=[...record.fields].reverse().find(x=>x.spec.label==='D 端口');
 assert.equal(lastD.control.value,'SMU1');
 const numeric=[...record.fields].reverse().find(x=>x.spec.label==='限流 (A)'&&x.spec.onFocus);
 assert.ok(numeric,'a configured SMU compliance field uses the DKDS Unit-hosted numeric keypad');
 assert.equal(numeric.spec.inputMode,'none','coarse-pointer touch does not invoke a conflicting OS keyboard');
 numeric.spec.onFocus({target:numeric.control});
 assert.equal(record.popovers.at(-1).variant,'picker');
 assert.equal(record.popovers.at(-1).role,'dialog');
 assert.equal(record.popovers.at(-1).ariaLabel,'科学计数法数字键盘');
 const press=label=>{
  const action=[...record.actions].reverse().find(x=>x.id==='numeric-'+label);
  assert.ok(action,'numeric key present: '+label);action.onInvoke();
 };
 press('清除');press('1');press('E');press('±');press('6');press('完成');
 assert.equal(state.pages[0].terminals[0].compliance,'1e-6');
 const close=[...record.actions].reverse().find(x=>x.id==='close-page-2');
 close.onInvoke();
 assert.equal(state.pages.length,1);
 assert.equal(state.activeId,'page-1');
 assert.equal(state.pages[0].terminals[0].resource,'SMU1',
  'closing other test preserves active port assignment');
 // True Routine/Page ownership in the DKDS Core host, not a separate web-only sketch.
 const routineAction=[...record.actions].reverse().find(x=>x.id==='add-routine');
 assert.ok(routineAction,'native DKDS Unit Project Explorer provides + Routine');
 routineAction.onInvoke();
 assert.equal(state.routines.length,2);
 assert.equal(state.pages.length,2);
 assert.equal(state.pages[1].routineId,state.routines[1].id);
 assert.equal(state.activeRoutineId,state.routines[1].id);
 const oldRoutine=[...record.listItems].reverse().find(x=>x.title==='Routine 1');
 assert.ok(oldRoutine,'Routine navigation is registered as a host-owned Unit action');
 oldRoutine.onInvoke();
 assert.equal(state.activeId,'page-1');
 assert.equal(state.activeRoutineId,'routine-1');
 const createSpec=[...record.actions].reverse().find(x=>x.id==='add-spec');
 assert.ok(createSpec,'Core host must expose separate Spec creation');
 createSpec.onInvoke();
 assert.equal(state.specs.length,1);
 assert.equal(state.pages[0].associateSpecId,'spec-1');
 const specField=[...record.fields].reverse().find(x=>x.spec.label==='关联规格');
 assert.ok(specField,'Page↔Spec association must use DKDS Unit selector');
 specField.spec.onChange({target:{value:''}});
 assert.equal(state.pages[0].associateSpecId,null,'Spec link can be cleared');
 // Real Core Device navigation is a native Unit selector, never a web-only control.
 const addDevice=[...record.actions].reverse().find(x=>x.id==='add-device');
 assert.ok(addDevice,'DKDS Core Project Explorer must create Device');
 const beforeDeviceFields=record.fields.length;
 addDevice.onInvoke();
 assert.equal(state.devices.length,2);
 assert.equal(state.activeDeviceId,'device-2');
 assert.equal(state.routines.at(-1).deviceId,'device-2');
 assert.equal(state.pages.at(-1).routineId,state.routines.at(-1).id);
 const currentDeviceField=[...record.fields].reverse().find(x=>x.spec.label==='器件');
 assert.equal(currentDeviceField.control.value,'device-2');
 assert.equal(currentDeviceField.spec.options.length,2);
 assert.ok(!record.fields.slice(beforeDeviceFields).some(x=>x.spec.label==='关联规格'),
  'the second Device without Specs must not expose first-Device spec options');
 const newDeviceSpec=[...record.actions].reverse().find(x=>x.id==='add-spec');
 newDeviceSpec.onInvoke();
 assert.equal(state.specs.length,2);
 assert.equal(state.specs[1].deviceId,'device-2');
 assert.throws(()=>sandbox.window.DKDSPluginModules &&
   registry.get('com.dkts.keithley-4200:model').associateSpec(state,'spec-1'),/another Device/);
 const goToFirstDevice=[...record.fields].reverse().find(x=>x.spec.label==='器件');
 goToFirstDevice.spec.onChange({target:{value:'device-1'}});
 assert.equal(state.activeDeviceId,'device-1');
 assert.equal(state.activeId,'page-1');
 // Output Sweep must use the same genuine Core X/P editor as I-V/Transfer.
 const kindOutput=[...record.fields].reverse().find(x=>x.spec.label==='新增测试类型');
 kindOutput.control.value='output';
 const addOutput=[...record.actions].reverse().find(x=>x.id==='add-test');
 addOutput.onInvoke();
 assert.equal(state.pages.at(-1).kind,'output');
 const portForOutput=[...record.fields].reverse().find(x=>x.spec.label==='D 端口');
 portForOutput.spec.onChange({target:{value:'SMU3'}});
 assert.ok(record.panels.some(x=>x.title==='Xsweep · D / SMU3'),
   'Output Sweep must reuse the real DKDS Unit sweep editor');
 assert.ok(record.closedPads>=1);
 assert.equal([...record.actions].reverse().find(x=>x.id==='numeric-E').variant,'quiet',
  'touch numeric keys use Core quiet actions and have no plugin-specific click shadow');
 record.activity.onActivate();
 assert.equal(record.opened,'dktsKeithley4200Page');
 record.onEvent.cb();
 assert.ok(record.refreshCount>=2);
 instance.deactivate();
 assert.ok(record.disposals>=2);
 console.log('Core-host native plugin: Activity/TOP, Unit PRIME, Data Center, plot, project state, port sync PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
