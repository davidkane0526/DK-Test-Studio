'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'integrations/dkds/native-top/plugin.js'),'utf8');
const declared=require('../integrations/dkds/native-top/plugin.json');
assert.doesNotMatch(source,/<iframe|srcdoc\s*=|document\.createElement\s*\(/,
 'Native TOP must not embed a separate browser shell');
assert.doesNotMatch(source,/socket\.write|\bME1\b|\bVC[1-9],/,
 'Native preview has no physical output or unreviewed KXCI commands');

let activate=null,manifest=null;
vm.runInNewContext(source,{DKDSPlugins:{define:(m,fn)=>{manifest=m;activate=fn;}}},
 {filename:'native-top/plugin.js'});
assert.equal(typeof activate,'function');
assert.deepEqual(JSON.parse(JSON.stringify(manifest)),declared);

const nodes=[];
const node=(tag='div')=>{
 const x={tag,children:[],listeners:{},textContent:'',value:'',className:'',
  appendChild(v){this.children.push(v);return v;},
  append(...values){this.children.push(...values);},
  replaceChildren(...values){this.children=[...values];},
  setAttribute(key,value){this[key]=value;},
  addEventListener(key,fn){this.listeners[key]=fn;},
 };
 nodes.push(x);return x;
};
let saved={schema:1,nextId:1,activeId:'test-1',tests:[
 {id:'test-1',kind:'iv',name:'I–V Sweep',protocol:'DC',
  parameters:{start:'0',stop:'2',step:'0.1',compliance:'0.001'}}]};
let captures=0,chart=null,top=null,activity=null,composed=null,off=false,renderCount=0;
const sources=[{artifactId:'dc-capture-1'}];
const table={id:'dc-capture-1',name:'4200A real imported capture',
 columns:[
  {key:'Vd',role:'x',unit:'V',values:['0','0.1','0.2']},
  {key:'Id',role:'y',unit:'A',values:['1e-9','2e-9','3e-9']}
 ]};
const makeLayout=(parent)=>{const x=node();parent?.appendChild(x);return x;};
const units={
 pageHeader:{create:()=>({actions:node('header')})},
 page:{create:()=>({element:node()})},
 layout:{create:makeLayout},
 workspace:{create:()=>({compose(spec){composed=spec},dispose(){off=true}})},
 panel:{create:()=>({body:node()})},
 note:{create:(parent,{text})=>{const x=node();x.textContent=text;parent?.appendChild(x);return x}},
 scientificPlot:{create:(_parent,config)=>{chart=config;return{
   requestRender(){renderCount++},dispose(){off=true}}}},
 prime:{build:spec=>spec}
};
const ctx={
 ui:{
  unitTemplates:units,dom:{create:node},
  activities:{add:x=>{activity=x}},
  pages:{add:x=>x},topWorkspace:{register:x=>{top=x}}
 },
 state:{create:(_initial,settings)=>{
  assert.equal(settings.projectSlice,'settings');
  return {get:()=>saved,patch:update=>{saved={...saved,...update};}};
 }},
 project:{capture(){captures++}},
 events:{on:(_event,cb)=>()=>{off=true}},
 data:{sources:{list:()=>sources},artifacts:{get:id=>id===table.id?table:null}},
 workspace:{openPage:id=>assert.equal(id,'dkts4200NativePage')},
 status:{set:()=>{}}
};
(async()=>{
 const runtime=await activate(ctx);
 assert.ok(composed?.primary&&composed.primes?.length===1,'host owns PRIMARY/PRIME surface composition');
 assert.equal(composed.primary.titlePolicy,'host-only','no duplicated page titlebar');
 assert.ok(top&&top.layout.mode==='native'&&top.layout.prime[0].presentationRole==='data-control');
 assert.ok(activity?.openMode==='window');
 assert.equal(typeof chart?.getCurves,'function');
 const curves=chart.getCurves();
 assert.equal(curves.length,1,'Core Data Center artifact appears in scientific plot');
 assert.deepEqual(JSON.parse(JSON.stringify(curves[0].x)),[0,0.1,0.2]);
 assert.deepEqual(JSON.parse(JSON.stringify(curves[0].y)),[1e-9,2e-9,3e-9]);
 const add=nodes.find(x=>x.textContent==='＋ 新增测试');
 assert.ok(add?.listeners?.click,'native add-test control is present');
 add.listeners.click();
 assert.equal(saved.tests.length,2,'two independent test pages');
 assert.equal(saved.activeId,'test-2','newly created test is selected');
 assert.ok(captures>=1,'test mutation persists through the DKDS project lifecycle');
 const sel=nodes.filter(x=>x.tag==='select').find(x=>x['aria-label']==='选择测试类型或页面'&&x.listeners.change);
 assert.ok(sel,'Core-hosted project test selector is present');
 sel.value='test-1';sel.listeners.change();
 assert.equal(saved.activeId,'test-1','Page selection updates host state');
 assert.ok(renderCount>=3,'project and Data Center changes request Core ScientificPlot redraw');
 runtime.deactivate();
 assert.equal(off,true,'unit/chart/event lifecycles disposed');
 console.log('DKDS native TOP: runtime activation, project state, Core Data Center, plot, test types, disposal passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
