(() => {
 'use strict';
 const manifest={"id":"com.dkts.keithley-4200","name":"DK Test Studio - Keithley 4200A","version":"0.8.1","apiVersion":"1.19.0","entry":"plugin.js","scripts":["model.js","plugin.js"],"enabled":true,"order":82,"description":"Native DKDS TOP workbench: host-owned theme, data, scientific plot and project state; output disabled.","pluginType":"workbench","requiresCore":["status","events","workspace","project","state","modules","data.sources","data.artifacts","ui.workspace","ui.unit-templates","ui.scientific-plot","ui.activities","ui.top-workspace","ui.pages"],"capabilities":["ui.page","ui.top-workspace","ui.plugin-workspace","ui.scientific-plot","data.scoped-sources","project.slice"],"platformPresentation":{"desktop":{"mode":"shared"},"mobile":{"mode":"adaptive"}},"workspace":{"role":"top","activity":"dkts-keithley-4200","icon":"▦","title":"4200A 测试","defaultSuper":true},"window":{"activity":"dkts-keithley-4200","title":"DK Test Studio 4200A","width":1380,"height":860,"minWidth":820,"minHeight":560,"dependencies":["scientific-renderer"],"prewarm":false,"reuse":true,"persistence":"project","artifactHydration":"live"},"data":{"accepts":["science.transport.iv","data.table"]}};
 DKDSPlugins.define(manifest,async ctx=>{
  const model=ctx.modules.require('model'),units=ctx.ui.unitTemplates;
  const ACTIVITY='dkts-keithley-4200',PAGE='dktsKeithley4200Page';
  const store=ctx.state.create(model.initial(),{projectSlice:'settings'});
  let wb=null,plot=null,plotView=null,nav=null,parameters=null,portFields=null,dataNote=null,kindField=null,pad=null,inlineTerminals=null,editorTabs=null,editorHeading=null;
  let editorSection='sweep';
  const PAGE_TABS=[['info','Info'],['sweep','Sweep'],['target','Target'],['strategy','Strategy'],['limits','Limits'],['variables','Page Var'],['spec','Associate Spec']];
  const touchNumeric=Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);
  const state=()=>model.validate(store.get());
  const active=()=>{const s=state();return s.pages.find(x=>x.id===s.activeId);};
  const persist=value=>{store.patch(model.validate(value));ctx.project.capture?.();render();};
  const sources=()=>{const rows=ctx.data.sources.list();return Array.isArray(rows)?rows:[];};
  // Core's plugin-scoped sources facade enforces Data Center assignments.
  // Revision-aware caching prevents full column clones on plot repaints.
  let plotCacheKey='',plotCache=[];
  function curves(){
   const rows=sources();
   const key=JSON.stringify(rows.map(row=>[row.artifactId,row.name,
     ctx.data.artifacts.artifactRevision?.(row.artifactId)||0]));
   if(key===plotCacheKey)return plotCache;
   plotCacheKey=key;
   plotCache=model.curvesFromArtifacts(rows,ctx.data.artifacts);
   return plotCache;
  }
  function refreshData(){
   plotCacheKey='';
   const items=sources();
   if(dataNote)dataNote.textContent='数据中心：'+items.length+' 组';
   plot?.requestRender?.('data-artifacts');
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
     const rangeOptions=[{value:'auto',label:'Auto'},
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
  function render(){
   if(!nav||!parameters)return;
   const s=state(),p=active();
   const selectedKind=kindField?.control?.value||'iv';
   nav.replaceChildren();
   // Real DKDS Core Units own the Device/Routine/Page/Spec project tree.
   const device=s.devices.find(d=>d.id===s.activeDeviceId);
   const visibleSpecs=s.specs.filter(spec=>spec.deviceId===s.activeDeviceId);
   units.header.create(nav,{kind:'panel',variant:'content',
    eyebrow:'PROJECT',title:'Research Project',meta:'Device / '+device.name});
   units.field.create(nav,{kind:'select',label:'Device',value:s.activeDeviceId,
    options:s.devices.map(item=>({value:item.id,label:item.name})),
    onChange:e=>persist(model.selectDevice(state(),e.target.value))});
   const tree=units.list.create(nav,{});
   for(const routine of s.routines.filter(r=>r.deviceId===s.activeDeviceId)){
    tree.item({leading:'▦',title:routine.name,
     selected:routine.id===s.activeRoutineId,
     onInvoke:()=>persist(model.selectRoutine(state(),routine.id))});
    for(const page of s.pages.filter(page=>page.routineId===routine.id))
     tree.item({leading:'└ ▧',title:page.name,
      selected:page.id===s.activeId,
      onInvoke:()=>persist(model.select(state(),page.id))});
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
   units.action.create(actions,{id:'add-device',label:'＋ Device',
    variant:'quiet',onInvoke:()=>persist(model.addDevice(state()))});
   units.action.create(actions,{id:'add-routine',label:'＋ Routine',
    variant:'quiet',onInvoke:()=>persist(model.addRoutine(state()))});
   units.action.create(actions,{id:'add-spec',label:'＋ Spec',
    variant:'quiet',onInvoke:()=>persist(model.addSpec(state()))});
   if(s.pages.length>1)
    units.action.create(actions,{id:'close-'+p.id,label:'× Page',
     variant:'quiet',onInvoke:()=>persist(model.remove(state(),p.id))});
   if(visibleSpecs.length)
    units.field.create(nav,{kind:'select',label:'Associate Spec',
     value:p.associateSpecId||'',options:[{value:'',label:'None'},
      ...visibleSpecs.map(spec=>({value:spec.id,label:spec.name}))],
     onChange:e=>persist(model.associateSpec(state(),e.target.value||null))});
   kindField=units.field.create(nav,{kind:'select',label:'New Page',
    value:selectedKind,options:model.KINDS.map(x=>({value:x.id,label:x.label}))});
   units.action.create(nav,{id:'add-test',label:'＋ Page',
    variant:'quiet',onInvoke:()=>persist(model.add(state(),
     kindField?.control?.value||'iv'))});
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
     variant:'headed',title:'Terminal',sizing:'content'});
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
    kind:'panel',variant:'content',eyebrow:'EDIT PAGE',title:p.name,meta:p.testType
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
    const grid=units.layout.create(section('Page Information').body,{variant:'form-grid-2'});
    units.field.create(grid,{kind:'input',label:'Page 名称',value:p.name,
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
     const panel=section('Terminal Settings');
     for(const term of ports){
      units.note.create(panel.body,{variant:'meta',text:term.logical+' · '+term.resource});
      const grid=units.layout.create(panel.body,{variant:'form-grid-4'});
      units.field.create(grid,{kind:'select',label:'Source Mode',value:term.sourceMode,
       options:[{value:'voltage',label:'Voltage'},{value:'current',label:'Current'}],
       onChange:e=>change(term.logical,'sourceMode',e.target.value)});
      units.field.create(grid,{kind:'select',label:'Role',value:term.role,
       options:[{value:'CONDITION',label:'Fixed'},{value:'X',label:'Xsweep'},
        {value:'P',label:'Psweep'}],onChange:e=>change(term.logical,'role',e.target.value)});
      units.field.create(grid,{kind:'select',label:'Range Mode',value:term.rangeMode,
       options:[{value:'auto',label:'Auto'},
        ...(term.sourceMode==='voltage'?[{value:'minimum',label:'Limited Auto'}]:[]),
        {value:'fixed',label:'Fixed'}],
       onChange:e=>change(term.logical,'rangeMode',e.target.value)});
      numericField(grid,term.logical,'rangeValue',
       term.sourceMode==='voltage'?'Current Range (A)':'Voltage Range (V)',
       term.rangeValue,term.rangeMode==='auto');
      numericField(grid,term.logical,'compliance',
       term.sourceMode==='voltage'?'Compliance (A)':'Compliance (V)',term.compliance);
      if(term.role==='CONDITION')numericField(grid,term.logical,'bias','Fixed Bias',term.bias);
     }
    }
   }else if(editorSection==='target'){
    const grid=units.layout.create(section('Measurement Target').body,{variant:'form-grid-2'});
    units.field.create(grid,{kind:'select',label:'Terminal',value:p.target.logical,
     options:p.terminals.map(t=>({value:t.logical,label:t.logical+' / '+t.resource})),
     onChange:e=>commitTransaction(()=>model.editTarget(state(),{logical:e.target.value}))});
    units.field.create(grid,{kind:'select',label:'Quantity',value:p.target.quantity,
     options:[{value:'Current',label:'Current (A)'},{value:'Voltage',label:'Voltage (V)'}],
     onChange:e=>commitTransaction(()=>model.editTarget(state(),{quantity:e.target.value}))});
   }else if(editorSection==='strategy'){
    const grid=units.layout.create(section('Measurement Strategy').body,{variant:'form-grid-2'});
    for(const [label,key] of [['Loops','loops'],['Xsweep Repeats','xRepeats'],
      ['Psweep Repeats','pRepeats']])
     scalarField(grid,label,p.sweep[key],v=>changeSweep(key,v));
    units.field.create(grid,{kind:'select',label:'Psweep',value:String(p.sweep.pEnabled),
     options:[{value:'false',label:'Off'},{value:'true',label:'On'}],
     onChange:e=>changeSweep('pEnabled',e.target.value==='true')});
   }else if(editorSection==='limits'){
    const panel=section('Terminal Limits');
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
    const panel=section('Page Var');
    for(const [index,variable] of p.variables.entries()){
     const row=units.layout.create(panel.body,{variant:'form-grid-4'});
     units.field.create(row,{kind:'input',label:'Name',value:variable.name,
      onChange:e=>commitTransaction(()=>model.editVariable(state(),index,{name:e.target.value}))});
     scalarField(row,'Value',variable.value,v=>commitTransaction(
      ()=>model.editVariable(state(),index,{value:v})));
     units.field.create(row,{kind:'input',label:'Unit',value:variable.unit,
      onChange:e=>commitTransaction(()=>model.editVariable(state(),index,{unit:e.target.value}))});
     units.action.create(row,{id:'remove-var-'+index,label:'×',variant:'quiet',
      onInvoke:()=>commitTransaction(()=>model.removeVariable(state(),index))});
    }
    units.action.create(panel.body,{id:'add-var',label:'＋ Variable',variant:'quiet',
     onInvoke:()=>commitTransaction(()=>model.addVariable(state()))});
   }else if(editorSection==='spec'){
    const grid=units.layout.create(section('Associate Spec').body,{variant:'form-grid-2'});
    units.field.create(grid,{kind:'select',label:'Spec',value:p.associateSpecId||'',
     options:[{value:'',label:'None'},
      ...s.specs.filter(x=>x.deviceId===s.activeDeviceId).map(x=>({value:x.id,label:x.name}))],
     onChange:e=>commitTransaction(()=>model.associateSpec(state(),e.target.value||null))});
    units.action.create(grid,{id:'new-spec-inline',label:'＋ Spec',variant:'quiet',
     onInvoke:()=>commitTransaction(()=>model.addSpec(state()))});
   }
  }
  ctx.ui.activities.add({id:ACTIVITY,label:'4200A',contextLabel:'DK Test Studio',icon:'▦',
   order:82,primary:true,openMode:'window',artifactHydration:'live',
   onActivate:()=>{ctx.workspace.openPage(PAGE);refreshData();}});
  const page=ctx.ui.pages.add({id:'dkts-4200a-page',pageId:PAGE,activity:ACTIVITY,
   label:'4200A',title:'',toolbar:false,html:''});
  const header=units.pageHeader.create(page,{variant:'page-owned',activity:ACTIVITY,
   title:'4200A',subtitle:''});
  units.layout.create(header.actions,{tagName:'span',variant:'identity',
   dataset:{dkdsSlot:'workbench-import'}});
  const body=units.page.create(page,{variant:'analysis'}).element;
  const container=units.layout.create(body,{variant:'identity'});
  wb=units.workspace.create(container,{variant:'standard',header:false,
   activity:ACTIVITY,primaryScroll:'safe'});
  // Core SDK owns the native Page editor and real PlotView, without a separate browser shell.
  const main=units.layout.create(null,{variant:'sidebar-main-compact'});
  nav=units.layout.create(main,{variant:'stack-compact'});
  const work=units.layout.create(main,{variant:'stack-compact'});
  // Core-accepted geometry widens the parameter editor; a Core-managed
  // 680px responsive override stacks editor / plot on narrow screens.
  const content=units.layout.create(work,{variant:'responsive-two-column',
   geometry:{gridTemplateColumns:'minmax(0,1.25fr) minmax(320px,.75fr)'},
   responsiveGeometry:[{maxWidth:680,
    geometry:{gridTemplateColumns:'minmax(0,1fr)'}}]});
  const editor=units.layout.create(content,{variant:'stack-compact'});
  editorHeading=units.layout.create(editor,{variant:'identity'});
  inlineTerminals=units.layout.create(editor,{variant:'identity'});
  editorTabs=units.layout.create(editor,{variant:'identity'});
  parameters=units.layout.create(editor,{variant:'stack-compact'});
  const plotArea=units.layout.create(content,{variant:'stack-comfortable'});
  const graphic=units.panel.create(plotArea,{variant:'plot-card',
   header:false,sizing:'content'});
  const graphicHeader=units.header.create(graphic.body,{kind:'plot',
   variant:'plot',title:'Data / Graph',actionHost:true});
  const plotHost=units.layout.create(graphic.body,{variant:'plot-card-fill'});
  plotView=units.plotView.adopt('dkts-4200a-main-plot',graphic.element,{
   variant:'complete',title:'Data / Graph',plot:plotHost,
   header:graphicHeader.element,actionsHost:graphicHeader.actions,
   fileStem:'DKTS_4200A_plot',images:true,copy:false,csv:false,
   placements:['home','float','global'],stateVersion:'dkts-native-v3'});
  plot=units.scientificPlot.create(plotHost,{variant:'curve',
   source:'dkts-native',xTitle:'Voltage / Time',yTitle:'Current (A)',
   getCurves:curves,getMarkers:()=>[]});
  dataNote=units.note.create(plotArea,{variant:'meta',text:'Data Center · 0'});
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
  render();refreshData();
  ctx.status.set('4200A 工作区已加载；原生输出禁用');
  return {deactivate(){pad?.close?.();off?.();plot?.dispose?.();plotView?.dispose?.();wb?.dispose?.();}};
 });
})();