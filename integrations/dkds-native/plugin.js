(() => {
 'use strict';
 const manifest={"id":"com.dkts.keithley-4200","name":"DK Test Studio - Keithley 4200A","version":"0.8.8","apiVersion":"1.19.0","entry":"plugin.js","scripts":["model.js","measurement-data.js","ui-shell.js","plugin.js"],"enabled":true,"order":82,"description":"Native DKDS TOP workbench: host-owned theme, data, scientific plot and project state; output disabled.","pluginType":"workbench","requiresCore":["status","events","workspace","project","state","modules","io","data.model","data.sources","data.artifacts","ui.workspace","ui.unit-templates","ui.scientific-plot","ui.table","ui.activities","ui.top-workspace","ui.pages"],"capabilities":["ui.page","ui.top-workspace","ui.plugin-workspace","ui.scientific-plot","data.scoped-sources","project.slice"],"platformPresentation":{"desktop":{"mode":"shared"},"mobile":{"mode":"adaptive"}},"workspace":{"role":"top","activity":"dkts-keithley-4200","icon":"▦","title":"4200A 测试","defaultSuper":true},"window":{"activity":"dkts-keithley-4200","title":"DK Test Studio 4200A","width":1380,"height":860,"minWidth":820,"minHeight":560,"dependencies":["scientific-renderer"],"prewarm":false,"reuse":true,"persistence":"project","artifactHydration":"live"},"data":{"accepts":["science.transport.iv","data.table"]},"styles":["ui-shell.css"]};
 DKDSPlugins.define(manifest,async ctx=>{
  const model=ctx.modules.require('model'),measurementData=ctx.modules.require('measurementData'),units=ctx.ui.unitTemplates,uiShell=ctx.modules.require('uiShell');
  if(typeof measurementData?.publishRaw!=='function')throw Error('KXCI Data Center publisher missing');
  const ACTIVITY='dkts-keithley-4200',PAGE='dktsKeithley4200Page';
  const store=ctx.state.create(model.initial(),{projectSlice:'settings'});
  let wb=null,plot=null,plotView=null,plots=[],plotViews=[],frameCards=[],frameSelections=['','','',''],frameKinds=['iv','transfer','it','raw'],frameGroup=null,frameTableHosts=[],framePlotHosts=[],frameTables=[],frameLayout='4',nav=null,parameters=null,dataNote=null,pad=null,portPopover=null,editorTabs=null,editorHeading=null,pageInfoRegion=null;
  let editorSection='sweep',editorOpen=false,workRegion=null,editorRegion=null,plotRegion=null,projectSurface=null;
  const PAGE_TABS=[['sweep','扫描 Sweep'],['target','目标 Target'],['strategy','策略 Strategy']];
  const FRAME_OPTIONS=[{value:'iv',label:'I–V'},{value:'transfer',label:'转移特性'},{value:'it',label:'I–t'},{value:'raw',label:'数据表'}];
  const TEST_TYPE_LABELS=Object.freeze({DC:'直流',Pulse:'脉冲',Cycle:'循环',Time:'时间',IVT:'I–V–t',CV:'C–V'});
  const testTypeLabel=value=>TEST_TYPE_LABELS[value]||String(value||'');
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
  function scalarField(host,label,value,commit,disabled=false,attributes={}){
   const original=String(value??'').trim();
   return units.field.create(host,{kind:'input',label,value,attributes,
    inputMode:touchNumeric?'none':'decimal',disabled,
    onFocus:event=>openNumericPad(event.target,label,commit),
    onBlur:event=>{
     if(!touchNumeric&&String(event.target.value??'').trim()!==original)
      commit(event.target.value);
    }
   });
  }
  function numericField(host,logical,key,label,value,disabled=false){
   return scalarField(host,label,value,v=>change(logical,key,v),disabled,
    {'aria-label':logical+' '+label});
  }
  const axisRanges=Object.freeze({
   voltage:['1e-12','1e-11','1e-10','1e-9','1e-8','1e-7','1e-6',
     '1e-5','1e-4','1e-3','1e-2','1e-1','1e0'],
   current:['0.2','2','20','200']
  });
  function renderSweep(parameters,p){
   const sw=p.sweep,preview=model.summary(p);
   const config=units.panel.create(parameters,{variant:'headed',
    title:'扫描概览',meta:'',
    sizing:'content',className:'dkts-sweep-structure'});
   units.summary.create(config.body,{variant:'strip',className:'dkts-sweep-metrics',items:[
    {text:'X '+(preview.ready?preview.xPoints:'—')+' 点'},
    {text:'P '+(preview.ready?(sw.pEnabled?preview.pPoints+' 点':'未启用'):'—')},
    {text:'循环 '+sw.loops+' 次'},
    {text:'总计 '+(preview.ready?preview.total:'—')+' 点'}
   ]});
   if(!preview.ready)units.note.create(config.body,{variant:'warning',
    className:'dkts-sweep-summary',text:preview.reason});
   renderTerminalSettings(parameters,p);
   for(const axis of ['X','P']){
    if(axis==='P'&&!sw.pEnabled)continue;
    const t=p.terminals.find(t=>t.role===axis)||
      p.terminals.find(t=>t.logical===(axis==='X'?'D':'G'));
    if(!t)continue;
    const segments=axis==='X'?sw.xSegments:sw.pSegments;
    const panel=units.panel.create(parameters,{variant:'headed',
     title:axis+'sweep',meta:'',sizing:'content',
     className:'dkts-sweep-axis',actions:[{id:'add-segment-'+axis,
      label:'＋ 添加扫描段',variant:'quiet',
      onInvoke:()=>commitTransaction(()=>model.addSegment(state(),axis))}]});
    const list=units.layout.create(panel.body,{variant:'stack-compact',
     className:'dkts-sweep-segments'});
    const unit=t.sourceMode==='current'?'A':'V';
    const rangeOptions=[{value:'auto',label:'自动'},
     ...axisRanges[t.sourceMode].map(value=>({value,label:value}))];
    const header=units.layout.create(list,{variant:'identity',
     className:'dkts-sweep-segment-head'});
    for(const label of ['起始 ('+unit+')','结束 ('+unit+')','步长 ('+unit+')',
      t.sourceMode==='current'?'电压档位 (V)':'电流档位 (A)','点间延迟 (ms)','操作'])
     units.layout.create(header,{variant:'identity',content:label});
    for(const [index,seg] of segments.entries()){
     const options=rangeOptions.map(row=>({...row}));
     if(seg.range!=='auto'&&!options.some(row=>row.value===seg.range))
      options.push({value:seg.range,label:seg.range});
     const row=units.layout.create(list,{variant:'identity',
      className:'dkts-sweep-segment',
      geometry:{display:'grid',gridTemplateColumns:
       'repeat(6,minmax(80px,1fr))',gap:'6px'},
      responsiveGeometry:[
       {maxWidth:620,geometry:{gridTemplateColumns:'repeat(2,minmax(128px,1fr))'}},
       {maxWidth:310,geometry:{gridTemplateColumns:'minmax(0,1fr)'}}
      ]});
     row?.setAttribute?.('data-dkts-segment',String(index+1));
     const numeric=(label,value,commit)=>units.field.create(row,{kind:'input',
      label,value,inputMode:touchNumeric?'none':'decimal',className:'dkts-sweep-field',
      onFocus:event=>openNumericPad(event.target,label,commit),
      onBlur:event=>{
       if(!touchNumeric&&String(event.target.value??'').trim()!==String(value??'').trim())
        commit(event.target.value);
      },
      attributes:{'aria-label':axis+' '+label+' 第 '+(index+1)+' 段'}});
     numeric('起始 ('+unit+')',seg.start,v=>changeSegment(axis,index,'start',v));
     numeric('结束 ('+unit+')',seg.stop,v=>changeSegment(axis,index,'stop',v));
     numeric('步长 ('+unit+')',seg.step,v=>changeSegment(axis,index,'step',v));
     units.field.create(row,{kind:'select',label:t.sourceMode==='current'?
      '电压档位 (V)':'电流档位 (A)',value:seg.range,options,
      className:'dkts-sweep-field',attributes:{'aria-label':axis+' 测量档位 第 '+(index+1)+' 段'},
      onChange:e=>changeSegment(axis,index,'range',e.target.value)});
     numeric('点间延迟 (ms)',seg.delayMs,v=>changeSegment(axis,index,'delayMs',v));
     units.action.create(row,{id:'remove-'+axis+'-'+index,label:'×',
      title:'删除此扫描段',variant:'quiet',enabled:segments.length>1,
      onInvoke:()=>commitTransaction(()=>model.removeSegment(state(),axis,index))});
     if(index<segments.length-1)units.divider.create(list,{variant:'horizontal'});
    }
   }
  }
  function renderTerminalSettings(host,p){
   const visible=model.visible(p);
   const panel=units.panel.create(host,{variant:'headed',title:'端口设置',
    meta:'',sizing:'content',className:'dkts-terminal-settings'});
   if(!visible.length){
    units.emptyState.create(panel.body,{message:'尚未分配测量端口。请先在页面标题栏配置 SMU。'});
    return;
   }
   const roleOptions=[
    {value:'CONDITION',label:'固定偏置'},
    {value:'X',label:'Xsweep'},
    {value:'P',label:'Psweep'}
   ];
   for(const term of visible){
    const row=units.layout.create(panel.body,{variant:'form-grid-4',
     className:'dkts-terminal-setting'});
    row?.setAttribute?.('data-dkts-terminal-setting',term.logical);
    units.note.create(row,{variant:'meta',text:term.logical+' · '+term.resource});
    units.field.create(row,{kind:'select',label:'端口用途',value:term.role,
     attributes:{'aria-label':term.logical+' 端口用途'},
     options:roleOptions,onChange:e=>change(term.logical,'role',e.target.value)});
    units.field.create(row,{kind:'select',label:'源输出模式',value:term.sourceMode,
     options:[{value:'voltage',label:'电压源'},{value:'current',label:'电流源'}],
     onChange:e=>change(term.logical,'sourceMode',e.target.value)});
    if(term.role==='CONDITION'){
     numericField(row,term.logical,'bias','固定偏置',term.bias);
    }else{
     units.note.create(row,{variant:'meta',text:term.role==='X'?'扫描段参数见下方 Xsweep':
      p.sweep.pEnabled?'扫描段参数见下方 Psweep':'已分配 Psweep，需在策略中启用'});
    }
   }
  }
  function renderLimitsPanel(host,p){
   const visible=model.visible(p);
   const panel=units.panel.create(host,{variant:'headed',title:'限值',
    meta:'',sizing:'content',className:'dkts-limits-panel'});
   if(!visible.length){
    units.emptyState.create(panel.body,{message:'先在页面标题栏为端口分配 SMU。'});
    return;
   }
   for(const [index,term] of visible.entries()){
    const section=units.layout.create(panel.body,{variant:'stack-compact',
     className:'dkts-limit-terminal'});
    units.note.create(section,{variant:'meta',text:term.logical+' · '+term.resource});
    const row=units.layout.create(section,{variant:'form-grid-2',
     className:'dkts-limit-row'});
    units.field.create(row,{kind:'select',label:'档位模式',value:term.rangeMode,
     options:[{value:'auto',label:'自动'},
      ...(term.sourceMode==='voltage'?[{value:'minimum',label:'自动下限'}]:[]),
      {value:'fixed',label:'固定档位'}],
     onChange:e=>change(term.logical,'rangeMode',e.target.value)});
    numericField(row,term.logical,'rangeValue',
     term.sourceMode==='voltage'?'电流测量档位 (A)':'电压测量档位 (V)',
     term.rangeValue,term.rangeMode==='auto');
    numericField(row,term.logical,'compliance',
     term.sourceMode==='voltage'?'限流 (A)':'限压 (V)',term.compliance);
    if(index<visible.length-1)units.divider.create(panel.body,{variant:'horizontal'});
   }
  }
  function renderVariablesPanel(host,p){
   const panel=units.panel.create(host,{variant:'headed',title:'页面变量',
    meta:'',sizing:'content',
    className:'dkts-variables-panel',
    actions:[{id:'add-var',label:'＋',title:'新增页面变量',variant:'quiet',
     onInvoke:()=>commitTransaction(()=>model.addVariable(state()))}]});
   if(!p.variables.length){
    units.emptyState.create(panel.body,{message:'尚未定义页面变量。'});
    return;
   }
   for(const [index,variable] of p.variables.entries()){
    const row=units.layout.create(panel.body,{variant:'form-grid-2',
     className:'dkts-page-var-row'});
    units.field.create(row,{kind:'input',label:'名称',value:variable.name,
     onBlur:e=>commitTransaction(()=>model.editVariable(state(),index,{name:e.target.value}))});
    scalarField(row,'数值',variable.value,v=>commitTransaction(
     ()=>model.editVariable(state(),index,{value:v})));
    units.field.create(row,{kind:'input',label:'单位',value:variable.unit,
     onBlur:e=>{
      if(e.target.value!==variable.unit)commitTransaction(
       ()=>model.editVariable(state(),index,{unit:e.target.value}));
     }});
    units.action.create(row,{id:'remove-var-'+index,label:'删除',title:'删除变量',
     variant:'quiet',onInvoke:()=>commitTransaction(()=>model.removeVariable(state(),index))});
   }
  }
  function renderAssociateSpecPanel(host,p,s){
   const available=s.specs.filter(x=>x.deviceId===s.activeDeviceId);
   const panel=units.panel.create(host,{variant:'headed',title:'关联规格',
    meta:'',sizing:'content',
    className:'dkts-spec-panel',
    actions:[{id:'add-spec-inline',label:'＋',title:'新建并关联规格',variant:'quiet',
     onInvoke:()=>commitTransaction(()=>model.addSpec(state()))}]});
   units.field.create(panel.body,{kind:'select',label:'器件规格',
    value:p.associateSpecId||'',options:[{value:'',label:'不关联'},
     ...available.map(x=>({value:x.id,label:x.name}))],
    onChange:e=>commitTransaction(()=>model.associateSpec(state(),e.target.value||null))});
   if(!available.length)units.note.create(panel.body,{variant:'meta',
    text:'当前器件尚无规格，可使用标题栏的＋新建。'});
  }
  function renderSweepTriptych(host,p,s){
   // Two-column information architecture: Limits gets the full left column;
   // the lower-frequency Page Var and Associate Spec tools share the right.
   // DKDS owns the 680px responsive collapse; no plugin-defined grid geometry.
   const related=units.layout.create(host,{variant:'two-card-grid',
    className:'dkts-sweep-related'});
   const limitsColumn=units.layout.create(related,{variant:'stack-compact',
    className:'dkts-limits-column'});
   const metadataColumn=units.layout.create(related,{variant:'stack-compact',
    className:'dkts-sweep-metadata-column'});
   renderLimitsPanel(limitsColumn,p);
   renderVariablesPanel(metadataColumn,p);
   renderAssociateSpecPanel(metadataColumn,p,s);
  }
  function renderPageInfo(host,p){
   // Page name is editable here; test type is already shown in the titlebar
   // meta and is intentionally not repeated as a disabled field.
   const panel=units.panel.create(host,{variant:'headed',title:'页面信息',
    meta:'',sizing:'content',className:'dkts-page-info'});
   const row=units.layout.create(panel.body,{variant:'form-grid-2'});
   units.field.create(row,{kind:'input',label:'页面名称',value:p.name,
    onBlur:e=>{if(e.target.value!==p.name)commitTransaction(
     ()=>model.editPage(state(),{name:e.target.value}));}});
   units.field.create(row,{kind:'input',label:'备注',value:p.note||'',
    placeholder:'可选备注',
    onBlur:e=>{if(e.target.value!==(p.note||''))commitTransaction(
     ()=>model.editPage(state(),{note:e.target.value}));}});
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
   frameGroup?.setColumns?.(frameLayout==='1'?1:'auto');
   for(let i=0;i<frameCards.length;i++)if(frameCards[i]?.style)
    frameCards[i].style.display=frameLayout==='1'&&i>0||frameLayout==='2'&&i>1?'none':'';
  }
    function updateEditorLayout(){
   // Replace the Core workspace's active content node, never just its width.
   // DKDS may restore a Unit-owned display style after layout/resize; relying
   // on display:none left both Page and PlotGroup visible in real Electron.
   applyFrameLayout();
   if(workRegion&&editorRegion&&plotRegion){
    const next=editorOpen?editorRegion:plotRegion;
    if(workRegion.firstElementChild!==next||
       workRegion.children?.length!==1)workRegion.replaceChildren(next);
   }
  }
  function render(){
   if(!nav||!parameters)return;
   updateEditorLayout();
   const s=state(),p=active();
   syncGraphSettings();applyFrameLayout();
   nav.replaceChildren();
   // Real DKDS Core Units own the Device/Routine/Page/Spec project tree.
   const device=s.devices.find(d=>d.id===s.activeDeviceId);
   const visibleSpecs=s.specs.filter(spec=>spec.deviceId===s.activeDeviceId);
   const projectHeader=units.header.create(nav,{kind:'panel',variant:'content',
    eyebrow:'工程',title:'项目',meta:'',actionHost:true});
   units.action.create(projectHeader.actions,{id:'add-project-node',label:'＋',
    title:'新建器件、流程或规格',menu:true,variant:'quiet',items:()=>[
     {id:'add-device',label:'新建器件',
      onInvoke:()=>{projectSurface?.close();editorOpen=false;persist(model.addDevice(state()));}},
     {id:'add-routine',label:'新建流程',
      onInvoke:()=>{projectSurface?.close();editorOpen=false;persist(model.addRoutine(state()));}},
     {id:'add-spec',label:'新建规格',
      onInvoke:()=>{projectSurface?.close();editorOpen=true;editorSection='sweep';persist(model.addSpec(state()));}},
     ...(state().pages.length>1?[{id:'close-page',label:'关闭当前页面',
      onInvoke:()=>persist(model.remove(state(),active().id))}]:[])
    ]});
   // Project overview is the graph home; this header is also keyboard accessible.
   if(projectHeader?.title?.addEventListener){
    const home=()=>{projectSurface?.close();editorOpen=false;render();};
    projectHeader.title.tabIndex=0;
    projectHeader.title.setAttribute?.('role','button');
    projectHeader.title.style.cursor='pointer';
    projectHeader.title.addEventListener('click',home);
    projectHeader.title.addEventListener('keydown',event=>{
     if(event.key==='Enter'||event.key===' '){event.preventDefault();home();}
    });
   }
   units.field.create(nav,{kind:'select',label:'器件',value:s.activeDeviceId,
    options:s.devices.map(item=>({value:item.id,label:item.name})),
    onChange:e=>{projectSurface?.close();editorOpen=false;persist(model.selectDevice(state(),e.target.value));}});
   const treeHost=units.layout.create(nav,{variant:'stack-compact',className:'dkts-project-tree'});
   for(const routine of s.routines.filter(r=>r.deviceId===s.activeDeviceId)){
    const routinePages=s.pages.filter(page=>page.routineId===routine.id);
    const routineHost=units.layout.create(treeHost,{variant:'stack-compact'});
    units.list.create(routineHost,{variant:'compact'}).item({leading:'▦',title:routine.name,
     meta:routinePages.length+' 个页面',selected:routine.id===s.activeRoutineId,
     onInvoke:()=>{projectSurface?.close();editorOpen=false;persist(model.selectRoutine(state(),routine.id));}});
    for(const page of routinePages){
     const pageHost=units.layout.create(routineHost,{variant:'identity'});
     if(pageHost?.style)pageHost.style.paddingLeft='15px';
     units.list.create(pageHost,{variant:'compact'}).item({leading:'▧',title:page.name,
      meta:testTypeLabel(page.testType),selected:page.id===s.activeId,
      onInvoke:()=>{projectSurface?.close();editorOpen=true;persist(model.select(state(),page.id));}});
    }
   }
   if(visibleSpecs.length){
    units.header.create(nav,{kind:'section',variant:'section',title:'关联规格',
     meta:String(visibleSpecs.length)});
    const specs=units.list.create(nav,{variant:'compact'});
    for(const spec of visibleSpecs)
     specs.item({leading:'◇',title:spec.name,
      selected:spec.id===p.associateSpecId,
      onInvoke:()=>{projectSurface?.close();editorOpen=true;editorSection='sweep';persist(model.associateSpec(state(),spec.id));}});
   }
   // Test Library is always visible in the Project Explorer. Selecting a type
   // creates a Page directly, without the old select-then-plus two-step flow.
   const testHeader=units.header.create(nav,{kind:'section',variant:'section',
    title:'测试类型',meta:'',actionHost:true});
   units.action.create(testHeader.actions,{id:'add-test-page',label:'＋ 页面',
    title:'选择测试类型并新增页面',menu:true,variant:'quiet',
    items:()=>model.KINDS.map(kind=>({id:'add-test-'+kind.id,
     label:kind.label,onInvoke:()=>{
      projectSurface?.close();editorOpen=true;persist(model.add(state(),kind.id));
     }}))});
   editorHeading.replaceChildren();
   const routine=s.routines.find(item=>item.id===p.routineId);
   const title=units.header.create(editorHeading,{
    kind:'panel',variant:'content',eyebrow:'编辑页面',title:p.name,
    titleEmphasis:'prominent',subtitle:(device?.name||'器件')+' / '+(routine?.name||'测试流程'),
    meta:testTypeLabel(p.testType),metaPlacement:'trailing'
   });
   const navEditor=units.action.create(title.actions,{id:'dkts-project-toggle-editor',
    label:'导航',title:'打开或收起工程导航',variant:'quiet',
    onInvoke:()=>projectSurface?.toggle()});
   navEditor?.element?.setAttribute?.('data-dkts-nav-toggle','true');
   units.action.create(title.actions,{id:'back-to-graphs',label:'← 返回绘图区',
    title:'返回工程图表工作区',variant:'quiet',
    onInvoke:()=>{editorOpen=false;render();}});
   const terminalGroup=units.layout.create(title.actions,{variant:'row',
    className:'dkts-terminal-control-group'});
   const terminalToolbar=units.layout.create(terminalGroup,{variant:'row',
    className:'dkts-terminal-toolbar'});
   terminalToolbar?.setAttribute?.('data-dkts-port-desktop','true');
   const terminalNames={S:'源极',D:'漏极',G:'栅极',B:'衬底'};
   const portOptions=['None','SMU1','SMU2','SMU3','SMU4','SMU5','SMU6',
    'SMU7','SMU8'].map(value=>({value,label:value}));
   for(const logical of ['S','D','G','B']){
    const term=p.terminals.find(item=>item.logical===logical);
    units.field.create(terminalToolbar,{kind:'select',label:logical+' 端口',
     controlOnly:true,controlClassName:'dkts-terminal-field',value:term.resource,
     attributes:{'aria-label':terminalNames[logical]+' ('+logical+') 端口',
      title:terminalNames[logical]+' ('+logical+')'},
     options:portOptions.map(option=>({...option,label:logical+' · '+option.label})),
     onChange:e=>change(logical,'resource',e.target.value)});
   }
   const terminalDivider=units.divider.create(terminalGroup,{variant:'vertical'});
   terminalDivider?.setAttribute?.('data-dkts-terminal-divider','true');
   let mobilePortAction=null;
   function openPortPopover(anchor){
    portPopover?.close?.();
    let draft=model.validate(state());
    const pop=units.popover.create(null,{variant:'picker',title:'端口映射',
     role:'dialog',ariaLabel:'源极、漏极、栅极和衬底端口映射',anchor,
     placement:'bottom-start',dismissOnOutside:true,offset:4,
     onClose:()=>{if(portPopover===pop)portPopover=null;}});
    portPopover=pop;
    const form=units.layout.create(pop.body,{variant:'form-grid-2',
     className:'dkts-mobile-port-grid'});
    const draftPage=draft.pages.find(item=>item.id===draft.activeId);
    for(const logical of ['S','D','G','B']){
     const term=draftPage.terminals.find(item=>item.logical===logical);
     units.field.create(form,{kind:'select',label:terminalNames[logical]+' ('+logical+')',
      value:term.resource,options:portOptions,
      attributes:{'aria-label':terminalNames[logical]+' ('+logical+') 端口'},
      onChange:e=>{
       try{draft=model.edit(draft,logical,{resource:e.target.value});}
       catch(error){e.target.value=term.resource;ctx.status.set('端口映射无效：'+String(error.message||error));}
      }});
    }
    units.note.create(pop.body,{variant:'meta',text:'修改后点击“应用”保存当前页面的端口映射。'});
    const actions=units.layout.create(pop.body,{variant:'row-wrap'});
    units.action.create(actions,{id:'apply-port-map',label:'应用',variant:'primary',
     onInvoke:()=>{
      try{
       const next=model.validate(draft),opened=portPopover;
       portPopover=null;opened?.close?.();persist(next);
      }catch(error){ctx.status.set('端口映射无效：'+String(error.message||error));}
     }});
    units.action.create(actions,{id:'cancel-port-map',label:'取消',variant:'quiet',
     onInvoke:()=>{pop.close();if(portPopover===pop)portPopover=null;}});
    return pop;
   }
   mobilePortAction=units.action.create(terminalGroup,{id:'mobile-port-map',
    label:'端口',title:'配置源极、漏极、栅极和衬底端口',variant:'secondary',
    onInvoke:()=>openPortPopover(mobilePortAction?.element)});
   mobilePortAction?.element?.setAttribute?.('data-dkts-port-mobile','true');
   pageInfoRegion.replaceChildren();
   renderPageInfo(pageInfoRegion,p);
   if(!PAGE_TABS.some(([id])=>id===editorSection))editorSection='sweep';
   editorTabs.replaceChildren();
   units.tabs.create(editorTabs,{variant:'compact',value:editorSection,
    items:PAGE_TABS.map(([id,label])=>({id,label,selected:id===editorSection})),
    onChange:value=>{
     const id=String(typeof value==='object'?value?.id||value?.value||'':value);
     if(PAGE_TABS.some(row=>row[0]===id)){editorSection=id;render();}
    }});
   parameters.replaceChildren();
   if(editorSection==='sweep'){
    if(['iv','transfer','output'].includes(p.kind))renderSweep(parameters,p);
    else units.note.create(parameters,{variant:'meta',
     text:'当前测试类型暂提供页面配置与数据展示；仪器输出保持禁用。'});
    renderSweepTriptych(parameters,p,s);
   }else if(editorSection==='target'){
    const assigned=model.visible(p);
    const panel=units.panel.create(parameters,{variant:'headed',title:'测量目标',
     meta:'仅使用已分配的物理端口',sizing:'content'});
    const grid=units.layout.create(panel.body,{variant:'form-grid-2'});
    const targetAssigned=assigned.some(t=>t.logical===p.target.logical);
    const targetOptions=assigned.length?assigned.map(t=>({value:t.logical,
     label:t.logical+' / '+t.resource})):[{value:'',label:'无可用端口'}];
    if(assigned.length&&!targetAssigned)
     targetOptions.unshift({value:'',label:'请选择已分配端口'});
    units.field.create(grid,{kind:'select',label:'测量端口',
     value:targetAssigned?p.target.logical:'',options:targetOptions,
     disabled:assigned.length===0,
     onChange:e=>{if(e.target.value)commitTransaction(
      ()=>model.editTarget(state(),{logical:e.target.value}));}});
    units.field.create(grid,{kind:'select',label:'测量量',value:p.target.quantity,
     options:[{value:'Current',label:'电流 (A)'},{value:'Voltage',label:'电压 (V)'}],
     onChange:e=>commitTransaction(()=>model.editTarget(state(),{quantity:e.target.value}))});
   }else if(editorSection==='strategy'){
    const panel=units.panel.create(parameters,{variant:'headed',title:'扫描策略',
     meta:'循环与扫描执行顺序',sizing:'content'});
    const grid=units.layout.create(panel.body,{variant:'form-grid-4'});
    for(const [label,key] of [['整体循环','loops'],['Xsweep 重复次数','xRepeats'],
      ['Psweep 重复次数','pRepeats']])
     scalarField(grid,label,p.sweep[key],v=>changeSweep(key,v),
      key==='pRepeats'&&!p.sweep.pEnabled);
    units.field.create(grid,{kind:'select',label:'Psweep 扫描',value:String(p.sweep.pEnabled),
     options:[{value:'false',label:'关闭'},{value:'true',label:'启用'}],
     onChange:e=>changeSweep('pEnabled',e.target.value==='true')});
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
  const main=units.layout.create(null,{variant:'sidebar-main-compact',className:'dkts-main-grid',
   geometry:{gap:'8px',minWidth:'0',minHeight:'0'},
   responsiveGeometry:[{maxWidth:900,geometry:{gridTemplateColumns:'minmax(0,1fr)',gap:'0px'}}]});
  const projectPanel=units.panel.create(main,{variant:'control-card',
   header:false,sizing:'fill',className:'dkts-project-panel'});
  nav=units.layout.create(projectPanel.body,{variant:'stack-compact',
   className:'dkts-project-navigation'});
  // DKDS owns the drawer surface paint, not plugin CSS.
  projectSurface=uiShell.attach(units,main,projectPanel.element);
  // DKDS Core workbench owns both the independent result graph and Page inspector.
  // One semantic Core content stack. Selecting a Page replaces the graph
  // surface with a full-width parameter editor; it is not a sibling column.
  const work=units.layout.create(main,{variant:'stack-compact',className:'dkts-work-region'});
  work?.setAttribute?.('data-dkts-work','true');
  const editor=units.layout.create(work,{variant:'stack-compact',className:'dkts-page-editor'});
  editor?.setAttribute?.('data-dkts-editor','true');
  editorHeading=units.layout.create(editor,{variant:'identity',className:'dkts-page-heading'});
  pageInfoRegion=units.layout.create(editor,{variant:'identity',className:'dkts-page-info-region'});
  editorTabs=units.layout.create(editor,{variant:'identity',className:'dkts-editor-tabs'});
  parameters=units.layout.create(editor,{variant:'stack-compact',
   className:'dkts-parameter-content'});
  const plotArea=units.layout.create(work,{variant:'stack-comfortable',
   className:'dkts-project-plot-area',geometry:{display:'flex',flexDirection:'column',
    minWidth:'0',minHeight:'0',flex:'1 1 auto',overflow:'hidden',gap:'8px'}});
  // DKTS-owned markers let Electron validate real frames independently of
  // internal DKDS Unit attribute naming or temporary detached Page views.
  plotArea?.setAttribute?.('data-dkts-view','graph');
  workRegion=work;editorRegion=editor;plotRegion=plotArea;
  // Four independent DKDS PlotView subwindows, each with its own host controls.
  // Never synthesize measurement samples in an offline UI.
  const plotsHeading=units.header.create(plotArea,{kind:'panel',
   variant:'content',eyebrow:'项目',title:'工程绘图区',
   meta:'4 个独立图窗',
   metaPlacement:'trailing',actionHost:true});
  const frameTools=units.layout.create(plotsHeading.actions,{variant:'row-wrap',
   className:'dkts-plot-toolbar'});
  const navGraph=units.action.create(plotsHeading.actions,{id:'dkts-project-toggle-graph',
   label:'导航',title:'打开或收起工程导航',variant:'quiet',
   onInvoke:()=>projectSurface?.toggle()});
  navGraph?.element?.setAttribute?.('data-dkts-nav-toggle','true');
  syncGraphSettings();
  units.field.create(frameTools,{kind:'select',label:'图窗布局',controlOnly:true,
    attributes:{'aria-label':'图窗布局','title':'图窗布局'},value:frameLayout,
   options:[{value:'1',label:'单窗口'},{value:'2',label:'双窗口'},
    {value:'4',label:'四宫格'}],
   onChange:e=>saveGraphSetting(-1,'count',e.target.value)});
  const groupHost=units.layout.create(plotArea,{variant:'identity',
   className:'dkts-project-plot-group'});
  groupHost?.setAttribute?.('data-dkts-plot-group','four-independent-frames');
  frameGroup=units.plotGroup.create(groupHost,{columns:2,preferredColumns:2,
   maxColumns:4,minItemWidth:342,responsive:true,density:'compact',
   orientationPolicy:{mode:'portrait-offset',offset:-1,minColumns:1}});
  const frameTitles=['图窗 1','图窗 2','图窗 3','图窗 4'];
    for(let index=0;index<4;index++){
   const graphic=units.panel.detached({variant:'plot-card',
    header:false,sizing:'fill'});
   frameCards.push(graphic.element);
   graphic.element?.setAttribute?.('data-dkts-plot-frame',String(index+1));
   const graphicHeader=units.header.create(graphic.body,{kind:'plot',
    variant:'plot',title:frameTitles[index],actionHost:true});
   graphicHeader.element?.setAttribute?.('data-dkts-plot-header',String(index+1));
   const frameActions=units.layout.create(graphicHeader.actions,{
    variant:'row',className:'dkts-frame-actions'});
   units.action.create(frameActions,{
    id:'dkts-frame-kind-'+(index+1),label:'显示',
    title:'切换图窗 '+(index+1)+' 的图形类型',
    menu:true,variant:'quiet',items:()=>FRAME_OPTIONS.map(kind=>({
     id:'kind-'+kind.value,
     label:(frameKinds[index]===kind.value?'✓ ':'')+kind.label,
     onInvoke:()=>saveGraphSetting(index,'kind',kind.value)
    }))
   });
   units.action.create(frameActions,{
    id:'dkts-frame-data-'+(index+1),
    label:'数据',title:'选择数据中心数据源或导出原始 CSV',
    menu:true,variant:'quiet',items:()=>frameDataMenu(index)
   });
   const plotHost=units.layout.create(graphic.body,{variant:'plot-card-fill'});
   plotHost?.setAttribute?.('data-dkts-plot-host','true');
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
    detailGeometry:{contentAspectRatio:2.25,contentMinHeightPx:132,contentMaxHeightPx:220},
    placements:['home','left','right','bottom','float','global'],stateVersion:'dkts-native-v5'});
   // Recreate only the scientific surface when this window changes axes.
   const instance=createFramePlot(index);
   plotViews.push(view);
   if(index===0){plotView=view;plot=instance;}
  }
  applyFrameLayout();
  refreshRawTables();
  // FS-Pro Page editing keeps terminal assignment in one visible strip.
  // A duplicate dockable PRIME caused the same four ports to appear twice.
  wb.compose({primary:{id:'main',label:'测试工程',
   presentationRole:'scientific-primary',scroll:'safe',
   titlePolicy:'host-only',mainNode:main},primes:[],subs:[]});
  ctx.ui.topWorkspace.register({id:ACTIVITY,activity:ACTIVITY,
   label:'4200A',icon:'▦',layout:{mode:'native',
    root:{selector:'#'+PAGE+' .dkds-plugin-workspace'},
    primary:{id:'main',role:'analysis-primary',
     presentationRole:'scientific-primary',priority:100,collapsible:false},
    prime:[],sub:[]}});
  const off=ctx.events?.on?.('data:artifacts-changed',refreshData);
  window.addEventListener?.('resize',updateEditorLayout);
  render();refreshData();
  ctx.status.set('4200A 工作区已加载；原生输出禁用');
  return {deactivate(){projectSurface?.dispose();window.removeEventListener?.('resize',updateEditorLayout);
   pad?.close?.();portPopover?.close?.();off?.();for(const item of plots)item?.dispose?.();
   for(const item of plotViews)item?.dispose?.();
   for(const item of frameTables)item?.dispose?.();frameGroup?.dispose?.();wb?.dispose?.();}};
 });
})();