'use strict';
// Exercise the actual plugin registration and Unit-first rendering contract.
// This is a mock DKDS Core runtime, not evidence of a real GUI host install.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'../integrations/dkds-native');
const registry=new Map(),definitions=[];
const sandbox={
 window:{matchMedia:()=>({matches:false}),DKDSPluginModules:{define:(id,name,value)=>registry.set(id+':'+name,value),
  require:(id,name)=>registry.get(id+':'+name)}},
 DKDSPlugins:{define:(manifest,activate)=>definitions.push({manifest,activate})},
 console
};
for(const file of ['hardware-capabilities.js','kxci-protocol.js','identity-core.js',
 'measurement-plan.js','kxci-measurement.js','model.js','measurement-data.js',
 'measurement-runtime.js','ui-shell.js','plugin.js'])
 vm.runInNewContext(fs.readFileSync(dir+'/'+file,'utf8'),sandbox,{filename:file});
assert.equal(definitions.length,1);
const record={actions:[],fields:[],panels:[],plots:[],plotViews:[],headers:[],layoutSpecs:[],dividers:[],summaries:[],metrics:[],
 listItems:[],popovers:[],plotGroups:[],tables:[],closedPads:0,top:null,activity:null,composed:null,disposals:0,captures:0,status:[],pageHeaders:0,fullReads:0,exports:[]};
const el=()=>({children:[],textContent:'',dataset:{},attributes:{},hidden:false,classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){this.attributes[k]=String(v);},getAttribute(k){return this.attributes[k]??null;},appendChild(node){this.children.push(node);return node;},querySelector(){return null;},querySelectorAll(){return[];},replaceChildren(...nodes){this.children=nodes;}});
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
 layout:{apply:(host,spec)=>{
  if(spec.responsiveGeometry)assert.equal(spec.responsiveGeometry[0].maxWidth,310);
  else assert.equal(spec.variant,'identity');
  return host;
 },create:(host,spec)=>{
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
   }else if(spec.className==='dkts-project-plot-area'){
    assert.equal(spec.geometry.display,'flex');
    assert.equal(spec.geometry.flexDirection,'column');
    assert.equal(spec.geometry.minHeight,'0');
   }else{
    assert.equal(spec.geometry,undefined,
     'DKTS native plugin must not introduce unregistered layout geometry');
    if(spec.responsiveGeometry)
     assert.deepEqual(Array.from(spec.responsiveGeometry,row=>Number(row.maxWidth)),[620,520]);
   }
   return el();
 }},
 toolbar:{
  create:(host,spec)=>{const element=el();host.children.push(element);record.nativeCommands=spec;return {element,actionGroup:{update(){}}};},
  contribute:spec=>{record.toolbar??=[];const button=el();record.toolbar.push({spec,button});return button;}
 },
 splitHandle:{create:(host,spec)=>{const element=el();element.spec=spec;host.children.push(element);return element;}},
 splitPane:{adopt:spec=>{record.splits??=[];record.splits.push(spec);return {handle:spec.handle};}},
 action:{create:(host,spec)=>{
  record.actions.push(spec);
  host?.children?.push(spec);
  const element=el();
  spec.element=element;
  return {element};
 }},
 tabs:{create:(host,spec)=>{record.tabs=record.tabs||[];record.tabs.push(spec);
  host?.children?.push(spec);return{element:el()}}},
 list:{create:host=>{const list=el();host.children.push(list);return {
  item:spec=>{record.listItems.push(spec);list.children.push(spec);return spec;}
 }}},
 note:{create:(host,spec)=>{const n=el();n.textContent=spec.text;host?.children?.push(n);return n}},
 divider:{create:(host,spec)=>{record.dividers.push(spec);const n=el();host.children.push(n);return n}},
 emptyState:{create:(host,spec)=>{host.children.push(spec);return{element:el()}}},
 summary:{create:(host,spec)=>{record.summaries.push(spec);const element=el();host.children.push(element);return{element}}},
 metric:{create:(host,spec)=>{record.metrics.push(spec);const element=el();host.children.push(element);return{element,label:el(),value:el()}}},
 panel:{detached:spec=>({element:el(),body:el()}),create:(host,spec)=>{
   assert.ok(['plain','headed','portable','control-card','plot-card','accepted-portable']
     .includes(spec.variant||'plain'),'Unknown DKDS SDK panel variant: '+String(spec.variant));
   record.panels.push(spec);
   const body=el(),element=el(),title=el(),actionHost=el(),header={element:el(),title,actionHost,actions:actionHost};
   if(host?.children)host.children.push(element);return{body,element,header,actions:spec.actions||[]}
 }},
 check:{create:(host,spec)=>{const element=el(),input={checked:spec.checked};record.checks??=[];record.checks.push({spec,input});host?.children?.push(element);return{element,input}}},
 field:{create:(host,spec)=>{const control={value:spec.value,disabled:spec.disabled,attributes:{},setAttribute(k,v){this.attributes[k]=String(v);}};
   record.fields.push({spec,control});host?.children?.push(control);return{control,element:el()}}},
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
 listMetadata:({id}={})=>id==='a1'?[{id,rowCount:3,metadata:{dktsScope:{pageId:'page-1',routineId:'routine-1',pageName:'Raw IV'}}}]:[],
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
 state:{create:(init,options)=>{assert.equal(options.projectSlice,'settings');
  assert.deepEqual(Array.from(init.pages,page=>page.kind),['dc','time']);
  state=ctx.modules.require('model').editPage(init,{kind:'iv'});
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
  settings:{define:(id,spec)=>({get:()=>({...spec.defaults}),open:()=>{record.settingsOpened=id;}})},
  dialogs:{confirm:async spec=>{record.confirmations??=[];record.confirmations.push(spec);return false;},
   alert:async spec=>{record.alerts??=[];record.alerts.push(spec);}},
  activities:{add:spec=>{record.activity=spec}},
  pages:{add:()=>el()},
  topWorkspace:{register:spec=>{record.top=spec}}},
 capabilities:{invoke:async()=>{throw Error('Mock TCP not connected');},
  get:id=>id==='network.tcp'?{id,methods:['open','exchange','close']}:null}
 };
(async()=>{
 const instance=await definitions[0].activate(ctx);
 assert.equal(record.top.activity,'dkts-keithley-4200');
 assert.ok(record.layoutSpecs.some(row=>row.className==='dkts-main-grid'&&row.variant==='identity'));
 assert.ok(record.layoutSpecs.some(row=>row.className==='dkts-work-region'&&row.variant==='identity'));
 assert.ok(record.layoutSpecs.some(row=>row.className==='dkts-sweep-segment'&&row.variant==='identity'));
 assert.ok(record.layoutSpecs.some(row=>row.className==='dkts-terminal-setting'&&row.variant==='identity'));
 assert.ok(record.headers.some(row=>row.title==='工程导航'));
 assert.ok(record.headers.some(row=>row.title==='I–V 扫描'&&!row.eyebrow&&!row.meta));
 assert.ok(record.layoutSpecs.some(row=>row.className==='dkts-terminal-toolbar'&&row.variant==='row'));
 assert.ok(record.fields.some(row=>row.spec.label==='源极 · S'&&row.control.value==='GNDU'));
 assert.ok(record.fields.some(row=>row.spec.label==='漏极 · D'&&row.control.value==='SMU1'));
 assert.ok(record.fields.some(row=>row.spec.label==='栅极 · G'&&row.control.value==='SMU2'));
 assert.ok(record.fields.some(row=>row.spec.label==='体端 · B'&&row.control.value==='None'));
 assert.deepEqual(record.toolbar.map(row=>row.spec.id),['dkts-workspace-connect','dkts-workspace-scan','dkts-workspace-smu-integration','dkts-workspace-language']);
 assert.ok(record.toolbar.every(row=>row.spec.variant==='quiet'&&row.spec.section==='instrument'));
 assert.deepEqual(Array.from(record.nativeCommands.actions,row=>row.id),record.toolbar.map(row=>row.spec.id));
 assert.equal(record.nativeCommands.activity,'dkts-keithley-4200');
 assert.ok(record.actions.some(row=>row.id==='dkts-toggle-templates'));
 assert.ok(!record.actions.some(row=>row.id==='library-iv'));
 assert.equal(record.toolbar.find(row=>row.spec.id==='dkts-workspace-scan').button.disabled,false);
 assert.ok(!record.actions.some(row=>row.id==='dkts-return-data-plots'));
 assert.ok(record.actions.some(row=>row.id==='dkts-page-view-page-1'&&row.label==='⚙︎'));
 assert.deepEqual(Array.from(record.fields.find(row=>row.spec.label==='漏极 · D').spec.options,row=>row.value),
  ['None','GNDU','SMU1','SMU2','SMU3','SMU4','PMU1-1','PMU1-2','PMU2-1','PMU2-2','PMU3-1','PMU3-2','PMU4-1','PMU4-2']);
 assert.ok(record.actions.some(row=>row.id.startsWith('dkts-run-')));
 assert.equal(record.tabs.at(-1).items.length,3);
 assert.deepEqual(Array.from(record.tabs.at(-1).items,row=>row.id),
  ['sweep','target','strategy']);
 assert.equal(record.panels.some(row=>row.title==='Xsweep'),true);
 assert.equal(record.panels.some(row=>row.title==='Psweep'),true);
 assert.equal(record.panels.some(row=>row.title==='端子量程与保护'),true);
 assert.equal(record.panels.some(row=>row.title==='固定偏置'),true);
 assert.deepEqual(record.splits.map(row=>[row.id,row.axis]),[['template','y'],['navigation','x'],['history','y']]);
 assert.equal(record.plotGroups[0].responsive,false);
 assert.equal(record.groupColumns,2);
 assert.equal(record.plotGroups.length,1);
 assert.equal(record.plotViews.length,4);
 assert.equal(record.tables.length,4);
 assert.equal(record.plots.length,4);
 assert.ok(record.plotViews.every(view=>!view.spec.detailGeometry));
 // Target has one sample row and never exposes None/GNDU as a measurement channel.
 const beforeTarget=record.fields.length;
 record.tabs.at(-1).onChange('target');
 const targetFields=record.fields.slice(beforeTarget);
 const targetChannel=targetFields.find(row=>row.spec.label==='通道');
 assert.ok(targetChannel);
 assert.deepEqual(Array.from(targetChannel.spec.options,row=>row.value),['D','G']);
 const targetPanel=[...record.panels].reverse().find(row=>row.title==='测量目标');
 assert.ok(targetPanel?.actions?.some(row=>row.id==='add-target'));
 targetPanel.actions.find(row=>row.id==='add-target').onInvoke();
 assert.equal(state.pages[0].targets.length,2);
 // Strategy is independent and commits its own values to the project model.
 const beforeStrategy=record.fields.length;
 record.tabs.at(-1).onChange('strategy');
 const strategyFields=record.fields.slice(beforeStrategy);
 for(const label of ['扫描模式','测试速度','点间延迟 (ms)','扫描循环'])
  assert.ok(strategyFields.some(row=>row.spec.label===label));
 strategyFields.find(row=>row.spec.label==='点间延迟 (ms)').spec.onBlur({target:{value:'25'}});
 assert.equal(state.pages[0].sweep.pointDelay,'25');
 assert.ok(state.pages[0].sweep.xSegments.every(row=>row.delayMs==='25'));
 // Limits, Page Var and Associate Spec are independent tabs.
 const beforeLimits=record.fields.length;
 record.tabs.at(-1).onChange('sweep');
 assert.ok(record.fields.length>beforeLimits);
 const varsPanel=[...record.panels].reverse().find(row=>row.title==='变量');
 assert.ok(varsPanel?.actions?.some(row=>row.id==='add-var'));
 varsPanel.actions.find(row=>row.id==='add-var').onInvoke();
 assert.equal(state.pages[0].variables.length,1);
 const specPanel=[...record.panels].reverse().find(row=>row.title==='关联规格');
 assert.ok(specPanel?.actions?.some(row=>row.id==='add-spec-inline'));
 specPanel.actions.find(row=>row.id==='add-spec-inline').onInvoke();
 assert.equal(state.specs.length,1);
 assert.equal(state.pages[0].associateSpecId,'spec-1');
 // Sweep retains the seven-column FS-Pro table and independent X/P controls.
 record.tabs.at(-1).onChange('strategy');
 const beforeSweep=record.fields.length;
 record.tabs.at(-1).onChange('sweep');
 const sweepFields=record.fields.slice(beforeSweep);
 assert.ok(sweepFields.some(row=>row.spec.label==='本段电流量程 (A)'));
 assert.ok(sweepFields.some(row=>row.spec.label==='速度'));
 assert.ok(sweepFields.some(row=>row.spec.label==='量程模式'));
 assert.ok(sweepFields.some(row=>row.spec.label==='电流量程 (A)'));
 assert.ok(sweepFields.some(row=>row.spec.label==='电流保护模式'));
 assert.ok(sweepFields.some(row=>row.spec.label==='电流保护值 (A)'));
 assert.ok(record.layoutSpecs.some(row=>row.className==='dkts-sweep-segment-head'&&row.variant==='identity'));
 assert.ok(record.layoutSpecs.some(row=>row.className==='dkts-sweep-segment'&&row.variant==='identity'));
 const addSegment=record.actions.find(row=>row.id==='add-segment-X');
 assert.ok(addSegment);addSegment.onInvoke();
 assert.equal(state.pages[0].sweep.xSegments.length,2);
 const removeSegment=[...record.actions].reverse().find(row=>row.id==='remove-X-1');
 assert.ok(removeSegment);removeSegment.onInvoke();
 assert.equal(state.pages[0].sweep.xSegments.length,1);
 const psweepEnable=record.checks.find(row=>row.spec.className==='dkts-psweep-enable');
 assert.ok(psweepEnable);
 psweepEnable.spec.onChange({target:{checked:true}});
 assert.equal(state.pages[0].sweep.pEnabled,true);
 assert.equal(state.pages[0].terminals.find(row=>row.logical==='G').role,'P');
 // The Data Center plot pipeline remains mounted and independent of the editor.
 assert.equal(record.plotGroups.length,1);
 assert.equal(record.plotViews.length,4);
 assert.equal(record.tables.length,4);
 assert.equal(record.plots.length,4);
 assert.equal(record.plots[0].getCurves().length,1);
 assert.equal(record.fullReads,0);
 const exportAction=record.actions.find(row=>row.id==='dkts-frame-data-1');
 assert.ok(exportAction?.menu);
 const exportOriginal=exportAction.items().find(row=>row.id==='export-original');
 assert.ok(exportOriginal);
 await exportOriginal.onInvoke();
 assert.equal(record.exports.length,1);
 assert.equal(record.fullReads,1);
 record.listItems.find(row=>row.title==='I–V 扫描').onInvoke();
 assert.equal(record.plots[0].getCurves().length,1,'test scope exposes its own run');
 assert.deepEqual(Array.from(record.actions.find(row=>row.id==='dkts-frame-kind-1').items(),row=>row.id),
  ['kind-iv','kind-it','kind-raw']);
 const historyAction=()=>record.actions.findLast(row=>row.id==='dkts-history-plot');
 assert.equal(historyAction().variant,'quiet');
 assert.equal(historyAction().enabled,false);
 record.listItems.findLast(row=>row.title==='Raw IV').onInvoke();
 assert.equal(historyAction().enabled,true);
 historyAction().items()[1].onInvoke();
 assert.equal(state.ui.scopedGraphs['page-1'].sources[1],'a1');
 record.actions.findLast(row=>row.id==='add-routine').onInvoke();
 assert.equal(record.plots[0].getCurves().length,0,'a separate routine does not inherit another test history');
 record.actions.findLast(row=>row.id==='library-retention').onInvoke();
 assert.ok(record.fields.some(row=>row.spec.attributes?.['data-dkts-timing-field']==='firstS'));
 assert.deepEqual(Array.from(record.actions.find(row=>row.id==='dkts-frame-kind-1').items(),row=>row.id),
  ['kind-it','kind-vt','kind-raw']);
 record.actions.findLast(row=>row.id==='library-pulse').onInvoke();
 const pulseType=()=>record.fields.findLast(row=>row.spec.attributes?.['data-dkts-dc-field']==='preset');
 const pulseTiming=()=>state.pages.find(page=>page.id===state.activeId).timing;
 const arbitraryField=path=>record.fields.findLast(row=>row.spec.attributes?.['data-dkts-parameter-path']===path);
 const setPort=(logical,value)=>record.fields.findLast(row=>row.spec.attributes?.['aria-label']?.includes('('+logical+') 端口'))
  .spec.onChange({target:{value}});
 assert.equal(pulseType().control.value,'pulse');
 assert.deepEqual(Array.from(pulseType().spec.options,row=>row.value),['optimized','point-by-point','pulse','pulse-sequence']);
 assert.equal(arbitraryField('smu.onMs').control.value,'5');
 assert.ok(pulseType().spec.options.some(row=>row.value==='pulse-sequence'));
 pulseType().spec.onChange({target:{value:'pulse-sequence'}});
 assert.equal(pulseTiming().testMode,'sequence');
 assert.equal(arbitraryField('arb.segments.0.measureStartUs').spec.disabled,true);
 assert.equal(arbitraryField('arb.segments.1.measureStartUs').spec.disabled,false);
 assert.equal(arbitraryField('arb.segments.1.measureStartUs').control.value,'2');
 pulseType().spec.onChange({target:{value:'pulse'}});
 assert.equal(arbitraryField('smu.onMs').control.value,'5');
 assert.equal(pulseTiming().arb.segments[1].measureStartUs,'2');
 setPort('D','PMU1-1');
 const gatePulseRole=()=>record.fields.findLast(row=>row.spec.attributes?.['data-dkts-dc-field']==='pulse-role-G');
 assert.deepEqual(Array.from(gatePulseRole().spec.options,row=>row.value),['off','x','psweep','condition']);
 gatePulseRole().spec.onChange({target:{value:'condition'}});
 arbitraryField('secondary.conditionV').spec.onInput({target:{value:'1.2'}});
 assert.equal(pulseTiming().secondary.terminal,'G');
 assert.equal(pulseTiming().secondary.conditionV,'1.2');
 const run=()=>record.actions.findLast(row=>row.id==='dkts-run-'+state.activeId).element;
 assert.equal(run().disabled,true);
 assert.match(run().title,/G · SMU 2 为独立 SMU/);
 gatePulseRole().spec.onChange({target:{value:'psweep'}});
 setPort('D','SMU1');
 assert.equal(run().disabled,true);
 assert.match(run().title,/伴随扫描.*需要 4225/);
 gatePulseRole().spec.onChange({target:{value:'condition'}});
 assert.equal(arbitraryField('smu.gateV').control.value,'1.2');
 const on=arbitraryField('smu.onMs');
 on.spec.onInput({target:{value:'0.05'}});
 assert.equal(run().disabled,true);
 assert.match(run().title,/5–20,000/);
 on.spec.onInput({target:{value:'10'}});
 assert.equal(run().disabled,false);
 assert.equal(pulseTiming().smu.onMs,'10');
 arbitraryField('smu.start').spec.onInput({target:{value:'0.2'}});
 arbitraryField('smu.gateV').spec.onInput({target:{value:'1.4'}});
 setPort('D','PMU1-1');
 setPort('G','PMU1-2');
 assert.equal(pulseType().control.value,'pulse');
 assert.equal(arbitraryField('start').control.value,'0.2');
 assert.equal(arbitraryField('secondary.conditionV').control.value,'1.4');
 assert.match(run().title,/负载/);
 const segmentAction=id=>record.actions.findLast(row=>row.id===id);
 segmentAction('pulse-segment-add').onInvoke();
 arbitraryField('xSegments.0.start').spec.onInput({target:{value:'0.3'}});
 assert.equal(pulseTiming().xSegments[0].start,'0.3');
 assert.deepEqual(Array.from(gatePulseRole().spec.options,row=>row.value),['off','condition']);
 setPort('D','SMU1');
 assert.match(run().title,/多段脉冲扫描/);
 segmentAction('pulse-segment-remove-1').onInvoke();
 assert.equal(pulseTiming().xSegments.length,0);
 setPort('G','SMU2');
 assert.equal(arbitraryField('smu.onMs').control.value,'10');
 assert.equal(arbitraryField('smu.gateV').control.value,'1.4');
 // Adding a DC test exposes its own controls and retains the existing I–V test.
 const oldIv=JSON.stringify(state.pages[0]);
 const beforeDc=record.fields.length;
 record.actions.findLast(row=>row.id==='library-dc').onInvoke();
 const dcFields=record.fields.slice(beforeDc);
 const dcRefs=dcFields.filter(row=>row.spec.attributes?.['data-dkts-dc-field']==='ref');
 assert.equal(dcRefs.length,3);
 assert.ok(dcRefs.some(row=>row.spec.attributes?.['aria-label']==='S 参考'&&row.spec.disabled));
 const methodFor=terminal=>dcFields.find(row=>row.spec.attributes?.['data-dkts-dc-field']==='method'&&
  row.spec.attributes?.['aria-label'].startsWith(terminal+' '));
 assert.equal(methodFor('G').control.value,'constant');
 assert.deepEqual(Array.from(methodFor('D').spec.options,option=>option.label),
  ['Linear Step','Linear Points','Log Points','List']);
 methodFor('D').spec.onChange({target:{value:'points'}});
 const preset=dcFields.find(row=>row.spec.attributes?.['data-dkts-dc-field']==='preset');
 assert.deepEqual(Array.from(preset.spec.options,option=>option.value),['optimized','point-by-point','pulse','pulse-sequence']);
 preset.spec.onChange({target:{value:'pulse-sequence'}});
 assert.equal(pulseTiming().testMode,'sequence');
 arbitraryField('arb.segments.1.durationUs').spec.onInput({target:{value:'11'}});
 pulseType().spec.onChange({target:{value:'optimized'}});
 assert.equal(state.pages.find(row=>row.id===state.activeId).ivAlternate.arb.blocks[0].segments[1].durationUs,'11');
 assert.equal(state.portMapping.D,'SMU1');
 pulseType().spec.onChange({target:{value:'point-by-point'}});
 assert.ok(record.fields.some(row=>row.spec.attributes?.['data-dkts-dc-field']==='range'&&row.control.value==='auto'));
 const dcPoints=record.fields.findLast(row=>row.spec.attributes?.['data-dkts-dc-field']==='points');
 const dcRun=record.actions.findLast(row=>row.id==='dkts-run-'+state.activeId).element;
 dcPoints.spec.onInput({target:{value:'0'}});
 assert.equal(dcRun.disabled,true);
 await record.actions.findLast(row=>row.id==='dkts-run-'+state.activeId).onInvoke();
 assert.equal(record.alerts?.length||0,0,'the execution entry also blocks an invalid draft');
 assert.equal(state.pages.find(row=>row.id===state.activeId).dc.terminals.D.segments[0].points,'11');
 dcPoints.spec.onInput({target:{value:'9'}});
 assert.equal(dcRun.disabled,false);
 assert.equal(state.pages.find(row=>row.id===state.activeId).dc.terminals.D.segments[0].points,'9');
 assert.equal(JSON.stringify(state.pages[0]),oldIv);
 const beforeTime=record.fields.length;
 record.actions.findLast(row=>row.id==='library-time').onInvoke();
 assert.ok(record.plotViews.some(view=>view.id.startsWith('dkts-plan-')&&view.spec.images));
 const timeMode=record.fields.findLast(row=>row.spec.attributes?.['data-dkts-dc-field']==='time-mode');
 assert.equal(timeMode.spec.kind,'select');
 assert.equal(timeMode.control.value,'smu-bias');
 assert.deepEqual(Array.from(timeMode.spec.options,item=>item.value),['smu-bias','pmu-segmented','linear-step']);
 const fieldAt=path=>record.fields.findLast(row=>row.spec.attributes?.['data-dkts-parameter-path']===path);
 const fixedPoints=fieldAt('events.0.points');
 assert.equal(fixedPoints.control.value,'9');
 assert.ok(!fixedPoints.spec.readOnly);
 fixedPoints.spec.onInput({target:{value:'12'}});
 const currentTime=()=>state.pages.find(row=>row.id===state.activeId).timing;
 assert.equal(currentTime().events[0].points,'12');
 const timeAction=id=>record.actions.findLast(row=>row.id===id).onInvoke();
 timeAction('add-time-segment');
 assert.equal(currentTime().mode,'native-list');
 assert.deepEqual(Array.from(currentTime().segments,segment=>segment.listPoints),['12','1']);
 fieldAt('segments.1.listPoints').spec.onInput({target:{value:'4'}});
 timeAction('remove-time-segment-1');
 assert.equal(currentTime().mode,'native-fixed');
 assert.equal(currentTime().events[0].points,'12');
 const reference=fieldAt('reference');
 assert.equal(reference.spec.kind,'select');
 assert.deepEqual(Array.from(reference.spec.options,option=>option.value),['GND','S']);
 reference.spec.onChange({target:{value:'GND'}});
 assert.equal(currentTime().reference,'GND');
 const integration=record.toolbar.find(row=>row.spec.id==='dkts-workspace-smu-integration');
 assert.equal(integration.button.textContent,'积分');
 integration.spec.onClick({currentTarget:integration.button});
 assert.equal(record.popovers.at(-1).className,'dkts-smu-integration-popover');
 assert.equal(record.popovers.at(-1).anchor,integration.button);
 record.fields.findLast(row=>row.spec.label==='工程默认').spec.onChange({target:{value:'long'}});
 assert.equal(state.smuIntegration,'long');
 integration.spec.onClick({currentTarget:integration.button});
 record.fields.findLast(row=>row.spec.label==='当前时间扫描').spec.onChange({target:{value:'short'}});
 assert.equal(currentTime().integrationPreset,'short');
 const beforeTimeTarget=record.fields.length;
 record.tabs.at(-1).onChange('target');
 assert.ok(!record.fields.slice(beforeTimeTarget).some(row=>row.spec.attributes?.['data-dkts-parameter-path']==='events.0.points'));
 record.actions.findLast(row=>row.id==='add-time-event').onInvoke();
 assert.deepEqual(Array.from(currentTime().events,event=>event.points),['12','12']);
 record.tabs.at(-1).onChange('sweep');
 fieldAt('events.0.points').spec.onInput({target:{value:'9'}});
 const isSwitchStep=row=>row.spec.attributes?.['data-dkts-timing-field']==='switchStepS';
 assert.ok(!record.fields.slice(beforeTime).some(isSwitchStep));
 const beforeLinearPlan=record.fields.length;
 fieldAt('mode').spec.onChange({target:{value:'linear-step'}});
 const timeRun=record.actions.findLast(row=>row.id==='dkts-run-'+state.activeId).element;
 assert.equal(timeRun.disabled,true);
 assert.match(timeRun.title,/线性步进仅用于规划/);
 assert.ok(record.fields.slice(beforeLinearPlan).some(isSwitchStep));
 assert.ok(!record.fields.slice(beforeLinearPlan).some(row=>row.spec.attributes?.['data-dkts-dc-field']==='time-stop'));
 const timeField=key=>record.fields.findLast(row=>row.spec.attributes?.['data-dkts-dc-field']===key);
 assert.equal(timeField('time-segments').control.value,'10');
 assert.equal(timeField('time-points').control.value,'10');
 record.fields.findLast(row=>row.spec.attributes?.['data-dkts-dc-field']==='time-source-D').spec.onChange({target:{value:'current'}});
 record.fields.findLast(row=>row.spec.attributes?.['data-dkts-parameter-path']==='segments.0.currentBias.D').spec.onInput({target:{value:'0.001'}});
 record.actions.findLast(row=>row.id==='add-time-segment').onInvoke();
 const plan=state.pages.find(row=>row.id===state.activeId).timing;
 assert.equal(plan.sourceModes.D,'current');
 assert.equal(plan.segments[1].currentBias.D,'0.001');
 assert.equal(plan.segments[1].bias.D,'0');
 assert.equal(timeField('time-segments').control.value,'20');
 fieldAt('segments.1.durationS').spec.onInput({target:{value:'2'}});
 assert.equal(timeField('time-segments').control.value,'30');
 assert.equal(timeField('time-points').control.value,'30');
 assert.ok(!record.actions.some(row=>/^dkts-save-(dc|time|timing)$/.test(row.id)));
 instance.deactivate();
 assert.ok(record.disposals>=1);
 console.log('Core-host native plugin: LabExpress main tabs, Unit extensions, X/P rows, Terminal, Fixed Bias, Target/Strategy/Limits/Page Var/Spec, Data Center and four PlotViews PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
