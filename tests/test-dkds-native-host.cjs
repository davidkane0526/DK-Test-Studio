'use strict';
// Exercise the actual plugin registration and Unit-first rendering contract.
// This is a mock DKDS Core runtime, not evidence of a real GUI host install.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'../integrations/dkds-native');
const registry=new Map(),definitions=[];
const sandbox={
 window:{DKDSPluginModules:{define:(id,name,value)=>registry.set(id+':'+name,value)}},
 DKDSPlugins:{define:(manifest,activate)=>definitions.push({manifest,activate})},
 console
};
vm.runInNewContext(fs.readFileSync(dir+'/model.js','utf8'),sandbox,{filename:'model.js'});
vm.runInNewContext(fs.readFileSync(dir+'/plugin.js','utf8'),sandbox,{filename:'plugin.js'});
assert.equal(definitions.length,1);
const record={actions:[],fields:[],panels:[],plots:[],top:null,activity:null,composed:null,disposals:0,captures:0,status:[]};
const el=()=>({children:[],textContent:'',replaceChildren(){this.children=[];}});
const units={
 pageHeader:{create:()=>({actions:el()})},page:{create:()=>({element:el()})},
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
 {key:'VdSet',values:[0,0.1,0.2]},{key:'Id',values:[1e-9,2e-9,3e-9]}
]};
const ctx={
 modules:{require:name=>registry.get('com.dkts.keithley-4200:'+name)},
 state:{create:(init,options)=>{assert.equal(options.projectSlice,'settings');state=init;
  return {get:()=>state,patch:delta=>{state={...state,...delta};}}}},
 project:{capture:()=>record.captures++},
 status:{set:text=>record.status.push(text)},
 workspace:{openPage:id=>record.opened=id},
 events:{on:(kind,cb)=>{record.onEvent={kind,cb};return()=>record.disposals++}},
 data:{sources:{list:()=>artifacts},artifacts:{get:id=>id==='a1'?table:null}},
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
 assert.equal(record.plots[0].getCurves().length,1,'reads canonical DKDS artifact');
 assert.equal(record.plots[0].getCurves()[0].points.length,3);
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
 assert.ok(record.captures>=2,'project history captured on mutation');
 // Navigating back must refresh the current Page's port selector, not reuse
 // the previous Page's stale None/SMU assignment.
 const select=[...record.actions].reverse().find(x=>x.id==='open-page-1');
 select.onInvoke();
 assert.equal(state.activeId,'page-1');
 const lastD=[...record.fields].reverse().find(x=>x.spec.label==='D 端口');
 assert.equal(lastD.control.value,'SMU1');
 record.activity.onActivate();
 assert.equal(record.opened,'dktsKeithley4200Page');
 record.onEvent.cb();
 assert.ok(record.refreshCount>=2);
 instance.deactivate();
 assert.ok(record.disposals>=2);
 console.log('Core-host native plugin: Activity/TOP, Unit PRIME, Data Center, plot, project state, port sync PASS');
})().catch(error=>{console.error(error);process.exitCode=1;});
