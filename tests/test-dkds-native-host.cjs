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
vm.runInNewContext(fs.readFileSync(dir+'/ui-shell.js','utf8'),sandbox,{filename:'ui-shell.js'});
vm.runInNewContext(fs.readFileSync(dir+'/plugin.js','utf8'),sandbox,{filename:'plugin.js'});
assert.equal(definitions.length,1);
const record={actions:[],fields:[],panels:[],plots:[],plotViews:[],headers:[],layoutSpecs:[],dividers:[],summaries:[],metrics:[],
 listItems:[],popovers:[],plotGroups:[],tables:[],closedPads:0,top:null,activity:null,composed:null,disposals:0,captures:0,status:[],pageHeaders:0,fullReads:0,exports:[]};
const el=()=>({children:[],textContent:'',replaceChildren(){this.children=[];}});
const units={
 pageHeader:{create:()=>{record.pageHeaders++;return {actions:el()}}},page:{create:()=>({element:el()})},
 header:{create:(host,spec)=>{record.headers.push(spec);return{element:el(),title:el(),actions:el()}}},
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
   record.layouts=(record.layouts||[]);record.layouts.push(spec.variant);record.layoutSpecs.push(spec);
   // The pinned SDK allows canonical layout recipes; arbitrary geometry
   // values are not guaranteed and previously failed real Core activation.
   assert.ok(['identity','form-grid-2','form-grid-4','row-wrap','two-card-grid',
     'stack-comfortable','stack-compact','sidebar-main-compact','sidebar-main-standard','content-actions','scroll-pane','row',
     'responsive-two-column','plot-card-fill','action-grid-4','grid'].includes(spec.variant),
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
    assert.equal(spec.geometry.gap,'8px');
    assert.equal(spec.responsiveGeometry?.[0]?.maxWidth,900,
     'the Core Unit Layout owns the responsive one-column drawer geometry');
    assert.equal(spec.responsiveGeometry[0].geometry.gridTemplateColumns,'minmax(0,1fr)');
   }else if(spec.variant==='sidebar-main-standard'){
    assert.equal(spec.geometry.gridTemplateColumns,'260px minmax(0,1fr)');
   }else if(spec.className==='dkts-terminal-toolbar') {
    assert.equal(spec.variant,'row');
    assert.equal(spec.geometry,undefined);
    assert.equal(spec.responsiveGeometry,undefined);
   }else if(spec.className==='dkts-sweep-related') {
    assert.equal(spec.variant,'two-card-grid',
     'Limits receives one full column while Page Var and Associate Spec share the other');
    assert.equal(spec.geometry,undefined,
     'the responsive two-column arrangement must use the pinned DKDS recipe');
    assert.equal(spec.responsiveGeometry,undefined);
   }else if(spec.className==='dkts-project-plot-area'){
    assert.equal(spec.geometry.display,'flex');
    assert.equal(spec.geometry.flexDirection,'column');
    assert.equal(spec.geometry.minHeight,'0');
   }else if(spec.className==='dkts-sweep-segment'){
    assert.equal(spec.geometry.display,'grid');
    assert.match(spec.geometry.gridTemplateColumns,/minmax\(118px,1\.15fr\) minmax\(0,1fr\) 34px$/);
    assert.equal(spec.geometry.gap,'6px',
     'scan rows use the exact geometry vocabulary accepted by the pinned DKDS Unit SDK');
    assert.deepEqual(Array.from(spec.responsiveGeometry,row=>Number(row.maxWidth)),[620,310]);
    assert.equal(spec.responsiveGeometry[0].geometry.gridTemplateColumns,'repeat(2,minmax(128px,1fr))');
    assert.equal(spec.responsiveGeometry[1].geometry.gridTemplateColumns,'minmax(0,1fr)');
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
 divider:{create:(host,spec)=>{record.dividers.push(spec);const n=el();host.children.push(n);return n}},
 emptyState:{create:(host,spec)=>{host.children.push(spec);return{element:el()}}},
 summary:{create:(host,spec)=>{record.summaries.push(spec);const element=el();host.children.push(element);return{element}}},
 metric:{create:(host,spec)=>{record.metrics.push(spec);const element=el();host.children.push(element);return{element,label:el(),value:el()}}},
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
  'native DKDS workbench uses the 235px compact Core sidebar and drawer breakpoint');
 assert.ok(record.layouts.includes('stack-compact'),
  'Project Explorer uses compact native DKDS Unit sizing');
 const projectHeader=record.headers.find(x=>x.title==='项目');
 assert.ok(projectHeader);
 assert.equal(projectHeader.meta,'','Device selector already displays selected device; do not repeat it');
 assert.equal(record.listItems.find(x=>x.title==='测试流程 1')?.selected,true,
  'active Routine is highlighted in the Project Explorer');
 assert.equal(record.listItems.find(x=>x.title==='I–V 扫描')?.selected,true,
  'active Page remains highlighted while the graph overview is open');
 assert.equal(record.top.layout.prime.length,0,
  'terminal assignment is not duplicated in a second PRIME surface');
 assert.equal(record.composed.primary.titlePolicy,'host-only');
 assert.equal(record.composed.primes.length,0);
 assert.ok(!record.layouts.includes('responsive-two-column'),'graph and Page parameter destinations cannot use a sibling-column split');
 assert.ok(!record.panels.some(x=>x.title==='Terminal'),'terminal mapping belongs in the Page titlebar, not a separate card');
 assert.ok(record.layoutSpecs.some(x=>x.className==='dkts-terminal-toolbar'&&x.variant==='row'),'desktop terminal selectors stay in one compact Page titlebar row');
 assert.ok(record.layoutSpecs.some(x=>x.className==='dkts-terminal-control-group'),'desktop selectors and mobile port action share one titlebar group');
 assert.ok(record.headers.some(x=>x.title==='测试类型'),'Project Explorer exposes the localized test type heading');
 const testMenu=record.actions.find(x=>x.id==='add-test-page');
 assert.ok(testMenu?.menu===true,'Test Library uses one compact action menu instead of ten persistent buttons');
 assert.equal(testMenu.items().length,10,'all supported test types remain directly selectable');
 assert.ok(record.summaries.some(x=>x.className==='dkts-sweep-metrics'&&x.variant==='strip'),
  'scan plan uses one compact Core summary strip rather than four stacked metric cards');
 const sweepSummary=record.summaries.find(x=>x.className==='dkts-sweep-metrics');
 assert.equal(sweepSummary.items.length,4);
 assert.match(sweepSummary.items[0].text,/X/);
 assert.equal(record.metrics.length,0,'the scan overview does not create four extra metric surfaces');
 assert.equal(record.fields.filter(x=>x.spec.label==='D 端口').length,1,
  'each logical terminal has exactly one assignment control');
 assert.equal(record.fields.filter(x=>x.spec.label==='G 端口').length,1);
 const terminalOrder=record.fields.filter(x=>/^[SDGB] 端口$/.test(x.spec.label||'')).map(x=>x.spec.label);
 assert.deepEqual(terminalOrder,['S 端口','D 端口','G 端口','B 端口'],
  'titlebar terminal controls follow Source, Drain, Gate, Body order');
 assert.ok(record.fields.filter(x=>/^[SDGB] 端口$/.test(x.spec.label||'')).every(x=>x.spec.controlOnly===true),
  'titlebar terminal selectors use compact unlabeled controls with accessible names');
 assert.ok(record.layoutSpecs.some(x=>x.className==='dkts-sweep-segment'),
  'each X/P segment is rendered as one compact DKDS Unit layout row');
 assert.ok(record.layoutSpecs.some(x=>x.className==='dkts-sweep-segment-head'),
  'wide scan rows use a single aligned column-header row');
 assert.ok(record.dividers.some(x=>x.variant==='vertical'),'titlebar separates terminal selectors from page actions with a DKDS vertical divider');
 assert.ok(record.dividers.every(x=>['vertical','horizontal'].includes(x.variant)),'all separators use the canonical DKDS Divider Unit');
 assert.equal(record.tabs.at(-1).items.length,3);
 assert.deepEqual(Array.from(record.tabs.at(-1).items,row=>row.id),['sweep','target','strategy']);
 assert.ok(record.panels.some(x=>x.title==='页面信息'),'Page Info is rendered above the primary tabs');
 assert.ok(record.fields.some(x=>x.spec.label==='页面名称'));
 assert.ok(record.fields.some(x=>x.spec.label==='备注'));
 assert.equal(record.fields.some(x=>x.spec.label==='测试类型'&&x.spec.readOnly===true),false,
  'test type is already shown in the Page titlebar meta and is not repeated as a disabled field');
 assert.ok(record.panels.some(x=>x.title==='限值'));
 assert.ok(record.panels.some(x=>x.title==='页面变量'));
 assert.ok(record.panels.some(x=>x.title==='关联规格'));
 const variablePanel=record.panels.find(x=>x.title==='页面变量');
 assert.ok(variablePanel.actions?.some(x=>x.id==='add-var'),
  'Page Var uses its panel header for the add action');
 variablePanel.actions.find(x=>x.id==='add-var').onInvoke();
 assert.equal(state.pages[0].variables.length,1,'Page Var add action creates a real persisted variable');
 const variableName=[...record.fields].reverse().find(x=>x.spec.label==='名称');
 variableName.spec.onBlur({target:{value:'Vth'}});
 assert.equal(state.pages[0].variables[0].name,'Vth','Page Var edits persist through project state');
 const varUnit=[...record.fields].reverse().find(x=>x.spec.label==='单位');
 assert.equal(typeof varUnit.spec.onChange,'undefined',
  'typing unit text should never re-render the entire editor per keystroke');
 assert.equal(typeof varUnit.spec.onBlur,'function');
 const variableValue=[...record.fields].reverse().find(x=>x.spec.label==='数值');
 variableValue.spec.onFocus({target:variableValue.control});
 const variablePress=label=>{const action=[...record.actions].reverse().find(x=>x.id==='numeric-'+label);assert.ok(action);action.onInvoke();};
 variablePress('清除');variablePress('1');variablePress('E');variablePress('±');variablePress('3');variablePress('完成');
 assert.equal(state.pages[0].variables[0].value,'1e-3','Page Var scientific keypad commits a valid exponent');
 const capturesBeforeUnchanged=record.captures;
 const unchangedValue=[...record.fields].reverse().find(x=>x.spec.label==='数值');
 unchangedValue.spec.onBlur({target:{value:unchangedValue.spec.value}});
 assert.equal(record.captures,capturesBeforeUnchanged,
  'leaving an unchanged numeric field must not rebuild the native workbench');
 const pageNote=[...record.fields].reverse().find(x=>x.spec.label==='备注');
 pageNote.spec.onBlur({target:{value:'Initial test plan'}});
 assert.equal(state.pages[0].note,'Initial test plan','Page Info note commits on blur without re-rendering each keystroke');
 assert.ok(!record.tabs.at(-1).items.some(x=>['limits','variables','spec','info'].includes(x.id)),
  'Limits, Page Var and Associate Spec belong to Sweep, not primary tabs');
 const beforeTarget=record.fields.length;
 record.tabs.at(-1).onChange('target');
 const unassignedTarget=record.fields.slice(beforeTarget).find(x=>x.spec.label==='测量端口');
 assert.ok(unassignedTarget);
 assert.equal(unassignedTarget.spec.disabled,true,
  'Target port selector is disabled when all physical ports are None');
 assert.deepEqual(Array.from(unassignedTarget.spec.options,row=>row.value),[''],
  'None ports are never exposed as selectable Target parameters');
 const beforeStrategy=record.fields.length;
 record.tabs.at(-1).onChange('strategy');
 const strategyFields=record.fields.slice(beforeStrategy).map(x=>x.spec.label);
 for(const label of ['整体循环','Xsweep 重复次数','Psweep 重复次数','Psweep 扫描'])
  assert.ok(strategyFields.includes(label),'Strategy is the only owner of '+label);
 const disabledPRepeat=record.fields.slice(beforeStrategy).find(x=>x.spec.label==='Psweep 重复次数');
 assert.equal(disabledPRepeat.spec.disabled,true,
  'Psweep repeat count is visibly disabled while the outer sweep is off');
 const beforeSweep=record.fields.length;
 record.tabs.at(-1).onChange('sweep');
 const sweepFields=record.fields.slice(beforeSweep).map(x=>x.spec.label);
 assert.ok(!sweepFields.includes('Xsweep 端口')&&!sweepFields.includes('Psweep 端口'),
  'sweep roles are assigned on each terminal row, not through a second port selector');
 assert.ok(!sweepFields.some(x=>/重复次数|整体循环|档位模式|限流|限压/.test(x||'')),
  'Sweep does not duplicate Strategy or Limits fields');

 const graphBack=record.actions.find(x=>x.id==='back-to-graphs');
 assert.ok(graphBack,'Page editor offers a visible return to the project-level graphs');
 assert.equal(record.panels.some(x=>x.title==='D · SMU1'),false,'None port does not render parameter panel');
 assert.equal(record.plotGroups.length,1,'four plot windows share canonical DKDS managed PlotGroup');
 assert.equal(record.plotGroups[0].minItemWidth,342,'narrow 744px host should stack PlotViews before controls clip');
  assert.equal(record.tables.length,4,'raw tables must use DKDS Unit Table, not HTML placeholders');
  assert.equal(record.plots.length,4,'four actual DKDS scientific plots');
 assert.ok(record.headers.some(x=>x.title==='工程绘图区'),'project graph heading is managed by DKDS Unit Header');
 assert.equal(record.headers.some(x=>x.kind==='plot'&&x.variant==='plot'),true,
   'DKDS Core owns the canonical chart title');
 assert.equal(record.plotViews.length,4,'four independent DKDS PlotView hosts');
 assert.deepEqual([...new Set(record.plotViews.map(x=>x.id))].length,4);
 assert.ok(record.fields.some(x=>x.spec.label==='图窗布局'&&x.spec.controlOnly===true),'plot layout uses DKDS compact header control');
 const showKind=record.actions.find(x=>x.id==='dkts-frame-kind-1');
 assert.ok(showKind&&showKind.menu===true,
  'plot type lives in a compact native header action, not a wide select');
 assert.deepEqual(Array.from(showKind.items(),item=>item.id),
  ['kind-iv','kind-transfer','kind-it','kind-raw']);
 assert.ok(showKind.items()[0].label.startsWith('✓ '),
  'active plot type is clearly marked in its menu');
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
 const dataMenu=record.actions.find(x=>x.id==='dkts-frame-data-1');
 assert.ok(dataMenu?.menu===true,'mobile PlotView uses one canonical DKDS Action menu for sources/export');
 const entries=dataMenu.items();
 assert.ok(entries.some(x=>x.id==='source-all'));
 const exportButton=entries.find(x=>x.id==='export-original');
 assert.ok(exportButton,'full-resolution export is a DKDS menu action');
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
 const mobilePorts=record.actions.find(x=>x.id==='mobile-port-map');
 assert.ok(mobilePorts,'phone titlebar uses one compact port action instead of four clipped selectors');
 mobilePorts.onInvoke();
 assert.equal(record.popovers.at(-1).title,'端口映射');
 const mobilePortFields=record.fields.slice(-4);
 assert.deepEqual(mobilePortFields.map(x=>x.spec.label),['源极 (S)','漏极 (D)','栅极 (G)','衬底 (B)']);
 mobilePortFields[0].spec.onChange({target:{value:'SMU2'}});
 const duplicatePort={target:{value:'SMU2'}};
 mobilePortFields[3].spec.onChange(duplicatePort);
 assert.equal(duplicatePort.target.value,'None','duplicate SMU assignment is rejected and the mobile field is restored');
 assert.match(record.status.at(-1),/Duplicate SMU assignment: SMU2/);
 const applyPortMap=[...record.actions].reverse().find(x=>x.id==='apply-port-map');
 assert.ok(applyPortMap,'mobile port mapping applies the four fields as one project-state transaction');
 applyPortMap.onInvoke();
 assert.equal(state.pages[0].terminals.find(x=>x.logical==='S').resource,'SMU2');
 assert.equal(state.pages[0].terminals.find(x=>x.logical==='D').resource,'SMU1');
 assert.equal(state.pages[0].terminals.find(x=>x.logical==='B').resource,'None');
 assert.equal(state.ui.graphs.count,4,'window layout persists in project slice');
 assert.ok(record.panels.some(x=>x.title==='端口设置'),
  'assigned ports share one compact terminal matrix within Sweep');
 const roleField=[...record.fields].reverse().find(x=>x.spec.attributes?.['aria-label']==='D 端口用途');
 assert.ok(roleField,'terminal matrix exposes one role selector per assigned SMU');
 roleField.spec.onChange({target:{value:'X'}});
 assert.equal(state.pages[0].terminals[0].role,'X');
 const beforeAssignedTarget=record.fields.length;
 record.tabs.at(-1).onChange('target');
 const assignedTarget=record.fields.slice(beforeAssignedTarget).find(x=>x.spec.label==='测量端口');
 assert.ok(assignedTarget);
 assert.deepEqual(Array.from(assignedTarget.spec.options,row=>row.value),['D','S'],
  'Target options contain only assigned physical terminals and never show None');
 assert.equal(assignedTarget.spec.value,'D');
 record.tabs.at(-1).onChange('sweep');
 const sweepAfterAssignment=record.fields.slice(beforeSweep).map(x=>x.spec.label);
 assert.ok(sweepAfterAssignment.includes('端口用途'));
 assert.ok(sweepAfterAssignment.includes('源输出模式'));
 assert.ok(sweepAfterAssignment.includes('档位模式'));
 assert.ok(sweepAfterAssignment.includes('电流测量档位 (A)'));
 assert.ok(sweepAfterAssignment.includes('限流 (A)'),
  'Limits are visible as the first panel of the Sweep bottom triptych');
 assert.ok(sweepAfterAssignment.filter(x=>x==='档位模式').length>=2,
  'each assigned SMU receives its own measurement range controls');
 assert.ok(record.layoutSpecs.some(x=>x.className==='dkts-sweep-related'&&x.variant==='two-card-grid'),
  'Sweep uses a two-column layout: full-width Limits plus a stacked Page Var/Associate Spec column');
 assert.ok(record.layoutSpecs.some(x=>x.className==='dkts-limits-column'&&x.variant==='stack-compact'));
 assert.ok(record.layoutSpecs.some(x=>x.className==='dkts-sweep-metadata-column'&&x.variant==='stack-compact'));
 assert.ok(record.layoutSpecs.some(x=>x.className==='dkts-limit-row'&&x.variant==='form-grid-2'),
  'each assigned SMU limit row uses a readable two-column form grid');
 assert.ok(record.panels.some(x=>x.title==='Xsweep'&&x.meta==='D · SMU1'),
  'assigned X port has its own Core-rendered scan segments');
 const addSegment=record.panels.find(x=>x.title==='Xsweep')?.actions?.find(x=>x.id==='add-segment-X');
 assert.ok(addSegment,'each assigned sweep has add-segment action');
 assert.equal(record.actions.find(x=>x.id==='remove-X-0')?.enabled,false,
  'the last remaining segment cannot be deleted from the UI');
 addSegment.onInvoke();
 assert.equal(state.pages[0].sweep.xSegments.length,2);
 assert.ok(record.dividers.some(x=>x.variant==='horizontal'),'multiple scan segments use the canonical horizontal DKDS Divider Unit');
 const removeSegment=[...record.actions].reverse().find(x=>x.id==='remove-X-1');
 assert.ok(removeSegment);
 assert.equal(removeSegment.enabled,true,'deletion is enabled only when another segment remains');
 removeSegment.onInvoke();
 assert.equal(state.pages[0].sweep.xSegments.length,1);
 record.tabs.at(-1).onChange('strategy');
 const scalar=[...record.fields].reverse().find(x=>x.spec.label==='整体循环');
 assert.ok(scalar,'global cycles are editable in the dedicated Strategy tab');
 scalar.spec.onFocus({target:scalar.control});
 const strategyPress=label=>{const action=[...record.actions].reverse().find(x=>x.id==='numeric-'+label);assert.ok(action);action.onInvoke();};
 strategyPress('清除');strategyPress('2');strategyPress('完成');
 assert.equal(state.pages[0].sweep.loops,'2');
 const add=record.actions.find(x=>x.id==='add-test-page').items().find(x=>x.id==='add-test-pulse');
 assert.ok(add,'Pulses are directly available from the Project Test Library menu');
 add.onInvoke();
 assert.equal(state.pages.length,2);
 assert.equal(state.pages[1].testType,'Pulse');
 assert.equal(state.activeId,'page-2');
 assert.ok([...record.actions].reverse().find(x=>x.id==='add-project-node').items().some(x=>x.id==='close-page'),
  'project menu can close the selected Page');
 assert.ok(record.captures>=2,'project history captured on mutation');
 // Navigating back must refresh the current Page's port selector, not reuse
 // the previous Page's stale None/SMU assignment.
 const select=[...record.listItems].reverse().find(x=>x.title==='I–V 扫描');
 select.onInvoke();
 assert.equal(state.activeId,'page-1');
 const lastD=[...record.fields].reverse().find(x=>x.spec.label==='D 端口');
 assert.equal(lastD.control.value,'SMU1');
 const numeric=[...record.fields].reverse().find(x=>x.spec.attributes?.['aria-label']==='D 限流 (A)'&&x.spec.onFocus);
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
 const pulseItem=[...record.listItems].reverse().find(x=>x.title==='脉冲扫描');
 assert.ok(pulseItem,'new Page remains selectable in the native project tree');
 pulseItem.onInvoke();
 const close=[...record.actions].reverse().find(x=>x.id==='add-project-node').items().find(x=>x.id==='close-page');
 assert.ok(close,'project menu closes current Page');
 close.onInvoke();
 assert.equal(state.pages.length,1);
 assert.equal(state.activeId,'page-1');
 assert.equal(state.pages[0].terminals[0].resource,'SMU1',
  'closing other test preserves active port assignment');
 // True Routine/Page ownership in the DKDS Core host, not a separate web-only sketch.
 const routineAction=[...record.actions].reverse().find(x=>x.id==='add-project-node').items().find(x=>x.id==='add-routine');
 assert.ok(routineAction,'native DKDS Unit Project Explorer provides + Routine');
 routineAction.onInvoke();
 assert.equal(state.routines.length,2);
 assert.equal(state.pages.length,2);
 assert.equal(state.pages[1].routineId,state.routines[1].id);
 assert.equal(state.activeRoutineId,state.routines[1].id);
 const oldRoutine=[...record.listItems].reverse().find(x=>x.title==='测试流程 1');
 assert.ok(oldRoutine,'Routine navigation is registered as a host-owned Unit action');
 oldRoutine.onInvoke();
 assert.equal(state.activeId,'page-1');
 assert.equal(state.activeRoutineId,'routine-1');
 const createSpec=[...record.actions].reverse().find(x=>x.id==='add-project-node').items().find(x=>x.id==='add-spec');
 assert.ok(createSpec,'Core host must expose separate Spec creation');
 const associatePanel=[...record.panels].reverse().find(x=>x.title==='关联规格');
 const inlineCreate=associatePanel.actions?.find(x=>x.id==='add-spec-inline');
 assert.ok(inlineCreate,'Associate Spec panel exposes a compact inline create action');
 inlineCreate.onInvoke();
 assert.equal(state.specs.length,1);
 assert.equal(state.pages[0].associateSpecId,'spec-1');
 record.tabs.at(-1).onChange('sweep');
 const specField=[...record.fields].reverse().find(x=>x.spec.label==='器件规格');
 assert.ok(specField,'Page↔Spec association must use DKDS Unit selector inside Sweep triptych');
 specField.spec.onChange({target:{value:''}});
 assert.equal(state.pages[0].associateSpecId,null,'Spec link can be cleared');
 // Real Core Device navigation is a native Unit selector, never a web-only control.
 const addDevice=[...record.actions].reverse().find(x=>x.id==='add-project-node').items().find(x=>x.id==='add-device');
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
 const newDeviceSpec=[...record.actions].reverse().find(x=>x.id==='add-project-node').items().find(x=>x.id==='add-spec');
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
 const addOutput=record.actions.find(x=>x.id==='add-test-page').items().find(x=>x.id==='add-test-output');
 assert.ok(addOutput,'Output Sweep is directly available in the Project Test Library menu');
 addOutput.onInvoke();
 assert.equal(state.pages.at(-1).kind,'output');
 const portForOutput=[...record.fields].reverse().find(x=>x.spec.label==='D 端口');
 portForOutput.spec.onChange({target:{value:'SMU3'}});
 record.tabs.at(-1).onChange('sweep');
 assert.ok(record.panels.some(x=>x.title==='Xsweep'&&x.meta==='D · SMU3'),
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
 console.log('Core-host native plugin: Activity/TOP, Page-titlebar port selectors, per-terminal X/P roles, mobile port Popover, Sweep related sections, Data Center, PlotGroup, project state PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
