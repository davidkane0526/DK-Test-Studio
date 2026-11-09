(() => {
 'use strict';
 const manifest={"id":"com.dkts.keithley-4200","name":"DK Test Studio - Keithley 4200A","version":"0.7.0","apiVersion":"1.19.0","entry":"plugin.js","scripts":["model.js","plugin.js"],"enabled":true,"order":82,"description":"Native DKDS TOP workbench: host-owned theme, data, scientific plot and project state; output disabled.","pluginType":"workbench","requiresCore":["status","events","workspace","project","state","modules","data.sources","data.artifacts","ui.workspace","ui.unit-templates","ui.scientific-plot","ui.activities","ui.top-workspace","ui.pages"],"capabilities":["ui.page","ui.top-workspace","ui.plugin-workspace","ui.scientific-plot","data.scoped-sources","project.slice"],"platformPresentation":{"desktop":{"mode":"shared"},"mobile":{"mode":"adaptive"}},"workspace":{"role":"top","activity":"dkts-keithley-4200","icon":"▦","title":"4200A 测试"},"window":{"activity":"dkts-keithley-4200","title":"DK Test Studio 4200A","width":1380,"height":860,"minWidth":820,"minHeight":560,"dependencies":["scientific-renderer"],"prewarm":false,"reuse":true,"persistence":"project","artifactHydration":"live"},"data":{"accepts":["science.transport.iv","data.table"]}};
 DKDSPlugins.define(manifest,async ctx=>{
  const model=ctx.modules.require('model'),units=ctx.ui.unitTemplates;
  const ACTIVITY='dkts-keithley-4200',PAGE='dktsKeithley4200Page';
  const store=ctx.state.create(model.initial(),{projectSlice:'settings'});
  let wb=null,plot=null,nav=null,parameters=null,portFields=null,dataNote=null,kindField=null;
  const state=()=>model.validate(store.get());
  const active=()=>{const s=state();return s.pages.find(x=>x.id===s.activeId);};
  const persist=value=>{store.patch(model.validate(value));ctx.project.capture?.();render();};
  const sources=()=>{const rows=ctx.data.sources.list();return Array.isArray(rows)?rows:[];};
  function curves(){
   const out=[];
   for(const row of sources()){
    const table=ctx.data.artifacts.get(row.artifactId);
    const cols=Array.isArray(table?.columns)?table.columns:[];
    const byKeys=keys=>cols.find(c=>keys.includes(String(c.key||c.name||'').toLowerCase()));
    const x=byKeys(['vdset','voltage','vds','vg','vgs','time']);
    const y=byKeys(['id','current','ids']);
    const xs=x?.values,ys=y?.values;
    if(!xs||!ys||xs.length!==ys.length||!xs.length)continue;
    const points=[];
    for(let i=0;i<xs.length;i++){
     const ax=Number(xs[i]),ay=Number(ys[i]);
     if(Number.isFinite(ax)&&Number.isFinite(ay))points.push({x:ax,y:ay});
    }
    if(points.length)out.push({id:String(row.artifactId),artifactId:row.artifactId,
     label:String(row.name||table.name||row.artifactId),points});
   }
   return out;
  }
  function refreshData(){
   if(dataNote)dataNote.textContent='DKDS 数据中心分配：'+sources().length+' 组。4200A 原生输出禁用。';
   plot?.requestRender?.('data-artifacts');
  }
  function change(logical,key,value){
   try{persist(model.edit(state(),logical,{[key]:value}));}
   catch(error){ctx.status.set('参数无效：'+String(error.message||error));render();}
  }
  function render(){
   if(!nav||!parameters)return;
   const s=state(),p=active();
   nav.replaceChildren();
   for(const page of s.pages)units.action.create(nav,{
    id:'open-'+page.id,label:page.name,
    variant:page.id===s.activeId?'primary':'quiet',
    onInvoke:()=>persist(model.select(state(),page.id))
   });
   units.action.create(nav,{id:'add-test',label:'＋ 新增测试',
    onInvoke:()=>persist(model.add(state(),kindField?.control?.value||'iv'))});
   if(portFields){
    portFields.replaceChildren();
    units.note.create(portFields,{variant:'meta',
     text:'以下均为离线端口规划。只有仪器完成型号识别及输出安全验收后才允许真实测试。'});
    for(const term of p.terminals)units.field.create(portFields,{
     kind:'select',label:term.logical+' 端口',value:term.resource,
     options:['None','SMU1','SMU2','SMU3','SMU4','SMU5','SMU6','SMU7','SMU8']
      .map(x=>({value:x,label:x})),
     onChange:event=>change(term.logical,'resource',event.target.value)
    });
   }
   parameters.replaceChildren();
   units.note.create(parameters,{variant:'meta',text:p.name+' · '+p.testType+
    ' · 离线参数模式；设备输出尚未通过安全验收'});
   const ports=model.visible(p);
   if(!ports.length)units.emptyState.create(parameters,{
    message:'未分配端口。None 端口只在「端口映射」面板显示。'
   });
   for(const t of ports){
    const panel=units.panel.create(parameters,{variant:'standard',title:t.logical+' · '+t.resource,sizing:'content'});
    const row1=units.layout.create(panel.body,{variant:'identity',geometry:{
     display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(116px,1fr))',gap:'8px'}});
    units.field.create(row1,{kind:'select',label:'源模式',value:t.sourceMode,
     options:[{value:'voltage',label:'Voltage'},{value:'current',label:'Current'}],
     onChange:e=>change(t.logical,'sourceMode',e.target.value)});
    units.field.create(row1,{kind:'select',label:'扫描角色',value:t.role,
     options:[{value:'CONDITION',label:'Condition'},{value:'X',label:'Xsweep'},{value:'P',label:'Psweep'}],
     onChange:e=>change(t.logical,'role',e.target.value)});
    for(const key of (t.role==='CONDITION'?['bias']:['start','stop','step']))
     units.field.create(row1,{kind:'input',label:({bias:'偏压',start:'开始',stop:'结束',step:'步长'})[key],
      value:t[key],inputMode:'decimal',onChange:e=>change(t.logical,key,e.target.value)});
    const row2=units.layout.create(panel.body,{variant:'identity',geometry:{
     display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(116px,1fr))',gap:'8px'}});
    units.field.create(row2,{kind:'select',label:'量程模式',value:t.rangeMode,
     options:[{value:'auto',label:'自动'},
      ...(t.sourceMode==='voltage'?[{value:'minimum',label:'电流自动下限'}]:[]),
      {value:'fixed',label:'即时指定'}],
     onChange:e=>change(t.logical,'rangeMode',e.target.value)});
    units.field.create(row2,{kind:'input',label:t.sourceMode==='voltage'?'电流档位 (A)':'电压档位 (V)',
     value:t.rangeValue,disabled:t.rangeMode==='auto',inputMode:'decimal',
     onChange:e=>change(t.logical,'rangeValue',e.target.value)});
    units.field.create(row2,{kind:'input',label:t.sourceMode==='voltage'?'限流 (A)':'限压 (V)',
     value:t.compliance,inputMode:'decimal',
     onChange:e=>change(t.logical,'compliance',e.target.value)});
   }
  }
  ctx.ui.activities.add({id:ACTIVITY,label:'4200A',contextLabel:'DK Test Studio',icon:'▦',
   order:82,primary:true,openMode:'window',artifactHydration:'live',
   onActivate:()=>{ctx.workspace.openPage(PAGE);refreshData();}});
  const page=ctx.ui.pages.add({id:'dkts-4200a-page',pageId:PAGE,activity:ACTIVITY,
   label:'4200A',title:'',toolbar:false,html:''});
  const header=units.pageHeader.create(page,{variant:'page-owned',activity:ACTIVITY,
   title:'DK Test Studio · 4200A',subtitle:'DKDS Core 工作区 · 不执行未经验证的仪器输出'});
  units.layout.create(header.actions,{tagName:'span',variant:'identity',
   dataset:{dkdsSlot:'workbench-import'}});
  const body=units.page.create(page,{variant:'analysis'}).element;
  const container=units.layout.create(body,{variant:'identity'});
  wb=units.workspace.create(container,{variant:'standard',header:false,
   activity:ACTIVITY,primaryScroll:'safe'});
  const main=units.layout.create(null,{variant:'stack-comfortable'});
  nav=units.layout.create(main,{variant:'identity',
   geometry:{display:'flex',flexWrap:'wrap',gap:'6px',alignItems:'center'}});
  dataNote=units.note.create(main,{variant:'meta',text:'从 DKDS 数据中心读取工程数据'});
  const graphic=units.panel.create(main,{variant:'plot-card',header:false,sizing:'content'});
  const plotHost=units.layout.create(graphic.body,{variant:'plot-card-fill'});
  plot=units.scientificPlot.create(plotHost,{variant:'curve',source:'dkts-native',
   xTitle:'Voltage / Time',yTitle:'Current (A)',getCurves:curves,getMarkers:()=>[]});
  const params=units.layout.create(null,{variant:'stack-comfortable'});
  const picker=units.panel.create(params,{variant:'standard',title:'测试类型',sizing:'content'});
  kindField=units.field.create(picker.body,{kind:'select',label:'新增类型',value:'iv',
   options:model.KINDS.map(x=>({value:x.id,label:x.label}))});
  parameters=units.layout.create(params,{variant:'stack-comfortable'});
  const ports=units.layout.create(null,{variant:'stack-comfortable'});
  portFields=ports;
  const paramPrime=units.prime.build({id:'parameters',label:'参数',title:'FS-Pro 参数设置',
   variant:'canonical-header',presentationRole:'data-control',presentationPurpose:'parameters',
   semanticKind:'panel',placementControl:'host',priority:92,collapsible:true,existingNode:params,
   defaultPlacement:'right',placements:['inline','right','bottom','float'],
   stateVersion:'native-dkts-v1'});
  const portPrime=units.prime.build({id:'ports',label:'端口',title:'端口映射',
   variant:'canonical-header',presentationRole:'inspector',semanticKind:'inspector',
   priority:65,collapsible:true,existingNode:ports,chrome:'auto',header:{mode:'generate',title:'端口映射'},
   defaultPlacement:'bottom',placements:['inline','right','bottom','float'],
   stateVersion:'native-dkts-v1'});
  wb.compose({primary:{id:'main',label:'数据图',presentationRole:'scientific-primary',
   scroll:'safe',titlePolicy:'host-only',mainNode:main},
   primes:[paramPrime,portPrime],subs:[]});
  ctx.ui.topWorkspace.register({id:ACTIVITY,activity:ACTIVITY,label:'4200A',icon:'▦',
   layout:{mode:'native',root:{selector:'#'+PAGE+' .dkds-plugin-workspace'},
    primary:{id:'main',role:'analysis-primary',presentationRole:'scientific-primary',
     priority:100,collapsible:false},
    prime:[{id:'parameters',label:'参数',presentationRole:'data-control',
     presentationPurpose:'parameters',priority:92,collapsible:true},
     {id:'ports',label:'端口',presentationRole:'inspector',priority:65,collapsible:true}],sub:[]}});
  const off=ctx.events?.on?.('data:artifacts-changed',refreshData);
  render();refreshData();
  ctx.status.set('4200A 工作区已加载；原生输出禁用');
  return {deactivate(){off?.();plot?.dispose?.();wb?.dispose?.();}};
 });
})();