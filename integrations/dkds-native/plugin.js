(() => {
 'use strict';
 const manifest={"id":"com.dkts.keithley-4200","name":"DK Test Studio - Keithley 4200A","version":"0.8.1","apiVersion":"1.19.0","entry":"plugin.js","scripts":["model.js","plugin.js"],"enabled":true,"order":82,"description":"Native DKDS TOP workbench: host-owned theme, data, scientific plot and project state; output disabled.","pluginType":"workbench","requiresCore":["status","events","workspace","project","state","modules","data.sources","data.artifacts","ui.workspace","ui.unit-templates","ui.scientific-plot","ui.activities","ui.top-workspace","ui.pages"],"capabilities":["ui.page","ui.top-workspace","ui.plugin-workspace","ui.scientific-plot","data.scoped-sources","project.slice"],"platformPresentation":{"desktop":{"mode":"shared"},"mobile":{"mode":"adaptive"}},"workspace":{"role":"top","activity":"dkts-keithley-4200","icon":"▦","title":"4200A 测试"},"window":{"activity":"dkts-keithley-4200","title":"DK Test Studio 4200A","width":1380,"height":860,"minWidth":820,"minHeight":560,"dependencies":["scientific-renderer"],"prewarm":false,"reuse":true,"persistence":"project","artifactHydration":"live"},"data":{"accepts":["science.transport.iv","data.table"]}};
 DKDSPlugins.define(manifest,async ctx=>{
  const model=ctx.modules.require('model'),units=ctx.ui.unitTemplates;
  const ACTIVITY='dkts-keithley-4200',PAGE='dktsKeithley4200Page';
  const store=ctx.state.create(model.initial(),{projectSlice:'settings'});
  let wb=null,plot=null,plotView=null,nav=null,parameters=null,portFields=null,dataNote=null,kindField=null,pad=null;
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
    const t=p.terminals.find(t=>t.resource!=='None'&&t.role===axis);
    if(!t)continue; // Never create a parameter editor for a None port.
    const segments=axis==='X'?sw.xSegments:sw.pSegments;
    const repeatKey=axis==='X'?'xRepeats':'pRepeats';
    const panel=units.panel.create(parameters,{variant:'headed',
      title:axis+'sweep · '+t.logical+' / '+t.resource,sizing:'content'});
    const layout=units.layout.create(panel.body,{variant:'form-grid-4'});
    scalarField(layout,'重复次数',sw[repeatKey],v=>changeSweep(repeatKey,v));
    for(const [index,seg] of segments.entries()){
     const group=units.panel.create(panel.body,{
      variant:'headed',title:'第 '+(index+1)+' 段',sizing:'content'});
     const controls=units.layout.create(group.body,{variant:'form-grid-4'});
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
   // Native DKDS Core Unit widgets own the actual Project/Routine/Page tree.
   const explorer=units.panel.create(nav,{
    variant:'headed',title:'Project Explorer / Device / MOSFET',sizing:'content'
   });
   for(const routine of s.routines){
    const branch=units.panel.create(explorer.body,{
     variant:'headed',title:routine.name,sizing:'content'
    });
    units.action.create(branch.body,{
     id:'routine-'+routine.id,label:'▦ '+routine.name,variant:'quiet',
     onInvoke:()=>persist(model.selectRoutine(state(),routine.id))
    });
    const pages=s.pages.filter(page=>page.routineId===routine.id);
    for(const page of pages){
     units.action.create(branch.body,{
      id:'open-'+page.id,label:'  ▧ '+page.name,
      variant:page.id===s.activeId?'primary':'quiet',
      onInvoke:()=>persist(model.select(state(),page.id))
     });
     if(s.pages.length>1)units.action.create(branch.body,{
      id:'close-'+page.id,label:'×',variant:'quiet',
      ariaLabel:'关闭 '+page.name,
      onInvoke:()=>persist(model.remove(state(),page.id))
     });
    }
   }
   const specPanel=units.panel.create(explorer.body,{
    variant:'headed',title:'Associate Spec',sizing:'content'
   });
   for(const spec of s.specs)units.action.create(specPanel.body,{
    id:'spec-'+spec.id,label:'◇ '+spec.name,
    variant:spec.id===p.associateSpecId?'primary':'quiet',
    onInvoke:()=>persist(model.associateSpec(state(),spec.id))
   });
   units.action.create(nav,{
    id:'add-routine',label:'＋ Routine',variant:'quiet',
    onInvoke:()=>persist(model.addRoutine(state()))
   });
   units.action.create(nav,{
    id:'add-spec',label:'＋ Spec',variant:'quiet',
    onInvoke:()=>persist(model.addSpec(state()))
   });
   if(s.specs.length){
    units.field.create(nav,{
     kind:'select',label:'Associate Spec',value:p.associateSpecId||'',
     options:[{value:'',label:'未关联'},
       ...s.specs.map(spec=>({value:spec.id,label:spec.name}))],
     onChange:event=>persist(model.associateSpec(state(),event.target.value||null))
    });
   }
   kindField=units.field.create(nav,{
    kind:'select',label:'新增类型',value:selectedKind,
    options:model.KINDS.map(x=>({value:x.id,label:x.label}))
   });
   units.action.create(nav,{id:'add-test',label:'＋ 新增测试',
    onInvoke:()=>persist(model.add(state(),kindField?.control?.value||'iv'))});
   if(portFields){
    portFields.replaceChildren();
    for(const term of p.terminals)units.field.create(portFields,{
     kind:'select',label:term.logical+' 端口',value:term.resource,
     options:['None','SMU1','SMU2','SMU3','SMU4','SMU5','SMU6','SMU7','SMU8']
      .map(x=>({value:x,label:x})),
     onChange:event=>change(term.logical,'resource',event.target.value)
    });
   }
   parameters.replaceChildren();
   units.note.create(parameters,{variant:'meta',text:p.name+' · '+p.testType});
   const ports=model.visible(p);
   if(!ports.length)units.emptyState.create(parameters,{
    message:'未分配端口。None 端口只在「端口映射」面板显示。'
   });
   for(const t of ports){
    const panel=units.panel.create(parameters,{variant:'headed',title:t.logical+' · '+t.resource,sizing:'content'});
    // Single FS-Pro-style row on wide screens; Core grid wraps naturally on tablets.
    const controls=units.layout.create(panel.body,{variant:'form-grid-4'});
    units.field.create(controls,{kind:'select',label:'源模式',value:t.sourceMode,
     options:[{value:'voltage',label:'Voltage'},{value:'current',label:'Current'}],
     onChange:e=>change(t.logical,'sourceMode',e.target.value)});
    units.field.create(controls,{kind:'select',label:'扫描角色',value:t.role,
     options:[{value:'CONDITION',label:'Condition'},{value:'X',label:'Xsweep'},{value:'P',label:'Psweep'}],
     onChange:e=>change(t.logical,'role',e.target.value)});
    if(t.role==='CONDITION')numericField(controls,t.logical,'bias','固定偏置',t.bias);
    // Scanned start/stop/step live ONLY in the X/P segment editor below.
    units.field.create(controls,{kind:'select',label:'量程模式',value:t.rangeMode,
     options:[{value:'auto',label:'自动'},
      ...(t.sourceMode==='voltage'?[{value:'minimum',label:'电流自动下限'}]:[]),
      {value:'fixed',label:'即时指定'}],
     onChange:e=>change(t.logical,'rangeMode',e.target.value)});
    numericField(controls,t.logical,'rangeValue',
     t.sourceMode==='voltage'?'电流档位 (A)':'电压档位 (V)',
     t.rangeValue,t.rangeMode==='auto');
    numericField(controls,t.logical,'compliance',
     t.sourceMode==='voltage'?'限流 (A)':'限压 (V)',t.compliance);
   }
   if(['iv','transfer','output'].includes(p.kind))renderSweep(parameters,p);
   else units.note.create(parameters,{variant:'meta',
    text:'该测试类型目前只提供离线参数草稿，尚未实现仪器执行。'});
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
  const main=units.layout.create(null,{variant:'stack-comfortable'});
  nav=units.layout.create(main,{variant:'row-wrap'});
  dataNote=units.note.create(main,{variant:'meta',text:'数据中心：0 组'});
  const graphic=units.panel.create(main,{variant:'plot-card',header:false,sizing:'content'});
  const graphicHeader=units.header.create(graphic.element,{
   kind:'plot',variant:'plot',title:'4200A 电学特性',actionHost:true
  });
  const plotHost=units.layout.create(graphic.body,{variant:'plot-card-fill'});
  // Adopt DKDS PlotView header/actions so title, image export, portable
  // placement and scientific-toolbar chrome are not reimplemented in DKTS.
  plotView=units.plotView.adopt('dkts-4200a-main-plot',graphic.element,{
   variant:'complete',title:'4200A 电学特性',
   plot:plotHost,header:graphicHeader.element,actionsHost:graphicHeader.actions,
   fileStem:'DKTS_4200A_plot',images:true,copy:false,csv:false,
   placements:['home','float','global'],stateVersion:'dkts-native-v2'
  });
  plot=units.scientificPlot.create(plotHost,{variant:'curve',source:'dkts-native',
   xTitle:'Voltage / Time',yTitle:'Current (A)',getCurves:curves,getMarkers:()=>[]});
  const params=units.layout.create(null,{variant:'stack-comfortable'});
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
   placementControl:'surface',chrome:'auto',
   priority:65,collapsible:true,existingNode:ports,
   defaultPlacement:'bottom',placements:['inline','right','bottom','float'],
   stateVersion:'native-dkts-v1'});
  // DKDS SDK requires surface-controlled inspector chrome. Its Unit builder
  // currently normalizes generated chrome to boolean true, but the movable
  // existingNode runtime accepts the literal "auto" (or a custom handle).
  // Preserve the canonical Core-generated header and its movable controls.
  portPrime.chrome='auto';
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
  return {deactivate(){pad?.close?.();off?.();plot?.dispose?.();plotView?.dispose?.();wb?.dispose?.();}};
 });
})();