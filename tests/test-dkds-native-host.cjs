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
vm.runInNewContext(fs.readFileSync(dir+'/plugin.js','utf8'),sandbox,{filename:'plugin.js'});
assert.equal(definitions.length,1);
const record={actions:[],fields:[],panels:[],plots:[],plotViews:[],headers:[],popovers:[],closedPads:0,top:null,activity:null,composed:null,disposals:0,captures:0,status:[]};
const el=()=>({children:[],textContent:'',replaceChildren(){this.children=[];}});
const units={
 pageHeader:{create:()=>({actions:el()})},page:{create:()=>({element:el()})},
 header:{create:(host,spec)=>{record.headers.push(spec);return{element:el(),actions:el()}}},
 plotView:{adopt:(id,card,spec)=>{record.plotViews.push({id,spec});return {dispose:()=>record.disposals++}}},
 popover:{create:(host,spec)=>{record.popovers.push(spec);return {
  body:el(),close:()=>{record.closedPads++;}}}},
 layout:{create:()=>el()},
 action:{create:(host,spec)=>{record.actions.push(spec);host.children.push(spec);return{element:el()}}},
 note:{create:(host,spec)=>{const n=el();n.textContent=spec.text;host.children.push(n);return n}},
 emptyState:{create:(host,spec)=>{host.children.push(spec);return{element:el()}}},
 panel:{create:(host,spec)=>{record.panels.push(spec);const body=el();host.children.push(body);return{body,element:el()}}},
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
const table={name:'Raw IV',columns:[
 {id:'v',key:'VdSet',role:'x',values:[0,0.1,0.2]},
 {id:'i',key:'Id',role:'y',values:[1e-9,2e-9,3e-9]}
]};
const reads=[];
let revision=1;
const artifactStore={
 get:()=>{throw Error('forbidden full Artifact copy')},
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
 data:{sources:{list:()=>artifacts},artifacts:artifactStore},
 ui:{unitTemplates:units,
  activities:{add:spec=>{record.activity=spec}},
  pages:{add:()=>el()},
  topWorkspace:{register:spec=>{record.top=spec}}}
 };
(async()=>{
 const instance=await definitions[0].activate(ctx);
 assert.equal(record.top.activity,'dkts-keithley-4200');
 assert.equal(record.top.layout.prime.length,2);
 assert.equal(record.composed.primary.titlePolicy,'host-only');
 assert.equal(record.composed.primes.length,2);
 assert.equal(record.panels.some(x=>x.title==='D · SMU1'),false,'None port does not render parameter panel');
 assert.equal(record.plots.length,1);
 assert.equal(record.headers.some(x=>x.kind==='plot'&&x.variant==='plot'),true,
   'DKDS Core owns the canonical chart title');
 assert.equal(record.plotViews.length,1);
 assert.equal(record.plotViews[0].spec.variant,'complete');
 assert.deepEqual([...record.plotViews[0].spec.placements],['home','float','global']);
 assert.equal(record.plotViews[0].spec.images,true);
 assert.equal(record.plotViews[0].spec.csv,false,
   'do not export downsampled chart points as instrument original CSV');
 assert.equal(record.plots[0].getCurves().length,1,'reads canonical DKDS artifact');
 assert.equal(record.plots[0].getCurves()[0].points.length,3);
 assert.equal(reads.length,2,'first plot reads just two bounded data columns');
 record.plots[0].getCurves();
 assert.equal(reads.length,2,'unchanged Artifact revisions reuse the cached data');
 revision++;
 record.plots[0].getCurves();
 assert.equal(reads.length,4,'Artifact revision change invalidates the chart cache');
 assert.ok(reads.every(r=>r.limit<=65536));
 const map=record.fields.find(x=>x.spec.label==='D 端口');
 assert.ok(map,'port assignment is a Core field');
 map.spec.onChange({target:{value:'SMU1'}});
 assert.equal(state.pages[0].terminals[0].resource,'SMU1');
 assert.ok(record.panels.some(x=>x.title==='D · SMU1'));
 const choice=record.fields.find(x=>x.spec.label==='新增类型');
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
 const select=[...record.actions].reverse().find(x=>x.id==='open-page-1');
 select.onInvoke();
 assert.equal(state.activeId,'page-1');
 const lastD=[...record.fields].reverse().find(x=>x.spec.label==='D 端口');
 assert.equal(lastD.control.value,'SMU1');
 const numeric=[...record.fields].reverse().find(x=>x.spec.label==='偏压'&&x.spec.onFocus);
 assert.ok(numeric,'a source bias field provides a DKDS Unit-hosted numeric keypad');
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
 assert.equal(state.pages[0].terminals[0].bias,'1e-6');
 const close=[...record.actions].reverse().find(x=>x.id==='close-page-2');
 close.onInvoke();
 assert.equal(state.pages.length,1);
 assert.equal(state.activeId,'page-1');
 assert.equal(state.pages[0].terminals[0].resource,'SMU1',
  'closing other test preserves active port assignment');
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
