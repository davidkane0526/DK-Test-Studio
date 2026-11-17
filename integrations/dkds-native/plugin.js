(() => {
 'use strict';
 const manifest={"id":"com.dkts.keithley-4200","name":"DK Test Studio - Keithley 4200A","version":"0.8.19","apiVersion":"1.19.0","entry":"plugin.js","scripts":["hardware-capabilities.js","kxci-protocol.js","identity-core.js","measurement-plan.js","kxci-measurement.js","model.js","measurement-data.js","measurement-runtime.js","ui-shell.js","plugin.js"],"enabled":true,"order":82,"description":"Native DKDS TOP workbench: FS-Pro scan editor, verified KXCI connection and guarded SMU execution; raw TI data is published to the DKDS Data Center.","pluginType":"workbench","requiresCore":["status","events","workspace","project","state","modules","io","data.model","data.sources","data.artifacts","ui.workspace","ui.dom","ui.unit-templates","ui.scientific-plot","ui.table","ui.activities","ui.toolbar","ui.context-menus","ui.top-workspace","ui.pages","capabilities","ui.settings","ui.dialogs"],"capabilities":["ui.page","ui.top-workspace","ui.plugin-workspace","ui.scientific-plot","data.scoped-sources","project.slice"],"platformPresentation":{"desktop":{"mode":"shared"},"mobile":{"mode":"adaptive"}},"workspace":{"role":"top","activity":"dkts-keithley-4200","icon":"▦","title":"4200A 测试","defaultSuper":true},"window":{"activity":"dkts-keithley-4200","title":"DK Test Studio 4200A","width":1380,"height":860,"minWidth":820,"minHeight":560,"dependencies":["scientific-renderer"],"prewarm":false,"reuse":true,"persistence":"project","artifactHydration":"live"},"data":{"accepts":["science.transport.iv","data.table"]},"styles":["ui-shell.css"],"pluginDependencies":[{"id":"builtin.connectivity-center"}]};
 DKDSPlugins.define(manifest,async ctx=>{
  const model=ctx.modules.require('model'),measurementData=ctx.modules.require('measurementData'),
   measurementRuntimeModule=ctx.modules.require('measurementRuntime'),units=ctx.ui.unitTemplates,
   uiShell=ctx.modules.require('uiShell');
  if(typeof measurementData?.publishRaw!=='function')throw Error('KXCI Data Center publisher missing');
  const ACTIVITY='dkts-keithley-4200',PAGE='dktsKeithley4200Page';
  const preferences=ctx.ui.settings.define('workspace-language',{defaults:{language:'zh-CN'}});
  let language=preferences.get('language')==='en'?'en':'zh-CN';
  const tr=(zh,en)=>language==='en'?en:zh;
  const t=key=>uiShell.translate(key,language);
  let updateGraphLanguage=()=>{};
  let treeMenu=null,executionDialogOpen=false,runPageId=null,runConfirmationPending=false;
  const segmentDrafts=new Map();
  let sweepIssue=null;


  const store=ctx.state.create(model.initial(),{projectSlice:'settings'});
  let wb=null,plot=null,plotView=null,plots=[],plotViews=[],frameCards=[],frameSelections=['','','',''],frameKinds=['iv','transfer','it','raw'],frameGroup=null,frameTableHosts=[],framePlotHosts=[],frameTables=[],frameLayout='4',nav=null,parameters=null,dataNote=null,pad=null,portPopover=null,editorTabs=null,editorHeading=null,terminalRegion=null;
  let editorSection='sweep',editorOpen=false,terminalVisible=true,workRegion=null,editorRegion=null,plotRegion=null,projectSurface=null;
  const defineConnectionSettings=()=>ctx.ui.settings.define('instrument-connection',{
   title:t('4200A 连接设置'),
   description:'使用 DKDS 通用 TCP/IP 通信能力连接 4200A。连接后先核验仪器身份和实际模块型号，再开放受安全策略约束的测量操作。',
   defaults:{host:'',port:1225,timeoutMs:5000,networkMode:'auto',
    interfaceName:'',expectedSerial:''},
   fields:[
    {id:'host',label:t('仪器 IP / 主机名'),type:'text'},
    {id:'port',label:t('KXCI TCP 端口'),type:'number',min:1,max:65535},
    {id:'expectedSerial',label:t('预期序列号'),type:'text'},
    {id:'timeoutMs',label:t('连接/读取超时 (ms)'),type:'number',min:250,max:30000},
    {id:'networkMode',label:t('网络接口模式'),type:'select',options:[
     {value:'auto',label:t('自动')},{value:'ethernet',label:t('以太网')},
     {value:'wifi',label:'Wi-Fi'},{value:'interface',label:t('指定网卡')}]},
    {id:'interfaceName',label:t('指定网卡名称'),type:'text'}
   ]
  });
  const connectionSettings=defineConnectionSettings();
  const measurementRuntime=measurementRuntimeModule.createRuntime(ctx,{
   onChange:update=>{
    if(update.event==='measurement-progress'){
     ctx.status.set('4200A 测量执行中：'+update.run.totalRows+' / '+update.run.totalPoints+' 点');
     return;
    }
    if(update.event==='connected')ctx.status.set('4200A 身份已验证：'+(update.connection.identity?.serial||''));
    else if(update.event==='modules-inspected'){
     const inventory=update.connection.inventory;
     ctx.status.set(inventory?.hardwareLimitsVerified&&inventory?.physicalModelsVerified
      ?(!update.protocolVerified?'4200A 模块已核验，但最新 KXCI Rev F 正文尚未核对，禁止真实仪器输出'
       :(!update.executionAdapterAvailable?'DKDS 宿主未提供受生命周期管理的定时服务，无法执行带延迟的逐点测量'
        :'4200A 实际模块与 KXCI 协议已核验，可检查测量方案'))
      :'4200A 已连接，但实际模块身份/额定值未完整核验，禁止仪器输出');
    }else if(update.event==='measurement-started')ctx.status.set('4200A 正在执行真实 KXCI 测量，停止时将依次关闭所有活动 SMU');
    else if(update.event==='measurement-finished'){
     runPageId=null;
     const run=update.run;
     if(run.shutdown==='unconfirmed')ctx.status.set('严重警告：SMU 输出关闭未获确认，请立即在仪器现场检查；不要断开连接');
     else if(update.publishError)ctx.status.set('测量结束，但原始数据发布失败：'+update.publishError);
     else if(update.published)ctx.status.set('测量 '+run.state+'；'+update.rows+' 行 KXCI 原始数据已写入 DKDS Data Center');
     else ctx.status.set('测量 '+run.state+'；没有可发布的实际 TI 采样行');
    }else if(update.event==='measurement-stopping')ctx.status.set('正在停止测量并关闭活动 SMU 输出…');
    else if(update.event==='disconnected')ctx.status.set('4200A 已断开');
    render();
   }
  });
  const PAGE_TABS=[['sweep','Sweep'],['target','Target'],['strategy','Strategy']];
  const frameOptions=()=>[{value:'iv',label:'I–V'},{value:'transfer',label:t('转移特性')},{value:'it',label:'I–t'},{value:'raw',label:t('数据表')}];
  const TEST_TYPE_LABELS=Object.freeze({DC:'直流',Pulse:'脉冲',Cycle:'循环',Time:'时间',IVT:'I–V–t',CV:'C–V'});
  const testTypeLabel=value=>t(TEST_TYPE_LABELS[value]||String(value||''));
  const touchNumeric=Boolean(window.matchMedia?.('(pointer: coarse)')?.matches);
  function fsproField(host,spec){
   const variant=['select','textarea'].includes(spec.kind)?spec.kind:'input';
   const className=['dkts-native-field',spec.className].filter(Boolean).join(' ');
   return units.field.create(host,{...spec,variant,className});
  }
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
  function displaySegmentError(error){
   const message=String(error?.message||error);
   if(message.startsWith('SWEEP_DIRECTION'))return tr('扫描起止值不同时，步进不能为 0。','A sweep with different endpoints requires a nonzero step.');
   if(message.startsWith('SWEEP_ENDPOINT'))return tr('该步进无法恰好到达终止值。','The step cannot reach the exact endpoint.');
   if(message.startsWith('SWEEP_STEP'))return tr('起始值与终止值相同时，步进须为 0。','Identical endpoints require zero step.');
   if(message.startsWith('SWEEP_POINTS'))return tr('该扫描段超过 4096 个点。','This segment exceeds 4096 points.');
   if(message.startsWith('Invalid numeric input'))return tr('这里需要有效的数字。','Enter a valid number.');
   return message;
  }
  function changeSegment(axis,index,key,value){
   const pageId=active().id,segmentKey=axis+'-'+index;
   const drafts=segmentDrafts.get(pageId)||new Map();
   const values={...drafts.get(segmentKey)?.values,[key]:value};
   try{
    const next=model.editSegment(state(),axis,index,values);
    drafts.delete(segmentKey);
    if(!drafts.size)segmentDrafts.delete(pageId);
    if(sweepIssue?.pageId===pageId&&sweepIssue.axis===axis&&sweepIssue.index===index)sweepIssue=null;
    persist(next);
   }catch(error){
    const message=displaySegmentError(error);
    drafts.set(segmentKey,{axis,index,key,values,message});
    segmentDrafts.set(pageId,drafts);
    ctx.status.set(message);
    render();
   }
  }
  function removeSweepSegment(axis,index){
   commitTransaction(()=>{
    const pageId=active().id,next=model.removeSegment(state(),axis,index);
    const drafts=segmentDrafts.get(pageId);
    if(drafts){
     const shifted=new Map();
     for(const draft of drafts.values()){
      if(draft.axis===axis&&draft.index===index)continue;
      const i=draft.axis===axis&&draft.index>index?draft.index-1:draft.index;
      shifted.set(draft.axis+'-'+i,{...draft,index:i});
     }
     if(shifted.size)segmentDrafts.set(pageId,shifted);else segmentDrafts.delete(pageId);
    }
    if(sweepIssue?.pageId===pageId)sweepIssue=null;
    return next;
   });
  }
  async function toggleInstrumentConnection(){
   const current=measurementRuntime.status().connection;
   try{
    if(current.phase==='connected'){
     const run=measurementRuntime.status().run;
     if(run.running){
      const confirmed=await ctx.ui.dialogs.confirm({title:'停止并断开 4200A',
       tone:'warning',message:'当前测量仍在执行。将先请求停止，并等待所有活动 SMU 的 DVn 输出关闭命令完成。',
       confirmLabel:'停止并断开',destructive:true});
      if(!confirmed)return;
     }
     await measurementRuntime.disconnect();
    }else{
     ctx.status.set('正在连接 4200A 并验证仪器身份…');
     await measurementRuntime.connectAndInspect(connectionSettings.get());
    }
   }catch(error){ctx.status.set('4200A 连接/断开失败：'+String(error.message||error));}
   render();
  }
  async function handleMeasurementAction(page,prepared){
   const current=measurementRuntime.status();
   if(current.run.running){
    measurementRuntime.stop();
    ctx.status.set(tr('已请求停止，正在等待仪器关闭输出。','Stop requested; waiting for instrument shutdown.'));
    render();return;
   }
   if(!page||!prepared?.canExecute||runConfirmationPending)return;
   runConfirmationPending=true;
   try{
   const plan=prepared.compiled.plan;
   const channels=Object.entries(prepared.channels).map(([role,channel])=>role+'=SMU'+channel).join('，');
   const voltageSegments=[...plan.xSweep.segments,...(plan.pSweep?.segments||[])];
   const maxVoltage=Math.max(0,...voltageSegments.flatMap(row=>[Math.abs(row.startV),Math.abs(row.stopV)]),
    ...Object.values(plan.fixedVoltages).map(value=>Math.abs(value)));
   const confirmed=await ctx.ui.dialogs.confirm({
    title:'确认 Keithley 4200A 实际输出',tone:'warning',destructive:true,
    message:'仪器 '+current.connection.identity.serial+' 将执行“'+page.name+'”，预计 '+
     prepared.pointCount.toLocaleString()+' 个测量点。',
    detail:'活动端口：'+channels+'。最大设定电压：'+maxVoltage+' V。开始后将真实驱动 SMU 并读取 KXCI TI 响应。请先确认实际接线、探针接触、器件固定、各端口独立限流和现场安全条件。软件会在完成、停止或异常时尝试关闭全部活动 SMU。',
    confirmLabel:'确认接线并开始输出'
   });
   if(!confirmed)return;
   try{
    runPageId=page.id;
    measurementRuntime.start(page,true);

    ctx.status.set('4200A 测量已启动：'+prepared.pointCount.toLocaleString()+' 点');
   }catch(error){
    runPageId=null;
    ctx.status.set(tr('测量启动失败：','Unable to start: ')+String(error.message||error));
   }
   render();
   }finally{runConfirmationPending=false;}
  }
  async function openExecution(page){
   if(measurementRuntime.status().run.running){
    if(runPageId===page.id)handleMeasurementAction();
    else ctx.status.set(tr('另一项测试正在运行。','Another test is running.'));
    return;
   }
   if(executionDialogOpen||runConfirmationPending)return;
   executionDialogOpen=true;
   try{
    let value=page.sweep.loops, message=page.name;
    for(;;){
     const result=await ctx.ui.dialogs.show({title:tr('执行次数设置','Execution count'),message,
      defaultAction:'dkts-execute',cancelAction:'cancel',
      input:{type:'number',label:tr('执行次数','Execution count'),value},
      actions:[
       {id:'cancel',label:t('取消'),kind:'secondary'},
       {id:'dkts-execute',label:tr('执行','Run'),kind:'danger',autofocus:true}
      ]});
     if(result?.action!=='dkts-execute')return;
     value=result.value.trim();
     if(!/^[1-9][0-9]*$/.test(value)||Number(value)>10000){
      message=tr('执行次数须为 1–10000 的整数。','Enter a whole number from 1 to 10000.');
      continue;
     }
     const invalid=segmentDrafts.get(page.id)?.values().next().value;
     if(invalid){
      revealSweepIssue(page.id,invalid.axis,invalid.index,invalid.key,invalid.message);
      return;
     }
     const candidate=model.editSweep(model.select(state(),page.id),{loops:value});
     const planned=candidate.pages.find(row=>row.id===page.id);
     if(!['iv','transfer','output'].includes(planned.kind)){
      await ctx.ui.dialogs.alert({title:tr('暂无法执行','Execution unavailable'),
       message:tr('此测试类型的执行器尚未接入。','An executor is not available for this test type.')});
      return;
     }
     const summary=model.summary(planned);
     if(!summary.ready){
      revealSweepIssue(page.id,summary.reason.includes('Psweep')?'P':'X',null,'port',summary.reason);
      return;
     }
     const prepared=measurementRuntime.prepare(planned);
     if(!prepared.canExecute){
      await ctx.ui.dialogs.alert({title:tr('执行前检查','Execution preflight'),
       message:prepared.reason||tr('执行前检查未通过。','Execution preflight failed.')});
      return;
     }
     await handleMeasurementAction(planned,prepared);
     return;
    }
   }catch(error){
    await ctx.ui.dialogs.alert({title:tr('执行前检查','Execution preflight'),message:String(error?.message||error)});
   }finally{executionDialogOpen=false;}
  }
  function revealSweepIssue(pageId,axis,index,key,message){
   sweepIssue={pageId,axis,index,key,message};
   showEditor(pageId,'sweep');
   const row=index===null?parameters.querySelector?.('[data-dkts-sweep-panel="'+axis+'"]'):
    parameters.querySelector?.('[data-dkts-sweep-row="'+axis+'-'+index+'"]');
   const control=row?.querySelector?.('[data-dkts-sweep-key="'+key+'"]');
   control?.scrollIntoView?.({block:'nearest'});
   control?.focus?.({preventScroll:true});
   ctx.status.set(message);
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
   const display=fsproField(pop.body,{kind:'input',label:t('当前数值'),
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
  function scalarField(host,label,value,commit,disabled=false,attributes={},readOnly=false){
   if(readOnly)return fsproField(host,{kind:'input',label,value,attributes,readOnly});
   const original=String(value??'').trim();
   return fsproField(host,{kind:'input',label,value,attributes,
    inputMode:touchNumeric?'none':'decimal',disabled,
    onFocus:event=>openNumericPad(event.target,label||attributes['aria-label'],commit),
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
  const logicalNames=Object.freeze({S:'Source',D:'Drain',G:'Gate',B:'Body'});
  const peakVoltage=segment=>Math.max(Math.abs(Number(segment.start)),Math.abs(Number(segment.stop)));
  function terminalPeaks(page,terminal){
   if(terminal.role==='X')return page.sweep.xSegments.map(peakVoltage);
   if(terminal.role==='P'&&page.sweep.pEnabled)return page.sweep.pSegments.map(peakVoltage);
   return [Math.abs(Number(terminal.bias))];
  }
  function currentRanges(terminal,peaks){
   if(terminal?.sourceMode!=='voltage')return null;
   return measurementRuntime.currentRanges?.(terminal.resource,peaks)??null;
  }
  function rangeChoices(available,saved,{auto=true}={}){
   const selected=available?.some(value=>value===Number(saved));
   const choices=available?.map(value=>{
    const formatted=value===1?'1':value.toExponential();
    return {value:value===Number(saved)?String(saved):formatted,label:formatted};
   })||[];
   if(auto)choices.unshift({value:'auto',label:'Auto'});
   const invalid=saved&&saved!=='auto'&&!selected;
   if(invalid)choices.push({value:saved,selected:true,disabled:true,label:String(saved)+' · '+
    (available===null?tr('待核验','Unverified'):tr('不适用','Unsupported'))});
   const help=available===null?tr('连接仪器并核验该 SMU 后显示可用量程。','Connect and verify the mapped SMU to see its ranges.'):
    tr('按实装 SMU、前放和所设电压筛选。','Filtered by the installed SMU, preamp and configured voltage.');
   return {choices,invalid:Boolean(invalid),help};
  }
  function terminalChoice(host,spec){
   const wrap=units.layout.create(host,{variant:'identity',className:'dkts-terminal-choice'});
   const selected=spec.options.some(option=>option.value===spec.value)&&logicalNames[spec.value];
   const field=fsproField(wrap,{...spec,controlDataset:{...spec.controlDataset,
    dktsTerminalChoice:selected?spec.value:''}});
   for(const option of field.control?.options||[]){
    if(logicalNames[option.value])option.setAttribute('data-dkts-terminal-tone',option.value);
   }
   if(selected){
    const badge=renderTerminalBadge(wrap,spec.value);
    badge?.classList?.add('dkts-terminal-selected');
    badge?.setAttribute?.('aria-hidden','true');
   }
   return field;
  }
  const speedOptions=()=>['Fast','Normal','Quiet'].map(value=>({value,label:t(value)}));
  const scanPortOptions=(p,axis)=>{
   const other=axis==='X'?'P':'X';
   return p.terminals.filter(term=>!['None','GNDU'].includes(term.resource)&&
    term.role!==other).map(term=>({value:term.logical,label:t(logicalNames[term.logical])}));
  };
  function assignSweepPort(axis,logical){
   const term=active().terminals.find(row=>row.logical===logical);
   if(!term||['None','GNDU'].includes(term.resource)){
    ctx.status.set('Xsweep/Psweep 必须选择已分配的 SMU 端口');return;
   }
   commitTransaction(()=>{const next=model.edit(state(),logical,{role:axis});if(sweepIssue?.key==='port'&&sweepIssue.axis===axis)sweepIssue=null;return next;});
  }
  function setPsweepEnabled(enabled){
   commitTransaction(()=>{
    let next=state(),page=next.pages.find(row=>row.id===next.activeId);
    if(enabled&&!page.terminals.some(term=>term.role==='P'&&!['None','GNDU'].includes(term.resource))){
     const candidate=page.terminals.find(term=>term.logical==='G'&&
      !['None','GNDU'].includes(term.resource)&&term.role!=='X')||
      page.terminals.find(term=>!['None','GNDU'].includes(term.resource)&&term.role!=='X');
     if(!candidate)throw Error('Psweep 已启用，请先为其分配独立 SMU');
     next=model.edit(next,candidate.logical,{role:'P'});
    }
    return model.editSweep(next,{pEnabled:Boolean(enabled)});
   });
  }
  function renderSweepAxis(host,p,axis){
   const sw=p.sweep,isP=axis==='P',enabled=!isP||sw.pEnabled;
   const current=p.terminals.find(term=>term.role===axis&&!['None','GNDU'].includes(term.resource));
   const fallback=p.terminals.find(term=>term.logical===(isP?'G':'D')&&!['None','GNDU'].includes(term.resource));
   const selected=current||(!enabled?fallback:null);
   const available=scanPortOptions(p,axis);
   const panel=units.panel.create(host,{variant:'headed',title:isP?'Psweep':'Xsweep',
    meta:t(isP?'Outer Sweep':'Inner Sweep'),sizing:'content',className:'dkts-sweep-axis',actionHost:true});
   panel.element?.setAttribute?.('data-dkts-sweep-panel',axis);
   const missingPort=sweepIssue?.pageId===p.id&&sweepIssue.axis===axis&&sweepIssue.key==='port';
   panel.header?.element?.setAttribute?.('data-dkts-axis',axis);
   panel.header?.title?.setAttribute?.('data-dkts-axis',axis);
   const controls=units.layout.create(panel.header?.actionHost||panel.header?.actions,
    {variant:'identity',className:'dkts-sweep-header-controls'});
   if(isP)units.check.create(controls,{kind:'checkbox',label:t('启用'),checked:sw.pEnabled,
    className:'dkts-psweep-enable',onChange:event=>setPsweepEnabled(event.target.checked)});
   const portGroup=units.layout.create(controls,{variant:'identity',className:'dkts-sweep-header-field'});
   terminalChoice(portGroup,{kind:'select',label:false,controlOnly:true,
    value:selected?.logical||'',options:selected?available:[{value:'',label:tr('选择端子','Select terminal')},...available],
    className:'dkts-sweep-head-port',controlClassName:'dkts-sweep-head-control',
    controlDataset:{dktsFsproHeadControl:'port'},
    attributes:{'aria-label':(isP?'Psweep':'Xsweep')+' '+tr('扫描端子','Sweep terminal'),'data-dkts-sweep-key':'port',...(missingPort?{'aria-invalid':'true'}:{})},
    disabled:!available.length,onChange:event=>assignSweepPort(axis,event.target.value)});
   const repeatGroup=units.layout.create(controls,{variant:'identity',className:'dkts-sweep-header-field'});
   const repeatLabel=units.note.create(repeatGroup,{variant:'meta',text:t('重复')});
   repeatLabel?.setAttribute?.('data-dkts-sweep-control-label','true');
   fsproField(repeatGroup,{kind:'number',inputType:'number',label:false,controlOnly:true,
    value:isP?sw.pRepeats:sw.xRepeats,min:1,max:10000,step:1,
    className:'dkts-sweep-repeat',controlClassName:'dkts-sweep-repeat-control',
    controlDataset:{dktsFsproHeadControl:'repeat'},
    attributes:{'aria-label':(isP?'Psweep':'Xsweep')+' 重复次数'},
    disabled:!enabled,onChange:event=>changeSweep(isP?'pRepeats':'xRepeats',event.target.value)});
   units.action.create(controls,{id:'add-segment-'+axis,label:'＋',title:tr('新增扫描段','Add sweep segment')+' · '+(isP?'Psweep':'Xsweep'),
    variant:'quiet',enabled:enabled,onInvoke:()=>commitTransaction(()=>model.addSegment(state(),axis))});
   if(isP&&!enabled){
    panel.element?.setAttribute?.('data-dkts-psweep-off','true');
    panel.header?.title?.setAttribute?.('data-dkds-tooltip',t('固定偏置 · Psweep 未启用'));
    return;
   }
   if(missingPort)units.note.create(panel.body,{variant:'warning',text:sweepIssue.message});
   const segments=isP?sw.pSegments:sw.xSegments;
   const list=units.layout.create(panel.body,{variant:'stack-compact',className:'dkts-sweep-segments'});
   const head=units.layout.create(list,{variant:'identity',className:'dkts-sweep-segment-head'});
   for(const label of ['#','Start (V)','Stop (V)','Step (V)','Range (A)','Speed',''])
    units.note.create(head,{variant:'meta',text:t(label)});
   for(const [index,saved] of segments.entries()){
    const draft=segmentDrafts.get(p.id)?.get(axis+'-'+index);
    const segment={...saved,...draft?.values};
    const issueId='dkts-sweep-error-'+axis+'-'+index;
    const fieldAttributes=(key,name)=>({
     'aria-label':name,'data-dkts-sweep-key':key,
     ...(draft?.key===key?{'aria-invalid':'true','aria-describedby':issueId}:{})
    });
    const row=units.layout.create(list,{variant:'identity',className:'dkts-sweep-segment'});
    row?.setAttribute?.('data-dkts-segment',String(index+1));
    row?.setAttribute?.('data-dkts-sweep-row',axis+'-'+index);
    const number=units.note.create(row,{variant:'meta',text:String(index+1),className:'dkts-sweep-index'});
    number?.setAttribute?.('data-dkts-segment-index',String(index+1));
    for(const [key,label] of [['start','Start (V)'],['stop','Stop (V)'],['step','Step (V)']]){
     const linked=key==='start'&&index>0;
     const attributes=fieldAttributes(key,axis+' '+label+' segment '+(index+1));
     if(linked)attributes['data-dkds-tooltip']=tr('起始值随上一段的终止值更新。','The start follows the previous segment’s stop.');
     scalarField(row,t(label),segment[key],value=>changeSegment(axis,index,key,value),false,
      attributes,linked);
    }
    const range=rangeChoices(currentRanges(current,[peakVoltage(segment)]),segment.range);
    fsproField(row,{kind:'select',label:t('Range (A)'),value:segment.range,
     options:range.choices,className:'dkts-sweep-field',
     attributes:{...fieldAttributes('range',t('Range (A)')+' '+axis+' '+(index+1)),
      'data-dkds-tooltip':range.help+' '+tr('Auto 沿用端子量程。','Auto follows the terminal range.'),
      ...(range.invalid?{'aria-invalid':'true'}:{})},
     onChange:event=>changeSegment(axis,index,'range',event.target.value)});
    fsproField(row,{kind:'select',label:t('Speed'),value:segment.speed||'Normal',
     options:speedOptions(),className:'dkts-sweep-field',
     attributes:fieldAttributes('speed',axis+' Speed segment '+(index+1)),
     onChange:event=>changeSegment(axis,index,'speed',event.target.value)});
    const removeHost=units.layout.create(row,{variant:'identity',className:'dkts-sweep-remove'});
    units.action.create(removeHost,{id:'remove-'+axis+'-'+index,label:'×',title:t('删除此扫描段'),
     variant:'quiet',enabled:segments.length>1,
     onInvoke:()=>removeSweepSegment(axis,index)});
    if(draft){
     const error=units.note.create(list,{variant:'warning',className:'dkts-inline-issue',text:
      tr('第 ','Segment ')+(index+1)+tr(' 段：',': ')+draft.message});
     error?.setAttribute?.('id',issueId);
     error?.setAttribute?.('role','alert');
    }
   }
  }
  function renderTerminalBadge(host,logical){
   const badge=units.note.create(host,{variant:'meta',className:'dkts-terminal-badge',text:t(logicalNames[logical])});
   badge?.setAttribute?.('data-dkts-terminal-badge',logical);
   badge?.setAttribute?.('data-dkts-terminal-tone',logical);
   return badge;
  }
  function renderTerminalCaption(host,terminal,unit=''){
   const caption=units.layout.create(host,{variant:'identity',className:'dkts-terminal-caption'});
   renderTerminalBadge(caption,terminal.logical);
   if(terminal.resource!=='None')units.note.create(caption,{variant:'meta',text:terminal.resource+unit});
  }
  function renderSweep(host,p,s){
   if(!['iv','transfer','output'].includes(p.kind)){
    units.note.create(host,{variant:'warning',
     text:tr('此测试类型的专用波形编辑器尚未接入。','The waveform editor is unavailable for this test type.')});
    return;
   }
   const input=units.panel.create(host,{variant:'headed',title:tr('输入设置','Input settings'),
    sizing:'content',className:'dkts-input-settings',actionHost:true});
   const reference=p.terminals.find(term=>term.resource==='GNDU');
   if(reference){
    const row=units.layout.create(input.header.actionHost||input.header.actions,
     {variant:'identity',className:'dkts-input-reference dkts-terminal-caption'});
    units.note.create(row,{variant:'meta',text:tr('参考端','Reference')});
    renderTerminalCaption(row,reference);
   }
   renderSweepAxis(input.body,p,'X');
   renderSweepAxis(input.body,p,'P');
   renderFixedBias(input.body,p);
   const options=units.layout.create(host,{variant:'identity',className:'dkts-sweep-options'});
   renderLimitsPanel(options,p);
   renderVariablesPanel(options,p);
   renderAssociateSpecPanel(options,p,s);
   renderTerminalSettings(host,p);
  }
  function renderTerminalSettings(host,p){
   const visible=model.visible(p);
   const panel=units.panel.create(host,{variant:'headed',title:t('Terminal Settings'),
    meta:'',sizing:'content',className:'dkts-terminal-settings'});
   if(!visible.length){units.emptyState.create(panel.body,{message:'尚未分配测量 SMU。'});return;}
   panel.header?.title?.setAttribute?.('data-dkds-tooltip',tr('扫描段选 Auto 时使用本区量程设置，电流保护独立校验。',
    'The Auto segment range uses these terminal settings. Compliance is checked separately.'));
   for(const term of visible){
    const row=units.layout.create(panel.body,{variant:'identity',className:'dkts-terminal-setting'});
    row?.setAttribute?.('data-dkts-terminal-setting',term.logical);
    const heading=units.layout.create(row,{variant:'identity',className:'dkts-terminal-setting-heading'});
    renderTerminalBadge(heading,term.logical);
    units.note.create(row,{variant:'meta',text:term.resource,className:'dkts-terminal-slot'});
    const mode=term.rangeMode==='minimum'?'limited-auto':term.rangeMode;
    const available=currentRanges(term,terminalPeaks(p,term));
    const options=[{value:'auto',label:t('Auto')}];
    for(const [value,label] of [['fixed','Fixed'],['limited-auto','Limited Auto']])
     if(available?.length||mode===value)options.push({value,label:t(label)});
    fsproField(row,{kind:'select',label:t('Range Mode'),value:mode,options,
     onChange:event=>{
      const rangeMode=event.target.value;
      if(rangeMode==='auto'){change(term.logical,'rangeMode',rangeMode);return;}
      if(!available?.length)return;
      const rangeValue=available.includes(Number(term.rangeValue))?term.rangeValue:
       String(available.includes(1e-6)?1e-6:available[0]);
      commitTransaction(()=>model.edit(state(),term.logical,{rangeMode,rangeValue}));
     }});
    const range=rangeChoices(available,mode==='auto'?'auto':term.rangeValue,{auto:mode==='auto'});
    fsproField(row,{kind:'select',label:t('Current Range (A)'),
     value:mode==='auto'?'auto':term.rangeValue,options:range.choices,
     dataset:{dkdsTooltip:range.help},
     attributes:range.invalid?{'aria-invalid':'true'}:{},
     disabled:mode==='auto'||!available?.length,
     onChange:event=>change(term.logical,'rangeValue',event.target.value)});
    fsproField(row,{kind:'select',label:t('Compliance Mode'),value:term.complianceMode||'follow-range',
     options:[{value:'follow-range',label:t('Follow range')},{value:'custom',label:t('Custom')}],
     onChange:event=>change(term.logical,'complianceMode',event.target.value)});
    numericField(row,term.logical,'compliance',t('Compliance (A)'),term.compliance,
     (term.complianceMode||'follow-range')!=='custom');
   }
  }
  function renderFixedBias(host,p){
   const fixed=p.terminals.filter(term=>!['None','GNDU'].includes(term.resource)&&
    (term.role==='CONDITION'||(!p.sweep.pEnabled&&term.role==='P')));
   const panel=units.panel.create(host,{variant:'headed',title:t('Fixed Bias'),
    meta:'',sizing:'content',className:'dkts-fixed-bias-panel'});
   if(!fixed.length){units.note.create(panel.body,{variant:'meta',text:t('没有需要设置固定偏置的已分配 SMU。')});return;}
   const grid=units.layout.create(panel.body,{variant:'identity',className:'dkts-fspro-fixed-bias'});
   for(const term of fixed){
    const unit=term.sourceMode==='current'?' (A)':' (V)';
    const label=t(logicalNames[term.logical])+' · '+term.resource+unit;
    const column=units.layout.create(grid,{variant:'identity',className:'dkts-fixed-bias-entry'});
    renderTerminalCaption(column,term,unit);
    scalarField(column,false,term.bias,value=>change(term.logical,'bias',value),false,
     {'aria-label':label});
   }
  }
  function renderPageInfo(host,p,s){
   const panel=units.panel.create(host,{variant:'headed',title:t('Page Information'),
    meta:'',sizing:'content',className:'dkts-page-info'});
   const grid=units.layout.create(panel.body,{variant:'identity',className:'dkts-fspro-info-grid'});
   fsproField(grid,{kind:'input',label:t('Page Name'),value:p.name,
    onBlur:event=>{if(event.target.value!==p.name)commitTransaction(
     ()=>model.editPage(state(),{name:event.target.value}));}});
   fsproField(grid,{kind:'select',label:t('Test Type'),value:p.kind,
    options:model.KINDS.map(kind=>({value:kind.id,label:t(kind.label)})),
    onChange:event=>commitTransaction(()=>model.editPage(state(),{kind:event.target.value,name:p.name}))});
   scalarField(grid,t('循环次数'),p.sweep.loops,value=>changeSweep('loops',value));
   const device=s.devices.find(row=>row.id===s.activeDeviceId);
   fsproField(grid,{kind:'input',label:t('Device Name'),value:device?.name||'',
    onBlur:event=>{if(event.target.value!==(device?.name||''))commitTransaction(
     ()=>model.editDevice(state(),{name:event.target.value}));}});
   fsproField(grid,{kind:'textarea',label:t('Notes'),value:p.note||'',
    className:'dkts-page-note',onBlur:event=>{if(event.target.value!==(p.note||''))commitTransaction(
     ()=>model.editPage(state(),{note:event.target.value}));}});
  }
  function renderTargetPanel(host,p){
   const panel=units.panel.create(host,{variant:'headed',title:t('Measurement Target'),
    meta:'',sizing:'content',className:'dkts-target-panel',actions:[{id:'add-target',label:t('＋ Target'),
     variant:'quiet',onInvoke:()=>commitTransaction(()=>model.addTarget(state()))}]});
   const head=units.layout.create(panel.body,{variant:'identity',className:'dkts-fspro-target-head'});
   head?.setAttribute?.('aria-hidden','true');
   for(const label of ['Name','Channel','Parameter','Measurement Range',''])
    units.note.create(head,{variant:'meta',text:t(label)});
   const assigned=model.visible(p);
   for(const [index,target] of p.targets.entries()){
    const row=units.layout.create(panel.body,{variant:'identity',className:'dkts-fspro-target-row'});
    fsproField(row,{kind:'input',label:t('Name'),value:target.name,
     onBlur:event=>{if(event.target.value!==target.name)commitTransaction(
      ()=>model.editTarget(state(),index,{name:event.target.value}));}});
    const channelOptions=assigned.map(term=>({value:term.logical,label:t(logicalNames[term.logical])}));
    terminalChoice(row,{kind:'select',label:t('Channel'),value:target.logical,
     options:channelOptions,disabled:channelOptions.length===0,
     onChange:event=>commitTransaction(()=>model.editTarget(state(),index,{logical:event.target.value}))});
    fsproField(row,{kind:'select',label:t('Parameter'),value:target.quantity,
     options:[{value:'Current',label:t('Current')},{value:'Voltage',label:t('Voltage')}],
     onChange:event=>commitTransaction(()=>model.editTarget(state(),index,{quantity:event.target.value}))});
    const targetRange=rangeChoices([],target.range);
    const targetHelp=tr('当前 KXCI 执行器沿用端子和扫描段量程。','The current KXCI executor uses terminal and sweep segment ranges.');
    fsproField(row,{kind:'select',label:t('Measurement Range'),value:target.range,
     options:targetRange.choices,disabled:!targetRange.invalid,
     dataset:{dkdsTooltip:targetHelp},
     attributes:targetRange.invalid?{'aria-invalid':'true'}:{},
     onChange:event=>commitTransaction(()=>model.editTarget(state(),index,{range:event.target.value}))});
    units.action.create(row,{id:'remove-target-'+index,label:'×',title:t('删除测量目标'),
     variant:'quiet',enabled:p.targets.length>1,
     onInvoke:()=>commitTransaction(()=>model.removeTarget(state(),index))});
   }
  }
  function renderStrategyPanel(host,p){
   const panel=units.panel.create(host,{variant:'headed',title:t('Measurement Strategy'),
    meta:'',sizing:'content',className:'dkts-strategy-panel'});
   const grid=units.layout.create(panel.body,{variant:'form-grid-4',className:'dkts-strategy-grid'});
   fsproField(grid,{kind:'select',label:t('扫描模式'),value:p.sweep.mode,
    options:[{value:'linear',label:t('Linear')},{value:'bidirectional',label:t('Forward / Reverse')},
     {value:'hysteresis',label:t('Hysteresis')}],
    onChange:event=>changeSweep('mode',event.target.value)});
   fsproField(grid,{kind:'select',label:t('测试速度'),value:p.sweep.speed,
    options:speedOptions(),onChange:event=>changeSweep('speed',event.target.value)});
   scalarField(grid,t('点间延迟 (ms)'),p.sweep.pointDelay,value=>changeSweep('pointDelay',value));
   scalarField(grid,t('扫描循环'),p.sweep.loops,value=>changeSweep('loops',value));
  }
  function renderLimitsPanel(host,p){
   const panel=units.panel.create(host,{variant:'headed',title:t('Limits'),
    meta:'',sizing:'content',className:'dkts-limits-panel'});
   const grid=units.layout.create(panel.body,{variant:'form-grid-2',className:'dkts-limits-grid'});
   const voltageHelp=tr('由 4200A 实装模块能力数据库和安全策略核验。',
    'Checked against the installed 4200A module capabilities and safety policy.');
   const outputHelp=tr('具体电压、电流、功率及时序限制由实际安装模块核验。网页预览只支持离线规划。',
    'Installed modules determine voltage, current, power and timing limits. The browser preview supports offline planning.');
   fsproField(grid,{kind:'input',label:t('电压软件输入预检上界 (V)'),value:'',readOnly:true,
    dataset:{dkdsTooltip:voltageHelp},attributes:{'aria-description':voltageHelp}});
   const connection=measurementRuntime.status().connection;
   const outputState=connection.phase==='connected'?tr('已连接','Connected'):tr('未连接','Disconnected');
   fsproField(grid,{kind:'input',label:t('仪器输出'),value:outputState,readOnly:true,
    dataset:{dkdsTooltip:outputHelp},attributes:{'aria-description':outputHelp}});
  }
  function renderVariablesPanel(host,p){
   const panel=units.panel.create(host,{variant:'headed',title:t('Page Var'),meta:'',sizing:'content',
    className:'dkts-variables-panel',actions:[{id:'add-var',label:'＋',title:t('新增页面变量'),variant:'quiet',
     onInvoke:()=>commitTransaction(()=>model.addVariable(state()))}]});
   if(!p.variables.length){units.emptyState.create(panel.body,{message:t('尚未定义页面变量。')});return;}
   for(const [index,variable] of p.variables.entries()){
    const row=units.layout.create(panel.body,{variant:'form-grid-4',className:'dkts-page-var-row'});
    fsproField(row,{kind:'input',label:t('Name'),value:variable.name,
     onBlur:event=>commitTransaction(()=>model.editVariable(state(),index,{name:event.target.value}))});
    scalarField(row,t('Value'),variable.value,value=>commitTransaction(
     ()=>model.editVariable(state(),index,{value})));
    fsproField(row,{kind:'input',label:t('Unit'),value:variable.unit,
     onBlur:event=>{if(event.target.value!==variable.unit)commitTransaction(
      ()=>model.editVariable(state(),index,{unit:event.target.value}));}});
    units.action.create(row,{id:'remove-var-'+index,label:'×',title:t('删除变量'),variant:'quiet',
     onInvoke:()=>commitTransaction(()=>model.removeVariable(state(),index))});
   }
  }
  function renderAssociateSpecPanel(host,p,s){
   const available=s.specs.filter(spec=>spec.deviceId===s.activeDeviceId);
   const panel=units.panel.create(host,{variant:'headed',title:t('Associate Spec'),meta:'',sizing:'content',
    className:'dkts-spec-panel',actions:[{id:'add-spec-inline',label:t('＋ Spec'),title:t('新建并关联规格'),
     variant:'quiet',onInvoke:()=>commitTransaction(()=>model.addSpec(state()))}]});
   const label=tr('关联器件规格','Associate device specification');
   fsproField(panel.body,{kind:'select',label:false,value:p.associateSpecId||'',
    options:[{value:'',label:t('未关联')},...available.map(spec=>({value:spec.id,label:spec.name}))],
    attributes:{'aria-label':label},controlDataset:{dktsAssociateSpec:'true'},disabled:!available.length,
    dataset:available.length?{}:{dkdsTooltip:tr('可使用标题栏的＋规格新建。','Use ＋ Spec to add a device specification.')},

    onChange:event=>commitTransaction(()=>model.associateSpec(state(),event.target.value||null))});
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
    emptyText:()=>tr('暂无可显示的数据','No data to display'),
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
    {id:'export-original',label:t('导出完整原始 CSV'),
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
   // A Page and the plot overview share the same workspace surface.
   if(workRegion&&editorRegion&&plotRegion){
    workRegion.setAttribute?.('data-dkts-editor-open',editorOpen?'true':'false');
    editorRegion.hidden=!editorOpen;
    plotRegion.hidden=editorOpen;
    if(!editorOpen)for(const item of plots)item?.requestRender?.('graph-visible');
   }
  }
  function openTestType(kind){
   projectSurface?.close();
   editorOpen=true;
   editorSection='sweep';
   persist(model.add(state(),kind));
  }
  function showEditor(id,section){
   projectSurface?.close();editorOpen=true;editorSection=section;
   persist(model.select(state(),id));
   parameters.scrollTop=0;
  }
  function showRoutine(id){
   projectSurface?.close();editorOpen=false;
   persist(model.selectRoutine(state(),id));
  }
  function addTreeMenu(host,items){
   function open(event,anchor){
    const box=anchor?.getBoundingClientRect?.();
    if(!box||!ctx.ui.contextMenus?.open)return;
    treeMenu?.dispose?.();
    treeMenu=ctx.ui.contextMenus.open({anchor,
     x:event?.type==='contextmenu'?event.clientX:box.left,
     y:event?.type==='contextmenu'?event.clientY:box.bottom+3,items:items()});
   }
   host?.addEventListener?.('contextmenu',event=>{
    event.preventDefault();
    open(event,host);
   });
   return open;
  }
  async function editRoutineLoops(routine){
   const label=tr('流程循环次数','Routine loop count');
   let value=routine.loops,message=routine.name;
   for(;;){
    const draft=await ctx.ui.dialogs.prompt({title:label,message,input:{type:'number',label,value},
     cancelLabel:t('取消'),confirmLabel:t('保存')});
    if(draft===null)return;
    value=draft.trim();
    if(/^[1-9][0-9]*$/.test(value)&&Number(value)<=10000){
     commitTransaction(()=>model.setRoutineLoops(state(),routine.id,value));
     return;
    }
    message=tr('循环次数须为 1–10000 的整数。','Enter a whole number from 1 to 10000.');
   }
  }
  function render(){
   if(!nav||!parameters)return;
   updateEditorLayout();
   editorRegion?.setAttribute?.('lang',language);
   nav?.setAttribute?.('lang',language);
   const s=state(),p=active();
   syncGraphSettings();applyFrameLayout();
   treeMenu?.dispose?.();treeMenu=null;
   nav.replaceChildren();
   // Real DKDS Core Units own the Device/Routine/Page/Spec project tree.
   const device=s.devices.find(d=>d.id===s.activeDeviceId);
   const visibleSpecs=s.specs.filter(spec=>spec.deviceId===s.activeDeviceId);
   projectToolbar.replaceChildren();
   const projectActions=units.layout.create(projectToolbar,{variant:'identity',className:'dkts-project-actions'});
   for(const [id,label,onInvoke] of [
    ['add-device',t('+ Device'),()=>{projectSurface?.close();editorOpen=false;persist(model.addDevice(state()));}],
    ['add-routine',t('+ Routine'),()=>{projectSurface?.close();editorOpen=false;persist(model.addRoutine(state()));}],
    ['add-spec',t('+ Spec'),()=>{projectSurface?.close();editorOpen=true;editorSection='sweep';persist(model.addSpec(state()));}]
   ])units.action.create(projectActions,{id,label,variant:'quiet',direct:true,onInvoke});
   units.action.create(projectActions,{id:'add-test-page',label:t('+ Page'),menu:true,variant:'quiet',
    items:()=>model.KINDS.map(kind=>({id:'add-test-'+kind.id,label:t(kind.label),onInvoke:()=>openTestType(kind.id)}))});
   const routine=s.routines.find(item=>item.id===s.activeRoutineId);
   units.note.create(projectToolbar,{variant:'meta',className:'dkts-breadcrumb',
    text:[t('测试工程'),device?.name,routine?.name,p.name].filter(Boolean).join(' / ')});
   const projectHeader=units.header.create(nav,{kind:'panel',variant:'content',
    title:t('Project Explorer'),meta:'',actionHost:true});
   projectHeader.element?.setAttribute?.('data-dkts-workspace-heading','true');
   const closeNav=units.action.create(projectHeader.actions,{id:'close-project-drawer',label:'‹',
    title:t('收起工程导航'),variant:'quiet',direct:true,onInvoke:()=>projectSurface?.close()});
   closeNav?.element?.setAttribute?.('data-dkts-nav-toggle','true');
   const treeHost=units.layout.create(nav,{variant:'stack-compact',className:'dkts-project-tree'});
   for(const item of s.devices){
    const branch=units.layout.create(treeHost,{variant:'stack-compact',className:'dkts-device-branch'});
    branch?.setAttribute?.('data-dkts-device',item.id);
    const deviceRow=units.layout.create(branch,{variant:'identity',className:'dkts-tree-row dkts-tree-device'});
    units.list.create(deviceRow,{variant:'compact'}).item({leading:'▤',title:item.name,
     onInvoke:()=>{projectSurface?.close();editorOpen=false;persist(model.selectDevice(state(),item.id));}});
    const routines=units.layout.create(branch,{variant:'stack-compact',className:'dkts-device-routines'});
    for(const routine of s.routines.filter(r=>r.deviceId===item.id))
     renderRoutine(routines,routine,s);
   }
   if(visibleSpecs.length){
    units.header.create(nav,{kind:'section',variant:'section',title:t('关联规格'),
     meta:String(visibleSpecs.length)});
    const specs=units.list.create(nav,{variant:'compact'});
    for(const spec of visibleSpecs)
     specs.item({leading:'◇',title:spec.name,
      selected:spec.id===p.associateSpecId,
      onInvoke:()=>{projectSurface?.close();editorOpen=true;editorSection='sweep';persist(model.associateSpec(state(),spec.id));}});
   }
   const librarySection=units.layout.create(nav,{variant:'stack-compact',className:'dkts-library-section'});
   units.header.create(librarySection,{kind:'section',variant:'section',title:t('TEST LIBRARY')});
   const library=units.layout.create(librarySection,{variant:'identity',className:'dkts-test-library'});
   for(const kind of model.KINDS)units.action.create(library,{id:'library-'+kind.id,
    label:t(kind.label),variant:'quiet',direct:true,onInvoke:()=>openTestType(kind.id)});
   renderEditor(p,s);
  }
  function renderRoutine(treeHost,routine,s){
   const routinePages=s.pages.filter(page=>page.routineId===routine.id);
   const routineHost=units.layout.create(treeHost,{variant:'identity',className:'dkts-tree-routine'});
   routineHost?.setAttribute?.('data-dkts-routine',routine.id);
   const routineRow=units.layout.create(routineHost,{variant:'identity',className:'dkts-tree-row'});
   units.list.create(routineRow,{variant:'compact'}).item({leading:'▦',title:routine.name,
    selected:!editorOpen&&routine.id===s.activeRoutineId,
    onInvoke:()=>showRoutine(routine.id)});
   const openMenu=addTreeMenu(routineRow,()=>[
    {id:'routine-loops',label:tr('循环次数','Loop count')+' · '+routine.loops,onInvoke:()=>editRoutineLoops(routine)},
    {id:'show-plots',label:t('绘图区'),onInvoke:()=>showRoutine(routine.id)},
    ...model.KINDS.map(kind=>({id:'add-'+kind.id,label:tr('新增 ','Add ')+t(kind.label),
     onInvoke:()=>{projectSurface?.close();editorOpen=true;editorSection='sweep';
      persist(model.add(model.selectRoutine(state(),routine.id),kind.id));}}))
   ]);
   const menuLabel=tr('流程菜单','Routine menu')+' · '+routine.name;
   const more=units.action.create(routineRow,{id:'dkts-routine-menu-'+routine.id,label:'…',title:menuLabel,
    variant:'quiet',direct:true,className:'dkts-tree-more',onInvoke:()=>openMenu(null,more?.element)});
   more?.element?.setAttribute?.('aria-label',menuLabel);
   more?.element?.setAttribute?.('aria-haspopup','menu');
   const pagesHost=units.layout.create(routineHost,{variant:'identity',className:'dkts-tree-pages'});
   for(const page of routinePages){
    const pageHost=units.layout.create(pagesHost,{variant:'identity',className:'dkts-project-page dkts-tree-row'});
    pageHost?.setAttribute?.('data-dkts-page-select',page.id);
    units.list.create(pageHost,{variant:'compact'}).item({leading:'▧',title:page.name,
     selected:editorOpen&&page.id===s.activeId,
     onInvoke:()=>showEditor(page.id,'sweep')});
    const stopping=measurementRuntime.status().run.running&&runPageId===page.id;
    const executionLabel=stopping?tr('停止测试','Stop test'):tr('执行测试','Run test');
    const run=units.action.create(pageHost,{id:'dkts-run-'+page.id,label:stopping?'■':'▶',
     title:executionLabel,variant:'quiet',direct:true,className:'dkts-tree-run',
     onInvoke:()=>openExecution(page)});
    run?.element?.setAttribute?.('aria-label',executionLabel+' · '+page.name);
    addTreeMenu(pageHost,()=>[
     {id:'edit',label:tr('编辑页面','Edit page'),onInvoke:()=>showEditor(page.id,'sweep')},
     {id:'rename',label:tr('页面名称与信息','Name and page info'),onInvoke:()=>showEditor(page.id,'info')},
     {id:'remove',label:tr('删除页面','Delete page'),enabled:state().pages.length>1,
      onInvoke:async()=>{
       const confirmed=await ctx.ui.dialogs.confirm({title:tr('删除页面','Delete page'),
        message:page.name,confirmLabel:tr('删除','Delete'),destructive:true});
       if(confirmed)persist(model.remove(state(),page.id));
      }}
    ]);
   }
  }
  function renderEditor(p,s){
   // The mapped terminals belong to the Page heading; the scan content stays below the primary tabs.
   editorHeading.replaceChildren();
   const title=units.header.create(editorHeading,{kind:'panel',variant:'content',
    title:p.name,actionHost:true,titleEmphasis:'prominent'});
   const headerActions=units.layout.create(title.actions,{variant:'identity',className:'dkts-page-actions'});
   const navEditor=units.action.create(headerActions,{id:'dkts-project-toggle-editor',
    label:t('导航'),title:t('打开或收起工程导航'),variant:'quiet',
    onInvoke:()=>projectSurface?.toggle()});
   navEditor?.element?.setAttribute?.('data-dkts-nav-toggle','true');
   terminalRegion=units.layout.create(headerActions,{variant:'identity',className:'dkts-terminal-strip'});
   terminalRegion?.setAttribute?.('data-dkts-terminal-strip','true');
   const terminalGroup=units.layout.create(terminalRegion,{variant:'row',className:'dkts-terminal-control-group'});
   const terminalToolbar=units.layout.create(terminalGroup,{variant:'row',className:'dkts-terminal-toolbar'});
   terminalToolbar?.setAttribute?.('data-dkts-port-desktop','true');
   terminalToolbar.hidden=!terminalVisible;
   const portOptions=['None','GNDU','SMU1','SMU2','SMU3','SMU4','SMU5','SMU6','SMU7','SMU8','SMU9']
    .map(value=>({value,label:t(value)}));
   for(const logical of ['S','D','G']){
    const term=p.terminals.find(item=>item.logical===logical);
    const terminal=units.layout.create(terminalToolbar,{variant:'identity',className:'dkts-terminal-item'});
    renderTerminalBadge(terminal,logical);
    fsproField(terminal,{kind:'select',label:t(logicalNames[logical])+' · '+logical,
     controlOnly:true,controlClassName:'dkts-terminal-field',value:term?.resource||'None',
     attributes:{'aria-label':t(logicalNames[logical])+' ('+logical+') '+t('端口'),title:t(logicalNames[logical])+' ('+logical+')'},
     options:portOptions,onChange:event=>change(logical,'resource',event.target.value)});
   }
   let mobilePortAction=null;
   function openPortPopover(anchor){
    portPopover?.close?.();let draft=model.validate(state());
    const pop=units.popover.create(null,{variant:'picker',title:t('Terminal 端口映射'),
     role:'dialog',ariaLabel:t('Source、Drain、Gate 端口映射'),anchor,placement:'bottom-start',
     dismissOnOutside:true,offset:4,onClose:()=>{if(portPopover===pop)portPopover=null;}});
    portPopover=pop;
    const form=units.layout.create(pop.body,{variant:'form-grid-2',className:'dkts-mobile-port-grid'});
    const draftPage=draft.pages.find(item=>item.id===draft.activeId);
    for(const logical of ['S','D','G']){
     const term=draftPage.terminals.find(item=>item.logical===logical);
     const pair=units.layout.create(form,{variant:'stack-compact',className:'dkts-bias-entry'});
     renderTerminalBadge(pair,logical);
     fsproField(pair,{kind:'select',label:false,
      value:term.resource,options:portOptions,attributes:{'aria-label':t(logicalNames[logical])+' ('+logical+') '+t('端口')},
      onChange:event=>{try{draft=model.edit(draft,logical,{resource:event.target.value});}
       catch(error){event.target.value=term.resource;ctx.status.set('端口映射无效：'+String(error.message||error));}}});
    }
    const actions=units.layout.create(pop.body,{variant:'row-wrap'});
    units.action.create(actions,{id:'apply-port-map',label:t('应用'),variant:'primary',onInvoke:()=>{
     try{const next=model.validate(draft),opened=portPopover;portPopover=null;opened?.close?.();persist(next);}
     catch(error){ctx.status.set('端口映射无效：'+String(error.message||error));}
    }});
    units.action.create(actions,{id:'cancel-port-map',label:t('取消'),variant:'quiet',
     onInvoke:()=>{pop.close();if(portPopover===pop)portPopover=null;}});
    return pop;
   }
   mobilePortAction=units.action.create(terminalGroup,{id:'mobile-port-map',label:t('端口'),
    title:t('配置 Source、Drain、Gate 端口'),variant:'secondary',
    onInvoke:()=>openPortPopover(mobilePortAction?.element)});
   mobilePortAction?.element?.setAttribute?.('data-dkts-port-mobile','true');
   if(mobilePortAction?.element)mobilePortAction.element.hidden=!terminalVisible;
   units.action.create(terminalGroup,{id:'toggle-terminal-strip',label:terminalVisible?t('隐藏'):tr('展开','Expand'),
    title:t('折叠或展开 Terminal 端口映射'),variant:'quiet',onInvoke:()=>{
     terminalVisible=!terminalVisible;
     terminalRegion?.setAttribute?.('data-dkts-terminal-collapsed',terminalVisible?'false':'true');
     render();
    }});
   units.action.create(terminalGroup,{id:'dkts-4200a-connect',className:'dkts-connect-menu',integrated:false,
    label:()=>t(measurementRuntime.status().connection.phase==='connected'?'已连接':
     measurementRuntime.status().connection.phase==='connecting'?'连接中':'连接'),
    title:t('4200A 连接状态、连接/断开与网络设置'),variant:'secondary',menu:true,
    enabled:()=>measurementRuntime.status().connection.phase!=='connecting',
    items:()=>[{id:'toggle-4200a-connection',
      label:t(measurementRuntime.status().connection.phase==='connected'?'断开仪器':'连接仪器'),
      onInvoke:toggleInstrumentConnection},
     {id:'open-4200a-settings',label:t('连接设置'),onInvoke:()=>connectionSettings.open()}]});
   terminalRegion?.setAttribute?.('data-dkts-terminal-collapsed',terminalVisible?'false':'true');

   if(editorSection!=='info'&&!PAGE_TABS.some(([id])=>id===editorSection))editorSection='sweep';
   editorTabs.replaceChildren();
   function selectTab(id){
    if(!PAGE_TABS.some(row=>row[0]===id)||id===editorSection)return;
    const scroll=parameters.scrollTop;
    editorSection=id;
    render();
    parameters.scrollTop=0;
    if(scroll)editorTabs.scrollIntoView?.({block:'nearest'});
    editorTabs.querySelector?.('[aria-selected="true"]')?.focus?.({preventScroll:true});
   }
   units.tabs.create(editorTabs,{variant:'compact',className:'dkts-tab-bar',value:editorSection,
    tabsClassName:'dkts-fspro-tablist',items:PAGE_TABS.map(([id,label])=>({
     id,label:t(label),selected:id===editorSection,onClick:()=>selectTab(id)
    })),onChange:selectTab});
   parameters.replaceChildren();
   if(editorSection==='info')renderPageInfo(parameters,p,s);
   else if(editorSection==='sweep')renderSweep(parameters,p,s);
   else if(editorSection==='target')renderTargetPanel(parameters,p);
   else if(editorSection==='strategy')renderStrategyPanel(parameters,p);


  }
  ctx.ui.activities.add({id:ACTIVITY,label:'4200A',contextLabel:'DK Test Studio',icon:'▦',
   order:82,primary:true,openMode:'window',artifactHydration:'live',
   onActivate:()=>{ctx.workspace.openPage(PAGE);refreshData();}});
  function toggleLanguage(){
   language=language==='en'?'zh-CN':'en';
   preferences.set({language});
   defineConnectionSettings();
   syncLanguageButton();
   const scroll=parameters.scrollTop;
   render();
   parameters.scrollTop=scroll;
   updateGraphLanguage();
   if(measurementRuntime.status().connection.phase==='disconnected')showOfflineStatus();
  }
  const languageButton=ctx.ui.toolbar?.add({id:'dkts-workspace-language',
   activity:ACTIVITY,group:'analysis',section:'language',variant:'secondary',order:10,priority:100,
   label:tr('EN','中文'),onClick:toggleLanguage});
  function syncLanguageButton(){
   if(!languageButton)return;
   const label=tr('Switch to English','切换为简体中文');
   languageButton.textContent=tr('EN','中文');
   languageButton.setAttribute('aria-label',label);
   languageButton.title=label;
   languageButton.lang=tr('en','zh-CN');
  }
  syncLanguageButton();
  const page=ctx.ui.pages.add({id:'dkts-4200a-page',pageId:PAGE,activity:ACTIVITY,
   label:'4200A',title:'',toolbar:false,html:''});
  // The Core SUPER activity bar already identifies this testing workspace.
  // A duplicate Page Header wastes 42px; SUPER hides its import action slot.
  // Keep the DKDS-owned page body, tabs, plotting and status intact.
  const body=units.page.create(page,{variant:'analysis'}).element;
  const container=units.layout.create(body,{variant:'identity'});
  wb=units.workspace.create(container,{variant:'standard',header:false,
   activity:ACTIVITY,primaryScroll:'safe'});
  // The plugin composes standard DKDS Units, including in an unmodified DKDS host.
  const workspace=units.layout.create(null,{variant:'identity',className:'dkts-workbench'});
  const projectToolbar=units.layout.create(workspace,{variant:'identity',className:'dkts-project-toolbar'});
  const main=units.layout.create(workspace,{variant:'identity',className:'dkts-main-grid'});
  const projectPanel=units.panel.create(main,{variant:'control-card',
   header:false,sizing:'fill',className:'dkts-project-panel'});
  projectPanel.body?.setAttribute?.('data-dkts-project-body','true');
  nav=units.layout.create(projectPanel.body,{variant:'stack-compact',
   className:'dkts-project-navigation'});
  // DKDS owns the drawer surface paint, not plugin CSS.
  projectSurface=uiShell.attach(units,main,projectPanel.element);
  // FS-Pro keeps the Page inspector and independent PlotGroup in sibling
  // columns. Selecting a Page never replaces or unmounts the graph surface.
  const work=units.layout.create(main,{variant:'identity',className:'dkts-work-region'});
  work?.setAttribute?.('data-dkts-work','true');
  const editor=units.layout.create(work,{variant:'identity',className:'dkts-page-editor'});
  editor?.setAttribute?.('data-dkts-editor','true');
   editorHeading=units.layout.create(editor,{variant:'identity',className:'dkts-page-heading'});
  editorTabs=units.layout.create(editor,{variant:'identity',className:'dkts-editor-tabs'});
  parameters=units.layout.create(editor,{variant:'identity',
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
   variant:'content',title:t('绘图区'),meta:'',actionHost:true});
  plotsHeading.element?.setAttribute?.('data-dkts-workspace-heading','true');
  const frameTools=units.layout.create(plotsHeading.actions,{variant:'row-wrap',
   className:'dkts-plot-toolbar'});
  const navGraph=units.action.create(plotsHeading.actions,{id:'dkts-project-toggle-graph',
   label:t('导航'),title:t('打开或收起工程导航'),variant:'quiet',
   onInvoke:()=>projectSurface?.toggle()});
  navGraph?.element?.setAttribute?.('data-dkts-nav-toggle','true');
  syncGraphSettings();
  const layoutField=fsproField(frameTools,{kind:'select',label:t('图窗布局'),controlOnly:true,
    attributes:{'aria-label':'图窗布局','title':'图窗布局'},value:frameLayout,
   options:[{value:'1',label:t('单窗口')},{value:'2',label:t('双窗口')},
    {value:'4',label:t('四宫格')}],
   onChange:e=>saveGraphSetting(-1,'count',e.target.value)});
  const groupHost=units.layout.create(plotArea,{variant:'identity',
   className:'dkts-project-plot-group'});
  groupHost?.setAttribute?.('data-dkts-plot-group','four-independent-frames');
  frameGroup=units.plotGroup.create(groupHost,{columns:2,preferredColumns:2,
   maxColumns:4,minItemWidth:342,responsive:true,density:'compact',
   orientationPolicy:{mode:'portrait-offset',offset:-1,minColumns:1}});
  const frameTitles=[1,2,3,4].map(index=>tr('图窗 ','Plot ')+index);
  const graphUpdates=[];
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
   const frameKind=units.action.create(frameActions,{
    id:'dkts-frame-kind-'+(index+1),label:()=>tr('显示','View'),
    title:'切换图窗 '+(index+1)+' 的图形类型',
    menu:true,variant:'quiet',items:()=>frameOptions().map(kind=>({
     id:'kind-'+kind.value,
     label:(frameKinds[index]===kind.value?'✓ ':'')+kind.label,
     onInvoke:()=>saveGraphSetting(index,'kind',kind.value)
    }))
   });
   const frameData=units.action.create(frameActions,{
    id:'dkts-frame-data-'+(index+1),
    label:()=>t('数据'),title:t('选择数据中心数据源或导出原始 CSV'),
    menu:true,variant:'quiet',items:()=>frameDataMenu(index)
   });
   graphUpdates.push(()=>{
    if(graphicHeader.title)graphicHeader.title.textContent=tr('图窗 ','Plot ')+(index+1);
    frameKind?.actionGroup?.update?.();
    frameData?.actionGroup?.update?.();
   });
   const plotHost=units.layout.create(graphic.body,{variant:'plot-card-fill'});
   plotHost?.setAttribute?.('data-dkts-plot-host','true');
   framePlotHosts.push(plotHost);
   const rawHost=units.layout.create(graphic.body,{variant:'scroll-pane'});
   rawHost?.setAttribute?.('data-dkts-raw-host','true');
   frameTableHosts.push(rawHost);
   frameTables.push(units.table.mount('dkts-frame-'+(index+1)+'-raw',rawHost,{
    variant:'standard',persistKey:'dkts-frame-'+(index+1)+'-raw',
    appearance:{density:'compact',stripe:'subtle'},columns:[],rows:[]}));
   const view=frameGroup.adoptPlot('dkts-4200a-frame-'+(index+1),graphic.element,{
    variant:'complete',title:frameTitles[index],plot:plotHost,
    header:graphicHeader.element,actionsHost:graphicHeader.actions,
    fileStem:'DKTS_4200A_frame_'+(index+1),images:true,copy:true,csv:false,
    // Home plots use Core-owned available height, not a fixed 2.25:1 aspect
    // ratio that left a second empty-looking band below each plot on tablet.
    placements:['home','left','right','bottom','float','global'],stateVersion:'dkts-native-v5'});
   // Recreate only the scientific surface when this window changes axes.
   const instance=createFramePlot(index);
   plotViews.push(view);
   if(index===0){plotView=view;plot=instance;}
  }
  updateGraphLanguage=()=>{
   plotRegion?.setAttribute?.('lang',language);
   if(plotsHeading.title)plotsHeading.title.textContent=t('绘图区');
   if(layoutField?.control){
    layoutField.control.setAttribute('aria-label',t('图窗布局'));
    layoutField.control.title=t('图窗布局');
    for(const [i,key] of ['单窗口','双窗口','四宫格'].entries())
     if(layoutField.control.options?.[i])layoutField.control.options[i].text=t(key);
   }
   for(const update of graphUpdates)update();
   for(const plot of plots)plot?.requestRender?.('language');
  };
  updateGraphLanguage();
  applyFrameLayout();
  refreshRawTables();
  // FS-Pro Page editing keeps terminal assignment in one visible strip.
  // A duplicate dockable PRIME caused the same four ports to appear twice.
  wb.compose({primary:{id:'main',label:t('测试工程'),
   presentationRole:'scientific-primary',scroll:'safe',
   titlePolicy:'host-only',mainNode:workspace},primes:[],subs:[]});
  ctx.ui.topWorkspace.register({id:ACTIVITY,activity:ACTIVITY,
   label:'4200A',icon:'▦',layout:{mode:'native',
    root:{selector:'#'+PAGE+' .dkds-plugin-workspace'},
    primary:{id:'main',role:'analysis-primary',
     presentationRole:'scientific-primary',priority:100,collapsible:false},
    prime:[],sub:[]}});
  const off=ctx.events?.on?.('data:artifacts-changed',refreshData);
  window.addEventListener?.('resize',updateEditorLayout);
  render();refreshData();
  function showOfflineStatus(){ctx.status.set(tr('4200A 离线 · 可编辑和校验测试规划','4200A offline · edit and validate the sweep plan'));}
  const connection=connectionSettings.get();
  if(connection.host&&connection.expectedSerial){
   ctx.status.set('4200A 工作区已加载；正在按保存的地址自动连接');
   Promise.resolve().then(()=>measurementRuntime.connectAndInspect(connection))
    .catch(error=>{ctx.status.set('4200A 自动连接失败：'+String(error.message||error));render();});
  }else{
   showOfflineStatus();
  }
  return {deactivate(){treeMenu?.dispose?.();projectSurface?.dispose();window.removeEventListener?.('resize',updateEditorLayout);
   pad?.close?.();portPopover?.close?.();off?.();for(const item of plots)item?.dispose?.();
   for(const item of plotViews)item?.dispose?.();
   for(const item of frameTables)item?.dispose?.();frameGroup?.dispose?.();wb?.dispose?.();}};
 });
})();