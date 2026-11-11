(() => {
 'use strict';
 const manifest={"id":"com.dkts.keithley-4200","name":"DK Test Studio - Keithley 4200A","version":"0.8.1","apiVersion":"1.19.0","entry":"plugin.js","scripts":["model.js","measurement-data.js","plugin.js"],"enabled":true,"order":82,"description":"Native DKDS TOP workbench: host-owned theme, data, scientific plot and project state; output disabled.","pluginType":"workbench","requiresCore":["status","events","workspace","project","state","modules","io","data.model","data.sources","data.artifacts","ui.workspace","ui.unit-templates","ui.scientific-plot","ui.table","ui.activities","ui.top-workspace","ui.pages"],"capabilities":["ui.page","ui.top-workspace","ui.plugin-workspace","ui.scientific-plot","data.scoped-sources","project.slice"],"platformPresentation":{"desktop":{"mode":"shared"},"mobile":{"mode":"adaptive"}},"workspace":{"role":"top","activity":"dkts-keithley-4200","icon":"▦","title":"4200A 测试","defaultSuper":true},"window":{"activity":"dkts-keithley-4200","title":"DK Test Studio 4200A","width":1380,"height":860,"minWidth":820,"minHeight":560,"dependencies":["scientific-renderer"],"prewarm":false,"reuse":true,"persistence":"project","artifactHydration":"live"},"data":{"accepts":["science.transport.iv","data.table"]}};
 DKDSPlugins.define(manifest,async ctx=>{
  const model=ctx.modules.require('model'),measurementData=ctx.modules.require('measurementData'),units=ctx.ui.unitTemplates;
  if(typeof measurementData?.publishRaw!=='function')throw Error('KXCI Data Center publisher missing');
  const ACTIVITY='dkts-keithley-4200',PAGE='dktsKeithley4200Page';
  const store=ctx.state.create(model.initial(),{projectSlice:'settings'});
  let wb=null,plot=null,plotView=null,plots=[],plotViews=[],frameCards=[],frameSelections=['','','',''],frameKinds=['iv','transfer','it','raw'],frameGroup=null,frameTableHosts=[],framePlotHosts=[],frameTables=[],frameLayout='4',nav=null,parameters=null,portFields=null,dataNote=null,kindField=null,pad=null,inlineTerminals=null,editorTabs=null,editorHeading=null;
  let editorSection='sweep',editorOpen=false,workRegion=null,editorRegion=null,plotRegion=null;
  const PAGE_TABS=[['info','信息'],['sweep','扫描'],['target','目标'],['strategy','策略'],['limits','保护'],['variables','页面变量'],['spec','关联规格']];
  const FRAME_OPTIONS=[{value:'iv',label:'I–V'},{value:'transfer',label:'转移'},{value:'it',label:'I–t'},{value:'raw',label:'数据表'}];
  const touchNumeric=Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);
  const state=()=>model.validate(store.get());
  const active=()=>{const s=state();return s.pages.find(x=>x.id===s.activeId);};
  const persist=value=>{store.patch(model.validate(value));ctx.project.capture?.();render();};
  const sources=()=>{const rows=ctx.data.sources.list();return Array.isArray(rows)?rows:[];};
  // Core's plugin-scoped sources facade enforces Data Center assignments.
  // Revision-aware caching prevents full column clones on plot repaints.
  const plotCache=new Map();
  function curves(axis='iv'){
   const rows=sources();
   const key=JSON.stringify([axis,...rows.map(row=>[row.artifactId,row.name,
    ctx.data.artifacts.artifactRevision?.(row.artifactId)||0])]);
   if(plotCache.has(key))return plotCache.get(key);
   const next=model.curvesFromArtifacts(rows,ctx.data.artifacts,{axis});
   plotCache.set(key,next);
   return next;
  }
    function syncGraphSettings(){
   const settings=state().ui.graphs;
   frameLayout=String(settings.count);
   frameKinds=[...settings.kinds];
   frameSelections=[...settings.sources];
  }
  function saveGraphSetting(index,field,value){
   const settings=state();
   if(index<0)settings.ui.graphs.count=Number(value);
   else if(field==='kind')settings.ui.graphs.kinds[index]=String(value);
   else settings.ui.graphs.sources[index]=String(value);
   const next=model.validate(settings);
   store.patch(next);
   ctx.project.capture?.();
   syncGraphSettings();
   applyFrameLayout();
   if(index>=0&&field==='kind')createFramePlot(index);
   refreshRawTables();
   for(const item of plots)item?.requestRender?.('frame-setting');
  }
  function refreshRawTables(){
   const available=sources();
   for(let index=0;index<frameTables.length;index++){
    const raw=frameKinds[index]==='raw';
    if(frameTableHosts[index]?.style)frameTableHosts[index].style.display=raw?'':'none';
    if(framePlotHosts[index]?.style)framePlotHosts[index].style.display=raw?'none':'';
    if(!raw)continue;
    const ref=frameSelections[index]
     ?available.find(item=>item.artifactId===frameSelections[index])
     :available.length===1?available[0]:null;
    if(!ref){frameTables[index].setData([],[]);continue;}
    const cols=ctx.data.artifacts.columnMetadata(ref.artifactId);
    if(!Array.isArray(cols)||!cols.length){frameTables[index].setData([],[]);continue;}
    const count=Math.min(200,...cols.map(col=>Number(col.length)||0));
    if(count<1){frameTables[index].setData([],[]);continue;}
    const slices=cols.map(col=>ctx.data.artifacts.readColumnRange(ref.artifactId,
     col.id||col.key,{start:0,limit:count}));
    const rows=Array.from({length:count},(_,i)=>Object.fromEntries(cols.map((col,c)=>
     [col.key||col.id,slices[c]?.values?.[i]??null])));
    frameTables[index].setData(cols.map(col=>({key:col.key||col.id,
     label:col.name||col.key||col.id})),rows);
   }
  }
  function refreshData(){
   plotCache.clear();
   refreshRawTables();
   for(const item of plots)item?.requestRender?.('data-artifacts');
  }
  function commitTransaction(fn){
   try{persist(fn());}
   catch(error){ctx.status.set('参数无效：'+String(error.message||error));render();}
  }
  function change(logical,key,value){
   commitTransaction(()=>model.edit(state(),logical,{[key]:value}));
  }
  function changeSweep(key,value){
   commitTransaction(()=>model.editSweep(state(),{[key]:value}));
  }
  function changeSegment(axis,index,key,value){
   commitTransaction(()=>model.editSegment(state(),axis,index,{[key]:value}));
  }
  function openNumericPad(input,title,commit){
   if(!touchNumeric||!input)return;
   pad?.close?.();pad=null;
   const pop=units.popover.create(null,{
    variant:'picker',title,role:'dialog',
    ariaLabel:'科学计数法数字键盘',anchor:input,placement:'bottom-start',
    dismissOnOutside:true,offset:4,
    onClose:()=>{if(pad===pop)pad=null;}
   });
   pad=pop;
   let buffer=String(input.value||'');
   const display=units.field.create(pop.body,{kind:'input',label:'当前数值',
    value:buffer,readOnly:true,inputMode:'none'});
   const keys=units.layout.create(pop.body,{variant:'action-grid-4'});
   for(const label of ['7','8','9','⌫','4','5','6','清除',
    '1','2','3','±','0','.','E','完成']){
    units.action.create(keys,{id:'numeric-'+label,label,variant:'quiet',
     onInvoke:()=>{
      if(label==='完成'){
       if(buffer)commit(buffer);
       pop.close();if(pad===pop)pad=null;
       return;
      }
      if(label==='清除')buffer='';
      else if(label==='⌫')buffer=buffer.slice(0,-1);
      else if(label==='±'){
       // Scientific notation requires a negative exponent, not just a
       // negative mantissa. Toggle the exponent sign when E is present.
       const eIndex=Math.max(buffer.indexOf('e'),buffer.indexOf('E'));
       if(eIndex>=0){
        const prefix=buffer.slice(0,eIndex+1),exp=buffer.slice(eIndex+1);
        buffer=prefix+(exp.startsWith('-')?exp.slice(1):
         exp.startsWith('+')?'-'+exp.slice(1):'-'+exp);
       }else buffer=buffer.startsWith('-')?buffer.slice(1):'-'+buffer;
      }
      else if(label==='E'){if(!/[eE]/.test(buffer))buffer+=(buffer?'e':'1e');}
      else buffer+=label;
      display.control.value=buffer;
     }
    });
   }
  }
  function scalarField(host,label,value,commit,disabled=false){
   return units.field.create(host,{kind:'input',label,value,
    inputMode:touchNumeric?'none':'decimal',disabled,
    onFocus:event=>openNumericPad(event.target,label,commit),
    onChange:event=>commit(event.target.value)
   });
  }
  function numericField(host,logical,key,label,value,disabled=false){
   return scalarField(host,label,value,v=>change(logical,key,v),disabled);
  }
  const axisRanges=Object.freeze({
   voltage:['1e-12','1e-11','1e-10','1e-9','1e-8','1e-7','1e-6',
     '1e-5','1e-4','1e-3','1e-2','1e-1','1e0'],
   current:['0.2','2','20','200']
  });
  function renderSweep(parameters,p){
   const sw=p.sweep;
   const config=units.panel.create(parameters,{variant:'headed',
     title:'扫描结构',sizing:'content'});
   const top=units.layout.create(config.body,{variant:'form-grid-2'});
   const opts=p.terminals.map(t=>({value:t.logical,label:t.logical+' / '+t.resource}));
   const xPort=p.terminals.find(t=>t.role==='X')||p.terminals[0];
   const pPort=p.terminals.find(t=>t.role==='P')||p.terminals[1];
   units.field.create(top,{kind:'select',label:'Xsweep 端口',value:xPort.logical,
    options:opts,onChange:e=>change(e.target.value,'role','X')});
   units.field.create(top,{kind:'select',label:'Psweep 端口',value:pPort.logical,
    options:opts,onChange:e=>change(e.target.value,'role','P')});
   scalarField(top,'整体循环',sw.loops,v=>changeSweep('loops',v));
   units.field.create(top,{kind:'select',label:'Psweep',value:String(sw.pEnabled),
    options:[{value:'false',label:'关闭'},{value:'true',label:'启用'}],
    onChange:event=>changeSweep('pEnabled',event.target.value==='true')});
   const preview=model.summary(p);
   units.note.create(config.body,{variant:'meta',text:preview.ready?
    '离线扫描规划：Xsweep '+preview.xPoints+' 点 × '+preview.xRepeats+
      ' 次'+(sw.pEnabled?' × Psweep '+preview.pPoints+' 点 × '+preview.pRepeats+' 次':'')+
      ' × '+preview.loops+' 轮 = '+preview.total+' 点。未输出至仪器。':
    preview.reason+'。未输出至仪器。'});
   for(const axis of ['X','P']){
    if(axis==='P'&&!sw.pEnabled)continue;
    const t=p.terminals.find(t=>t.role===axis)||
      p.terminals.find(t=>t.logical===(axis==='X'?'D':'G'));
    if(!t)continue; // Offline sweep plan remains visible before allocation.
    const segments=axis==='X'?sw.xSegments:sw.pSegments;
    const repeatKey=axis==='X'?'xRepeats':'pRepeats';
    const panel=units.panel.create(parameters,{variant:'headed',
      title:axis+'sweep · '+t.logical+' / '+t.resource,sizing:'content'});
    const layout=units.layout.create(panel.body,{variant:'form-grid-4'});
    scalarField(layout,'重复次数',sw[repeatKey],v=>changeSweep(repeatKey,v));
    for(const [index,seg] of segments.entries()){
     const group=units.panel.create(panel.body,{
      variant:'headed',title:'第 '+(index+1)+' 段',sizing:'content'});
     const controls=units.layout.create(group.body,{variant:'form-grid-4',
    responsiveGeometry:[{maxWidth:620,geometry:{
     gridTemplateColumns:'repeat(4,minmax(0,1fr))'}},
     {maxWidth:520,geometry:{gridTemplateColumns:'repeat(2,minmax(0,1fr))'}}]});
     const unit=t.sourceMode==='current'?'A':'V';
     for(const [key,label] of [['start','起始'],['stop','结束'],['step','步长']]){
      scalarField(controls,label+' ('+unit+')',seg[key],
       v=>changeSegment(axis,index,key,v));
     }
     const rangeOptions=[{value:'auto',label:'自动'},
      ...axisRanges[t.sourceMode].map(value=>({value,label:value}))];
     if(seg.range!=='auto'&&!rangeOptions.some(row=>row.value===seg.range)){
      rangeOptions.push({value:seg.range,label:seg.range});
     }
     units.field.create(controls,{kind:'select',
      label:t.sourceMode==='current'?'电压档位 (V)':'电流档位 (A)',
      value:seg.range,options:rangeOptions,
      onChange:e=>changeSegment(axis,index,'range',e.target.value)});
     scalarField(controls,'点间延迟 (ms)',seg.delayMs,
      v=>changeSegment(axis,index,'delayMs',v));
     if(segments.length>1)units.action.create(controls,{
      id:'remove-'+axis+'-'+index,label:'删除本段',variant:'quiet',
      onInvoke:()=>commitTransaction(()=>model.removeSegment(state(),axis,index))
     });
    }
    units.action.create(panel.body,{
     id:'add-segment-'+axis,label:'＋ 添加扫描段',variant:'quiet',
     onInvoke:()=>commitTransaction(()=>model.addSegment(state(),axis))
    });
   }
  }
  function scopedSource(index){
   const all=sources();
   const selected=frameSelections[index];
   if(selected)return all.find(item=>item.artifactId===selected)||null;
   return all.length===1?all[0]:null;
  }
  function createFramePlot(index){
   const host=framePlotHosts[index];if(!host)return null;
   plots[index]?.dispose?.();
   const kind=frameKinds[index]||'iv';
   const title=kind==='it'?'时间 (s)':kind==='transfer'?'栅极电压 (V)':'漏极电压 (V)';
   const instance=units.scientificPlot.create(host,{variant:'curve',
    source:'dkts-native-frame-'+(index+1),
    xTitle:title,yTitle:'漏极电流 (A)',
    getCurves:()=>frameCurves(index),getMarkers:()=>[]});
   plots[index]=instance;
   return instance;
  }
  function frameCurves(index){
   const kind=frameKinds[index]||'iv',selected=frameSelections[index],available=sources();
   if(kind==='raw'||selected&&!available.some(row=>row.artifactId===selected))return [];
   const list=curves(kind);
   return selected?list.filter(curve=>curve.artifactId===selected):list;
  }
    function frameDataMenu(index){
   const available=sources();
   const selected=frameSelections[index]||'';
   // The DKDS Action Menu owns source choices and export instead of
   // squeezing two full-width fields into the mobile PlotView titlebar.
   return [
    {id:'source-all',label:(selected===''?'✓ ':'')+'全部已分配数据',
     onInvoke:()=>saveGraphSetting(index,'source','')},
    ...available.map((ref,i)=>({
     id:'source-'+i,
     label:(selected===ref.artifactId?'✓ ':'')+String(ref.name||ref.artifactId),
     onInvoke:()=>saveGraphSetting(index,'source',String(ref.artifactId))
    })),
    {id:'export-original',label:'导出完整原始 CSV',
     onInvoke:()=>exportOriginalCsv(index).catch(error=>
      ctx.status.set('导出失败：'+String(error.message||error)))}
   ];
  }
  async function exportOriginalCsv(index){
   // Full-resolution export belongs to canonical Data Center Artifact + DKDS IO.
   // Never use decimated ScientificPlot points as measurement originals.
   const ref=scopedSource(index);
   if(!ref){
    ctx.status.set(sources().length?'请选择一个具体数据源再导出':'尚无可导出的原始数据');
    return false;
   }
   const rev=ctx.data.artifacts.artifactRevision(ref.artifactId);
   if(!Number.isInteger(rev))throw Error('无法校验原始数据版本');
   const table=ctx.data.artifacts.get(ref.artifactId);
   if(!table||table.kind!=='data.table'||!Array.isArray(table.columns)||!table.columns.length)
    throw Error('选中数据源不是原始 DataTable');
   // Check raw length before allocating a full row projection. For very large
   // sources the Data Center's own streaming exporter remains authoritative.
   if(!Number.isSafeInteger(table.rowCount)||table.rowCount>250000)
    throw Error('原始数据过大或行数无效，请使用数据中心的完整导出功能');
   const rows=ctx.data.model.rows(table);
   if(!Array.isArray(rows)||rows.length!==table.rowCount)
    throw Error('导出数据行数与 Data Center 原始记录不一致');
   // Use a detached canonical snapshot, keeping the Artifact itself immutable.
   const safeName=String(ref.name||'Measurement').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(0,64);
   if(ctx.data.artifacts.artifactRevision(ref.artifactId)!==rev)
    throw Error('导出时数据源已变更，请重试');
   await ctx.io.saveCsv(rows,'DKTS_4200A_'+safeName+'.csv');
   ctx.status.set('已通过 DKDS 导出 '+rows.length+' 条原始数据（未抽稀）');
   return true;
  }
  function applyFrameLayout(){
   // Core PlotGroup owns responsive geometry; only hide nonselected children.
   frameGroup?.setColumns?.(frameLayout==='1'?1:2);
   for(let i=0;i<frameCards.length;i++)if(frameCards[i]?.style)
    frameCards[i].style.display=frameLayout==='1'&&i>0||frameLayout==='2'&&i>1?'none':'';
  }
    function updateEditorLayout(){
   // FS-Pro hierarchy: project-level graph workspace and Page editor are
   // separate navigation destinations, never cramped side-by-side panels.
   applyFrameLayout();
   if(editorRegion?.style)editorRegion.style.display=editorOpen?'':'none';
   if(plotRegion?.style)plotRegion.style.display=editorOpen?'none':'';
  }
  function render(){
   if(!nav||!parameters)return;
   updateEditorLayout();
   const s=state(),p=active();
   syncGraphSettings();applyFrameLayout();
   const selectedKind=kindField?.control?.value||'iv';
   nav.replaceChildren();
   // Real DKDS Core Units own the Device/Routine/Page/Spec project tree.
   const device=s.devices.find(d=>d.id===s.activeDeviceId);
   const visibleSpecs=s.specs.filter(spec=>spec.deviceId===s.activeDeviceId);
   const projectHeader=units.header.create(nav,{kind:'panel',variant:'content',
    title:'项目导航',meta:''});
   // The existing Project heading is the graph-level navigation target.
   if(projectHeader?.element?.addEventListener){
    const home=()=>{editorOpen=false;render();};
    projectHeader.element.tabIndex=0;
    projectHeader.element.setAttribute?.('role','button');
    projectHeader.element.style.cursor='pointer';
    projectHeader.element.addEventListener('click',home);
    projectHeader.element.addEventListener('keydown',event=>{
     if(event.key==='Enter'||event.key===' '){event.preventDefault();home();}
    });
   }
   units.field.create(nav,{kind:'select',label:'器件',value:s.activeDeviceId,
    options:s.devices.map(item=>({value:item.id,label:item.name})),
    onChange:e=>{editorOpen=false;persist(model.selectDevice(state(),e.target.value));}});
   const treeHost=units.layout.create(nav,{variant:'stack-compact'});
   for(const routine of s.routines.filter(r=>r.deviceId===s.activeDeviceId)){
    const routineHost=units.layout.create(treeHost,{variant:'stack-compact'});
    units.list.create(routineHost,{}).item({leading:'▦',title:routine.name,
     selected:false,
     onInvoke:()=>{editorOpen=false;persist(model.selectRoutine(state(),routine.id));}});
    for(const page of s.pages.filter(page=>page.routineId===routine.id)){
     const pageHost=units.layout.create(routineHost,{variant:'identity'});
     if(pageHost?.style)pageHost.style.paddingLeft='15px';
     units.list.create(pageHost,{}).item({leading:'▧',title:page.name,
      selected:editorOpen&&page.id===s.activeId,
      onInvoke:()=>{editorOpen=true;persist(model.select(state(),page.id));}});
    }
   }
   if(visibleSpecs.length){
    units.note.create(nav,{variant:'meta',text:'SPEC'});
    const specs=units.list.create(nav,{});
    for(const spec of visibleSpecs)
     specs.item({leading:'◇',title:spec.name,
      selected:spec.id===p.associateSpecId,
      onInvoke:()=>persist(model.associateSpec(state(),spec.id))});
   }
   const actions=units.layout.create(nav,{variant:'row-wrap'});
   units.action.create(actions,{id:'add-device',label:'＋ 器件',
    variant:'quiet',onInvoke:()=>{editorOpen=false;persist(model.addDevice(state()));}});
   units.action.create(actions,{id:'add-routine',label:'＋ 测试流程',
    variant:'quiet',onInvoke:()=>{editorOpen=false;persist(model.addRoutine(state()));}});
   units.action.create(actions,{id:'add-spec',label:'＋ 规格',
    variant:'quiet',onInvoke:()=>{editorOpen=true;persist(model.addSpec(state()));}});
   if(s.pages.length>1)
    units.action.create(actions,{id:'close-'+p.id,label:'× 页面',
     variant:'quiet',onInvoke:()=>persist(model.remove(state(),p.id))});
   if(visibleSpecs.length)
    units.field.create(nav,{kind:'select',label:'关联规格',
     value:p.associateSpecId||'',options:[{value:'',label:'无'},
      ...visibleSpecs.map(spec=>({value:spec.id,label:spec.name}))],
     onChange:e=>persist(model.associateSpec(state(),e.target.value||null))});
   kindField=units.field.create(nav,{kind:'select',label:'新增测试类型',
    value:selectedKind,options:model.KINDS.map(x=>({value:x.id,label:x.label}))});
   units.action.create(nav,{id:'add-test',label:'＋ 页面',
    variant:'quiet',onInvoke:()=>{editorOpen=true;persist(model.add(state(),
     kindField?.control?.value||'iv'));}});
   if(portFields){
    portFields.replaceChildren();
    for(const term of p.terminals)units.field.create(portFields,{
     kind:'select',label:term.logical+' 端口',value:term.resource,
     options:['None','SMU1','SMU2','SMU3','SMU4','SMU5','SMU6','SMU7','SMU8']
      .map(x=>({value:x,label:x})),
     onChange:event=>change(term.logical,'resource',event.target.value)
    });
   }
   // Terminal assignment is now part of the visible native Main workspace.
   if(inlineTerminals){
    inlineTerminals.replaceChildren();
    const panel=units.panel.create(inlineTerminals,{
     variant:'headed',title:'端口设置',sizing:'content'});
    const form=units.layout.create(panel.body,{variant:'form-grid-4',
     responsiveGeometry:[{maxWidth:620,geometry:{
      gridTemplateColumns:'repeat(4,minmax(0,1fr))'}},
      {maxWidth:520,geometry:{
       gridTemplateColumns:'repeat(2,minmax(0,1fr))'}}]});
    for(const term of p.terminals)units.field.create(form,{
     kind:'select',label:term.logical+' 端口',value:term.resource,
     options:['None','SMU1','SMU2','SMU3','SMU4','SMU5','SMU6',
      'SMU7','SMU8'].map(value=>({value,label:value})),
     onChange:e=>change(term.logical,'resource',e.target.value)
    });
   }
   editorHeading.replaceChildren();
   const title=units.header.create(editorHeading,{
    kind:'panel',variant:'content',eyebrow:'编辑页面',title:p.name,meta:p.testType
   });
   units.action.create(title.actions,{id:'check-plan',label:'校验规划',
    variant:'secondary',onInvoke:()=>{
     const result=model.summary(active());
     ctx.status.set(result.ready?'离线规划 '+result.total+' 点':result.reason);
    }});
   units.action.create(title.actions,{id:'run-disabled',label:'▶ 测试',
    variant:'secondary',enabled:false});
   editorTabs.replaceChildren();
   units.tabs.create(editorTabs,{variant:'compact',value:editorSection,
    items:PAGE_TABS.map(([id,label])=>({id,label,selected:id===editorSection})),
    onChange:value=>{
     const id=String(typeof value==='object'?value?.id||value?.value||'':value);
     if(PAGE_TABS.some(row=>row[0]===id)){editorSection=id;render();}
    }});
   parameters.replaceChildren();
   const section=(name)=>units.panel.create(parameters,{
    variant:'headed',title:name,sizing:'content'});
   if(editorSection==='info'){
    const grid=units.layout.create(section('页面信息').body,{variant:'form-grid-2'});
    units.field.create(grid,{kind:'input',label:'页面名称',value:p.name,
     onChange:e=>commitTransaction(()=>model.editPage(state(),{name:e.target.value}))});
    units.field.create(grid,{kind:'textarea',label:'备注',value:p.note||'',
     onChange:e=>commitTransaction(()=>model.editPage(state(),{note:e.target.value}))});
    scalarField(grid,'循环次数',p.sweep.loops,v=>changeSweep('loops',v));
   }else if(editorSection==='sweep'){
    if(['iv','transfer','output'].includes(p.kind))renderSweep(parameters,p);
    else units.note.create(parameters,{variant:'meta',
     text:'当前类型只允许离线配置；仪器输出禁用。'});
    const ports=model.visible(p);
    if(ports.length){
     const panel=section('端口参数');
     for(const term of ports){
      units.note.create(panel.body,{variant:'meta',text:term.logical+' · '+term.resource});
      const grid=units.layout.create(panel.body,{variant:'form-grid-4'});
      units.field.create(grid,{kind:'select',label:'源输出模式',value:term.sourceMode,
       options:[{value:'voltage',label:'电压'},{value:'current',label:'电流'}],
       onChange:e=>change(term.logical,'sourceMode',e.target.value)});
      units.field.create(grid,{kind:'select',label:'扫描角色',value:term.role,
       options:[{value:'CONDITION',label:'固定'},{value:'X',label:'Xsweep'},
        {value:'P',label:'Psweep'}],onChange:e=>change(term.logical,'role',e.target.value)});
      units.field.create(grid,{kind:'select',label:'档位模式',value:term.rangeMode,
       options:[{value:'auto',label:'自动'},
        ...(term.sourceMode==='voltage'?[{value:'minimum',label:'受限自动'}]:[]),
        {value:'fixed',label:'固定'}],
       onChange:e=>change(term.logical,'rangeMode',e.target.value)});
      numericField(grid,term.logical,'rangeValue',
       term.sourceMode==='voltage'?'电流档位 (A)':'电压档位 (V)',
       term.rangeValue,term.rangeMode==='auto');
      numericField(grid,term.logical,'compliance',
       term.sourceMode==='voltage'?'限流 (A)':'限压 (V)',term.compliance);
      if(term.role==='CONDITION')numericField(grid,term.logical,'bias','固定偏置',term.bias);
     }
    }
   }else if(editorSection==='target'){
    const grid=units.layout.create(section('测量目标').body,{variant:'form-grid-2'});
    units.field.create(grid,{kind:'select',label:'端口',value:p.target.logical,
     options:p.terminals.map(t=>({value:t.logical,label:t.logical+' / '+t.resource})),
     onChange:e=>commitTransaction(()=>model.editTarget(state(),{logical:e.target.value}))});
    units.field.create(grid,{kind:'select',label:'测量量',value:p.target.quantity,
     options:[{value:'Current',label:'Current (A)'},{value:'Voltage',label:'Voltage (V)'}],
     onChange:e=>commitTransaction(()=>model.editTarget(state(),{quantity:e.target.value}))});
   }else if(editorSection==='strategy'){
    const grid=units.layout.create(section('测试策略').body,{variant:'form-grid-2'});
    for(const [label,key] of [['循环次数','loops'],['Xsweep 重复次数','xRepeats'],
      ['Psweep 重复次数','pRepeats']])
     scalarField(grid,label,p.sweep[key],v=>changeSweep(key,v));
    units.field.create(grid,{kind:'select',label:'Psweep',value:String(p.sweep.pEnabled),
     options:[{value:'false',label:'关闭'},{value:'true',label:'启用'}],
     onChange:e=>changeSweep('pEnabled',e.target.value==='true')});
   }else if(editorSection==='limits'){
    const panel=section('端口保护');
    if(!model.visible(p).length)units.emptyState.create(panel.body,{
     message:'先在 Terminal 中分配端口'});
    for(const term of model.visible(p)){
     const grid=units.layout.create(panel.body,{variant:'form-grid-2'});
     numericField(grid,term.logical,'compliance',
      term.logical+' / '+term.resource+' Compliance',term.compliance);
     numericField(grid,term.logical,'rangeValue',
      term.logical+' / '+term.resource+' Range',term.rangeValue,term.rangeMode==='auto');
    }
    units.note.create(panel.body,{variant:'meta',
     text:'仅离线规划；真实硬件输出禁用。'});
   }else if(editorSection==='variables'){
    const panel=section('页面变量');
    for(const [index,variable] of p.variables.entries()){
     const row=units.layout.create(panel.body,{variant:'form-grid-4'});
     units.field.create(row,{kind:'input',label:'名称',value:variable.name,
      onChange:e=>commitTransaction(()=>model.editVariable(state(),index,{name:e.target.value}))});
     scalarField(row,'Value',variable.value,v=>commitTransaction(
      ()=>model.editVariable(state(),index,{value:v})));
     units.field.create(row,{kind:'input',label:'单位',value:variable.unit,
      onChange:e=>commitTransaction(()=>model.editVariable(state(),index,{unit:e.target.value}))});
     units.action.create(row,{id:'remove-var-'+index,label:'×',variant:'quiet',
      onInvoke:()=>commitTransaction(()=>model.removeVariable(state(),index))});
    }
    units.action.create(panel.body,{id:'add-var',label:'＋ 变量',variant:'quiet',
     onInvoke:()=>commitTransaction(()=>model.addVariable(state()))});
   }else if(editorSection==='spec'){
    const grid=units.layout.create(section('关联规格').body,{variant:'form-grid-2'});
    units.field.create(grid,{kind:'select',label:'规格',value:p.associateSpecId||'',
     options:[{value:'',label:'无'},
      ...s.specs.filter(x=>x.deviceId===s.activeDeviceId).map(x=>({value:x.id,label:x.name}))],
     onChange:e=>commitTransaction(()=>model.associateSpec(state(),e.target.value||null))});
    units.action.create(grid,{id:'new-spec-inline',label:'＋ 规格',variant:'quiet',
     onInvoke:()=>commitTransaction(()=>model.addSpec(state()))});
   }
  }
  ctx.ui.activities.add({id:ACTIVITY,label:'4200A',contextLabel:'DK Test Studio',icon:'▦',
   order:82,primary:true,openMode:'window',artifactHydration:'live',
   onActivate:()=>{ctx.workspace.openPage(PAGE);refreshData();}});
  const page=ctx.ui.pages.add({id:'dkts-4200a-page',pageId:PAGE,activity:ACTIVITY,
   label:'4200A',title:'',toolbar:false,html:''});
  // The Core SUPER activity bar already identifies this testing workspace.
  // A duplicate Page Header wastes 42px; SUPER hides its import action slot.
  // Keep the DKDS-owned page body, tabs, plotting and status intact.
  const body=units.page.create(page,{variant:'analysis'}).element;
  const container=units.layout.create(body,{variant:'identity'});
  wb=units.workspace.create(container,{variant:'standard',header:false,
   activity:ACTIVITY,primaryScroll:'safe'});
  // Core SDK owns the native Page editor and real PlotView, without a separate browser shell.
  const main=units.layout.create(null,{variant:'sidebar-main-compact',
   // DKDS Core SDK 1.19 accepts this registered one-column geometry at 620px.
   // The unmodified compact recipe keeps 235px sidebar on tablet/desktop.
   responsiveGeometry:[{maxWidth:620,
    geometry:{gridTemplateColumns:'minmax(0,1fr)'}}]});
  nav=units.layout.create(main,{variant:'stack-compact'});
  // DKDS Core workbench owns both the independent result graph and Page inspector.
  // One semantic Core content stack. Selecting a Page replaces the graph
  // surface with a full-width parameter editor; it is not a sibling column.
  const work=units.layout.create(main,{variant:'stack-compact'});
  const editor=units.layout.create(work,{variant:'stack-compact'});
  editorHeading=units.layout.create(editor,{variant:'identity'});
  inlineTerminals=units.layout.create(editor,{variant:'identity'});
  editorTabs=units.layout.create(editor,{variant:'identity'});
  parameters=units.layout.create(editor,{variant:'stack-compact'});
  const plotArea=units.layout.create(work,{variant:'stack-comfortable'});
  workRegion=work;editorRegion=editor;plotRegion=plotArea;
  // Four independent DKDS PlotView subwindows, each with its own host controls.
  // Never synthesize measurement samples in an offline UI.
  const plotsHeading=units.header.create(plotArea,{kind:'panel',
   variant:'content',title:'绘图区',actionHost:true});
  const frameTools=units.layout.create(plotsHeading.actions,{variant:'row-wrap'});
  syncGraphSettings();
  units.field.create(frameTools,{kind:'select',label:'图窗布局',controlOnly:true,
    attributes:{'aria-label':'图窗布局','title':'图窗布局'},value:frameLayout,
   options:[{value:'1',label:'单窗口'},{value:'2',label:'双窗口'},
    {value:'4',label:'四宫格'}],
   onChange:e=>saveGraphSetting(-1,'count',e.target.value)});
  const groupHost=units.layout.create(plotArea,{variant:'identity'});
  frameGroup=units.plotGroup.create(groupHost,{columns:2,preferredColumns:2,
   maxColumns:4,minItemWidth:260,responsive:true,density:'regular',
   orientationPolicy:{mode:'portrait-offset',offset:-1,minColumns:1}});
  const frameTitles=['图窗 1','图窗 2','图窗 3','图窗 4'];
    for(let index=0;index<4;index++){
   const graphic=units.panel.detached({variant:'plot-card',
    header:false,sizing:'fill'});
   frameCards.push(graphic.element);
   const graphicHeader=units.header.create(graphic.body,{kind:'plot',
    variant:'plot',title:frameTitles[index],actionHost:true});
   const typeHost=units.layout.create(graphicHeader.actions,{variant:'identity'});
   units.field.create(typeHost,{kind:'select',label:'显示',controlOnly:true,
     attributes:{'aria-label':'图窗 '+(index+1)+' 显示内容','title':'显示内容'},value:frameKinds[index],
    options:FRAME_OPTIONS,onChange:e=>saveGraphSetting(index,'kind',e.target.value)});
   units.action.create(graphicHeader.actions,{
    id:'dkts-frame-data-'+(index+1),
    label:'数据',title:'选择数据中心数据源或导出原始 CSV',
    menu:true,variant:'quiet',items:()=>frameDataMenu(index)
   });
   const plotHost=units.layout.create(graphic.body,{variant:'plot-card-fill'});
   framePlotHosts.push(plotHost);
   const rawHost=units.layout.create(graphic.body,{variant:'scroll-pane'});
   frameTableHosts.push(rawHost);
   frameTables.push(units.table.mount('dkts-frame-'+(index+1)+'-raw',rawHost,{
    variant:'standard',persistKey:'dkts-frame-'+(index+1)+'-raw',
    appearance:{density:'compact',stripe:'subtle'},columns:[],rows:[]}));
   const view=frameGroup.adoptPlot('dkts-4200a-frame-'+(index+1),graphic.element,{
    variant:'complete',title:frameTitles[index],plot:plotHost,
    header:graphicHeader.element,actionsHost:graphicHeader.actions,
    fileStem:'DKTS_4200A_frame_'+(index+1),images:true,copy:true,csv:false,
    detailGeometry:{contentAspectRatio:1.65,contentMinHeightPx:190,contentMaxHeightPx:520},
    placements:['home','left','right','bottom','float','global'],stateVersion:'dkts-native-v5'});
   // Recreate only the scientific surface when this window changes axes.
   const instance=createFramePlot(index);
   plotViews.push(view);
   if(index===0){plotView=view;plot=instance;}
  }
  applyFrameLayout();
  refreshRawTables();
  // Keep optional dockable Port PRIME; editing of Page is always visible.
  const ports=units.layout.create(null,{variant:'stack-compact'});
  portFields=ports;
  const portPrime=units.prime.build({id:'ports',label:'端口',title:'端口映射',
   variant:'canonical-header',presentationRole:'inspector',
   semanticKind:'inspector',placementControl:'surface',chrome:'auto',
   priority:65,collapsible:true,existingNode:ports,defaultPlacement:'bottom',
   placements:['inline','right','bottom','float'],stateVersion:'native-dkts-v2'});
  portPrime.chrome='auto';
  wb.compose({primary:{id:'main',label:'测试工程',
   presentationRole:'scientific-primary',scroll:'safe',
   titlePolicy:'host-only',mainNode:main},primes:[portPrime],subs:[]});
  ctx.ui.topWorkspace.register({id:ACTIVITY,activity:ACTIVITY,
   label:'4200A',icon:'▦',layout:{mode:'native',
    root:{selector:'#'+PAGE+' .dkds-plugin-workspace'},
    primary:{id:'main',role:'analysis-primary',
     presentationRole:'scientific-primary',priority:100,collapsible:false},
    prime:[{id:'ports',label:'端口',presentationRole:'inspector',
     priority:65,collapsible:true}],sub:[]}});
  const off=ctx.events?.on?.('data:artifacts-changed',refreshData);
  window.addEventListener?.('resize',updateEditorLayout);
  render();refreshData();
  ctx.status.set('4200A 工作区已加载；原生输出禁用');
  return {deactivate(){window.removeEventListener?.('resize',updateEditorLayout);
   pad?.close?.();off?.();for(const item of plots)item?.dispose?.();
   for(const item of plotViews)item?.dispose?.();
   for(const item of frameTables)item?.dispose?.();frameGroup?.dispose?.();wb?.dispose?.();}};
 });
})();