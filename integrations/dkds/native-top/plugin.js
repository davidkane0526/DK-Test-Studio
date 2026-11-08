/* DK Test Studio experimental DKDS-native workbench.
 * All host infrastructure comes from Plugin API 1.19 Unit Templates.
 * No iframe, private DOM shell, local theme engine, or instrument-output bridge.
 */
(() => {
 'use strict';
 const manifest={"id":"com.dkts.keithley-4200-native-preview","name":"DK Test Studio · DKDS Native TOP Preview","version":"0.1.0","apiVersion":"1.19.0","entry":"plugin.js","scripts":["plugin.js"],"platformPresentation":{"desktop":{"mode":"shared"},"mobile":{"mode":"adaptive"}},"enabled":true,"order":83,"description":"Experimental host-native 4200A TOP workspace; no iframe or instrument output.","pluginType":"workbench","requiresCore":["status","events","project","state","workspace","data.sources","data.artifacts","ui.dom","ui.workspace","ui.unit-templates","ui.scientific-plot","ui.activities","ui.top-workspace","ui.pages"],"capabilities":["ui.page","ui.top-workspace","ui.plugin-workspace","ui.scientific-plot","data.scoped-sources","state.store"],"workspace":{"role":"top","activity":"dkts-4200a-native","icon":"▥","title":"4200A 原生工作区"},"window":{"activity":"dkts-4200a-native","title":"4200A 原生工作区","width":1380,"height":840,"minWidth":860,"minHeight":570,"dependencies":["scientific-renderer"],"prewarm":false,"reuse":true,"persistence":"project","artifactHydration":"live"},"data":{"accepts":["science.transport.iv","data.table"]}};
 const TESTS=Object.freeze([
  {kind:'iv',name:'I–V Sweep',protocol:'DC'},
  {kind:'transfer',name:'Transfer Sweep',protocol:'DC'},
  {kind:'time',name:'Time Sweep',protocol:'IVT'},
  {kind:'pulse',name:'Pulse Sweep',protocol:'Pulse'},
  {kind:'cv',name:'C–V Sweep',protocol:'CV'}
 ]);
 DKDSPlugins.define(manifest, async ctx => {
  const units=ctx.ui.unitTemplates,dom=ctx.ui.dom;
  const stored=ctx.state.create({schema:1,nextId:1,activeId:'test-1',
   tests:[{id:'test-1',kind:'iv',name:'I–V Sweep',protocol:'DC',connection:{},
    parameters:{start:'0',stop:'2',step:'0.1',compliance:'0.001'}}]},
   {projectSlice:'settings'});
  let workbench=null,plot=null,selection=null,details=null,notes=null,disposed=false;
  let testToolbar=null;

  function snapshot(){
   const value=stored.get();
   return value&&Array.isArray(value.tests)?value:{schema:1,nextId:1,activeId:'test-1',tests:[]};
  }
  const current=()=>{const value=snapshot();return value.tests.find(row=>row.id===value.activeId)||null;};
  const sources=()=>{const rows=ctx.data.sources.list();return Array.isArray(rows)?rows:[];};
  function selectedTable(){
   for(const row of sources()){
    const table=ctx.data.artifacts.get(row.artifactId);
    if(table&&Array.isArray(table.columns)&&table.columns.length>=2)return table;
   }
   return null;
  }
  function curves(){
   const table=selectedTable();if(!table)return [];
   const columns=table.columns||[];
   const x=columns.find(c=>c.role==='x')||columns[0];
   const y=columns.find(c=>c.role==='y')||columns.find(c=>c!==x);
   if(!x||!y||!Array.isArray(x.values)||!Array.isArray(y.values))return [];
   const xs=[],ys=[];
   for(let i=0;i<Math.min(x.values.length,y.values.length);i++){
    const a=Number(x.values[i]),b=Number(y.values[i]);
    if(Number.isFinite(a)&&Number.isFinite(b)){xs.push(a);ys.push(b);}
   }
   if(!xs.length)return [];
   return [{id:String(table.id||'host-artifact'),name:String(table.name||'Data Center'),
    x:xs,y:ys,xUnit:x.unit||'',yUnit:y.unit||''}];
  }
  function renderTests(){
   if(!testToolbar)return;
   const value=snapshot();testToolbar.replaceChildren();
   const selector=dom.create('select');selector.className='dkds-field-control';
   selector.setAttribute('aria-label','选择测试类型或页面');
   for(const row of value.tests){
    const option=dom.create('option');option.value=row.id;
    option.textContent=row.name+' ('+row.protocol+')';selector.appendChild(option);
   }
   selector.value=value.activeId;
   selector.addEventListener('change',()=>{
    stored.patch({activeId:selector.value});ctx.project.capture?.();refresh();
   });
   testToolbar.appendChild(selector);
   const add=dom.create('button');add.type='button';add.textContent='＋ 新增测试';
   add.className='dkds-action-button';add.addEventListener('click',addTest);
   testToolbar.appendChild(add);
   const active=current();
   if(selection)selection.textContent=active?
    active.name+' · '+active.protocol+' · 未启用原生硬件输出':'尚未创建测试页面';
  }
  function renderParameters(){
   if(!details)return;
   const active=current();details.replaceChildren();
   if(!active)return;
   units.note.create(details,{variant:'meta',
    text:'测量资源必须通过 KCon 物理模块识别。未分配(None)的端子不显示源输出参数。'});
   const selection=dom.create('div');selection.className='dkds-field';
   const name=dom.create('label');name.textContent='测试类型';selection.appendChild(name);
   const select=dom.create('select');select.className='dkds-field-control';
   select.setAttribute('aria-label','测试类型');
   for(const row of TESTS){
    const option=dom.create('option');option.value=row.kind;option.textContent=row.name;
    select.appendChild(option);
   }
   select.value=active.kind;
   select.addEventListener('change',()=>{
    const option=TESTS.find(x=>x.kind===select.value);if(!option)return;
    const value=snapshot();
    stored.patch({tests:value.tests.map(x=>x.id===active.id?
      {...x,kind:option.kind,name:option.name,protocol:option.protocol}:x)});
    ctx.project.capture?.();refresh();
   });
   selection.appendChild(select);details.appendChild(selection);
   units.note.create(details,{variant:'meta',
    text:'FS-Pro PagePlan/SMU 端口编译器尚未与此原生 TOP 对接。本预览仅保存测试类型和读取 Data Center，不发送 KXCI 写指令。'});
  }
  function refresh(){
   if(disposed)return;
   renderTests();renderParameters();
   if(notes){
    const table=selectedTable();
    notes.textContent=table?
      'Data Center 已分配 '+sources().length+' 组数据。当前显示：'+String(table.name||table.id):
      '未分配数据。通过 DKDS 数据中心导入或选择测量记录。';
   }
   plot?.requestRender?.('project-artifacts');
  }
  function addTest(){
   const value=snapshot();
   const id='test-'+(Number(value.nextId)+1);
   const row={id,kind:'iv',name:'I–V Sweep',protocol:'DC',connection:{},
    parameters:{start:'0',stop:'2',step:'0.1',compliance:'0.001'}};
   stored.patch({nextId:Number(value.nextId)+1,activeId:id,tests:[...value.tests,row]});
   ctx.project.capture?.();refresh();
  }

  ctx.ui.activities.add({id:'dkts-4200a-native',label:'4200A',contextLabel:'4200A 原生 TOP',
   icon:'▥',order:83,primary:true,openMode:'window',
   onActivate:()=>{ctx.workspace.openPage('dkts4200NativePage');refresh();}});
  const page=ctx.ui.pages.add({id:'dkts-4200a-native-page',
   pageId:'dkts4200NativePage',activity:'dkts-4200a-native',
   label:'4200A',title:'4200A · 原生测试工作区',toolbar:false,html:''});
  const header=units.pageHeader.create(page,{variant:'page-owned',
   activity:'dkts-4200a-native',title:'DK Test Studio',
   subtitle:'DKDS Core TOP · 数据中心 / 主题 / 历史由宿主提供'});
  units.layout.create(header.actions,{tagName:'span',variant:'identity',
   dataset:{dkdsSlot:'workbench-import'}});
  const body=units.page.create(page,{variant:'analysis'}).element;
  const host=units.layout.create(body,{variant:'identity'});
  workbench=units.workspace.create(host,{variant:'standard',header:false,
   activity:'dkts-4200a-native',primaryScroll:'safe'});

  const main=units.layout.create(null,{variant:'stack-comfortable'});
  testToolbar=units.layout.create(main,{variant:'stack-compact'});
  selection=units.note.create(main,{variant:'meta',text:'4200A 原生 TOP'});
  notes=units.note.create(main,{variant:'meta',text:'Data Center 尚无数据源'});
  const chartPanel=units.panel.create(main,{variant:'plot-card',header:true,sizing:'content'});
  const plotContainer=units.layout.create(chartPanel.body,{variant:'plot-card-fill'});
  plot=units.scientificPlot.create(plotContainer,{variant:'curve',
   source:'dkts-4200a-native',xTitle:'Voltage (V)',yTitle:'Current (A)',
   getCurves:curves,getMarkers:()=>[]});

  details=units.layout.create(null,{variant:'stack-comfortable'});
  const prime=units.prime.build({id:'parameters',label:'参数',title:'测试参数',
   variant:'canonical-header',presentationRole:'data-control',
   presentationPurpose:'parameters',semanticKind:'panel',priority:90,
   collapsible:true,existingNode:details,defaultPlacement:'right',
   placements:['inline','right','bottom','float'],stateVersion:'dkts-native-v1'});

  workbench.compose({primary:{id:'main',label:'科学绘图区',
   presentationRole:'scientific-primary',scroll:'safe',titlePolicy:'host-only',
   mainNode:main},primes:[prime],subs:[]});
  ctx.ui.topWorkspace.register({id:'dkts-4200a-native',
   activity:'dkts-4200a-native',label:'4200A',icon:'▥',
   layout:{mode:'native',root:{selector:'#dkts4200NativePage .dkds-plugin-workspace'},
    primary:{id:'main',role:'analysis-primary',presentationRole:'scientific-primary',
     priority:100,collapsible:false},
    prime:[{id:'parameters',presentationRole:'data-control',
     presentationPurpose:'parameters',priority:90,collapsible:true}],sub:[]}});

  const off=ctx.events?.on?.('data:artifacts-changed',refresh);
  refresh();
  return{deactivate(){disposed=true;off?.();plot?.dispose?.();workbench?.dispose?.();}};
 });
})();