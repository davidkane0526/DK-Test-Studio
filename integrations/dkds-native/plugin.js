(() => {
 'use strict';
 const manifest={"id":"com.dkts.keithley-4200","name":"DK Test Studio - Keithley 4200A","version":"0.8.39","apiVersion":"1.19.0","entry":"plugin.js","scripts":["hardware-capabilities.js","kxci-protocol.js","identity-core.js","measurement-plan.js","kxci-measurement.js","model.js","measurement-data.js","measurement-runtime.js","ui-shell.js","plugin.js"],"enabled":true,"order":82,"description":"Native DKDS TOP workbench: FS-Pro scan editor, verified KXCI connection and guarded SMU execution; raw TI data is published to the DKDS Data Center.","pluginType":"workbench","requiresCore":["status","events","workspace","project","state","modules","io","data.model","data.sources","data.artifacts","ui.workspace","ui.dom","ui.unit-templates","ui.scientific-plot","ui.table","ui.activities","ui.toolbar","ui.context-menus","ui.top-workspace","ui.pages","capabilities","ui.settings","ui.dialogs"],"capabilities":["ui.page","ui.top-workspace","ui.plugin-workspace","ui.scientific-plot","data.scoped-sources","project.slice"],"platformPresentation":{"desktop":{"mode":"shared"},"mobile":{"mode":"adaptive"}},"workspace":{"role":"top","activity":"dkts-keithley-4200","icon":"▦","title":"4200A 测试","defaultSuper":true},"window":{"activity":"dkts-keithley-4200","title":"DK Test Studio 4200A","width":1380,"height":860,"minWidth":820,"minHeight":560,"dependencies":["scientific-renderer"],"prewarm":false,"reuse":true,"persistence":"project","artifactHydration":"live"},"data":{"accepts":["science.transport.iv","data.table"]},"styles":["ui-shell.css"],"pluginDependencies":[{"id":"builtin.connectivity-center"}]};
 DKDSPlugins.define(manifest,async ctx=>{
  const model=ctx.modules.require('model'),measurementData=ctx.modules.require('measurementData'),
   measurementRuntimeModule=ctx.modules.require('measurementRuntime'),units=ctx.ui.unitTemplates,
   uiShell=ctx.modules.require('uiShell');
  if(typeof measurementData?.publishRaw!=='function')throw Error('KXCI Data Center publisher missing');
  const ACTIVITY='dkts-keithley-4200',PAGE='dktsKeithley4200Page';
  const preferences=ctx.ui.settings.define('workspace-language',{defaults:{language:'zh-CN'}});
  let language=preferences.get('language')==='en'?'en':'zh-CN';
  const wiringPreferences=ctx.ui.settings.define('instrument-wiring',{defaults:{profile:''}});
  const navigationPreferences=ctx.ui.settings.define('workspace-navigation',{defaults:{templatesCollapsed:false,templateGroups:{}}});
  let templatesCollapsed=navigationPreferences.get('templatesCollapsed')===true;
  const templateGroups={...navigationPreferences.get('templateGroups')};
  const userTemplates=ctx.ui.settings.define('test-templates',{defaults:{items:[]}});
  let routineSettings=null;
  const tr=(zh,en)=>language==='en'?en:zh;
  const t=key=>uiShell.translate(key,language);
  const newTestKinds=model.KINDS.filter(kind=>!['iv','arb'].includes(kind.id));
  let updateGraphLanguage=()=>{};
  let treeMenu=null,executionDialogOpen=false,runPageId=null,runConfirmationPending=false;
  const segmentDrafts=new Map();
  let sweepIssue=null;


  const store=ctx.state.create(model.initial(),{projectSlice:'settings'});
  const targetPlotKeys=[];
  let wb=null,plot=null,plotView=null,plots=[],plotViews=[],frameCards=[],frameSelections=['','','',''],frameKinds=['iv','transfer','it','raw'],frameGroup=null,frameTableHosts=[],framePlotHosts=[],frameTables=[],frameLayout='4',nav=null,parameters=null,dataNote=null,pad=null,portPopover=null,editorTabs=null,editorHeading=null,terminalRegion=null;
  let editorSection='sweep',editorOpen=false,plotScope='project',workRegion=null,editorRegion=null,plotRegion=null,projectSurface=null;
  let instrumentBusy=false,connectionDialogOpen=false;
  let smuIntegrationPopover=null;
  let layoutField=null,historyHost=null,plotsHeading=null;
  let specNavigation=null;
  const historyChoices=new Map();
  const timingDrafts=new Map();
  const dcDrafts=new Map();
  const timeDrafts=new Map();
  const fieldIssues=new Map(),runButtons=new Map();
  let editorPlan=null,editorPageId=null,parameterStatus=null,parameterOutputs=null;
  let disposeTimePreview=null,timeTimingTip=null;
  const hardware=ctx.modules.require('dkts-capabilities');
  const defineConnectionSettings=()=>ctx.ui.settings.define('instrument-connection',{
   title:tr('4200A 高级连接设置','4200A advanced connection settings'),
   description:tr('通常只需输入仪器地址。其余设置用于修改 KXCI 端口、网络选路或已记住的序列号。',
    'Normally only the instrument address is needed. Change these settings for a custom KXCI port, network route or remembered serial number.'),
   defaults:{host:'',port:1225,timeoutMs:5000,networkMode:'auto',
    interfaceName:'',expectedSerial:'',autoReconnect:false},
   fields:[
    {id:'port',label:t('KXCI TCP 端口'),type:'number',min:1,max:65535,
     description:tr('默认 1225。只有在仪器的 KCon 中修改过端口时才需要改。','Default 1225. Change only if the port was changed in KCon.')},
    {id:'expectedSerial',label:tr('已记住的序列号','Remembered serial number'),type:'text',
     description:tr('首次连接自动读取。更换同一地址上的仪器时，可清空后重新识别。','Read automatically on first connection. Clear it to identify a replacement instrument at the same address.')},
    {id:'timeoutMs',label:t('连接/读取超时 (ms)'),type:'number',min:250,max:30000},
    {id:'networkMode',label:t('网络接口模式'),type:'select',options:[
     {value:'auto',label:t('自动')},{value:'ethernet',label:t('以太网')},
     {value:'wifi',label:'Wi-Fi'},{value:'interface',label:t('指定网卡')}]},
    {id:'interfaceName',label:t('指定网卡名称'),type:'text',
     description:tr('自动模式留空。只有手动指定本机网络接口时才需要填写。','Leave blank in Auto mode. Required only when manually selecting a local network interface.')}
   ]
  });
  const connectionSettings=defineConnectionSettings();
  const measurementRuntime=measurementRuntimeModule.createRuntime(ctx,{
   getSmuIntegration:()=>state().smuIntegration,
   onChange:update=>{
    if(update.event==='measurement-progress'){
     if(update.run.currentStage&&runPageId!==update.run.currentStage.pageId){runPageId=update.run.currentStage.pageId;render();}
     const received=Math.max(update.run.totalRows,update.run.liveRows?.at(-1)?.sequence||0);
     ctx.status.set('4200A 测量执行中：已接收 '+received+' / '+update.run.totalPoints+' 点');
     for(const item of plots)item?.requestRender?.('measurement-batch');
     return;
    }
    if(update.event==='connected')ctx.status.set('4200A 身份已验证：'+(update.connection.identity?.serial||''));
    else if(update.event==='modules-inspected'){
     const inventory=update.connection.inventory;
     const modules=inventory?.slots||[];
     const count=family=>modules.filter(slot=>slot.family===family).length;
     const counts=inventory?'4200A · '+count('SMU')+' SMU / '+count('PMU')+' PMU':'4200A';
     const issue=update.connection.diagnostic||update.connection.inventoryError||(!inventory?.hardwareLimitsVerified||!inventory?.physicalModelsVerified
      ?tr('模块型号或额定值待核验','Module models or ratings need verification'):
      !(update.protocolVerified||update.systemModeProtocolVerified)?tr('测量执行模式待核验','Measurement mode needs verification'):
      !update.executionAdapterAvailable?tr('宿主定时服务不可用','Host timing unavailable'):tr('模块扫描完成','Port scan complete'));
     ctx.status.set(counts+' · '+issue);
    }else if(update.event==='measurement-started')ctx.status.set('4200A 正在执行测量，停止时将关闭活动输出');
    else if(update.event==='measurement-finished'){
     runPageId=null;
     const run=update.run;
     if(run.shutdown==='unconfirmed')ctx.status.set('严重警告：仪器输出关闭未获确认，请立即在仪器现场检查；不要断开连接');
     else if(run.state==='failed'){
      ctx.status.set('测量失败：'+(run.error||'未知错误'));
      const trace=(update.commandTrace||[]).slice(-12).map(item=>item.command+' → '+(item.error||item.response||'')+' ['+item.durationMs+' ms]').join('\n');
      void ctx.ui.dialogs.alert({title:'4200A 测量失败',message:run.error||'未知错误',detail:trace});
     }
     else if(update.publishError)ctx.status.set('测量结束，但原始数据发布失败：'+update.publishError);
     else if(update.published)ctx.status.set('测量 '+run.state+'；'+update.rows+' 行 KXCI 原始数据已写入 DKDS Data Center');
     else ctx.status.set('测量 '+run.state+'；没有可发布的实际 TI 采样行');
     refreshData();
    }else if(update.event==='measurement-stopping')ctx.status.set('正在停止测量并关闭活动 SMU 输出…');
    else if(update.event==='connection-lost')ctx.status.set(update.connection.diagnostic);
    else if(update.event==='disconnected')ctx.status.set('4200A 已断开');
    render();
   }
  });
  const PAGE_TABS=[['sweep','Sweep'],['target','Target'],['strategy','Strategy']];
  const pagePlots={dc:['iv','transfer','target','target-h'],iv:['iv','it'],transfer:['transfer','iv'],output:['iv','transfer'],
   pulse:['iv','it','vt'],retention:['it','vt'],time:['it','vt'],pund:['it','vt'],
   arb:['vt','it'],endurance:['it','iv'],cv:[]};
  const plotLabel=kind=>({iv:'I–V',transfer:t('转移特性'),it:'I–t',vt:'V–t',target:tr('自定义目标','Target'),'target-h':tr('目标 H','Target H'),raw:t('数据表')})[kind];
  const isTargetPlot=kind=>kind==='target'||kind==='target-h';
  function frameOptions(s){
   if(plotScope==='project')return model.PLOT_KINDS.filter(k=>!isTargetPlot(k));
   const kinds=s.pages.filter(page=>plotScope==='page'?page.id===s.activeId:page.routineId===s.activeRoutineId)
    .flatMap(page=>page.kind==='time'&&page.timing.mode===model.TIME_PMU_MODE?pagePlots.pulse:pagePlots[page.kind]||[]);
   return [...new Set([...kinds,'raw'])].filter(k=>!isTargetPlot(k)||plotScope==='page'&&(k!=='target-h'||Boolean(s.pages.find(p=>p.id===s.activeId)?.dc?.target?.h?.trim())));
  }
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
  const saveProject=value=>{store.patch(value);ctx.project.capture?.();};
  const persist=value=>{saveProject(model.validate(value));render();};
  const artifactMetadata=id=>ctx.data.artifacts.listMetadata?.({id})?.[0]||null;
  const acquisition=meta=>({...meta?.acquisition,...meta?.metadata?.acquisition,...meta?.metadata?.dktsScope});
  const scopeId=s=>plotScope==='page'?s.activeId:plotScope==='routine'?s.activeRoutineId:null;
  function sources(s=state()){
   const rows=ctx.data.sources.list();
   if(!Array.isArray(rows))return [];
   const scope=scopeId(s);
   return rows.filter(row=>row.excluded!==true&&(!scope||
    acquisition(artifactMetadata(row.artifactId))?.[plotScope==='page'?'pageId':'routineId']===scope));
  }
  // Core's plugin-scoped sources facade enforces Data Center assignments.
  // Revision-aware caching prevents full column clones on plot repaints.
  const plotCache=new Map();
  function curves(axis='iv',rows=sources()){
   let target=null;if(isTargetPlot(axis)){try{target=model.targetForAxis(model.dcTargetColumns(active()),axis);}catch{return [];}}
   const key=JSON.stringify([axis,target,...rows.map(row=>[row.artifactId,row.name,
    ctx.data.artifacts.artifactRevision?.(row.artifactId)||0])]);
   if(plotCache.has(key))return plotCache.get(key);
   const available=target?.needsVector?rows.filter(row=>{const state=acquisition(artifactMetadata(row.artifactId))?.runState;return !state||state==='completed';}):rows;
   const next=model.curvesFromArtifacts(available,ctx.data.artifacts,{axis:isTargetPlot(axis)?'target':axis,target});
   plotCache.set(key,next);
   return next;
  }
  function graphSettings(s){
   const scope=scopeId(s);
   return scope?s.ui.scopedGraphs[scope]||model.initial().ui.graphs:s.ui.graphs;
  }
  function syncGraphSettings(s=state()){
   const settings=graphSettings(s);
   frameLayout=String(settings.count);
   const allowed=frameOptions(s);
   const fallback=allowed.filter(kind=>!settings.kinds.includes(kind));
   frameKinds=settings.kinds.map((kind,index)=>allowed.includes(kind)?kind:fallback.shift()||allowed[index%allowed.length]);
   frameSelections=[...settings.sources];
   if(layoutField?.control)layoutField.control.value=frameLayout;
  }
  function saveGraphSetting(index,field,value){
   const s=state(),settings=graphSettings(s),scope=scopeId(s);
   settings.kinds=[...frameKinds];
   if(index<0)settings.count=Number(value);
   else if(field==='kind')settings.kinds[index]=String(value);
   else settings.sources[index]=String(value);
   if(scope)s.ui.scopedGraphs[scope]=settings;
   const next=model.validate(s);
   store.patch(next);
   ctx.project.capture?.();
   syncGraphSettings();
   applyFrameLayout();
   if(index>=0&&field==='kind')createFramePlot(index);
   refreshRawTables();
   renderHistory(next);
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
   if(historyHost)renderHistory(state());
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
  function changeSegment(axis,index,key,value,live=false){
   const pageId=active().id,segmentKey=axis+'-'+index;
   const drafts=segmentDrafts.get(pageId)||new Map();
   const values={...drafts.get(segmentKey)?.values,[key]:value};
   try{
    const next=model.editSegment(state(),axis,index,values);
    drafts.delete(segmentKey);
    if(!drafts.size)segmentDrafts.delete(pageId);
    if(sweepIssue?.pageId===pageId&&sweepIssue.axis===axis&&sweepIssue.index===index)sweepIssue=null;
    if(live){
     saveProject(next);
     const page=next.pages.find(row=>row.id===pageId);
     const segments=axis==='X'?page.sweep.xSegments:page.sweep.pSegments;
     for(const control of parameters.querySelectorAll?.('[data-dkts-sweep-key][data-dkts-parameter-path]')||[]){
      const [owner,row,field]=control.getAttribute('data-dkts-parameter-path').split('.');
      if(owner!==axis||field==='range'||field==='speed'||(Number(row)===index&&field===key)||
         drafts.get(axis+'-'+row)?.values[field]!==undefined)continue;
      if(segments[row]?.[field]!==undefined)control.value=segments[row][field];
     }
     refreshParameterIssue(page);
    }else persist(next);
   }catch(error){
    const message=displaySegmentError(error);
    drafts.set(segmentKey,{axis,index,key,values,message});
    segmentDrafts.set(pageId,drafts);
    if(live)refreshParameterIssue(active());
    else{ctx.status.set(message);render();}
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
  const sameHost=(left,right)=>String(left||'').trim().toLowerCase()===String(right||'').trim().toLowerCase();
  async function updateInstrument({settings,session}={}){
   if(instrumentBusy||measurementRuntime.status().run.running)return;
   const connect=Boolean(settings||session),saved=connectionSettings.get();
   const endpoint=session?.settings||settings;
   instrumentBusy=true;syncInstrumentButtons();
   try{
    ctx.status.set(connect?tr('正在连接 4200A 并读取实装端口…','Connecting to 4200A and scanning ports…'):
     tr('正在读取 4200A 实装端口…','Scanning installed 4200A ports…'));
    if(connect){
     const profile={...saved,...endpoint,
      expectedSerial:!saved.host||sameHost(saved.host,endpoint.host)?saved.expectedSerial:''};
     const {identity}=await measurementRuntime.connect(profile,session?.sessionId);
     if(identity)connectionSettings.set({
      host:profile.host,port:Number(profile.port),networkMode:profile.networkMode,
      interfaceName:profile.interfaceName,expectedSerial:identity.serial,autoReconnect:true});
     await measurementRuntime.inspectModules();
    }else await measurementRuntime.inspectModules({refresh:true});
    try{measurementRuntime.setTopologyProfile(JSON.parse(wiringPreferences.get('profile')||'null'));}catch{measurementRuntime.setTopologyProfile(null);}
   }catch(error){
    const reason=String(error.message||error);
    const detail=/Host capability unavailable: tcpOpen|网页服务未提供通用 TCP 网关|远程 TCP 请求失败，HTTP 405/.test(reason)?
     tr('当前网页没有仪器连接网关。请在 DKTS 客户端或已配对的局域网页面连接。',
      'This page has no instrument gateway. Connect in the DKTS app or on a paired LAN page.'):reason;
    ctx.status.set((connect?tr('4200A 连接失败','4200A connection failed'):
     tr('端口扫描失败','Port scan failed'))+' · '+detail);
   }
   finally{instrumentBusy=false;render();}
  }
  async function disconnectInstrument(){
   if(!instrumentIdle()){
    ctx.status.set(tr('请先等待核验完成或停止测量，再断开仪器。','Wait for verification or stop the test before disconnecting.'));
    return;
   }
   instrumentBusy=true;syncInstrumentButtons();
   try{await measurementRuntime.disconnect();connectionSettings.set({autoReconnect:false});}
   catch(error){ctx.status.set(String(error.message||error));}
   finally{instrumentBusy=false;render();}
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
   const pulse=prepared.compiled.pulse;
   const plan=prepared.compiled.plan;
   const channels=Object.entries(prepared.channels).map(([role,channel])=>role+'=SMU'+channel).join('，');
   const voltageSegments=plan.xSweep?[...plan.xSweep.segments,...(plan.pSweep?.segments||[])]:[];
   const maxVoltage=Math.max(0,...voltageSegments.filter(row=>Number.isFinite(row.startV)).flatMap(row=>[Math.abs(row.startV),Math.abs(row.stopV)]),
    ...Object.values(plan.fixedVoltages||{}).map(value=>Math.abs(value)),...Object.values(plan.generators||{}).flatMap(g=>g.segments.flatMap(s=>[Math.abs(s.startV),Math.abs(s.stopV)])),...Object.values(plan.listFollowers||{}).flatMap(g=>g.segments.filter(s=>Number.isFinite(s.startV)).map(s=>Math.abs(s.startV))),...Object.values(plan.portSettings||{}).map(row=>row.complianceV||0),pulse?.peak||0);
   const currentPeak=Math.max(0,...voltageSegments.filter(row=>Number.isFinite(row.startA)).flatMap(row=>[Math.abs(row.startA),Math.abs(row.stopA)]),...Object.values(plan.fixedCurrents||{}).map(Math.abs),...Object.values(plan.listFollowers||{}).flatMap(g=>g.segments.filter(s=>Number.isFinite(s.startA)).map(s=>Math.abs(s.startA))));
   const confirmed=await ctx.ui.dialogs.confirm({
    title:'确认 Keithley 4200A 实际输出',tone:'warning',destructive:true,
    message:'仪器 '+current.connection.identity.serial+' 将执行“'+page.name+'”，预计 '+
     prepared.pointCount.toLocaleString()+' 个测量点。',
    detail:'活动端口：'+(pulse?(pulse.resources||[pulse.resource]).join(' / '):channels)+'。最大设定电压或限压：'+maxVoltage+' V。'+(pulse?'仅所选脉冲通道输出，其他 SMU 输出关闭。':'')+(Object.values(plan.sourceModes||{}).includes('current')?'最大设定电流：'+currentPeak.toExponential(3)+' A。':'')+(prepared.compiled.system?.rpmRoutes?.length?'本次自动切换：'+prepared.compiled.system.rpmRoutes.map(r=>r.pmu+' → '+r.smu).join('，')+'。请确认接线未变化、所有相连输出均已关闭且无其他测试。':'')+(page.kind==='time'?'读数后等待和采样点数按测试设置执行；实际时长以仪器记录为准。':'')+'请确认实际接线、探针接触、各端口限流及现场安全条件。测量结束、停止或异常时，软件会尝试关闭活动输出。',
    confirmLabel:'确认接线并开始输出'
   });
   if(!confirmed)return;
   const latest=state().pages.find(item=>item.id===page.id);
   if(!latest||pageParameterIssue(latest)||JSON.stringify({...latest,sweep:{...latest.sweep,loops:page.sweep.loops}})!==JSON.stringify(page)){
    ctx.status.set(tr('参数已变化，请重新检查后执行。','The parameters changed. Review them and run again.'));
    return;
   }
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
   page=state().pages.find(row=>row.id===page.id);
   if(!page)return;
   const issue=pageParameterIssue(page);
   if(issue){ctx.status.set(issue.message);return;}
   if(page.kind==='dc'||page.kind==='time'||page.kind==='pulse'){
    const prepared=measurementRuntime.prepare(page);
    if(!prepared.canExecute){
     await ctx.ui.dialogs.alert({title:tr('执行前检查','Execution preflight'),message:prepared.reason||'执行前检查未通过'});
     return;
    }
    await handleMeasurementAction(page,prepared);
    return;
   }
   if(page.timing){
    await ctx.ui.dialogs.alert({title:'暂无法执行',message:'此测试执行器尚未接入'});
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
     const currentPage=state().pages.find(row=>row.id===page.id);
     if(!currentPage)return;
     const parameterIssue=pageParameterIssue(currentPage);
     if(parameterIssue){ctx.status.set(parameterIssue.message);return;}
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
   const host=editorRegion?.closest?.('#'+PAGE)||null;
   const pop=units.popover.create(host,{
    variant:'picker',title,role:'dialog',className:'dkts-numeric-pad',
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
       commit(buffer);
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
   if(host&&pop.element){
    const field=input.getBoundingClientRect(),area=host.getBoundingClientRect();
    const footer=host.ownerDocument.getElementById('statusBar')?.getBoundingClientRect();
    const height=pop.element.getBoundingClientRect().height;
    const bottom=Math.min(area.bottom,footer?.top||area.bottom)-8;
    const below=field.bottom+4,above=field.top-height-4;
    const top=below+height<=bottom?below:Math.min(above,bottom-height);
    pop.reposition({point:{clientX:field.left,clientY:Math.max(area.top+8,top)}});
   }
  }
  function scalarField(host,label,value,commit,disabled=false,attributes={},readOnly=false,live=false){
   if(readOnly)return fsproField(host,{kind:'input',label,value,attributes,readOnly});
   let committed=String(value??'').trim();
   const save=value=>{committed=String(value??'').trim();commit(value);};
   const field=fsproField(host,{kind:'input',label,value,attributes,
    inputMode:touchNumeric?'none':'decimal',disabled,
    onFocus:event=>openNumericPad(event.target,label||attributes['aria-label'],next=>{
     event.target.value=next;save(next);
    }),
    onInput:live?event=>save(event.target.value):undefined,
    onBlur:event=>{
     if(!touchNumeric&&String(event.target.value??'').trim()!==committed)
      save(event.target.value);
    }
   });
   return {...field,setValue:next=>{
    committed=String(next??'').trim();
    if(field.control)field.control.value=next;
   }};
  }
  function numericField(host,logical,key,label,value,disabled=false){
   return validatedField(host,label,value,logical+'.'+key,
    v=>model.edit(state(),logical,{[key]:v}),{disabled,ariaLabel:logical+' '+label});
  }
  function saveField(pageId,path,label,value,edit){
   const issues=fieldIssues.get(pageId)||new Map();
   let page;
   try{
    const next=edit(value);
    saveProject(next);
    page=next.pages.find(item=>item.id===pageId);
    issues.delete(path);
   }catch(error){
    issues.set(path,{path,label,message:planMessage(error),value});
   }
   if(issues.size)fieldIssues.set(pageId,issues);
   else fieldIssues.delete(pageId);
   refreshParameterIssue(page||active());
  }
  function validatedField(host,label,value,path,edit,{disabled=false,ariaLabel=label,text=false}={}){
   const pageId=editorPageId;
   const change=value=>saveField(pageId,path,ariaLabel,value,edit);
   const raw=fieldIssues.get(pageId)?.get(path)?.value??value;
   const attributes={'aria-label':ariaLabel,'data-dkts-parameter-path':path};
   return text?fsproField(host,{kind:'input',label,value:raw,attributes,onInput:event=>change(event.target.value)}):
    scalarField(host,label,raw,change,disabled,attributes,false,true);
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
  const isSmu=term=>/^SMU[1-9]$/.test(term?.resource||'');
  const scanPortOptions=(p,axis)=>{
   const other=axis==='X'?'P':'X';
   return p.terminals.filter(term=>isSmu(term)&&
    term.role!==other).map(term=>({value:term.logical,label:t(logicalNames[term.logical])}));
  };
  function assignSweepPort(axis,logical){
   const term=active().terminals.find(row=>row.logical===logical);
   if(!isSmu(term)){
    ctx.status.set('Xsweep/Psweep 必须选择已分配的 SMU 端口');return;
   }
   commitTransaction(()=>{const next=model.edit(state(),logical,{role:axis});if(sweepIssue?.key==='port'&&sweepIssue.axis===axis)sweepIssue=null;return next;});
  }
  function setPsweepEnabled(enabled){
   commitTransaction(()=>{
    let next=state(),page=next.pages.find(row=>row.id===next.activeId);
    if(enabled&&!page.terminals.some(term=>term.role==='P'&&isSmu(term))){
     const candidate=page.terminals.find(term=>term.logical==='G'&&
      isSmu(term)&&term.role!=='X')||
      page.terminals.find(term=>isSmu(term)&&term.role!=='X');
     if(!candidate)throw Error('Psweep 已启用，请先为其分配独立 SMU');
     next=model.edit(next,candidate.logical,{role:'P'});
    }
    return model.editSweep(next,{pEnabled:Boolean(enabled)});
   });
  }
  function renderSweepAxis(host,p,axis){
   const sw=p.sweep,isP=axis==='P',enabled=!isP||sw.pEnabled;
   const current=p.terminals.find(term=>term.role===axis&&isSmu(term));
   const fallback=p.terminals.find(term=>term.logical===(isP?'G':'D')&&isSmu(term));
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
   const portField=terminalChoice(portGroup,{kind:'select',label:false,controlOnly:true,
    value:selected?.logical||'',options:selected?available:[{value:'',label:tr('选择端子','Select terminal')},...available],
    className:'dkts-sweep-head-port',controlClassName:'dkts-sweep-head-control',
    controlDataset:{dktsFsproHeadControl:'port'},
    attributes:{'aria-label':(isP?'Psweep':'Xsweep')+' '+tr('扫描端子','Sweep terminal'),'data-dkts-sweep-key':'port',...(missingPort?{'aria-invalid':'true'}:{})},
    disabled:!available.length,onChange:event=>assignSweepPort(axis,event.target.value)});
   // Core's header select minimum applies to general-purpose fields. Sweep
   // selectors only show a terminal badge and arrow.
   if(portField.control?.style)Object.assign(portField.control.style,{
    width:'var(--dkts-sweep-terminal-width,62px)',minWidth:'0'
   });
   const repeatGroup=units.layout.create(controls,{variant:'identity',className:'dkts-sweep-header-field'});
   const repeatLabel=units.note.create(repeatGroup,{variant:'meta',text:t('重复')});
   repeatLabel?.setAttribute?.('data-dkts-sweep-control-label','true');
   const repeatKey=isP?'pRepeats':'xRepeats',repeatName=(isP?'Psweep':'Xsweep')+' '+tr('重复次数','Repeat count');
   fsproField(repeatGroup,{kind:'number',inputType:'number',label:false,controlOnly:true,
    value:fieldIssues.get(p.id)?.get(repeatKey)?.value??sw[repeatKey],min:1,max:10000,step:1,
    className:'dkts-sweep-repeat',controlClassName:'dkts-sweep-repeat-control',
    controlDataset:{dktsFsproHeadControl:'repeat'},
    attributes:{'aria-label':repeatName,'data-dkts-parameter-path':repeatKey},
    disabled:!enabled,onInput:event=>saveField(p.id,repeatKey,repeatName,event.target.value,
     value=>model.editSweep(state(),{[repeatKey]:value}))});
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
    const fieldAttributes=(key,name)=>({
     'aria-label':name,'data-dkts-sweep-key':key,
     'data-dkts-parameter-path':axis+'.'+index+'.'+key
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
     scalarField(row,t(label),segment[key],value=>changeSegment(axis,index,key,value,true),false,
      attributes,linked,true);
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
  function pulsePort(page,values){
   const mapped=page.terminals.find(term=>term.logical===values.terminal)?.resource||'None';
   const resource=page.kind==='pulse'||values.testMode==='bias-steps'?measurementRuntime.resolvePulsePort(mapped,values.channel):mapped;
   const inventory=measurementRuntime.status().connection.inventory;
   const match=/^(SMU|PMU)([1-9])(?:-([12]))?$/.exec(resource);
   const slot=inventory?.slots?.find(row=>row.family===match?.[1]&&row.channel===Number(match?.[2]));
   const pmuVerified=slot?.family==='PMU'&&slot.physicalIdentityVerified===true;
   const withRpm=slot?.rpmChannels?.includes(Number(match?.[3]||values.channel))===true;
   return {resource,match,slot,pmuVerified,withRpm};
  }
  const captureBudget=(result,rate)=>hardware.getPmuCaptureBudget((result.captureWindowS??result.windowS)*(result.totalSweepPoints||result.points)*result.pulseCount,
   result.captureWindowS??result.windowS,rate,{pulseCount:result.pulseCount,sweepPoints:result.points,stepPoints:result.secondary?.points||1});
  function pulseCompatibility(values,result,budget=captureBudget(result,result.rateHz)){
   const measured=hardware.getPulseTimingRecommendation(result.rangeV,null,true,'pmu',false,result.peakV);
   const timing=measured.kxciInterfaceTiming;
   const toSeconds=key=>Number(values[key])*1e-6;
   const period=toSeconds('periodUs'),flat=toSeconds('widthUs');
   const rise=toSeconds('riseUs'),fall=toSeconds('fallUs'),delay=toSeconds('delayUs');
   const width=flat+(rise+fall)/2;
   const offTime=period-delay-flat-rise-fall;
   const edgeMin=Math.max(timing.transitionMinS,measured.transitionMinS);
   if(period<Math.max(timing.periodMinS,measured.periodMinS)||period>Math.min(timing.periodMaxS,measured.periodMaxS)||
      width<Math.max(timing.pulseWidthMinS,measured.pulseWidthMinS)||rise<edgeMin||fall<edgeMin||
      rise>timing.transitionMaxS||fall>timing.transitionMaxS||rise>width||
      (delay>0&&delay<timing.delayStepS)||offTime<=timing.minOffTimeS+1e-15)
    return tr('周期、平顶或边沿不满足所选 PMU 电压档的 KXCI 时序限制。',
     'Period, flat top or transitions exceed the KXCI limits for this PMU range.');
   if(budget.kxciBoundaryStatus!=='within-published-range')
    return tr('采样率和测量窗口达到或超出 KXCI 每通道点数边界。','Rate and measure windows reach or exceed the KXCI per-channel point limit.');
   return '';
  }
  function plannedTimingDraft(p){
   if(!timingDrafts.has(p.id))timingDrafts.set(p.id,{settings:JSON.parse(JSON.stringify(p.timing))});
   return timingDrafts.get(p.id);
  }
  function renderTiming(host,p){
   const pulse=p.kind==='pulse',draft=editorPlan.draft,values=draft.settings;
   const put=(key,value)=>{values[key]=value;updateEditorPlan(key);};
   const panel=(zh,en,target=host)=>{
    const group=units.panel.create(target,{variant:'headed',title:tr(zh,en),sizing:'content',className:'dkts-timing-panel'});
    return units.layout.create(group.body,{variant:'identity',className:'dkts-timing-fields'});
   };
   const fields=(target,specs)=>{
    for(const [key,zh,en] of specs)scalarField(target,tr(zh,en),values[key],value=>{put(key,value);refreshTimingSummary();},false,
     {'data-dkts-timing-field':key,'data-dkts-parameter-path':key},false,true);
   };
   const select=(target,key,label,options)=>fsproField(target,{kind:'select',label,value:values[key],
    options:options.map(([value,label])=>({value,label})),attributes:{'data-dkts-timing-field':key,'data-dkts-parameter-path':key},
    onChange:event=>{put(key,event.target.value);render();}});
   const {resource,match,slot,pmuVerified,withRpm}=pulsePort(p,values);
   const pulseRanges=()=>{
    const ranges=pmuVerified?hardware.getPmuCurrentRanges(values.rangeV,withRpm):[];
    const options=[['',tr('自动','Auto')],...ranges.map(range=>[String(range),String(range)+' A'])];
    if(values.currentRangeA&&!ranges.includes(Number(values.currentRangeA)))
     options.push([values.currentRangeA,values.currentRangeA+' A · '+tr('待核验','Unverified')]);
    return options;
   };
   if(pulse&&editorSection==='sweep'){
    const modePanel=panel('扫描类型','Sweep type');
    fsproField(modePanel,{kind:'select',label:tr('测试方式','Test mode'),value:values.testMode,attributes:{'data-dkts-timing-field':'testMode'},
     options:[{value:'sweep',label:tr('脉冲扫描','Pulse sweep')},{value:'sequence',label:tr('任意波形','Arbitrary waveform')}],onChange:event=>{
     const mode=event.target.value;
     // Preserve mode-specific settings when switching modes.
     if(mode==='sequence'&&!values.arb)values.arb={loops:'1',segments:[{startV:'0',stopV:'1',durationUs:'1',measure:false,measureStartUs:'0',measureStopUs:'0'},{startV:'1',stopV:'1',durationUs:'10',measure:true,measureStartUs:'2',measureStopUs:'8'},{startV:'1',stopV:'0',durationUs:'1',measure:false,measureStartUs:'0',measureStopUs:'0'}]};
     draft.arbPage=0;
     put('testMode',mode);render();
    }});
   }
   if(pulse&&values.testMode!=='sweep'){
    renderArbTiming(host,p,values,put,panel);return;
   }
   if(editorSection==='sweep'){
    const input=panel('输入设置','Input settings');
    select(input,'terminal',tr('端子','Terminal'),['S','D','G'].filter(key=>!pulse||key!==values.secondary?.terminal).map(key=>[key,t(logicalNames[key])+' · '+
     (pulse?pulsePort(p,{...values,terminal:key}).resource:p.terminals.find(term=>term.logical===key)?.resource||'None')]));
    if(pulse){
     select(input,'rangeV',tr('PMU 电压档','PMU voltage range'),[['10','10 V'],['40','40 V']]);
     if(!match?.[3])select(input,'channel',tr('卡内通道','Card channel'),[['1','CH1'],['2','CH2']]);
     fields(input,[['loadOhms','DUT 与互连等效负载 (Ω)','DUT and interconnect load (Ω)']]);
     const levels=panel('Xsweep · 脉冲电平','Xsweep · Pulse levels');
     const amplitude=values.sweep==='amplitude';
     select(levels,'sweep',tr('扫描方式','Sweep mode'),[['amplitude',tr('扫描幅值','Amplitude sweep')],['base',tr('扫描基线','Base sweep')]]);
     if(!amplitude){fields(levels,[['basePeakV','固定峰值 (V)','Fixed peak (V)']]);if(values.basePeakV==='')fields(levels,[['fixedV','旧单点相对幅值 (V)','Legacy single-point relative amplitude (V)']]);}
     fields(levels,[['start','起始 (V)','Start (V)'],['stop','终止 (V)','Stop (V)'],['step','步进 (V)','Step (V)']]);
     const outer=panel('Psweep · 脉冲电平','Psweep · Pulse levels');
     const otherKeys=['S','D','G'].filter(key=>key!==values.terminal);
     fsproField(outer,{kind:'select',label:tr('端子','Terminal'),value:values.secondary?.terminal||'None',options:[{value:'None',label:'None'},...otherKeys.map(key=>({value:key,label:t(logicalNames[key])+' · '+pulsePort(p,{...values,terminal:key}).resource}))],onChange:event=>{
      const terminal=event.target.value;if(terminal==='None'){put('secondary',null);render();return;}
      const keys=['channel','rangeV','loadOhms','fixedV','start','stop','step','widthUs','riseUs','fallUs','delayUs','windowStartUs','windowTimeUs','currentRangeA','sweep','basePeakV','rangePolicy','prePercent','postPercent'];
      const secondary=values.secondary?{...values.secondary,terminal}:{...Object.fromEntries(keys.map(k=>[k,String(values[k])])),terminal,stop:String(values.start),step:'0',currentRangeA:''};
      put('secondary',secondary);render();
     }});
     if(values.secondary){
      const second=values.secondary,port=pulsePort(p,{...values,...second});
      const setSecond=(key,value)=>{put('secondary',{...values.secondary,[key]:String(value)});refreshTimingSummary();};
      if(!port.match?.[3])dcSelect(outer,tr('卡内通道','Card channel'),second.channel,[{value:'1',label:'CH1'},{value:'2',label:'CH2'}],value=>{setSecond('channel',value);render();},{key:'psweep-channel',path:'secondary.channel'});
      dcSelect(outer,tr('电压档','Voltage range'),second.rangeV,[{value:'10',label:'10 V'},{value:'40',label:'40 V'}],value=>{setSecond('rangeV',value);render();},{key:'psweep-range',path:'secondary.rangeV'});
      dcSelect(outer,tr('电流档','Current range'),second.currentRangeA,[{value:'',label:tr('自动','Auto')},...(port.pmuVerified?hardware.getPmuCurrentRanges(Number(second.rangeV),port.withRpm):[]).map(x=>({value:String(x),label:String(x)+' A'}))],value=>setSecond('currentRangeA',value),{key:'psweep-current-range',path:'secondary.currentRangeA'});
      dcSelect(outer,tr('扫描方式','Sweep mode'),second.sweep||'amplitude',[{value:'amplitude',label:tr('扫描幅值','Amplitude sweep')},{value:'base',label:tr('扫描基线','Base sweep')}],value=>{setSecond('sweep',value);render();},{key:'psweep-mode',path:'secondary.sweep'});
      if(second.currentRangeA)dcSelect(outer,tr('量程模式','Range mode'),second.rangePolicy||'fixed',[{value:'fixed',label:tr('固定','Fixed')},{value:'limited-auto',label:tr('最低自动量程','Limited auto')}],value=>setSecond('rangePolicy',value),{key:'psweep-range-policy',path:'secondary.rangePolicy'});
      const secondaryBase=second.sweep==='base';
      for(const [key,zh,en] of [[secondaryBase?'basePeakV':'fixedV',secondaryBase?'固定峰值 (V)':'基线 (V)',secondaryBase?'Fixed peak (V)':'Base (V)'],['start','起始 (V)','Start (V)'],['stop','终止 (V)','Stop (V)'],['step','步进 (V)','Step (V)'],['loadOhms','负载 (Ω)','Load (Ω)'],['widthUs','平顶 (µs)','Flat top (µs)'],['riseUs','上升 (µs)','Rise (µs)'],['fallUs','下降 (µs)','Fall (µs)'],['delayUs','延迟 (µs)','Delay (µs)'],['windowStartUs','测量延迟 (µs)','Measure delay (µs)'],['windowTimeUs','测量时间 (µs)','Measure time (µs)']])
       scalarField(outer,tr(zh,en),second[key]??'',value=>setSecond(key,value),false,{'data-dkts-parameter-path':'secondary.'+key},false,true);
     }
     const basic=panel('脉冲设置 · 基本','Pulse Settings · Basic');
     fields(basic,[['periodUs','脉冲周期 (µs)','Pulse Period (µs)'],['widthUs','计划平顶时长 (µs)','Planned flat top (µs)']]);
     const advanced=panel('脉冲设置 · 高级','Pulse Settings · Advanced');
     for(const [key,zh,en] of [['holdUs','保持时间 (µs)','Hold Time (µs)'],
      ['baseDelayUs','基线延迟 (µs)','Base Delay (µs)']])
      scalarField(advanced,tr(zh,en),values[key],null,false,{'data-dkts-timing-field':key},true);
     units.note.create(advanced,{variant:'meta',text:tr(
      '保持和基线延迟保留旧方案值。当前 KXCI 脉冲设置仅提供独立的首脉冲延迟。',
      'Hold and base delay preserve legacy plan values. This KXCI pulse setup exposes the first-pulse delay separately.')});
     for(const [key,zh,en] of [['windowStartUs','测量延迟 (µs)','Measure Delay (µs)'],
      ['windowTimeUs','测量时间 (µs)','Measure Time (µs)']]){
      const field=scalarField(advanced,tr(zh,en),values[key],value=>{put(key,String(value).trim());refreshTimingSummary();},false,
       {'data-dkts-timing-field':key,'data-dkts-parameter-path':key,'placeholder':'Auto'},false,true);
      field.control?.setAttribute?.('placeholder','Auto');
     }
     if(amplitude)fields(advanced,[['fixedV','基线电平 (V)','Base Level (V)']]);
     select(advanced,'currentRangeA',tr('量程选择','Range Selection'),pulseRanges());
     if(values.currentRangeA)select(advanced,'rangePolicy',tr('量程模式','Range mode'),[['fixed',tr('固定','Fixed')],['limited-auto',tr('最低自动量程','Limited auto')]]);
     units.action.create(advanced,{id:'dkts-pulse-auto',label:tr('自动测量设置','Auto measurement settings'),
      variant:'quiet',direct:true,onInvoke:()=>{
       for(const key of ['windowStartUs','windowTimeUs','currentRangeA'])values[key]='';
       redrawDc();
      }});
     fields(advanced,[['riseUs','上升时间 (µs)','Rise (µs)'],['fallUs','下降时间 (µs)','Fall (µs)'],
      ['delayUs','首脉冲延迟 (µs)','First-pulse delay (µs)'],['pulseCount','每点脉冲数','Pulses per point']]);
    }else{
     fields(input,[['conditionV','初始偏置 (V)','Initial bias (V)'],['conditionS','初始偏置时长 (s)','Initial bias duration (s)'],
      ['holdV','保持偏置 (V)','Hold bias (V)']]);
     const schedule=panel('Time Xsweep · 保持时序','Time Xsweep · Retention schedule');
     select(schedule,'spacing',tr('取点方式','Spacing'),[['log',tr('对数','Logarithmic')],['linear',tr('线性','Linear')]]);
     fields(schedule,[['firstS','首次读出 (s)','First read (s)'],['lastS','末次读出 (s)','Last read (s)'],['points','读出点数','Read count']]);
    }
   }else if(editorSection==='target'){
    const event=panel('测量事件','Measure event');
    if(pulse){
     select(event,'mode',tr('采样方式','Acquisition'),[['spot',tr('窗内均值（Pulse I–V）','Spot mean (Pulse I–V)')],['waveform',tr('窗内波形','Window waveform')]]);
     if(values.mode==='waveform')fields(event,[['prePercent','脉冲前采样比例 (0–1)','Pre-data fraction (0–1)'],['postPercent','脉冲后采样比例 (0–1)','Post-data fraction (0–1)']]);
     const presets=['1000','10000','100000','1000000','10000000','50000000','100000000','200000000'];
     let rates=[];
     try{
      const budget=captureBudget(model.timedSummary('pulse',values),null);
      rates=presets.filter(rate=>Number(rate)>=budget.minSampleRateHz&&Number(rate)<=budget.kxciMaxSampleRateHz&&
       Math.ceil(Number(rate)*budget.totalMeasureDurationS-1e-9)<budget.interfaceMaxGeneratedPointsPerChannel);
      units.note.create(event,{variant:'meta',text:tr('KXCI 采样范围 ','KXCI sample rate ') +
       Math.ceil(budget.minSampleRateHz)+' – '+Math.floor(budget.kxciMaxSampleRateHz)+tr(' Sa/s（上限待核验）',' Sa/s (boundary pending verification)')});
     }catch{}
     const selected=rates.find(rate=>Number(rate)===Number(values.rateHz));
     const customLabel=tr('自定义整数采样率','Custom integer rate');
     dcSelect(event,tr('采样率 (Sa/s)','Sample rate (Sa/s)'),draft.customRate?'custom':selected||'custom',
      [...rates.map(value=>({value,label:Number(value).toLocaleString(language)})),{value:'custom',label:customLabel}],
      value=>{
       draft.customRate=value==='custom';
       if(value!=='custom')put('rateHz',value);
       render();
      },{key:'pulse-rate-preset',path:'rateHz'});
     if(draft.customRate||!selected)fields(event,[['rateHz','自定义采样率 (Sa/s)','Custom rate (Sa/s)']]);
    }else fields(event,[['readV','读出偏置 (V)','Read bias (V)'],['windowS','读出窗口 (s)','Read window (s)'],['complianceA','SMU 电流保护 (A)','SMU compliance (A)']]);
   }else{
    const strategy=panel('仪器与调度','Instrument and scheduling');
    units.note.create(strategy,{variant:'meta',text:pulse?tr(
     '由 4225-PMU 负责脉冲和测量窗口。规划时间以平顶为参考，执行适配仍需按对应 KXCI 模式核对。',
     'The 4225-PMU owns pulse and window timing. Planning uses the flat top as its reference. Verify conversion for the selected KXCI mode.'):
     tr('初始偏置后进入保持时段，读出事件的时间相对于保持开始。实测应保存时间戳和间隔偏差。',
      'Read events are relative to the start of the hold after initial bias. Acquisition should preserve timestamps and interval deviation.')});
   }
   const summary=panel('方案校验','Plan checks');
   function refreshTimingSummary(){
    summary.replaceChildren();
   try{
    const result=model.timedSummary(p.kind,values);
    units.note.create(summary,{variant:'meta',text:pulse?`${result.points}${result.secondary?' × '+result.secondary.points:''} ${tr('扫描点','sweep points')} × ${result.pulseCount} ${tr('脉冲','pulses')}`:
     `${result.points} ${tr('次读出','reads')} · ${result.firstS}–${result.lastS} s · ${tr('窗口','Window')} ${result.windowS} s`});
    units.note.create(summary,{variant:'meta',text:resource+(slot?.physicalIdentityVerified===true?
     ' · '+String(slot.physicalModel||slot.family)+(withRpm?' + RPM':''):' · '+tr('模块待核验','Module unverified'))});
    let reason='';
    if(pulse){
     if(values.windowStartUs===''||values.windowTimeUs==='')
      units.note.create(summary,{variant:'meta',text:tr('Auto 采样预算按可用平顶窗口估算。','Auto estimates sample usage from the available flat-top window.')});
     const budget=captureBudget(result,result.rateHz);
     units.note.create(summary,{variant:'meta',text:tr('每通道预计采样点','Estimated samples per channel')+' '+budget.sampleCountAtSelectedRate});
     reason=pulseCompatibility(values,result,budget);
     if(!reason&&(Number(values.holdUs)!==0||Number(values.baseDelayUs)!==0))
      reason=tr('保留的旧保持或基线延迟暂无 KXCI 映射。','Legacy hold or base delay awaits KXCI mapping.');
     if(!reason&&result.loadOhms===null)reason=tr('填写负载后才能校核 DUT 端电压。','Enter the load to check the voltage at the DUT.');
     else if(!reason&&result.peakV>hardware.getPulseOutputLimits('pmu',result.rangeV,result.loadOhms).maxVoltageV)
      reason=tr('所设峰值超过当前负载下的电压估算上限。','The peak exceeds the estimated voltage limit at this load.');
     else if(!reason&&!pmuVerified)reason=tr('请为该端子选择脉冲通道，或在仪器连接菜单确认 RPM 接线。','Select a pulse channel for this terminal or confirm its RPM wiring in the instrument menu.');
     else if(!reason&&values.currentRangeA&&!hardware.getPmuCurrentRanges(result.rangeV,withRpm).includes(Number(values.currentRangeA)))
      reason=tr('请选择与该 PMU 通道及 RPM 配置匹配的电流档。','Select a current range for this PMU channel and RPM configuration.');
    }else if(slot?.family!=='SMU')reason=tr('该逻辑端子需映射到实装 SMU。','Map this terminal to an installed SMU.');
    else{
     const limits=hardware.getSmuLimits(slot,result.peakV,result.complianceA);
     if(!limits.known||limits.requiresInterlock)reason=tr('SMU 额定值或现场互锁待核验。','Verify the SMU rating or physical interlock.');
    }
    if(reason)units.note.create(summary,{variant:'warning',text:reason});
   }catch(error){units.note.create(summary,{variant:'warning',text:String(error.message||error)});}
   }
   refreshTimingSummary();
  }

  function createPlanPlot(host,page,title,xTitle,yTitle,getData,displayItems){
   const card=units.panel.create(host,{variant:'plot-card',header:false,sizing:'content',className:'dkts-plan-plot-card'});
   const header=units.header.create(card.body,{kind:'plot',variant:'plot',title,actionHost:true});
   const actions=dcLayout(header.actions,'dkts-frame-actions');
   units.action.create(actions,{id:'dkts-plan-display',label:tr('显示','View'),menu:true,variant:'quiet',items:displayItems});
   units.action.create(actions,{id:'dkts-plan-data',label:t('数据'),menu:true,variant:'quiet',items:()=>{
    const rows=getData().rows;
    return [
     {id:'dkts-plan-csv',label:tr('导出计划 CSV','Export plan CSV'),enabled:rows.length>0,
      onInvoke:()=>{
       const columns=Object.keys(rows[0]).map(key=>({name:key,values:rows.map(row=>row[key])}));
       return ctx.io.saveCsv(ctx.io.csv.table({columns,rowCount:rows.length}),'DKTS_plan_'+page.id+'.csv');
      }},
     {id:'dkts-plan-measured',label:tr('打开实测图窗','Open measured plots'),onInvoke:()=>showPageGraphs(page.id)}
    ];
   }});
   const plotHost=dcLayout(card.body,'dkts-plan-plot');
   const view=units.plotView.adopt('dkts-plan-'+page.id,card.element,{
    variant:'complete',title,plot:plotHost,header:header.element,actionsHost:header.actions,
    placements:['home','left','right','bottom','float','global'],stateVersion:'dkts-plan-v1',
    fileStem:'DKTS_plan_'+page.id,images:true,copy:true,csv:false
   });
   const plot=units.scientificPlot.create(plotHost,{variant:'curve',source:'dkts-plan-'+page.id,xTitle,yTitle,
    getCurves:()=>getData().curves,getMarkers:()=>getData().markers,
    emptyText:()=>tr('无有效方案','No valid plan')});
   disposeTimePreview=()=>{plot.dispose?.();view.dispose?.();};
   return plot;
  }
  const emptyPlanPlot=()=>({curves:[],markers:[],rows:[]});
  function timeIcon(host,glyph,label,kind){
   if(!host)return null;
   const icon=units.layout.create(host,{variant:'identity',tagName:'span',className:'dkts-time-icon '+kind});
   if(!icon)return null;
   host.classList?.add('dkts-time-icon-anchor');
   icon.textContent=glyph;
   icon.setAttribute('tabindex','0');
   icon.setAttribute('role',kind==='dkts-time-switch'?'button':'img');
   icon.setAttribute('aria-label',label);
   return icon;
  }
  function closeTimeTimingTip(){
   const tip=timeTimingTip;
   timeTimingTip=null;
   tip?.popover.close();
  }
  function bindTimeTip(icon,label,text,draw){
   if(!icon)return;
   icon.setAttribute('aria-description',text);
   const show=()=>{
    if(timeTimingTip?.anchor===icon)return;
    closeTimeTimingTip();
    const popover=units.popover.create(null,{variant:'picker',anchor:icon,placement:'bottom-start',offset:4,
     className:'dkts-smu-timing-popover'+(draw?'':' dkts-short-time-tip'),title:label,header:Boolean(draw),
     role:'tooltip',ariaLabel:label,close:false,dismissOnOutside:false});
    timeTimingTip={anchor:icon,popover};
    draw?.(popover.body);
    units.note.create(popover.body,{variant:'meta',text});
    popover.reposition?.();
   };
   for(const start of ['mouseenter','focus'])icon.addEventListener?.(start,show);
   for(const end of ['mouseleave','blur'])icon.addEventListener?.(end,()=>{if(timeTimingTip?.anchor===icon)closeTimeTimingTip();});
   icon.addEventListener?.('keydown',event=>{if(event.key==='Escape')closeTimeTimingTip();});
  }
  function timeHelp(host,label,text){
   const icon=timeIcon(host,'?',tr('说明 · ','Help · ')+label,'dkts-time-help');
   bindTimeTip(icon,label,text);
   return icon;
  }
  function timeWaitHelp(field,label,text,phases,highlight){
   const icon=timeIcon(field.label,'?',tr('时序示意 · ','Timing diagram · ')+label,'dkts-time-help');
   bindTimeTip(icon,label,text,body=>{
    const diagram=dcLayout(body,'dkts-smu-timing-diagram');
    for(const [index,phase] of phases.entries()){
     const item=dcLayout(diagram,'dkts-smu-timing-phase');
     item.setAttribute('data-dkts-timing-phase',phase.read?'read':'wait');
     if(index===highlight)item.setAttribute('data-dkts-timing-focus','true');
     if(phase.level)item.setAttribute('data-dkts-timing-level','raised');
     dcLayout(item,'dkts-smu-timing-trace').setAttribute('aria-hidden','true');
     units.note.create(item,{variant:'meta',text:phase.label});
     units.note.create(item,{variant:'meta',text:phase.detail()});
    }
   });
  }
  function reciprocal(value,scale){
   const number=Number(value),result=scale/number;
   return number>0&&Number.isFinite(result)&&result>0?String(result):'';
  }
  function renderSamplingField(host,draft,fields,read,write){
   const showRate=draft.sampleAsRate===true;
   const [label,path]=fields[showRate?1:0];
   const field=scalarField(host,label,read(showRate),value=>write(showRate,value),false,
    {'data-dkts-parameter-path':path},false,true);
   const title=fields[showRate?0:1][0];
   const trigger=timeIcon(field.label,'⇄',tr('切换到','Switch to ')+title,'dkts-time-switch');
   if(!trigger)return;
   const toggle=()=>{
    draft.sampleAsRate=!showRate;
    const scroll=parameters.scrollTop;
    render();
    parameters.scrollTop=scroll;
    editorRegion.querySelector('.dkts-time-switch')?.focus({preventScroll:true});
   };
   trigger.addEventListener('click',event=>{event.preventDefault();toggle();});
   trigger.addEventListener('keydown',event=>{
    if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle();}
   });
  }
  function renderArbTiming(host,p,values,put,panel,timeSettings){
   const draft=editorPlan.draft,byBias=values.testMode==='bias-steps',path=byBias?'biasSteps':'arb';
   const partner=byBias?null:values.arbPartner,partnerActive=Boolean(partner&&draft.arbChannel===1);
   const current=()=>partnerActive?values.arbPartner:values,settings=current();
   const putChannel=(key,value)=>{if(partnerActive)put('arbPartner',{...values.arbPartner,[key]:value});else put(key,value);};
   const blockList=()=>byBias?[current().biasSteps]:current().arb.blocks||[current().arb];
   const blocks=blockList(),selected=Math.max(0,Math.min(blocks.length-1,draft.arbBlock||0)),arb=blocks[selected];
   const change=(key,value)=>{
    if(byBias)put('biasSteps',{...values.biasSteps,[key]:value});
    else putChannel('arb',{blocks:blockList().map((block,i)=>i===selected?{...block,[key]:value}:block)});
    refresh();
   };
   const field=(target,label,value,onChange,path,disabled=false)=>scalarField(target,label,String(value),v=>{onChange(String(v));},disabled,
    {'data-dkts-parameter-path':(byBias?'pmu.':'')+path},false,true);
   const timingContext=()=>{const port=pulsePort(p,settings);return {withRpm:port.pmuVerified&&port.withRpm};};
   let sequenceLayout,edgeDisplay,rangeDisplay,currentRangeControl;
   if(editorSection==='sweep'){
    if(!byBias){
    const channels=panel('时序端子','Sequence terminals');
    dcSelect(channels,tr('第二端子','Second terminal'),values.arbPartner?.terminal||'None',[{value:'None',label:'None'},...['S','D','G'].filter(k=>k!==values.terminal).map(k=>({value:k,label:t(logicalNames[k])+' · '+pulsePort(p,{...values,terminal:k}).resource}))],terminal=>{
     if(terminal==='None'){draft.arbChannel=0;put('arbPartner',null);}
     else{const old=values.arbPartner;put('arbPartner',old?{...old,terminal}:{terminal,channel:values.channel,rangeV:values.rangeV,loadOhms:values.loadOhms,currentRangeA:values.currentRangeA,mode:values.mode,arb:JSON.parse(JSON.stringify(values.arb))});}
     draft.arbBlock=0;draft.arbPage=0;render();
    },{key:'arb-second-terminal'});
    if(partner)dcSelect(channels,tr('编辑端子','Edit terminal'),partnerActive?'1':'0',[{value:'0',label:t(logicalNames[values.terminal])},{value:'1',label:t(logicalNames[partner.terminal])}],v=>{draft.arbChannel=Number(v);draft.arbBlock=0;draft.arbPage=0;render();},{key:'arb-edit-terminal'});
    }
    const input=panel(byBias?'时间扫描 · 单周期':'输入设置',byBias?'Time sweep · One cycle':'Input settings');
    if(byBias){
     input?.classList?.add('dkts-pmu-time-settings');
     renderTimeMode(input,timeSettings);
    }
    const choices=['S','D','G'].filter(k=>k!==(partnerActive?values.terminal:partner?.terminal));
    const channelSelect=(target,key,label,options)=>dcSelect(target,label,String(settings[key]),options.map(([value,label])=>({value,label})),value=>{putChannel(key,value);render();},{key:'arb-'+key});
    channelSelect(input,'terminal',tr('端子','Terminal'),choices.map(key=>[key,t(logicalNames[key])+' · '+pulsePort(p,{...values,...settings,terminal:key}).resource]));
    const port=pulsePort(p,{...values,...settings});
    if(!port.match?.[3])channelSelect(input,'channel',tr('卡内通道','Card channel'),[['1','CH1'],['2','CH2']]);
    if(!byBias)channelSelect(input,'rangeV',tr('电压档','Voltage range'),[['10','10 V'],['40','40 V']]);
    const loadLabel=byBias?tr('估计负载 (Ω)','Estimated load (Ω)'):tr('负载 (Ω)','Load (Ω)');
    const load=field(input,loadLabel,settings.loadOhms,v=>{putChannel('loadOhms',v);refresh();},'loadOhms');
    if(byBias)timeHelp(load.label,loadLabel,tr(
     '供 PMU 补偿和量程校验。变阻器件须核对实际 V/I 及阻值范围；留空可编排，运行前须确认。',
     'Used for PMU load compensation and range checks. Review the known resistance range. A blank value allows planning only.'));
    const currentLabel=tr('固定电流档','Fixed current range');
    if(byBias)currentRangeControl=dcSelect(input,currentLabel,settings.currentRangeA,
     [{value:'',label:tr('请选择','Select')}],value=>{putChannel('currentRangeA',value);refresh();},{key:'arb-currentRangeA'});
    else{
     const ranges=port.pmuVerified?hardware.getPmuCurrentRanges(Number(settings.rangeV),port.withRpm):[];
     channelSelect(input,'currentRangeA',currentLabel,[['',tr('请选择固定电流档','Select a fixed range')],...ranges.map(r=>[String(r),String(r)+' A'])]);
    }
    if(byBias){
     renderSamplingField(input,draft,[
      [tr('采样步长 (µs)','Sampling step (µs)'),'pmu.sampleStepUs'],
      [tr('采样频率 (Sa/s)','Sample rate (Sa/s)'),'pmu.rateHz']
     ],showRate=>{
      if(!showRate)return String(values.sampleStepUs??'').trim()||reciprocal(values.rateHz,1e6);
      try{return String(hardware.segmentArbSampleRate(values));}catch{return '';}
     },(showRate,value)=>{
      if(showRate){values.sampleStepUs='';put('rateHz',value.trim());}
      else put('sampleStepUs',value.trim()||' ');
      refresh();
     });
     const edgeMode=arb.edgeUs===''?'auto':'manual';
     dcSelect(input,tr('过渡方式','Transition mode'),edgeMode,[{value:'auto',label:tr('按硬件自动','Automatic')},
      {value:'manual',label:tr('手动','Manual')}],v=>{
      if(v==='auto')draft.manualEdgeUs=values.biasSteps.edgeUs;
      const automatic=edgeDisplay?.value?.split(' / ').at(-1);
      change('edgeUs',v==='auto'?'':(draft.manualEdgeUs||(Number(automatic)>0?automatic:'1')));
      render();
     },{key:'pmu-edge-mode'});
     const edgeLabel=tr('过渡时间 (µs)','Transition (µs)');
     const edge=edgeMode==='manual'?field(input,edgeLabel,arb.edgeUs,v=>change('edgeUs',v),'biasSteps.edgeUs'):
      dcInput(input,edgeLabel,'—',null,{key:'pmu-edge-effective',readOnly:true});
     if(edgeMode==='auto')edgeDisplay=edge.control;
     timeHelp(edge.label,edgeLabel,tr('电压变化时才计入过渡。序列从 0 V 开始并回到 0 V。','Transitions apply when voltage changes. The sequence starts and ends at 0 V.'));
     field(input,tr('循环次数','Cycles'),arb.loops,v=>change('loops',v),'biasSteps.loops');
    }
    if(!byBias){
    const sequencePanel=panel('序列组合','Sequence list');
    dcSelect(sequencePanel,tr('序列','Sequence'),String(selected),blocks.map((b,i)=>({value:String(i),label:(i+1)+' · '+b.loops+' × '+b.segments.length+' '+tr('段','segments')})),v=>{draft.arbBlock=Number(v);draft.arbPage=0;render();},{key:'arb-block'});
    if(blocks.length<512&&blocks.reduce((n,b)=>n+b.segments.length,0)<=2045)units.action.create(sequencePanel,{id:'dkts-arb-block-add',label:tr('增加序列','Add sequence'),variant:'quiet',direct:true,onInvoke:()=>{const end=blocks.at(-1).segments.at(-1).stopV;const segment={startV:end,stopV:end,durationUs:'10',measure:false,measureStartUs:'0',measureStopUs:'0'};putChannel('arb',{blocks:[...blocks,{loops:'1',segments:Array.from({length:3},()=>({...segment}))}]});draft.arbBlock=blocks.length;draft.arbPage=0;render();}});
    if(blocks.length>1)units.action.create(sequencePanel,{id:'dkts-arb-block-remove',label:tr('删除当前序列','Remove sequence'),variant:'quiet',direct:true,onInvoke:()=>{putChannel('arb',{blocks:blocks.filter((_,i)=>i!==selected)});draft.arbBlock=Math.max(0,selected-1);draft.arbPage=0;render();}});
    field(sequencePanel,tr('序列重复次数','Sequence repeats'),arb.loops,v=>change('loops',v),'arb.loops');
    }
    if(byBias)sequenceLayout=dcLayout(host,'dkts-bias-step-layout');
    const seq=panel(byBias?'分段偏置表':'时序段',byBias?'Bias segments':'Sequence segments',sequenceLayout);
    const count=arb.segments.length;
    const pageCount=Math.ceil(count/32),pageIndex=Math.max(0,Math.min(pageCount-1,draft.arbPage||0));
    if(pageCount>1)dcSelect(seq,tr('段范围','Segments'),String(pageIndex),Array.from({length:pageCount},(_,i)=>({value:String(i),label:(i*32+1)+'–'+Math.min(count,(i+1)*32)})),v=>{draft.arbPage=Number(v);render();},{key:'arb-page'});
    const edit=(i,key,val)=>change('segments',blockList()[selected].segments.map((s,j)=>j===i?{...s,[key]:val}:s));
    const table=byBias?dcLayout(seq,'dkts-bias-step-table'):seq;
    if(byBias){
     const header=dcLayout(table,'dkts-bias-step-header dkts-bias-step-row dkts-time-column-head');
     for(const [zh,en] of [['段','No.'],['偏置 (V)','Bias (V)'],['保持 (µs)','Hold (µs)'],['测量','Measure'],
      ['起点 (µs)','Start (µs)'],['终点 (µs)','Stop (µs)']]){
      if(zh==='测量'){
       const caption=units.layout.create(header,{variant:'identity',className:'dkts-bias-column-caption'});
       units.note.create(caption,{variant:'meta',text:tr(zh,en)});
       timeHelp(caption,tr(zh,en),tr('启用后可设置测量窗口。终点留空表示段末。','Enable to set the measurement window. Leave the stop blank for the segment end.'));
      }else units.note.create(header,{variant:'meta',text:tr(zh,en)});
     }
    }
    const shapeFields=byBias?[['biasV','偏置 (V)','Bias (V)'],['durationUs','保持时间 (µs)','Hold (µs)']]:
     [['startV','起始电压 (V)','Start (V)'],['stopV','终止电压 (V)','Stop (V)'],['durationUs','时长 (µs)','Duration (µs)']];
    for(let i=pageIndex*32;i<Math.min(count,(pageIndex+1)*32);i++){
     const s=arb.segments[i],row=byBias?dcLayout(table,'dkts-bias-step-row'):
      units.panel.create(seq,{variant:'headed',title:tr('段 ','Segment ')+(i+1),sizing:'content',className:'dkts-timing-panel'}).body;
     if(byBias)row?.setAttribute?.('data-dkts-bias-row',String(i+1));
     if(byBias)units.note.create(row,{variant:'meta',text:String(i+1)});
     const rowPath=path+'.segments.'+i+'.';
     const labelFor=label=>tr('段 ','Segment ')+(i+1)+' · '+label;
     for(const [key,zh,en] of shapeFields){
      const input=field(row,tr(zh,en),s[key],v=>edit(i,key,v),rowPath+key);
      if(byBias)input.control?.setAttribute('aria-label',labelFor(tr(zh,en)));
     }
     dcSelect(row,tr('测量','Measure'),s.measure?'on':'off',[
      {value:'off',label:tr('不测量','Off')},{value:'on',label:tr('测量','On')}
     ],v=>{edit(i,'measure',v==='on');render();},{key:'arb-measure-'+i,ariaLabel:byBias?labelFor(tr('测量','Measure')):undefined});
     if(byBias||s.measure){
      const start=field(row,tr('测量起点 (µs)','Measure start (µs)'),s.measure?s.measureStartUs:'',v=>edit(i,'measureStartUs',v),rowPath+'measureStartUs',!s.measure);
      const stop=field(row,tr('测量终点 (µs)','Measure stop (µs)'),s.measure?s.measureStopUs:'',v=>edit(i,'measureStopUs',v),rowPath+'measureStopUs',!s.measure);
      if(byBias){
       start.control?.setAttribute('placeholder','—');
       start.control?.setAttribute('aria-label',labelFor(tr('测量起点 (µs)','Measure start (µs)')));
       stop.control?.setAttribute('placeholder',s.measure?tr('段末','Segment end'):'—');
       stop.control?.setAttribute('aria-label',labelFor(tr('测量终点 (µs)','Measure stop (µs)')));
      }
     }
     if(byBias||count>3){
      const remove=units.action.create(row,{id:'dkts-arb-remove-'+i,label:byBias?'−':tr('删除','Remove'),variant:byBias?'secondary':'quiet',direct:true,
       enabled:count>(byBias?1:3),onInvoke:()=>{
        change('segments',blockList()[selected].segments.filter((_,j)=>i!==j));render();
       }}).element;
      if(byBias)remove?.setAttribute?.('aria-label',tr('删除段 ','Remove segment ')+(i+1));
     }
    }
    if(blocks.reduce((n,b)=>n+b.segments.length,0)<2048)units.action.create(seq,{id:'dkts-arb-add',label:byBias?'＋ '+tr('新增时间段','Add time segment'):tr('增加时序段','Add segment'),variant:byBias?'secondary':'quiet',className:byBias?'dkts-bias-step-add':undefined,direct:true,onInvoke:()=>{
     const segments=blockList()[selected].segments,last=segments.at(-1);
     const voltage=byBias?{biasV:last.biasV}:{startV:last.stopV,stopV:last.stopV};
     change('segments',[...segments,{...voltage,durationUs:'10',measure:false,measureStartUs:'0',measureStopUs:byBias?'':'0'}]);
     draft.arbPage=Math.floor(count/32);render();
    }});
   }else if(editorSection==='target'){
    const event=panel('测量事件','Measure event');
    for(const [label,config,isPartner] of [[t(logicalNames[values.terminal]),values,false],...(partner?[[t(logicalNames[partner.terminal]),partner,true]]:[])]){
     const acquisition=dcSelect(event,label+' · '+tr('采样方式','Acquisition'),config.mode,[
      {value:'spot',label:tr('窗口均值','Spot mean')},{value:'waveform',label:tr('窗口波形','Waveform')}
     ],v=>{if(isPartner)put('arbPartner',{...values.arbPartner,mode:v});else put('mode',v);refresh();},{key:'arb-mode-'+label});
     if(byBias)timeHelp(acquisition.label,tr('采样方式','Acquisition'),tr(
      '窗口均值每窗返回一条，波形返回逐点数据。','Spot mean returns one result per window. Waveform returns each sample.'));
    }
    if(!byBias)field(event,tr('采样率 (Sa/s)','Sample rate (Sa/s)'),values.rateHz,v=>{put('rateHz',v);refresh();},'rateHz');
   }else{
    const strategy=panel('测量策略','Strategy');
    if(byBias)rangeDisplay=dcInput(strategy,tr('自动电压档','Auto voltage range'),'—',null,{key:'pmu-auto-range',readOnly:true}).control;
    if(!byBias)units.note.create(strategy,{variant:'meta',text:tr('由仪器执行完整序列及重复次数。','The instrument executes the complete sequence and repetitions.')});
   }
   let plot=null,data=emptyPlanPlot();
   if(editorSection==='sweep'){
    plot=createPlanPlot(sequenceLayout||host,p,tr('时序预览','Sequence preview'),tr('时间 (µs)','Time (µs)'),tr('计划偏置 (V)','Planned bias (V)'),()=>data,
     ()=>[{id:'dkts-plan-windows',label:(draft.hideWindows?'':'✓ ')+tr('测量窗口','Acquisition windows'),onInvoke:()=>{
      draft.hideWindows=!draft.hideWindows;refresh();
     }}]);
   }
   function draw(){
    if(!plot)return;
    data=emptyPlanPlot();
    try{
     const preview=hardware.segmentArbPreview({...values,...current(),testMode:values.testMode},selected,timingContext());
     const terminal=current().terminal,resource=pulsePort(p,current()).resource;
     const label=terminal+' · '+resource,points=[];
     const color=terminalColor(terminal);
     for(const segment of preview.segments){
      const {startTicks,endTicks,startV,stopV,window}=segment;
      const at=ticks=>startV+(stopV-startV)*(ticks-startTicks)/(endTicks-startTicks);
      points.push({x:startTicks/100,y:startV},{x:endTicks/100,y:stopV});
      if(window&&!draft.hideWindows)data.curves.push({
       id:'window-'+segment.index,label:tr('测量窗口','Acquisition window'),color,opacity:.30,strokeWidth:6,
       points:[{x:window.startTicks/100,y:at(window.startTicks)},{x:window.endTicks/100,y:at(window.endTicks)}]
      });
      data.rows.push({source:'planned',terminal,segment:segment.index,start_us:startTicks/100,end_us:endTicks/100,
       start_V:startV,end_V:stopV,window_start_us:window?window.startTicks/100:'',window_end_us:window?window.endTicks/100:''});
     }
     data.curves.unshift({id:terminal,label,color,points});
    }catch{}
    plot.requestRender?.('timing-plan');
   }
   const planPanel=panel('方案校验','Plan checks');
   const summary=byBias?dcLayout(planPanel,'dkts-plan-summary'):planPanel;
   if(byBias)mountParameterIssue(planPanel);
   function refresh(){
    draw();summary.replaceChildren();
    if(edgeDisplay)edgeDisplay.value='—';
    if(rangeDisplay||currentRangeControl){
     let range;
     try{range=hardware.segmentArbVoltageRange(values);}catch{}
     if(rangeDisplay)rangeDisplay.value=range?range+' V':'—';
     const context=timingContext(),port=pulsePort(p,settings);
     const ranges=range&&port.pmuVerified?hardware.getPmuCurrentRanges(range,context.withRpm).map(String):[];
     const options=[{value:'',label:tr('请选择','Select')},...ranges.map(value=>({value,label:value+' A'}))];
     if(values.currentRangeA&&!ranges.includes(values.currentRangeA))
      options.push({value:values.currentRangeA,label:values.currentRangeA+' A · '+tr('待核对','Review')});
     currentRangeControl?.setOptions?.(options,{value:values.currentRangeA});
    }
    try{
     const s=model.timedSummary('pulse',values,timingContext());
     if(edgeDisplay)edgeDisplay.value=s.transitionUs.join(' / ')||'—';
     const count=byBias?values.biasSteps.segments.length+' '+tr('个保持段，含过渡共 ','holds, with transitions '):'';
     const blocks=s.blocks?s.blocks.length+' '+tr('序列','sequences')+' · ':'';
     units.note.create(summary,{variant:'meta',text:blocks+count+s.segments.length+' '+tr('段','segments')+
      (s.blocks?'':' × '+s.loops)+' · '+s.durationS+' s · '+tr('预计记录 ','Estimated records ')+(s.totalEstimatedRecords??s.estimatedRecords)});
     if(s.loadOhms===null||values.currentRangeA===''||s.partner&&(s.partner.loadOhms===null||partner.currentRangeA===''))
      units.note.create(summary,{variant:'warning',text:tr('请填写负载并选择固定电流档。','Enter the load and select a fixed current range.')});
     const policy=hardware.DATABASE.safetyPolicies.kxci;
     if(byBias&&(!policy.allowPulseModeOutput||!policy.allowSegmentArbOutput))
      units.note.create(summary,{variant:'meta',text:tr('实机输出待验收','Instrument output pending verification')});
    }catch(e){if(!byBias)units.note.create(summary,{variant:'warning',text:String(e.message||e)});}
   }
   refresh();
  }
  const dcLayout=(host,className)=>units.layout.create(host,{variant:'identity',className});
  const dcPanel=(host,title,className,{actions,sizing='content'}={})=>units.panel.create(host,{
   variant:'headed',title,sizing,className,actions
  }).body;
  function planMessage(error){
   const message=String(error.message||error);
   if(language==='en')return message;
   if(message.startsWith('Invalid numeric input'))return '请输入有效数值。';
   if(message.startsWith('Enter an expression'))return '请输入有效的数值或表达式。';
   if(message.includes('must be a positive integer'))return '请输入正整数。';
   if(message.includes('exceeds planning bound'))return '超过方案允许的上限。';
   if(message.includes('requires a step toward Stop'))return '步进须朝向终止值，且每段最多 4096 点。';
   if(message.includes('requires distinct endpoints'))return '起止值须不同且至少两点。对数扫描的起止值须非零且同号。';
   if(message.includes('SMU planning envelope'))return '超出 SMU 的规划范围，请核对设定值与保护限值。';
   if(message.includes('Ref must lead'))return '参考链须经已映射的电压端子接地，且不能形成循环。';
   if(message.includes('requires a positive'))return '请填写正数的保护限值。';
   if(message.includes('requires a single method'))return '此端子的所有扫描段须使用同一方法。';
   return ({
    'Outputs must be distinct measured signals on mapped SMUs':'请选择已映射 SMU 的测量信号，各信号只能出现一次。',
    'Ref Node must be GND or a mapped voltage Condition with Ref set to GND':'请选择地，或参考设为 GND 的已映射电压恒定端子。',
    'Select exactly one Xsweep and at most one Psweep on mapped SMUs':'请在已映射 SMU 上选择一个 Xsweep，最多一个 Psweep。',
    'Switching Step must be positive':'切换步长须大于零。',
    'Sampling Step must be positive':'采样步长须大于零。',
    'Segment duration must be a positive multiple of Switching Step':'持续时间须为切换步长的正整数倍。',
    'The SMU integration time must fit within a sampling step':'SMU 积分时间须能放进一个采样步长。',
    'Event start cannot be negative':'测量事件的起始时间不能为负。',
    'Event interval cannot be shorter than Sampling Step':'事件间隔不得短于计划采样步长。',
    'The averaging window must fit the measurement interval and integration time':'平均窗口须满足积分时间，且不得超过事件间隔。',
    'A measurement event exceeds the cycle duration':'测量事件超出单周期终止时间，请调整事件起点、间隔、平均窗口或点数。',
    'Time plan exceeds the offline planning limit':'方案超出离线规划的时长或总读数上限。'
   })[message]||message;
  }
  function planFieldLabel(path){
   const [head,index,key,terminal]=path.split('.');
   if(head==='X'||head==='P')return head+'sweep'+tr(' · 扫描段 ',' · Segment ')+(Number(index)+1)+' · '+
    ({start:'Start',stop:'Stop',step:'Step',range:tr('量程','Range'),speed:tr('速度','Speed')}[key]||key);
   if(head==='segments')return tr('扫描 · 时段 ','Sweep · Time row ')+(Number(index)+1)+' · '+
    (terminal||tr('持续时间','Duration'));
   if(head==='events')return tr('目标 · 事件 ','Target · Event ')+(Number(index)+1)+' · '+({
    startS:tr('起始时间','Start Time'),intervalS:tr('事件间隔','Interval Time'),
    averageS:tr('平均窗口','Average Time'),points:tr('点数','Points'),
    terminal:tr('端子','Terminal')
   }[key]||key);
   if(index==='segments')return head+tr(' · 扫描段 ',' · Segment ')+(Number(key)+1)+' · '+
    ({start:'Start',stop:'Stop',step:'Step',points:'Points',value:tr('设定值','Value'),
     formula:tr('表达式','Expression'),range:tr('量程','Range')}[terminal]||terminal);
   return ({reference:'Ref Node',referenceV:'Ref (V)',outputs:'Outputs',
    sampleStepS:tr('计划采样步长','Planned Sampling Step'),switchStepS:tr('切换步长','Switching Step'),
    integrationPreset:tr('策略 · SMU 积分档','Strategy · SMU integration preset'),
    cycles:tr('循环次数','Cycles'),roles:tr('扫描角色','Scan role')}[path]||'');
  }
  function checkedPlan(page,settings){
   if(page.kind==='dc'){
    return model.dcSummary(page,{...settings,bodyResource:page.dc.bodyResource,specIds:page.dc.specIds});
   }
   const pmuTime=page.kind==='time'&&settings.mode===model.TIME_PMU_MODE;
   if(pmuTime){
    const pmu={...settings.pmu,rangeV:'auto'},port=pulsePort(page,pmu);
    try{
     const result=model.timedSummary('pulse',pmu,{withRpm:port.pmuVerified&&port.withRpm});
     if(port.pmuVerified&&pmu.currentRangeA&&!hardware.getPmuCurrentRanges(result.rangeV,port.withRpm).includes(Number(pmu.currentRangeA)))
      throw Object.assign(Error(tr('该电流档与实装 PMU/RPM 不匹配。','This range is incompatible with installed PMU/RPM.')),{field:'currentRangeA'});
     return result;
    }catch(error){
     if(error.field)error.field='pmu.'+error.field;
     throw error;
    }
   }
   const result=model.timedSummary(page.kind,settings);
   if(page.kind==='time'){
    if(!model.timeGroundNodes(page).includes(model.timeReference(page,settings)))
     throw Object.assign(Error(tr('请选择 GND 或已接到 GNDU 的端子。','Select GND or a terminal mapped to GNDU.')),{field:'reference'});
    const connection=measurementRuntime.status().connection;
    if(connection.phase==='connected'&&!connection.inventoryError)
     for(const term of page.terminals.filter(isSmu)){
      const slot=connection.inventory?.slots?.find(item=>item.family==='SMU'&&item.channel===Number(term.resource.slice(3)));
      if(!slot?.physicalIdentityVerified||!slot.ratingsVerified)continue;
      const limits=hardware.getModuleCapability(slot.physicalType)?.electrical;
      if(!limits)continue;
      const current=settings.sourceModes[term.logical]==='current';
      const key=current?'currentBias':'bias',max=current?limits.overrangeMaxCurrentA:limits.maxSourceVoltageV;
      const index=settings.segments.findIndex(segment=>Math.abs(Number(segment[key][term.logical]))>max);
      if(index>=0)throw Object.assign(Error(tr(
       '已核验的 '+term.resource+' 输出上限为 ±'+max+(current?' A。':' V。'),
       'The verified '+term.resource+' source limit is ±'+max+(current?' A.':' V.'))),
       {field:'segments.'+index+'.'+key+'.'+term.logical});
     }
   }
   if(page.kind==='pulse'){
    if(settings.testMode!=='sweep'){const port=pulsePort(page,settings);if(port.pmuVerified&&settings.currentRangeA&&!hardware.getPmuCurrentRanges(settings.rangeV,port.withRpm).includes(Number(settings.currentRangeA)))throw Object.assign(Error(tr('该电流档与实装 PMU/RPM 不匹配。','This range is incompatible with installed PMU/RPM.')),{field:'currentRangeA'});return result;}
    const issue=pulseCompatibility(settings,result);
    if(issue)throw Error(issue);
    if(settings.secondary){const secondary=model.pulseSecondarySettings(settings),summary={...result.secondary,totalSweepPoints:result.totalSweepPoints};const outerIssue=pulseCompatibility(secondary,summary);if(outerIssue)throw Error('Psweep: '+outerIssue);}
    const port=pulsePort(page,settings);
    if(port.pmuVerified&&settings.currentRangeA&&
       !hardware.getPmuCurrentRanges(settings.rangeV,port.withRpm).includes(Number(settings.currentRangeA)))
     throw Object.assign(Error(tr('该电流档与实装 PMU/RPM 不匹配。','This current range is incompatible with the installed PMU/RPM.')),
      {field:'currentRangeA'});
   }
   return result;
  }
  function pageParameterIssue(page){
   const field=[...(fieldIssues.get(page.id)?.values()||[])].find(row=>row.path!=='pRepeats'||page.sweep.pEnabled);
   if(field)return field;
   if(page.kind==='dc'||page.timing){
    const draft=page.kind==='dc'?dcDrafts.get(page.id):page.kind==='time'?timeDrafts.get(page.id):timingDrafts.get(page.id);
    const settings=draft?.settings||page.dc||page.timing;
    try{checkedPlan(page,settings);}
    catch(error){return {path:error.field||draft?.issuePath||'',message:planMessage(error)};}
    if(page.kind==='time'&&settings.mode!==model.TIME_PMU_MODE){
     const unmapped=settings.events.findIndex(event=>!page.terminals.some(term=>term.logical===event.terminal&&isSmu(term)));
     if(unmapped>=0)return {path:'events.'+unmapped+'.terminal',message:tr(
      '测量端子未映射到 SMU，请在工程顶栏分配。','Assign an SMU to the measurement terminal in the project toolbar.')};
    }
    return null;
   }
   if(!['iv','transfer','output'].includes(page.kind))return null;
   const segment=[...(segmentDrafts.get(page.id)?.values()||[])].find(row=>row.axis==='X'||page.sweep.pEnabled);
   if(segment)return {path:segment.axis+'.'+segment.index+'.'+segment.key,message:segment.message};
   const summary=model.summary(page);
   if(!summary.ready)return {path:'',message:summary.reason};
   try{measurementRuntimeModule.pageToSweepProgram(page);}
   catch(error){return {path:'',message:planMessage(error)};}
   const connection=measurementRuntime.status().connection;
   if(connection.phase==='connected'&&connection.inventory&&!connection.inventoryPending&&!connection.inventoryError){
    const prepared=measurementRuntime.prepare(page);
    if(!prepared.ready)return {path:'',message:prepared.reason};
   }
   return null;
  }
  function syncRunButton(page,issue=pageParameterIssue(page)){
   const button=runButtons.get(page.id);
   const running=measurementRuntime.status().run.running;
   const stopping=running&&runPageId===page.id;
   if(!button)return;
   const label=stopping?tr('停止测试','Stop test'):tr('执行测试','Run test');
   button.disabled=!stopping&&(running||Boolean(issue));
   const field=issue&&planFieldLabel(issue.path);
   button.title=!stopping&&issue?[field,issue.message].filter(Boolean).join(' · '):label;
  }
  function refreshParameterIssue(page){
   const issue=pageParameterIssue(page);
   syncRunButton(page,issue);
   const path=issue?.path||'';
   let fieldLabel=issue?.label||planFieldLabel(path);
   for(const field of editorRegion?.querySelectorAll?.('[data-dkts-parameter-path]')||[]){
    if(path&&field.getAttribute('data-dkts-parameter-path')===path){
     field.setAttribute('aria-invalid','true');
     field.setAttribute('aria-describedby','dkts-parameter-issue');
     fieldLabel=fieldLabel||field.getAttribute('aria-label')||field.labels?.[0]?.textContent;
    }else if(field.getAttribute('aria-describedby')==='dkts-parameter-issue'){
     field.removeAttribute('aria-invalid');
     field.removeAttribute('aria-describedby');
    }
   }
   if(parameterStatus){
    const message=issue?[fieldLabel,issue.message].filter(Boolean).join(' · '):'';
    if(parameterStatus.textContent!==message)parameterStatus.textContent=message;
    parameterStatus.hidden=!issue;
   }
   if(parameterOutputs?.control){
    if(page.kind==='time'){
     const timing=timeDrafts.get(page.id)?.settings||page.timing;
     parameterOutputs.control.value=timePageOutputs(timing);
    }else if(!page.timing)parameterOutputs.control.value=page.targets.map(target=>target.name).join(', ');
   }
  }
  function updateEditorPlan(path=''){
   if(!editorPlan)return;
   const s=state(),page=s.pages.find(row=>row.id===s.activeId);
   if(page.id!==editorPlan.id)return;
   const {draft}=editorPlan;
   if(path)draft.issuePath=path;
   try{
    checkedPlan(page,draft.settings);
    const previous=page.dc||page.timing;
    const nextSettings=page.dc?{...draft.settings,bodyResource:previous.bodyResource,specIds:previous.specIds}:draft.settings;
    if(JSON.stringify(previous)!==JSON.stringify(nextSettings)){
     const apply=page.dc?model.editDc:model.editTiming;
     saveProject(apply(s,nextSettings));
    }
   }catch{}
   refreshParameterIssue(page);
  }
  function dcInput(host,label,value,change,{key,terminal,path,disabled=false,kind='input',readOnly=false,help}={}){
   return fsproField(host,{kind,label,value,disabled,readOnly,
    attributes:{...(key?{'data-dkts-dc-field':key}:{}),...(terminal?{'aria-label':terminal+(label?' '+label:'')}:{}),
     ...(path?{'data-dkts-parameter-path':path}:{}),
     ...(help?{'data-dkds-tooltip':help}:{})},
    onInput:change?event=>{
     change(event.target.value);
     if(path==='referenceV')for(const linked of editorRegion?.querySelectorAll?.('[data-dkts-parameter-path="referenceV"]')||[])
      if(linked!==event.target)linked.value=event.target.value;
     if(path)updateEditorPlan(path);
    }:undefined});
  }
  function dcSelect(host,label,value,options,change,{key,terminal,ariaLabel,path,disabled=false,help}={}){
   const values=options.map(option=>typeof option==='string'?{value:option,label:option}:option);
   if(!values.some(option=>option.value===value))
    values.push({value,label:value+' · '+tr('待调整','Review')});
   return fsproField(host,{kind:'select',label,value,options:values,disabled,
    attributes:{...(key?{'data-dkts-dc-field':key}:{}),...(path?{'data-dkts-parameter-path':path}:{}),
     ...(ariaLabel||terminal?{'aria-label':ariaLabel||terminal+' '+label}:{}),
     ...(help?{'data-dkds-tooltip':help}:{})},
    onChange:event=>{
     const form=editorPlan;
     if(path&&form)form.draft.issuePath=path;
     change(event.target.value);
     if(path&&form===editorPlan)updateEditorPlan(path);
    }});
  }
  function dcDraft(p){
   if(!dcDrafts.has(p.id))dcDrafts.set(p.id,{settings:JSON.parse(JSON.stringify(p.dc))});
   return dcDrafts.get(p.id);
  }
  function redrawDc(){
   updateEditorPlan();
   const offset=parameters.scrollTop;
   render();
   parameters.scrollTop=offset;
  }
  function renderDcControls(host,p){
   const dc=dcDraft(p).settings,terminals=model.dcTerminals(p);
   const row=dcLayout(host,'dkts-dc-reference');
   row?.setAttribute?.('data-dkts-dc-controls','true');
   const preset=dcLayout(row,'dkts-dc-preset');
   const referencesGroup=dcLayout(row,'dkts-dc-reference-fields');
   const presets=[tr('DC（优化加速）','DC Optimized Timing'),tr('DC（逐点）','DC Point By Point')];
   dcSelect(preset,tr('类型','Type'),dc.preset,model.DC_PRESETS.map((value,index)=>({value,label:presets[index]})),
    value=>{dc.preset=value;redrawDc();},{key:'preset',path:'preset'});
   const isGround=key=>key==='GND'||terminals.find(term=>term.logical===key)?.resource==='GNDU';
   const references=terminals.filter(term=>term.resource==='GNDU'||
    (dc.terminals[term.logical].mode==='voltage'&&dc.terminals[term.logical].role==='CONDITION'));
   dcSelect(referencesGroup,'Ref Node',dc.reference,['GND',...references.map(term=>term.logical)],value=>{
    dc.reference=value;
    if(value!=='GND')dc.terminals[value].ref='GND';
    if(isGround(value))dc.referenceV='0';
    redrawDc();
   },{key:'reference',path:'reference'});
   dcInput(referencesGroup,'Ref (V)',isGround(dc.reference)?'0':dc.referenceV,
    value=>{dc.referenceV=value;},{key:'referenceV',path:'referenceV',readOnly:isGround(dc.reference)});
   dcInput(referencesGroup,'Outputs',dc.outputs,value=>{dc.outputs=value;},{key:'outputs',
    path:'outputs',
    help:tr('以逗号或空格分隔：','Separate signals with commas or spaces: ')+model.dcOutputs(p).join(', ')});
  }
  function renderParameterControls(host,p){
   if(p.kind==='dc'){renderDcControls(host,p);return;}
   const row=dcLayout(host,'dkts-dc-reference dkts-page-reference');
   row?.setAttribute?.('data-dkts-parameter-controls','true');
   const type=dcLayout(row,'dkts-dc-preset');
   dcInput(type,tr('类型','Type'),p.kind==='time'?tr('IVT · 时间扫描','IVT · Time sweep'):testTypeLabel(p.testType),
    null,{readOnly:true,key:'test-type'});
   const refs=dcLayout(row,'dkts-dc-reference-fields');
   const ground=p.terminals.find(term=>term.resource==='GNDU');
   const timing=editorPlan?.draft.settings;
   if(p.kind==='time'&&timing.mode!==model.TIME_PMU_MODE){
    const options=model.timeGroundNodes(p).map(node=>({value:node,label:node==='GND'?'GND':node+' · GNDU'}));
    dcSelect(refs,'Ref Node',model.timeReference(p,timing),options,value=>{timing.reference=value;},
     {key:'reference',path:'reference',help:tr('时间扫描以 0 V 为参考，可选 GND 或接到 GNDU 的端子。','Time sweeps use a 0 V reference. Select GND or a terminal mapped to GNDU.')});
   }else{
    dcInput(refs,'Ref Node',ground?ground.logical+' · GNDU':'GND',null,{readOnly:true,key:'reference'});
   }
   dcInput(refs,'Ref (V)','0',null,{readOnly:true,key:'referenceV'});
   const signal=timing?.terminal?.toLowerCase();
   const outputs=p.kind==='time'?timePageOutputs(timing):p.kind==='pulse'?'I'+signal+', V'+signal:
    p.kind==='retention'?'I'+signal:p.targets.map(target=>target.name).join(', ');
   parameterOutputs=dcInput(refs,'Outputs',outputs,null,{readOnly:true,key:'outputs',
    help:tr('在「目标」中设置测量输出。','Configure measurement outputs on the Target tab.')});
  }
  function dcMeasurementRanges(term,row,segment,terminals){
   if(row.mode==='voltage'){
    if(row.ref!=='GND'&&!terminals.some(t=>t.logical===row.ref&&t.resource==='GNDU'))return null;
    const values=segment.method==='list'?segment.list.split(/[,\n]/):[segment.start,segment.stop];
    if(values.some(value=>!value.trim()||!Number.isFinite(Number(value))))return null;
    return currentRanges(term,values.map(Number));
   }
   const connection=measurementRuntime.status().connection;
   if(connection.phase!=='connected'||connection.inventoryError)return null;
   const slot=connection.inventory?.slots?.find(item=>item.family==='SMU'&&item.channel===Number(term.resource.slice(3)));
   if(!slot?.physicalIdentityVerified||!slot.ratingsVerified)return null;
   return hardware.getModuleCapability(slot.physicalType)?.electrical?.voltageRanges.map(range=>range.nominalV)??null;
  }
  function renderDcSweep(host,p,s,dc,redraw){
   const terminals=model.dcTerminals(p),smus=terminals.filter(term=>term.resource!=='GNDU');
   const panel=dcPanel(host,tr('输入设置','Input settings'),'dkts-dc-input-panel');
   const affected=p.terminals.filter(term=>term.logical!=='B'&&term.resource!=='None'&&!terminals.includes(term));
   if(affected.length)units.note.create(panel,{variant:'warning',text:
    affected.map(term=>term.logical+' · '+term.resource).join(' / ')+
    tr('：DC 偏置需使用 SMU 或 GNDU。',': DC bias requires SMU or GNDU.')});
   if(!terminals.length)units.emptyState.create(panel,{message:tr('请先分配 DC 端子。','Assign DC terminals first.')});
   for(const term of terminals){
    const key=term.logical,row=dc.terminals[key],ground=term.resource==='GNDU',root=dc.reference===key;
    const mode=ground?'common':root?'voltage':row.mode;
    const role=root||ground?'CONDITION':row.role;
    const band=dcLayout(panel,'dkts-dc-terminal');
    band?.setAttribute?.('data-dkts-dc-terminal',key);
    const segmentList=root||ground?[{method:'constant',value:ground?'0':dc.referenceV}]:row.segments;
    const unit=mode==='current'?'A':'V';
    const methods=model.dcMethods(role).map(value=>({value,label:model.DC_METHODS[value]}));
    const identity=dcLayout(band,'dkts-dc-terminal-id');
    const labelRow=dcLayout(identity,'dkts-dc-terminal-label');
    units.note.create(labelRow,{variant:'meta',className:'dkts-terminal-badge dkts-dc-terminal-symbol',text:key})
     ?.setAttribute?.('data-dkts-terminal-tone',key);
    const name=dcLayout(labelRow,'dkts-dc-terminal-caption');
    units.note.create(name,{variant:'meta',className:'dkts-dc-terminal-name',text:t(logicalNames[key])});
    units.note.create(name,{variant:'meta',className:'dkts-dc-terminal-resource',text:term.resource.replace(/^SMU(\d)$/,'SMU $1')});
    const availableRefs=mode==='current'||root||ground?[]:terminals.filter(other=>
     other.logical!==key&&(other.resource==='GNDU'||dc.terminals[other.logical].mode==='voltage'));
    dcSelect(identity,tr('参考','Ref'),ground||root?'GND':row.ref,['GND',...availableRefs.map(term=>term.logical)],
     value=>{row.ref=value;},{key:'ref',path:key+'.ref',terminal:key,disabled:ground||root||mode==='current'});
    const settings=dcLayout(band,'dkts-dc-terminal-modes');
    const modeFields=dcLayout(settings,'dkts-dc-mode-fields');
    dcSelect(modeFields,tr('模式','Mode'),mode,ground?[{value:'common',label:'Common'}]:
     [{value:'voltage',label:'Voltage'},{value:'current',label:'Current'}],value=>{
      if(row.mode!==value)for(const segment of row.segments)segment.range='auto';
      row.mode=value;
      if(value==='current')row.ref='GND';
      redraw();
     },{key:'mode',path:key+'.mode',terminal:key,disabled:ground||root});
    const roles=[{value:'CONDITION',label:'Condition'},{value:'X',label:'Xsweep'},{value:'P',label:'Psweep'}];
    dcSelect(modeFields,false,role,roles.filter(option=>option.value===role||
     (option.value==='CONDITION'?row.segments.length===1:
      !smus.some(other=>other.logical!==key&&dc.terminals[other.logical].role===option.value))),
     value=>{
      row.role=value;
      for(const segment of row.segments)
       if(!model.dcMethods(value).includes(segment.method))segment.method=value==='CONDITION'?'constant':'step';
      redraw();
     },{key:'role',path:key+'.role',ariaLabel:key+' '+tr('扫描角色','Scan role'),disabled:ground||root});
    const firstMethod=segmentList[0].method;
    const mixed=segmentList.some(segment=>segment.method!==firstMethod);
    const sharedMethod=mixed?'mixed':firstMethod;
    if(mixed)methods.unshift({value:'mixed',label:tr('请选择统一方法','Choose a shared method')});
    dcSelect(settings,tr('方法','Method'),sharedMethod,methods,value=>{
     if(value==='mixed')return;
     for(const segment of row.segments)segment.method=value;
     redraw();
    },{key:'method',path:key+'.method',terminal:key,disabled:ground||root});
    const segments=dcLayout(band,'dkts-dc-segments');
    for(const [index,segment] of segmentList.entries()){
     const line=dcLayout(segments,'dkts-dc-primary');
     line?.setAttribute?.('data-dkts-dc-primary',String(index+1));
     if(mixed)units.note.create(line,{variant:'warning',className:'dkts-dc-legacy-method',
      text:tr('第 ','Segment ')+(index+1)+' · '+model.DC_METHODS[segment.method]});
     const fields=dcLayout(line,'dkts-dc-segment-fields');
     const field=(name,label)=>dcInput(fields,label,segment[name],value=>{
      if(root&&name==='value')dc.referenceV=value;
      else segment[name]=value;
     },{key:name,path:root&&!ground?'referenceV':key+'.segments.'+index+'.'+name,terminal:key,readOnly:ground,help:name==='formula'?
      tr('支持页面变量、scale()、getx() 及有 Psweep 时的 getp()。',
       'Supports Page Var, scale(), getx(), and getp() when a Psweep exists.'):undefined});
     if(segment.method==='constant')field('value',tr('设定值','Value')+' ('+unit+')');
     else if(segment.method==='list')field('list','List ('+unit+')');
     else if(segment.method==='generator')field('formula',tr('表达式','Expression'));
     else{
      field('start','Start ('+unit+')');
      field('stop','Stop ('+unit+')');
      if(segment.method==='step')field('step','Step ('+unit+')');
      else field('points','Points');
     }
     if(dc.preset==='point-by-point'&&role!=='CONDITION'){
      const range=rangeChoices(dcMeasurementRanges({...term,sourceMode:mode},row,segment,terminals),segment.range);
      const measurementUnit=mode==='voltage'?'A':'V';
      dcSelect(fields,tr('量程','Range')+' ('+measurementUnit+')',segment.range,range.choices,
       value=>{segment.range=value;},{key:'range',path:key+'.segments.'+index+'.range',terminal:key});
     }
     const actions=dcLayout(line,'dkts-dc-segment-actions');
     if(role!=='CONDITION'){
      units.action.create(actions,{id:'dc-remove-'+key+'-'+index,label:'−',
       title:tr('删除扫描段','Remove sweep segment'),variant:'quiet',enabled:!mixed&&row.segments.length>1,
       onInvoke:()=>{row.segments.splice(index,1);redraw();}});
      if(index===segmentList.length-1)
       units.action.create(actions,{id:'dc-add-'+key,label:'+',title:tr('新增扫描段','Add sweep segment'),
        variant:'quiet',enabled:!mixed&&row.segments.length<16,onInvoke:()=>{
         row.segments.push({...segment});redraw();
        }});
     }
    }
   }
   const bottom=dcLayout(host,'dkts-dc-bottom');
   const limits=dcPanel(bottom,t('Limits'),'dkts-dc-limits',{sizing:'fill'});
   const head=dcLayout(limits,'dkts-dc-limit-row');
   for(const name of ['Node','I (A)','V (V)'])units.note.create(head,{variant:'meta',text:name});
   for(const {logical,resource} of terminals){
    const line=dcLayout(limits,'dkts-dc-limit-row'),row=dc.terminals[logical],ground=resource==='GNDU';
    units.note.create(line,{variant:'meta',text:logical});
    dcInput(line,false,ground?'':row.limitI,value=>{row.limitI=value;},
     {key:'limitI',path:logical+'.limitI',terminal:logical+' I (A)',readOnly:ground});
    dcInput(line,false,ground?'':row.limitV,value=>{row.limitV=value;},
     {key:'limitV',path:logical+'.limitV',terminal:logical+' V (V)',readOnly:ground});
   }
   renderVariablesPanel(bottom,p,'fill');
   renderDcSpecs(bottom,p,s.specs.filter(spec=>spec.deviceId===s.activeDeviceId));
  }
  function renderDcSpecs(host,p,available){
   const panel=dcPanel(host,t('Associate Spec'),'dkts-dc-specs',{sizing:'fill',actions:[{
    id:'dc-add-spec',label:'＋',title:t('新建并关联规格'),variant:'quiet',
    onInvoke:()=>commitTransaction(()=>model.addSpec(state()))
   }]});
   const associated=p.dc.specIds;
   const unselected=available.filter(spec=>!associated.includes(spec.id));
   if(unselected.length)dcSelect(panel,tr('添加已有规格','Add existing spec'),'',[
    {value:'',label:tr('选择规格','Select spec')},...unselected.map(spec=>({value:spec.id,label:spec.name}))
   ],value=>{if(value)commitTransaction(()=>model.associateSpec(state(),value));},{key:'associateSpec'});
   if(!associated.length)units.emptyState.create(panel,{message:tr('尚未关联规格。','No associated specs.')});
   for(const id of associated){
    const row=dcLayout(panel,'dkts-dc-spec-row');
    units.note.create(row,{variant:'meta',text:available.find(spec=>spec.id===id)?.name||id});
    units.action.create(row,{id:'dc-remove-'+id,label:'−',title:tr('解除关联','Remove association'),
     variant:'quiet',onInvoke:()=>commitTransaction(()=>model.removeDcSpec(state(),id))});
   }
  }
  function renderDcTarget(host,p,dc){
   const formula=dcPanel(host,tr('公式','Formula'),'dkts-dc-target');
   dcInput(formula,tr('目标公式','Target formula'),dc.target.formula,value=>{dc.target.formula=value;},
    {key:'formula',path:'target.formula',kind:'textarea'});
   const bottom=dcLayout(host,'dkts-dc-bottom');
   const plot=dcPanel(bottom,tr('绘图','Plot'),'dkts-dc-plot');
   for(const key of ['x','y'])dcInput(plot,key.toUpperCase(),dc.target[key],value=>{dc.target[key]=value;},{key:'plot-'+key,path:'target.'+key});
   for(const key of ['h','p'])dcInput(plot,key.toUpperCase(),dc.target[key],value=>{dc.target[key]=value;},{key:'plot-'+key,path:'target.'+key,help:key==='p'?tr('Psweep 设定值，以逗号分隔','Comma-separated Psweep source levels'):tr('第二输出表达式，在独立 Target H 图窗显示','Secondary expression shown in a Target H plot frame')});
   renderVariablesPanel(bottom,p);
   const quoted=dcPanel(bottom,'Quote Var','dkts-dc-quote');
   for(const signal of dc.outputs.trim().split(/[\s,]+/).filter(Boolean))
    units.note.create(quoted,{variant:'meta',text:signal+' · '+tr('输出','Output')});
   for(const {logical} of model.dcTerminals(p)){
    const {role}=dc.terminals[logical];
    units.note.create(quoted,{variant:'meta',text:logical+' · '+({X:'Xsweep',P:'Psweep',CONDITION:'Condition'}[role])});
   }
  }
  function renderDcStrategy(host,dc,redraw){
   const panel=dcPanel(host,tr('测试策略','Measurement strategy'),'dkts-dc-strategy');
   const row=dcLayout(panel,'dkts-dc-strategy-fields'),settings=dc.strategy;
   dcSelect(row,tr('设置','Setting'),settings.mode,[{value:'global',label:'Global Setting'},
    {value:'local',label:'Local Setting'}],value=>{settings.mode=value;redraw();},{key:'strategy'});
   if(settings.mode==='local'){
    const speeds=[{value:'fast',label:tr('快速','Fast')},{value:'normal',label:tr('标准','Normal')},{value:'quiet',label:tr('低噪声','Quiet')}];
    if(settings.integrationPreset==='legacy')speeds.push({value:'legacy',label:tr('旧积分设置 · ','Legacy integration · ')+settings.integration+' s'});
    dcSelect(row,tr('测量速度','Measurement speed'),settings.integrationPreset||'normal',speeds,
     value=>{settings.integrationPreset=value;if(value!=='legacy')settings.integration='';redraw();},{key:'integration',path:'integration'});
    dcInput(row,tr('延迟时间 (s)','Delay time (s)'),settings.delay,
     value=>{settings.delay=value;},{key:'delay',path:'delay',help:'Default: blank'});
   }else{
    units.note.create(panel,{variant:'meta',text:tr('全局 SMU 积分档在顶栏「端口」右侧设置。','Set the global SMU integration in the top toolbar, next to Ports.')});
   }
   if(dc.preset==='optimized'||dc.preset==='point-by-point'){
    dcInput(row,tr('首点保持 (s)','Hold time (s)'),settings.hold,value=>{settings.hold=value;},
     {key:'hold',path:'hold',help:'Default: blank'});
   }
   if(dc.preset==='point-by-point'){
    dcSelect(row,tr('超限处理','On limit'),settings.onLimit,[
     {value:'stop',label:tr('停止本测试','Stop this test')},
     {value:'skip',label:tr('跳过该点','Skip this point')}
    ],value=>{settings.onLimit=value;},{key:'onLimit',path:'onLimit'});
   }
   {
    dcSelect(row,tr('扫描方向','Sweep direction'),settings.direction,[
     {value:'forward',label:tr('正向','Forward')},
     {value:'forward-reverse',label:tr('正向 / 反向','Forward / Reverse')}
    ],value=>{settings.direction=value;},{key:'direction',path:'direction'});
   }
  }
  function renderDc(host,p,s){
   const dc=editorPlan.draft.settings;
   const surface=dcLayout(host,'dkts-dc-editor');
   surface?.setAttribute?.('data-dkts-dc-editor',editorSection);
   if(editorSection==='sweep')renderDcSweep(surface,p,s,dc,redrawDc);
   else if(editorSection==='target')renderDcTarget(surface,p,dc);
   else renderDcStrategy(surface,dc,redrawDc);
  }

  function timeDraft(p){
   if(!timeDrafts.has(p.id))timeDrafts.set(p.id,{settings:JSON.parse(JSON.stringify(p.timing))});
   return timeDrafts.get(p.id);
  }
  function smuIntegrationPresets(){
   return [{value:'short',label:tr('短 · 0.1 PLC','Short · 0.1 PLC')},
    {value:'medium',label:tr('中 · 1 PLC','Medium · 1 PLC')},
    {value:'long',label:tr('长 · 10 PLC','Long · 10 PLC')}];
  }
  function terminalColor(terminal){
   const tag=workspace?.querySelector?.('[data-dkts-terminal-tone="'+terminal+'"]');
   return tag?window.getComputedStyle(tag).getPropertyValue('--dkts-terminal-accent').trim():undefined;
  }
  function smuTimePlotData(settings,terminals,grid){
   const data=emptyPlanPlot();
   if(!grid)return data;
   for(const term of terminals){
    const {logical,resource}=term;
    const current=settings.sourceModes[logical]==='current',unit=current?'A':'V';
    const bank=current?'currentBias':'bias';
    const values=settings.segments.map(segment=>String(segment[bank][logical]).trim());
    if(values.some(value=>!value||!Number.isFinite(Number(value))))continue;
    const levels=values.map(Number),color=terminalColor(logical);
    const points=levels.flatMap((y,i)=>[{x:grid.starts[i],y},{x:grid.starts[i+1]??grid.durationS,y}]);
    data.curves.push({id:logical,label:logical+' · '+t(logicalNames[logical])+' / '+resource,color,points});
    for(const [i,y] of levels.entries())data.rows.push({source:'planned',terminal:logical,unit,segment:i+1,
     axis:grid.pointsAxis?'point':grid.readings.length?'estimated_wait_s':'planned_s',start:grid.starts[i],
     end:grid.pointsAxis&&grid.starts[i+1]!==undefined?grid.starts[i+1]-1:grid.starts[i+1]??grid.durationS,bias:y});
    const events=settings.events.filter(event=>event.terminal===logical);
    if(!events.length)continue;
    const samples=grid.readings.length?grid.readings:events.flatMap(event=>{
     const start=Number(event.startS),step=Number(event.intervalS),count=Number(event.points);
     const stride=Math.max(1,Math.ceil(count/128));
     return Array.from({length:Math.ceil(count/stride)},(_,index)=>{
      const at=start+index*stride*step;
      return {at,segment:Math.max(0,grid.starts.findLastIndex(begin=>begin<=at))};
     });
    });
    const stride=Math.max(1,Math.ceil(samples.length/128));
    samples.forEach(({at,segment},index)=>{
     if(index%stride&&index!==samples.length-1)return;
     data.markers.push({id:logical+'-'+index,curveId:logical,locked:true,x:at,y:levels[segment],color});
    });
   }
   return data;
  }
  const timeOutputs=events=>[...new Set(events.map(event=>(event.quantity==='Voltage'?'V':'I')+event.terminal.toLowerCase()))].join(', ');
  const timePageOutputs=timing=>{
   if(timing.mode!==model.TIME_PMU_MODE)return timeOutputs(timing.events);
   if(!timing.pmu.biasSteps.segments.some(row=>row.measure))return '';
   const terminal=timing.pmu.terminal.toLowerCase();
   return 'I'+terminal+', V'+terminal;
  };
  function renderTimeMode(host,settings){
   const smu=['native-fixed','native-list'].includes(settings.mode);
   dcSelect(host,tr('方式','Mode'),smu?'smu-bias':settings.mode,[
    {value:'smu-bias',label:tr('时间偏置 · SMU','Time bias · SMU')},
    {value:model.TIME_PMU_MODE,label:tr('分段脉冲 · PMU','Segmented pulse · PMU')},
    {value:'linear-step',label:tr('线性步进 · 计划','Linear Step Plan')}
   ],value=>{
    if(smu)settings.smuMode=settings.mode;
    settings.mode=value==='smu-bias'?(settings.segments.length>1||settings.smuMode==='native-list'?'native-list':'native-fixed'):value;
    if(value===model.TIME_PMU_MODE)settings.pmu??=model.defaultPmuTimeSettings();
    redrawDc();
   },{key:'time-mode',path:'mode'});
  }
  function renderTime(host,p){
   const draft=editorPlan.draft,settings=draft.settings,list=settings.mode==='native-list',native=settings.mode==='native-fixed';
   const surface=dcLayout(host,'dkts-dc-editor dkts-time-editor');
   surface?.setAttribute?.('data-dkts-time-editor',editorSection);
   if(settings.mode===model.TIME_PMU_MODE){
    const panel=(zh,en,target=surface)=>dcLayout(dcPanel(target,tr(zh,en),'dkts-timing-panel'),'dkts-timing-fields');
    settings.pmu.rangeV='auto';
    renderArbTiming(surface,p,settings.pmu,(key,value)=>{
     settings.pmu[key]=value;
     updateEditorPlan('pmu.'+key);
    },panel,settings);
    return;
   }
   const smus=p.terminals.filter(term=>isSmu(term)&&(!(native||list)||term.logical!=='B'));
   surface?.style?.setProperty?.('--dkts-time-segment-fields',String(2+smus.length));
   let plot=null,plotData=emptyPlanPlot(),displayTerminals=[],status=null,segmentCount=null,samplePoints=null;
   const timeValue=value=>Number.isFinite(value)?String(Number(value.toPrecision(12))):'—';
   function refreshPlan(){
    let plan=null,grid=null;
    try{grid=model.timeGrid(settings);}catch{}
    try{plan=model.timedSummary('time',settings);}catch{}
    const mapped=settings.events.every(event=>smus.some(term=>term.logical===event.terminal));
    if(segmentCount)segmentCount.value=String(grid?.segmentCount??'—');
    if(samplePoints)samplePoints.value=String(grid?.samplePoints??'—');
    if(status){
     status.textContent=plan&&mapped?(native||list?tr('仪器执行 · ','Instrument execution · '):tr('单循环 ','Per cycle ')+timeValue(plan.durationS)+' s · ')+plan.cycles+
      tr(' 循环 · ',' cycles · ')+plan.points+tr(' 次计划读数',' planned event readings'):'';
     status.setAttribute('data-dkts-time-valid',String(Boolean(plan&&mapped)));
     status.hidden=!(plan&&mapped);
    }
    let previewGrid=null;
    try{previewGrid=model.timePreviewGrid(settings,draft.previewAxis);}catch{}
    plotData=smuTimePlotData(settings,displayTerminals,plan?previewGrid:null);
    plot?.requestRender?.('timing-plan');
   }
   const plannedText=(parent,row,key,zh,en,path=key,changed)=>scalarField(parent,tr(zh,en),row[key],value=>{
    row[key]=value;
    changed?.();
    updateEditorPlan(path);
    refreshPlan();
   },false,{'data-dkts-timing-field':key,'data-dkts-parameter-path':path},false,true);
   const action=(parent,id,label,title,enabled,onInvoke)=>units.action.create(parent,{id,label,title,variant:'quiet',enabled,onInvoke});
   if(editorSection==='sweep'){
    const input=dcLayout(surface,'dkts-time-setup');
    const oneCycle=dcPanel(input,tr('时间扫描 · 单周期','Time sweep · One cycle'),'dkts-time-panel dkts-time-settings');
    const controls=dcLayout(oneCycle,'dkts-time-grid-fields');
    renderTimeMode(controls,settings);
    if(!native&&!list){
     const switchStep=plannedText(controls,settings,'switchStepS','切换步长 (s)','Switching step (s)');
     timeHelp(switchStep.label,tr('切换步长','Switching step'),tr('每段持续时间须为切换步长的整数倍。','Each segment duration must be a whole multiple of the switching step.'));
     segmentCount=dcInput(controls,tr('切换步数','Switch count'),'—',null,{readOnly:true,key:'time-segments'}).control;
     renderSamplingField(controls,draft,[
      [tr('计划采样步长 (s)','Planned step (s)'),'sampleStepS'],
      [tr('计划采样频率 (Hz)','Planned rate (Hz)'),'sampleRateHz']
     ],showRate=>showRate?reciprocal(settings.sampleStepS,1):settings.sampleStepS,(showRate,value)=>{
      settings.sampleStepS=showRate?reciprocal(value,1):value;
      updateEditorPlan(showRate?'sampleRateHz':'sampleStepS');
      refreshPlan();
     });
    }
    if(!native)samplePoints=dcInput(controls,tr('单周期总采样点','Total Time Points'),'—',null,{readOnly:true,key:'time-points'}).control;
    const repeat=dcPanel(input,tr('重复','Repeat'),'dkts-time-panel dkts-time-repeat');
    plannedText(dcLayout(repeat,'dkts-time-grid-fields'),settings,'cycles','循环次数','Cycles');
    const panels=dcLayout(surface,'dkts-time-workspace');
    const inputs=dcPanel(panels,tr('时间偏置表','Time Bias Table'),'dkts-time-panel dkts-time-inputs');
    const modes=dcLayout(inputs,'dkts-time-source-modes');
    const unitFor=key=>settings.sourceModes[key]==='current'?'A':'V';
    for(const term of smus){
     const key=term.logical;
     dcSelect(modes,key+' · '+t(logicalNames[key])+' '+tr('输出','Source'),settings.sourceModes[key],[
      {value:'voltage',label:tr('电压 (V)','Voltage (V)')},{value:'current',label:tr('电流 (A)','Current (A)')}
     ],value=>{settings.sourceModes[key]=value;redrawDc();},
     {key:'time-source-'+key,path:'sourceModes.'+key});
    }
    if((native||list)&&smus.some(term=>settings.sourceModes[term.logical]==='current')){
     const protection=dcLayout(inputs,'dkts-time-source-modes');
     for(const term of smus.filter(term=>settings.sourceModes[term.logical]==='current'))plannedText(protection,settings.voltageLimitsV,term.logical,term.logical+' · '+tr('电压保护 (V)','Voltage compliance (V)'),term.logical+' · Voltage compliance (V)','voltageLimitsV.'+term.logical);
    }
    const timing=dcLayout(inputs,'dkts-time-source-modes');
    if(native){
     const event=settings.events[0];
     const shared=(key,zh,en)=>plannedText(timing,event,key,zh,en,'events.0.'+key,()=>{
      for(const signal of settings.events)signal[key]=event[key];
     });
     const start=shared('startS','首点前等待 (s)','Wait before first reading (s)');
     const interval=shared('intervalS','点间等待 (s)','Wait after each reading (s)');
     const phaseRead=(zh,en)=>({label:tr(zh,en),read:true,detail:()=>tr('积分＋读出','Integration + readout')});
     const phases=[
      {label:tr('偏置后等待','Wait at bias'),detail:()=>event.startS+' s'},
      phaseRead('读数 1','Read 1'),
      {label:tr('读数后等待','Wait after reading'),detail:()=>event.intervalS+' s'},
      phaseRead('读数 2','Read 2')
     ];
     timeWaitHelp(start,tr('首次读数前等待','Wait before first reading'),tr('设定偏置后，到开始第一次读数的等待。','The delay after setting bias and before the first reading.'),phases,0);
     timeWaitHelp(interval,tr('读数后等待','Wait after each reading'),tr('一次读数完成后，到开始下一次读数的等待。','The delay after one reading completes and before the next begins.'),phases,2);
    }else if(list){
     const delay=plannedText(timing,settings,'listDelayS','每点稳定等待 (s)','Settling delay per point (s)');
     const wait={label:tr('偏置后等待','Settle at bias'),detail:()=>settings.listDelayS+' s'};
     const read={label:tr('读取本点','Read the point'),read:true,detail:()=>tr('积分＋读出','Integration + readout')};
     timeWaitHelp(delay,tr('每点稳定等待','Settling delay per point'),tr('每点设置偏置后，先等待，再积分读出。','Each point sets bias, waits, then integrates and reads.'),[wait,read,{...wait,level:true},{...read,level:true}],0);
    }
    const table=dcLayout(inputs,'dkts-time-table');
    if(!smus.length)units.note.create(table,{variant:'warning',text:tr('请在工程顶栏分配 SMU 端子。','Assign an SMU terminal in the project toolbar.')});
    const byPoint=native||list;
    const head=dcLayout(table,'dkts-time-segment dkts-time-column-head');
    for(const label of [tr('段','Index'),byPoint?tr('点号范围','Point range'):tr('起始 (s)','Start (s)'),byPoint?tr('点数','Readings'):tr('持续时间 (s)','Duration (s)'),...smus.map(term=>
     term.logical+' · '+t(logicalNames[term.logical])+' ('+unitFor(term.logical)+')')]){
     if(label===tr('点数','Readings')){
      const caption=dcLayout(head,'dkts-bias-column-caption');
      units.note.create(caption,{variant:'meta',text:label});
      timeHelp(caption,tr('每周期采样点数','Samples per cycle'),tr('从 1 编号。60 点为 1–60，下一段从 61 开始。','Numbering starts at 1. A 60-point segment spans 1–60. The next starts at 61.'));
     }else units.note.create(head,{variant:'meta',text:label});
    }
    const starts=[];
    function refreshStarts(){
     let start=0;
     for(const [index,segment] of settings.segments.entries()){
      const amount=native?settings.events[0].points:list?segment.listPoints:segment.durationS;
      const count=Number(amount),end=Number.isFinite(start)&&count>0?start+count:NaN;
      if(starts[index])starts[index].value=byPoint?
       (Number.isSafeInteger(end)?(start+1===end?String(end):(start+1)+'–'+end):'—'):
       (Number.isFinite(start)?String(Number(start.toPrecision(12))):'—');
      start=end;
     }
    }
    for(const [index,segment] of settings.segments.entries()){
     const line=dcLayout(table,'dkts-time-segment');
     line?.setAttribute?.('data-dkts-time-segment',String(index+1));
     units.note.create(line,{variant:'meta',text:String(index+1)});
     starts.push(dcInput(line,byPoint?tr('点号范围','Point range'):tr('起始 (s)','Start (s)'),'0',null,{readOnly:true,key:'time-start'}).control);
     if(native)plannedText(line,settings.events[0],'points','点数','Readings','events.0.points',()=>{
      for(const event of settings.events)event.points=settings.events[0].points;
      refreshStarts();
     });
     else if(list)plannedText(line,segment,'listPoints','点数','Readings','segments.'+index+'.listPoints',refreshStarts);
     else plannedText(line,segment,'durationS','持续时间 (s)','Duration (s)','segments.'+index+'.durationS',refreshStarts);
     for(const terminal of smus){
      const key=terminal.logical,unit=unitFor(key),bank=unit==='A'?'currentBias':'bias';
      const label=key+' · '+t(logicalNames[key])+' ('+unit+')';
      plannedText(line,segment[bank],key,label,label,'segments.'+index+'.'+bank+'.'+key);
     }
     units.action.create(line,{id:'remove-time-segment-'+index,label:'−',title:tr('删除时间段','Remove time segment'),
      variant:'secondary',direct:true,enabled:settings.segments.length>1,onInvoke:()=>{
       settings.segments.splice(index,1);
       if(list&&settings.segments.length===1){
        settings.mode='native-fixed';
        settings.smuMode=settings.mode;
        const {startS,intervalS}=settings.events[0];
        for(const event of settings.events)Object.assign(event,{points:settings.segments[0].listPoints,startS,intervalS});
       }
       redrawDc();
      }});
    }
    refreshStarts();
    units.action.create(inputs,{id:'add-time-segment',label:'＋ '+tr('新增时间段','Add time segment'),
     variant:'secondary',direct:true,enabled:settings.segments.length<64,onInvoke:()=>{
      const last=settings.segments.at(-1);
      if(native){
       last.listPoints=settings.events[0].points;
       settings.mode='native-list';
       settings.smuMode=settings.mode;
      }
      settings.segments.push({...last,...(byPoint?{listPoints:'1'}:{}),bias:{...last.bias},currentBias:{...last.currentBias}});
      redrawDc();
     }});
    const unitsUsed=[...new Set(smus.map(term=>unitFor(term.logical)))];
    const displayUnit=unitsUsed.includes(draft.previewUnit)?draft.previewUnit:unitsUsed[0]||'V';
    displayTerminals=smus.filter(term=>unitFor(term.logical)===displayUnit);
    const estimates=byPoint&&draft.previewAxis==='time';
    const axisTitle=byPoint?(estimates?tr('估算时间 (s)','Estimated time (s)'):tr('点号','Point index')):tr('时间 (s)','Time (s)');
    plot=createPlanPlot(panels,p,native?tr('偏置预览','Bias preview'):tr('计划时序预览','Planned timing'),
     axisTitle,displayUnit==='A'?tr('计划偏置 (A)','Planned bias (A)'):tr('计划偏置 (V)','Planned bias (V)'),()=>plotData,()=>[
      ...(byPoint?[
       {id:'dkts-plan-axis-point',label:(!estimates?'✓ ':'')+tr('点号','Point index'),onInvoke:()=>{draft.previewAxis='point';redrawDc();}},
       {id:'dkts-plan-axis-time',label:(estimates?'✓ ':'')+tr('估算时间（仅等待）','Estimated time (waits only)'),onInvoke:()=>{draft.previewAxis='time';redrawDc();}}
      ]:[]),
      ...unitsUsed.map(unit=>({id:'dkts-plan-unit-'+unit,label:(displayUnit===unit?'✓ ':'')+(unit==='A'?tr('电流 (A)','Current (A)'):tr('电压 (V)','Voltage (V)')),
       onInvoke:()=>{draft.previewUnit=unit;redrawDc();}}))
     ]);
   }else if(editorSection==='target'){
    const bySignal=native||list;
    const target=dcPanel(surface,bySignal?tr('采集信号','Measured signals'):tr('测量事件','Measure Event'),'dkts-time-panel');
    for(const [index,event] of settings.events.entries()){
     const row=dcLayout(target,bySignal?'dkts-time-event dkts-time-signal':'dkts-time-event');
     row?.setAttribute?.('data-dkts-time-event',String(index+1));
     const path=key=>'events.'+index+'.'+key;
     dcSelect(row,tr('端子','Terminal'),event.terminal,smus.map(term=>({value:term.logical,label:term.logical+' · '+t(logicalNames[term.logical])})),
      value=>{event.terminal=value;refreshPlan();},{key:'time-terminal',path:path('terminal')});
     dcSelect(row,tr('测量量','Quantity'),event.quantity,[{value:'Current',label:tr('电流','Current')},
      {value:'Voltage',label:tr('电压','Voltage')}],value=>{event.quantity=value;refreshPlan();},
      {key:'time-quantity',path:path('quantity')});
     if(!bySignal){
      plannedText(row,event,'startS','起始时间 (s)','Start Time (s)',path('startS'));
      plannedText(row,event,'intervalS','事件间隔 (s)','Interval Time (s)',path('intervalS'));
      plannedText(row,event,'averageS','平均窗口 (s)','Average Time (s)',path('averageS'));
      plannedText(row,event,'points','点数','Points',path('points'));
     }
     action(row,'remove-time-event-'+index,'−',bySignal?tr('删除采集信号','Remove measured signal'):tr('删除测量事件','Remove measure event'),settings.events.length>1,
      ()=>{settings.events.splice(index,1);redrawDc();});
    }
    const addLabel=bySignal?tr('新增采集信号','Add signal'):tr('新增测量事件','Add measure event');
    action(target,'add-time-event','＋ '+addLabel,addLabel,settings.events.length<(bySignal?Math.min(6,smus.length*2):16),
     ()=>{if(bySignal){const candidates=smus.flatMap(term=>['Current','Voltage'].map(quantity=>({terminal:term.logical,quantity})));const next=candidates.find(c=>!settings.events.some(e=>e.terminal===c.terminal&&e.quantity===c.quantity));if(!next)return;settings.events.push({...settings.events[0],...next});}else settings.events.push({...settings.events.at(-1)});redrawDc();});
   }else if(!native&&!list){
    const strategy=dcPanel(surface,tr('测试策略','Measurement strategy'),'dkts-time-panel');
    const controls=dcLayout(strategy,'dkts-dc-strategy-fields');
    const presets=[{value:'instrument',label:tr('计划默认','Planning default')},...smuIntegrationPresets()];
    if(settings.integrationS!=='')presets.push({value:'legacy',label:tr('旧方案 · ','Legacy plan · ')+settings.integrationS+' s'});
    const integration=dcSelect(controls,tr('SMU 积分档','SMU integration preset'),settings.integrationS!==''?'legacy':settings.integrationPreset,
     presets,value=>{
      if(value==='legacy')return;
      settings.integrationS='';
      settings.integrationPreset=value;
      redrawDc();
     },{key:'time-integration-preset',path:'integrationPreset'});
    timeHelp(integration.label,tr('SMU 积分档','SMU integration'),tr(
     '积分时间随 50/60 Hz 电源线频率变化。','Integration time depends on the 50/60 Hz line frequency.'));
   }else{
    const strategy=dcPanel(surface,tr('测试策略','Measurement strategy'),'dkts-time-panel');
    timeHelp(strategy,tr('SMU 积分档','SMU integration'),tr(
     '在顶栏「端口」右侧的「积分」设置。','Use Integration in the top toolbar next to Ports.'));
   }
   const summary=dcPanel(surface,tr('方案校验','Plan checks'),'dkts-time-panel');
   mountParameterIssue(summary);
   status=units.note.create(summary,{variant:'meta',className:'dkts-time-status',text:''});
   status?.setAttribute?.('aria-live','polite');
   refreshPlan();
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
   const visible=model.visible(p).filter(isSmu);
   const panel=units.panel.create(host,{variant:'headed',title:t('Terminal Settings'),
    meta:'',sizing:'content',className:'dkts-terminal-settings'});
   if(!visible.length){units.emptyState.create(panel.body,{message:'尚未分配测量 SMU。'});return;}
   panel.header?.title?.setAttribute?.('data-dkds-tooltip',tr('扫描段选 Auto 时使用本区量程设置，电流保护独立校验。',
    'The Auto segment range uses these terminal settings. Compliance is checked separately.'));
   for(const term of visible){
    const row=units.layout.create(panel.body,{variant:'identity',className:'dkts-terminal-setting'});
    row?.setAttribute?.('data-dkts-terminal-setting',term.logical);
    units.note.create(row,{variant:'meta',text:term.resource.replace(/^SMU(\d)$/,'SMU $1'),className:'dkts-terminal-slot'});
    const heading=units.layout.create(row,{variant:'identity',className:'dkts-terminal-setting-heading'});
    renderTerminalBadge(heading,term.logical);
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
   const fixed=p.terminals.filter(term=>isSmu(term)&&
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
    validatedField(column,false,term.bias,term.logical+'.bias',
     value=>model.edit(state(),term.logical,{bias:value}),{ariaLabel:label});
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
    options:newTestKinds.filter(kind=>kind.id!=='dc').map(kind=>({value:kind.id,label:t(kind.label)})),
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
    validatedField(row,t('Name'),target.name,target.id+'.name',
     value=>model.editTarget(state(),index,{name:value}),{text:true,ariaLabel:tr('目标 ','Target ')+(index+1)+' · '+t('Name')});
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
     onInvoke:()=>commitTransaction(()=>{
      fieldIssues.get(p.id)?.delete(target.id+'.name');
      return model.removeTarget(state(),index);
     })});
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
   for(const [key,label] of [['pointDelay','点间延迟 (ms)'],['loops','扫描循环']])
    validatedField(grid,t(label),p.sweep[key],key,value=>model.editSweep(state(),{[key]:value}));
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
  function renderVariablesPanel(host,p,sizing='content'){
   const panel=units.panel.create(host,{variant:'headed',title:t('Page Var'),meta:'',sizing,
    className:'dkts-variables-panel',actions:[{id:'add-var',label:'＋',title:t('新增页面变量'),variant:'quiet',
     onInvoke:()=>commitTransaction(()=>model.addVariable(state()))}]});
   if(!p.variables.length){units.emptyState.create(panel.body,{message:t('尚未定义页面变量。')});return;}
   for(const [index,variable] of p.variables.entries()){
    const row=units.layout.create(panel.body,{variant:'form-grid-4',className:'dkts-page-var-row'});
    for(const [key,label] of [['name','Name'],['value','Value'],['unit','Unit']])
     validatedField(row,t(label),variable[key],'variable.'+index+'.'+key,
      value=>model.editVariable(state(),index,{[key]:value}),
      {text:key!=='value',ariaLabel:tr('变量 ','Variable ')+(index+1)+' · '+t(label)});
    units.action.create(row,{id:'remove-var-'+index,label:'×',title:t('删除变量'),variant:'quiet',
     onInvoke:()=>commitTransaction(()=>{
      const next=model.removeVariable(state(),index),issues=fieldIssues.get(p.id);
      for(const [path,issue] of [...(issues||[])]){
       const [group,row,key]=path.split('.');
       if(group!=='variable'||Number(row)<index)continue;
       issues.delete(path);
       if(Number(row)>index){
        const moved='variable.'+(Number(row)-1)+'.'+key;
        issues.set(moved,{...issue,path:moved,label:tr('变量 ','Variable ')+Number(row)+' · '+t(
         {name:'Name',value:'Value',unit:'Unit'}[key])});
       }
      }
      return next;
     })});
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
  function targetPlotKey(page,kind){try{return JSON.stringify(model.targetForAxis(model.dcTargetColumns(page),kind));}catch{return 'null';}}
  function createFramePlot(index){
   const host=framePlotHosts[index];if(!host)return null;
   plots[index]?.dispose?.();
   const kind=frameKinds[index]||'iv';
   let target=null;if(isTargetPlot(kind)){try{target=model.targetForAxis(model.dcTargetColumns(active()),kind);}catch{}}
   const title=isTargetPlot(kind)?(target?target.x.signal+(target.x.unit?' ('+target.x.unit+')':''):'X'):['it','vt'].includes(kind)?tr('时间 (s)','Time (s)'):kind==='transfer'?tr('栅极电压 (V)','Gate voltage (V)'):tr('漏极电压 (V)','Drain voltage (V)');
   const instance=units.scientificPlot.create(host,{variant:'curve',
    source:'dkts-native-frame-'+(index+1),
    xTitle:title,yTitle:isTargetPlot(kind)?(target?target.y.signal+(target.y.unit?' ('+target.y.unit+')':''):'Y'):kind==='vt'?tr('电压 (V)','Voltage (V)'):tr('电流 (A)','Current (A)'),
    emptyText:()=>tr('暂无可显示的数据','No data to display'),
    getCurves:()=>frameCurves(index),getMarkers:()=>[]});
   plots[index]=instance;
   targetPlotKeys[index]=isTargetPlot(kind)?JSON.stringify(target):null;
   return instance;
  }
  function frameCurves(index){
   const kind=frameKinds[index]||'iv',selected=frameSelections[index],available=sources();
   if(kind==='raw'||selected&&!available.some(row=>row.artifactId===selected))return [];
   const list=curves(kind,available).slice();
   if(selected)return list.filter(curve=>curve.artifactId===selected);
   const run=measurementRuntime.status().run,s=state();
   let target=null;if(isTargetPlot(kind)){try{target=model.targetForAxis(model.dcTargetColumns(active()),kind);}catch{return list;}}
   const scopeMatches=plotScope==='page'?s.activeId===runPageId:plotScope==='routine'?s.pages.some(p=>p.id===runPageId&&p.routineId===s.activeRoutineId):true;
   if(run.running&&scopeMatches&&run.liveRows?.length&&!target?.needsVector){
    const groups=new Map();
    for(const r of run.liveRows){if(r.source==='4200A-KXCI-PMU'&&kind==='transfer')continue;const key=(r.pulseResource?r.pulseResource+' · ':'')+[r.cycle,r.pPoint||1,r.pRepeat||1,r.xRepeat||1].join(':');if(!groups.has(key))groups.set(key,[]);const point=isTargetPlot(kind)?model.evaluateTargetPoint(target,r):{x:kind==='it'||kind==='vt'?r.timeS:kind==='transfer'?r.gateVoltageV:r.pulseVoltageV??r.drainVoltageV,y:kind==='vt'?(r.pulseVoltageV??r.drainVoltageV):(r.pulseCurrentA??r.drainCurrentA)};if(point)groups.get(key).push(point);}
    for(const [key,rows] of groups){const points=rows.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));if(points.length)list.push({id:'dkts-live-'+run.runId+'-'+key,label:'4200A · '+tr('本次测量预览','Live acquisition')+' '+key,points});}
   }
   return list;
  }
  function renderHistory(s){
   historyHost.replaceChildren();
   const scope=scopeId(s)||'project';
   const data=sources(s).map(ref=>({ref,meta:artifactMetadata(ref.artifactId)}))
    .sort((left,right)=>String(acquisition(right.meta)?.timestamp||right.meta?.createdAt||'')
     .localeCompare(String(acquisition(left.meta)?.timestamp||left.meta?.createdAt||'')));
   const panel=units.panel.create(historyHost,{variant:'headed',title:tr('历史数据','History'),
    meta:data.length+tr(' 条记录',' records'),sizing:'fill',actionHost:true,className:'dkts-history-panel'});
   const selected=data.find(({ref})=>ref.artifactId===historyChoices.get(scope))?.ref.artifactId||'';
   const actions=units.layout.create(panel.header.actionHost||panel.header.actions,
    {variant:'row',className:'dkts-history-actions'});
   units.action.create(actions,{id:'dkts-history-plot',label:tr('显示到图窗','Show in plot'),
    variant:'quiet',menu:true,enabled:Boolean(selected),items:()=>frameKinds.slice(0,Number(frameLayout))
     .map((kind,index)=>({id:'history-frame-'+index,label:tr('图窗 ','Plot ')+(index+1)+' · '+plotLabel(kind),
      onInvoke:()=>{
       saveGraphSetting(index,'source',selected);
       ctx.status.set(tr('已将历史数据放入图窗 ','History shown in plot ')+(index+1));
      }}))});
   const columns=units.layout.create(panel.body,{variant:'identity',className:'dkts-history-columns'});
   for(const label of [tr('测试／数据源','Test / data source'),tr('采集时间','Acquired'),tr('状态','Status'),tr('行数','Rows')])
    units.note.create(columns,{variant:'meta',text:label});
   if(!data.length){
    units.note.create(panel.body,{variant:'meta',className:'dkts-history-empty',text:tr('当前范围暂无历史数据','No history in this view')});
    return;
   }
   const rows=units.layout.create(panel.body,{variant:'stack-compact',className:'dkts-history-records'});
   const list=units.list.create(rows,{variant:'compact'});
   for(const {ref,meta} of data){
    const run=acquisition(meta),stamp=run?.timestamp||meta?.createdAt;
    const time=stamp&&!Number.isNaN(Date.parse(stamp))?new Date(stamp).toLocaleString(language):'';
    const name=run?.pageName||ref.name||ref.artifactId;
    const status={completed:tr('完成','Completed'),stopped:tr('已停止','Stopped'),failed:tr('失败','Failed')}[run.runState]||'—';
    const item=list.item({title:name,selected:ref.artifactId===selected,onInvoke:()=>{
     historyChoices.set(scope,ref.artifactId);
     renderHistory(state());
     historyHost.querySelector?.('.dkds-list-item.selected')?.focus?.({preventScroll:true});
    }});
    const row=item?.querySelector?.('.dkds-list-item-content');
    if(row)for(const value of [time||'—',status,String(meta?.rowCount??'—')])units.note.create(row,{variant:'meta',text:value});
   }
  }
  function frameDataMenu(index){
   const available=sources();
   const selected=frameSelections[index]||'';
   // The DKDS Action Menu owns source choices and export instead of
   // squeezing two full-width fields into the mobile PlotView titlebar.
   return [
    {id:'source-all',label:(selected===''?'✓ ':'')+tr('当前范围全部数据','All data in this view'),
     onInvoke:()=>saveGraphSetting(index,'source','')},
    ...available.map((ref,i)=>({
     id:'source-'+i,
     label:(selected===ref.artifactId?'✓ ':'')+String(ref.name||ref.artifactId),
     onInvoke:()=>saveGraphSetting(index,'source',String(ref.artifactId))
    })),
    ...(isTargetPlot(frameKinds[index])?[{id:'export-target',label:tr('导出完整 Target 计算 CSV','Export full computed Target CSV'),onInvoke:()=>exportTargetCsv(index).catch(error=>ctx.status.set(String(error.message||error)))}]:[]),
    {id:'export-original',label:t('导出完整原始 CSV'),
     onInvoke:()=>exportOriginalCsv(index).catch(error=>
      ctx.status.set('导出失败：'+String(error.message||error)))}
   ];
  }
  async function exportTargetCsv(index){
   const ref=scopedSource(index);if(!ref)throw Error(tr('请先选择一个具体数据源','Select one data source first'));
   const target=model.dcTargetColumns(active()),id=ref.artifactId,rev=ctx.data.artifacts.artifactRevision(id),table=ctx.data.artifacts.get(id);
   if(!Number.isInteger(rev)||table?.kind!=='data.table'||!Number.isSafeInteger(table.rowCount)||table.rowCount>250000)throw Error('Target 导出需要可验证的完整 DataTable（最多 250000 行）');
   const rows=ctx.data.model.rows(table);if(!Array.isArray(rows)||rows.length!==table.rowCount)throw Error('原始数据行数不匹配');
   if(target.needsVector){const state=acquisition(artifactMetadata(id))?.runState;if(state&&state!=='completed')throw Error(tr('向量计算需要完整采集记录','Vector Target requires a completed acquisition'));}
   const output=model.targetExportRows(target,rows);if(!output.length)throw Error('P 筛选后没有可导出记录');if(ctx.data.artifacts.artifactRevision(id)!==rev)throw Error('数据源发生变化，请重试');
   const name=String(ref.name||'Measurement').replace(/[^a-zA-Z0-9._-]+/g,'_').slice(0,64);await ctx.io.saveCsv(output,'DKTS_Target_'+name+'.csv');ctx.status.set(tr('已导出独立计算结果，原始数据未修改','Computed Target exported; raw data unchanged'));
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
   frameGroup?.setColumns?.(frameLayout==='1'?1:2);
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
   editorOpen=true;plotScope='page';
   editorSection='sweep';
   persist(model.add(state(),kind));
  }
  function showEditor(id,section){
   projectSurface?.close();editorOpen=true;plotScope='page';editorSection=section;
   persist(model.select(state(),id));
   parameters.scrollTop=0;
  }
  function showRoutine(id){
   projectSurface?.close();editorOpen=false;plotScope='routine';
   persist(model.selectRoutine(state(),id));
  }
  function showPageGraphs(id,keepNavigation=false){
   projectSurface?.close();editorOpen=false;plotScope='page';
   if(!keepNavigation){persist(model.select(state(),id));return;}
   store.patch(model.select(state(),id));
   ctx.project.capture?.();
   render(true);
  }
  function updateTreeSelection(item,selected){
   item?.classList?.toggle('selected',selected);
   item?.setAttribute?.('aria-selected',String(selected));
  }
  const viewGlyph=showingSettings=>showingSettings?'▥':'⚙︎';
  async function renameDevice(device){
   const label=tr('器件名称','Device name');
   const name=await ctx.ui.dialogs.prompt({title:tr('重命名器件','Rename device'),input:{label,value:device.name},
    cancelLabel:t('取消'),confirmLabel:t('保存')});
   if(typeof name==='string'&&name.trim()!==device.name)commitTransaction(()=>model.editDevice(state(),{name:name.trim()},device.id));
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
  const savedTemplates=()=>{
   const rows=userTemplates.get('items');
   return Array.isArray(rows)?rows:[];
  };
  async function saveSetupTemplate(kind,id){
   try{
    const setup=model.templateSnapshot(state(),kind,id);
    const name=await ctx.ui.dialogs.prompt({title:tr('保存为模板','Save as template'),
     input:{label:tr('模板名称','Template name'),value:setup.name},cancelLabel:t('取消'),confirmLabel:t('保存')});
    if(name==null)return;
    const label=String(name).trim(),items=savedTemplates();
    if(!label||label.length>64)throw Error(tr('模板名须为 1–64 个字符。','Use a template name of 1–64 characters.'));
    if(items.some(item=>item.kind===kind&&item.name===label))
     throw Error(tr('已有同名模板。','A template with that name already exists.'));
    if(items.length>=100)throw Error(tr('最多保存 100 个用户模板。','Save up to 100 user templates.'));
    userTemplates.set({items:[...items,{...setup,name:label}]});
    templateGroups[kind]=false;
    templatesCollapsed=false;
    navigationPreferences.set({templatesCollapsed,templateGroups});
    render();
    librarySection.querySelector?.('#dkts-template-group-'+kind)?.scrollIntoView?.({block:'nearest'});
   }catch(error){await ctx.ui.dialogs.alert({title:tr('保存为模板','Save as template'),message:String(error.message||error)});}
  }
  function useSetupTemplate(setup){
   try{
    const next=model.insertSetup(state(),setup);
    projectSurface?.close();
    editorOpen=setup.kind==='test';
    plotScope=editorOpen?'page':'routine';
    editorSection='sweep';
    persist(next);
   }catch(error){void ctx.ui.dialogs.alert({title:tr('应用模板','Use template'),message:String(error.message||error)});}
  }
  async function duplicateTreeItem(kind,item){
   const title=kind==='test'?tr('复制测试','Copy test'):tr('复制流程','Copy routine');
   let value='1',message=item.name;
   for(;;){
    const entry=await ctx.ui.dialogs.prompt({title,message,input:{type:'number',min:1,max:128,step:1,
     label:tr('复制次数','Number of copies'),value},cancelLabel:t('取消'),confirmLabel:tr('复制','Copy')});
    if(entry==null)return;
    value=String(entry).trim();
    if(!/^[1-9][0-9]*$/.test(value)||Number(value)>128){
     message=tr('请输入 1–128 的整数。','Enter an integer from 1 to 128.');continue;
    }
    try{
     const next=model.duplicateSetup(state(),kind,item.id,value);
     editorOpen=kind==='test'&&editorOpen;
     plotScope=kind==='test'?'page':'routine';
     editorSection='sweep';
     persist(next);
    }catch(error){await ctx.ui.dialogs.alert({title,message:String(error.message||error)});}
    return;
   }
  }
  function openRoutineSettings(routine,anchor){
   routineSettings?.close();
   const rows=state().pages.filter(page=>page.routineId===routine.id);
   const order=rows.map(page=>page.id),names=new Map(rows.map(page=>[page.id,page.name]));
   const pop=units.popover.create(null,{variant:'picker',className:'dkts-routine-settings',anchor,placement:'bottom-start',
    title:tr('流程设置','Routine settings')+' · '+routine.name,role:'dialog',dismissOnOutside:true,
    onClose:()=>{if(routineSettings===pop)routineSettings=null;}});
   routineSettings=pop;
   const list=dcLayout(pop.body,'dkts-routine-sort-list');
   const renderRows=()=>{
    list.replaceChildren();
    order.forEach((id,index)=>{
     const row=dcLayout(list,'dkts-routine-sort-row');
     units.note.create(row,{variant:'meta',text:(index+1)+'. '+names.get(id)});
     for(const [offset,glyph,label] of [[-1,'↑',tr('上移','Move up')],[1,'↓',tr('下移','Move down')]]){
      const target=index+offset;
      const button=units.action.create(row,{id:'dkts-sort-'+id+'-'+(offset<0?'up':'down'),label:glyph,variant:'quiet',direct:true,
       enabled:target>=0&&target<order.length,onInvoke:()=>{
        [order[index],order[target]]=[order[target],order[index]];
        renderRows();
       }}).element;
      button?.setAttribute('aria-label',label+' '+names.get(id));
     }
    });
   };
   renderRows();
   const controls=dcLayout(pop.body,'dkts-routine-sort-actions');
   units.action.create(controls,{label:tr('循环次数','Loop count')+' · '+routine.loops,variant:'quiet',direct:true,onInvoke:()=>{
    pop.close();void editRoutineLoops(routine);
   }});
   units.action.create(controls,{id:'dkts-apply-routine-order',label:t('应用'),variant:'primary',direct:true,
    enabled:Boolean(rows.length),onInvoke:()=>{
     pop.close();
     commitTransaction(()=>model.reorderTests(state(),routine.id,order));
    }});
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
  function renderSpecNavigation(s,p){
   specNavigation.replaceChildren();
   const specs=s.specs.filter(spec=>spec.deviceId===s.activeDeviceId);
   if(!specs.length)return;
   units.header.create(specNavigation,{kind:'section',variant:'section',title:t('关联规格'),meta:String(specs.length)});
   const list=units.list.create(specNavigation,{variant:'compact'});
   for(const spec of specs)list.item({leading:'◇',title:spec.name,selected:p.kind==='dc'?p.dc.specIds.includes(spec.id):spec.id===p.associateSpecId,
    onInvoke:()=>{projectSurface?.close();editorOpen=true;plotScope='page';editorSection='sweep';persist(model.associateSpec(state(),spec.id));}});
  }
  function render(keepNavigation=false){
   if(!nav||!parameters)return;
   updateEditorLayout();
   editorRegion?.setAttribute?.('lang',language);
   nav?.setAttribute?.('lang',language);
   const s=state(),p=s.pages.find(page=>page.id===s.activeId);
   const previousKinds=frameKinds;
   syncGraphSettings(s);applyFrameLayout();
   for(const [index,kind] of frameKinds.entries())
    if(previousKinds[index]!==kind||isTargetPlot(kind)&&targetPlotKeys[index]!==targetPlotKey(p,kind))createFramePlot(index);
   syncInstrumentButtons();
   updateGraphLanguage();
   refreshRawTables();
   renderHistory(s);
   for(const plot of plots)plot?.requestRender?.('view-scope');
   if(keepNavigation){
    for(const row of nav.querySelectorAll?.('[data-dkts-page-select]')||[]){
     const item=row.querySelector?.('[data-dkts-page-item]');
     updateTreeSelection(item,plotScope==='page'&&row.getAttribute('data-dkts-page-select')===s.activeId);
     const button=row.querySelector?.('.dkts-tree-page-view');
     const label=tr('设置','Settings');
     if(button){
      button.textContent=viewGlyph(false);
      button.title=label;
      button.setAttribute('aria-label',label+' · '+s.pages.find(page=>page.id===row.getAttribute('data-dkts-page-select'))?.name);
     }
    }
    for(const page of s.pages)syncRunButton(page);
    for(const item of nav.querySelectorAll?.('[data-dkts-routine-item]')||[])updateTreeSelection(item,false);
    renderSpecNavigation(s,p);
    renderEditor(p,s);
    return;
   }
   treeMenu?.dispose?.();treeMenu=null;
   runButtons.clear();
   navigation.replaceChildren();
   librarySection.replaceChildren();
   // Real DKDS Core Units own the Device/Routine/Page/Spec project tree.
   projectControls.replaceChildren();
   const projectActions=units.layout.create(projectControls,{variant:'identity',className:'dkts-project-actions'});
   for(const [id,label,onInvoke] of [
    ['add-device',t('+ Device'),()=>{projectSurface?.close();editorOpen=false;plotScope='project';persist(model.addDevice(state()));}],
    ['add-routine',t('+ Routine'),()=>{projectSurface?.close();editorOpen=false;plotScope='routine';persist(model.addRoutine(state()));}],
    ['add-spec',t('+ Spec'),()=>{projectSurface?.close();editorOpen=true;plotScope='page';editorSection='sweep';persist(model.addSpec(state()));}]
   ])units.action.create(projectActions,{id,label,variant:'quiet',direct:true,onInvoke});
   units.action.create(projectActions,{id:'add-test-page',label:t('+ Page'),menu:true,variant:'quiet',
    items:()=>newTestKinds.map(kind=>({id:'add-test-'+kind.id,label:t(kind.label),onInvoke:()=>openTestType(kind.id)}))});
   renderSharedPorts(p);
   const projectHeader=units.header.create(navigation,{kind:'panel',variant:'content',
    title:t('Project Explorer'),meta:'',actionHost:true});
   projectHeader.element?.setAttribute?.('data-dkts-workspace-heading','true');
   const closeNav=units.action.create(projectHeader.actions,{id:'close-project-drawer',label:'‹',
    title:t('收起工程导航'),variant:'quiet',direct:true,onInvoke:()=>projectSurface?.close()});
   closeNav?.element?.setAttribute?.('data-dkts-nav-toggle','true');
   const treeHost=units.layout.create(navigation,{variant:'stack-compact',className:'dkts-project-tree'});
   for(const item of s.devices){
    const branch=units.layout.create(treeHost,{variant:'stack-compact',className:'dkts-device-branch'});
    branch?.setAttribute?.('data-dkts-device',item.id);
    const deviceRow=units.layout.create(branch,{variant:'identity',className:'dkts-tree-row dkts-tree-device'});
    const deviceButton=units.list.create(deviceRow,{variant:'compact'}).item({leading:'▤',title:item.name,
     attributes:{'data-dkts-device-item':item.id,title:item.name+' · '+tr('双击重命名器件','Double-click to rename device')},
     onInvoke:()=>{projectSurface?.close();editorOpen=false;plotScope='project';
      store.patch(model.selectDevice(state(),item.id));ctx.project.capture?.();render(true);}});
    deviceButton?.addEventListener?.('dblclick',()=>renameDevice(item));
    addTreeMenu(deviceRow,()=>[{id:'rename-device',label:tr('重命名器件','Rename device'),onInvoke:()=>renameDevice(item)}]);
    const routines=units.layout.create(branch,{variant:'stack-compact',className:'dkts-device-routines'});
    for(const routine of s.routines.filter(r=>r.deviceId===item.id))
     renderRoutine(routines,routine,s);
   }
   specNavigation=units.layout.create(navigation,{variant:'identity'});
   renderSpecNavigation(s,p);
   const libraryHeader=units.header.create(librarySection,{kind:'panel',variant:'content',
    title:t('TEST LIBRARY'),className:'dkts-library-heading',actionHost:true});
   const collapseTemplates=units.action.create(libraryHeader.actions,{
    id:'dkts-toggle-templates',label:'−',variant:'quiet',direct:true,onInvoke:()=>{
     templatesCollapsed=!templatesCollapsed;
     navigationPreferences.set({templatesCollapsed});
     syncTemplatePanel();
    }
   }).element;
   const syncTemplatePanel=()=>{
    librarySection.setAttribute('data-dkts-library-collapsed',String(templatesCollapsed));
    templateSplit.handle.hidden=templatesCollapsed;
    const label=templatesCollapsed?tr('展开测试模板','Expand test templates'):tr('收起测试模板','Collapse test templates');
    collapseTemplates.textContent=templatesCollapsed?'+':'−';
    collapseTemplates.title=label;
    collapseTemplates.setAttribute('aria-label',label);
    collapseTemplates.setAttribute('aria-expanded',String(!templatesCollapsed));
    collapseTemplates.setAttribute('aria-controls','dkts-test-templates');
   };
   syncTemplatePanel();
   libraryHeader.element?.setAttribute?.('data-dkts-workspace-heading','true');
   const library=dcLayout(librarySection,'dkts-template-groups');
   library.id='dkts-test-templates';
   const templates=savedTemplates();
   for(const [key,zh,en] of [['builtIn','内置模板','Built-in templates'],['test','用户测试模板','User test templates'],['routine','用户流程模板','User routine templates']]){
    const group=dcLayout(library,'dkts-template-group');
    const list=dcLayout(group,'dkts-test-library');
    list.id='dkts-template-group-'+key;
    let collapsed=templateGroups[key]??key!=='builtIn';
    const label=tr(zh,en);
    const button=units.action.create(group,{id:'dkts-template-toggle-'+key,label,variant:'quiet',direct:true,
     className:'dkts-template-toggle',onInvoke:()=>{
      collapsed=!collapsed;templateGroups[key]=collapsed;
      navigationPreferences.set({templateGroups});
      syncGroup();
     }}).element;
    if(button&&group.insertBefore)group.insertBefore(button,list);
    function syncGroup(){
     list.hidden=collapsed;
     button?.setAttribute('aria-expanded',String(!collapsed));
     button?.setAttribute('aria-controls',list.id);
    }
    syncGroup();
    if(key==='builtIn'){
     for(const kind of newTestKinds)units.action.create(list,{id:'library-'+kind.id,label:t(kind.label),
      variant:'quiet',direct:true,onInvoke:()=>openTestType(kind.id)});
    }else{
     const rows=templates.filter(item=>item.kind===key);
     if(!rows.length)units.note.create(list,{variant:'meta',text:tr('暂无模板','No templates')});
     for(const [index,setup] of rows.entries())units.action.create(list,{id:'dkts-user-template-'+key+'-'+index,
      label:setup.name,variant:'quiet',direct:true,onInvoke:()=>useSetupTemplate(setup)});
    }
   }
   renderEditor(p,s);
  }
  async function executeRoutineFromTree(routine){
   if(measurementRuntime.status().run.running){if(measurementRuntime.status().run.currentStage?.routineId===routine.id)measurementRuntime.stop();return;}
   if(runConfirmationPending)return;runConfirmationPending=true;
   try{const snapshot=state(),pages=snapshot.pages.filter(p=>p.routineId===routine.id),current=snapshot.routines.find(r=>r.id===routine.id);
    const issue=pages.find(page=>pageParameterIssue(page));if(issue)throw Error(issue.name+'：'+pageParameterIssue(issue).message);
    const prepared=measurementRuntime.prepareRoutine(pages,current.loops);if(!prepared.canExecute)throw Error(prepared.reason);
    const accepted=await ctx.ui.dialogs.confirm({title:tr('执行测试流程','Run routine'),tone:'warning',destructive:true,message:current.name+' · '+pages.length+' × '+current.loops,detail:pages.map((p,i)=>(i+1)+'. '+p.name).join('\n')+'\n'+tr('按顺序执行。每阶段关闭输出后再进入下一阶段，不保证跨阶段偏置连续或硬件同步。请确认所有接线与保护条件。','Stages run sequentially with outputs closed between stages; no continuous bias or hardware synchronization is implied. Verify all wiring and protection.'),confirmLabel:tr('确认接线并开始输出','Confirm wiring and run')});if(!accepted)return;
    const latest=state();if(JSON.stringify(latest.pages.filter(p=>p.routineId===routine.id))!==JSON.stringify(pages)||latest.routines.find(r=>r.id===routine.id)?.loops!==current.loops||pages.some(p=>pageParameterIssue(p)))throw Error('流程参数已变化，请重新确认');
    runPageId=pages[0].id;measurementRuntime.startRoutine(pages,current.loops,true);render();
   }catch(e){if(!measurementRuntime.status().run.running)runPageId=null;await ctx.ui.dialogs.alert({title:tr('流程执行检查','Routine preflight'),message:String(e.message||e)});}
   finally{runConfirmationPending=false;}
  }
  function renderRoutine(treeHost,routine,s){
   const routinePages=s.pages.filter(page=>page.routineId===routine.id);
   const routineHost=units.layout.create(treeHost,{variant:'identity',className:'dkts-tree-routine'});
   routineHost?.setAttribute?.('data-dkts-routine',routine.id);
   const routineRow=units.layout.create(routineHost,{variant:'identity',className:'dkts-tree-row'});
   const routineItem=units.list.create(routineRow,{variant:'compact'}).item({leading:'▦',title:routine.name,attributes:{title:routine.name},
    selected:plotScope==='routine'&&routine.id===s.activeRoutineId,
    onInvoke:()=>showRoutine(routine.id)});
   routineItem?.setAttribute?.('data-dkts-routine-item','true');
   addTreeMenu(routineRow,()=>[
    {id:'routine-execute',label:measurementRuntime.status().run.currentStage?.routineId===routine.id&&measurementRuntime.status().run.running?tr('停止流程','Stop routine'):tr('执行流程','Run routine'),onInvoke:()=>executeRoutineFromTree(routine)},
    {id:'routine-settings',label:tr('流程设置','Routine settings'),onInvoke:()=>openRoutineSettings(routine,more?.element)},
    {id:'routine-copy',label:tr('复制','Copy'),onInvoke:()=>duplicateTreeItem('routine',routine)},
    {id:'routine-template',label:tr('保存为模板','Save as template'),onInvoke:()=>saveSetupTemplate('routine',routine.id)},
    {id:'show-plots',label:t('绘图区'),onInvoke:()=>showRoutine(routine.id)},
    ...newTestKinds.map(kind=>({id:'add-'+kind.id,label:tr('新增 ','Add ')+t(kind.label),
     onInvoke:()=>{projectSurface?.close();editorOpen=true;plotScope='page';editorSection='sweep';
      persist(model.add(model.selectRoutine(state(),routine.id),kind.id));}}))
   ]);
   const menuLabel=tr('流程设置','Routine settings')+' · '+routine.name;
   const more=units.action.create(routineRow,{id:'dkts-routine-menu-'+routine.id,label:'⚙',title:menuLabel,
    variant:'quiet',direct:true,className:'dkts-tree-more',onInvoke:()=>openRoutineSettings(routine,more?.element)});
   more?.element?.setAttribute?.('aria-label',menuLabel);
   more?.element?.setAttribute?.('aria-haspopup','dialog');
   const pagesHost=units.layout.create(routineHost,{variant:'identity',className:'dkts-tree-pages'});
   for(const page of routinePages){
    const pageHost=units.layout.create(pagesHost,{variant:'identity',className:'dkts-project-page dkts-tree-row'});
    pageHost?.setAttribute?.('data-dkts-page-select',page.id);
    const pageItem=units.list.create(pageHost,{variant:'compact'}).item({leading:'▧',title:page.name,attributes:{title:page.name},
     selected:plotScope==='page'&&page.id===s.activeId,
     onInvoke:()=>showPageGraphs(page.id,true)});
    pageItem?.setAttribute?.('data-dkts-page-item','true');
    pageItem?.addEventListener?.('dblclick',()=>showEditor(page.id,'sweep'));
    const settingsOpen=editorOpen&&page.id===s.activeId;
    const viewLabel=settingsOpen?tr('数据图','Data plots'):tr('设置','Settings');
    const view=units.action.create(pageHost,{id:'dkts-page-view-'+page.id,label:viewGlyph(settingsOpen),title:viewLabel,
     variant:'quiet',direct:true,className:'dkts-tree-page-view',
     onInvoke:()=>editorOpen&&active().id===page.id?showPageGraphs(page.id):showEditor(page.id,'sweep')});
    view?.element?.setAttribute?.('aria-label',viewLabel+' · '+page.name);
    const stopping=measurementRuntime.status().run.running&&runPageId===page.id;
    const issue=pageParameterIssue(page);
    const executionLabel=stopping?tr('停止测试','Stop test'):tr('执行测试','Run test');
    const run=units.action.create(pageHost,{id:'dkts-run-'+page.id,label:stopping?'■':'▶',
     title:executionLabel,variant:'quiet',direct:true,className:'dkts-tree-run',
     enabled:stopping||(!measurementRuntime.status().run.running&&!issue),
     onInvoke:()=>openExecution(page)});
    runButtons.set(page.id,run?.element);
    syncRunButton(page,issue);
    run?.element?.setAttribute?.('aria-label',executionLabel+' · '+page.name);
    if(stopping)run?.element?.setAttribute?.('data-dkts-running','true');
    addTreeMenu(pageHost,()=>[
     {id:'test-copy',label:tr('复制','Copy'),onInvoke:()=>duplicateTreeItem('test',page)},
     {id:'test-template',label:tr('保存为模板','Save as template'),onInvoke:()=>saveSetupTemplate('test',page.id)},
     {id:'edit',label:tr('编辑页面','Edit page'),onInvoke:()=>showEditor(page.id,'sweep')},
     {id:'rename',label:page.kind==='dc'?tr('重命名测试','Rename test'):tr('页面名称与信息','Name and page info'),
      onInvoke:async()=>{
       if(page.kind!=='dc'){showEditor(page.id,'info');return;}
       const label=tr('测试名称','Test name');
       const name=await ctx.ui.dialogs.prompt({title:tr('重命名测试','Rename test'),
        input:{label,value:page.name},cancelLabel:t('取消'),confirmLabel:t('保存')});
       if(name?.trim()&&name.trim()!==page.name)
        commitTransaction(()=>model.editPage(model.select(state(),page.id),{name:name.trim()}));
      }},
     {id:'remove',label:tr('删除页面','Delete page'),enabled:state().pages.length>1,
      onInvoke:async()=>{
       const confirmed=await ctx.ui.dialogs.confirm({title:tr('删除页面','Delete page'),
        message:page.name,confirmLabel:tr('删除','Delete'),destructive:true});
       if(confirmed)persist(model.remove(state(),page.id));
      }}
    ]);
   }
  }
  function renderSharedPorts(p){
   const inventory=measurementRuntime.status().connection.inventory;
   const logicals=p.kind==='dc'?['S','D','G','B']:['S','D','G'];
   const hardware=inventory?(inventory.ports||ctx.modules.require('dkts-kxci').portCatalog(inventory)).filter(port=>['SMU','PMU'].includes(port.family)).map(port=>port.id):['SMU1','SMU2','SMU3','SMU4'];
   const resources=[...new Set(['None','GNDU',...hardware])];
   const portOptions=(value,logical)=>[
    ...resources.filter(resource=>logical!=='B'||!resource.startsWith('PMU')).map(resource=>({value:resource,label:resource==='None'?t(resource):resource.replace(/^SMU(\d)$/,'SMU $1')})),
    ...(resources.includes(value)?[]:[{value,label:value+' · '+(inventory?
     tr('未检测到','Not detected'):tr('未核验','Unverified'))}])
   ];
   terminalRegion=units.layout.create(projectControls,{variant:'identity',className:'dkts-terminal-strip'});
   terminalRegion?.setAttribute?.('data-dkts-terminal-strip','true');
   terminalRegion?.setAttribute?.('aria-label',tr('工程共享端口映射','Project-wide port mapping'));
   if(p.kind==='dc'){
    terminalRegion?.setAttribute?.('data-dkts-dc-ports','true');
    terminalRegion?.setAttribute?.('aria-label',tr('工程共享端口及 DC 体端映射','Shared ports and DC body mapping'));
   }
   const terminalGroup=units.layout.create(terminalRegion,{variant:'row',className:'dkts-terminal-control-group'});
   const terminalToolbar=units.layout.create(terminalGroup,{variant:'row',className:'dkts-terminal-toolbar'});
   terminalToolbar?.setAttribute?.('data-dkts-port-desktop','true');
   for(const logical of logicals){
    const resource=logical==='B'?p.dc.bodyResource:p.terminals.find(item=>item.logical===logical).resource;
    const terminal=units.layout.create(terminalToolbar,{variant:'identity',className:'dkts-terminal-item'});
    renderTerminalBadge(terminal,logical);
    fsproField(terminal,{kind:'select',label:t(logicalNames[logical])+' · '+logical,
     controlOnly:true,controlClassName:'dkts-terminal-field',value:resource,
     attributes:{'aria-label':t(logicalNames[logical])+' ('+logical+') '+t('端口'),title:t(logicalNames[logical])+' ('+logical+')'},
     options:portOptions(resource,logical),onChange:event=>{
      if(logical==='B')commitTransaction(()=>model.editDcBody(state(),event.target.value));
      else change(logical,'resource',event.target.value);
     }});
   }
   let mobilePortAction=null;
   function openPortPopover(anchor){
    portPopover?.close?.();let draft=state();
    const dcPorts=p.kind==='dc';
    const pop=units.popover.create(dcPorts?workspace:null,{variant:'picker',title:t('Terminal 端口映射'),
     className:dcPorts?'dkts-dc-port-popover':undefined,
     role:'dialog',ariaLabel:p.kind==='dc'?tr('S、D、G、B 端口映射','S, D, G and B port mapping'):
      t('Source、Drain、Gate 端口映射'),anchor,placement:'bottom-start',
     dismissOnOutside:true,offset:4,onClose:()=>{if(portPopover===pop)portPopover=null;}});
    portPopover=pop;
    const form=units.layout.create(pop.body,{variant:'form-grid-2',className:'dkts-mobile-port-grid'});
    const draftPage=draft.pages.find(item=>item.id===draft.activeId);
    for(const logical of logicals){
     const resource=logical==='B'?draftPage.dc.bodyResource:draftPage.terminals.find(item=>item.logical===logical).resource;
     const pair=units.layout.create(form,{variant:'stack-compact',className:'dkts-bias-entry'});
     renderTerminalBadge(pair,logical);
     fsproField(pair,{kind:'select',label:false,
      value:resource,options:portOptions(resource,logical),attributes:{'aria-label':t(logicalNames[logical])+' ('+logical+') '+t('端口')},
      onChange:event=>{try{
       draft=logical==='B'?model.editDcBody(draft,event.target.value):model.edit(draft,logical,{resource:event.target.value});
      }catch(error){
       const latest=draft.pages.find(item=>item.id===draft.activeId);
       event.target.value=logical==='B'?latest.dc.bodyResource:latest.terminals.find(t=>t.logical===logical).resource;
       ctx.status.set('端口映射无效：'+String(error.message||error));
      }}});
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
   mobilePortAction=units.action.create(terminalGroup,{id:'mobile-port-map',label:tr('映射','Port map'),
    title:p.kind==='dc'?tr('配置 S、D、G、B 端口','Configure S, D, G and B ports'):
     t('配置 Source、Drain、Gate 端口'),variant:'secondary',
    onInvoke:()=>openPortPopover(mobilePortAction?.element)});
   mobilePortAction?.element?.setAttribute?.('data-dkts-port-mobile','true');
  }
  function mountParameterIssue(host){
   parameterStatus=units.note.create(host,{variant:'warning',className:'dkts-parameter-issue',text:''});
   parameterStatus?.setAttribute?.('id','dkts-parameter-issue');
   parameterStatus?.setAttribute?.('aria-live','polite');
  }
  function renderEditor(p,s){
   closeTimeTimingTip();
   disposeTimePreview?.();
   disposeTimePreview=null;
   editorPageId=p.id;
   editorPlan=p.kind==='dc'?{id:p.id,draft:dcDraft(p)}:p.kind==='time'?{id:p.id,draft:timeDraft(p)}:
    p.timing?{id:p.id,draft:plannedTimingDraft(p)}:null;
   parameterStatus=null;
   parameterOutputs=null;
   editorHeading.replaceChildren();
   const title=units.header.create(editorHeading,{kind:'panel',variant:'content',
    title:p.name,actionHost:true,titleEmphasis:'prominent'});
   const headerActions=units.layout.create(title.actions,{variant:'identity',className:'dkts-page-actions'});
   const navEditor=units.action.create(headerActions,{id:'dkts-project-toggle-editor',
    label:t('导航'),title:t('打开或收起工程导航'),variant:'quiet',
    onInvoke:()=>projectSurface?.toggle()});
   navEditor?.element?.setAttribute?.('data-dkts-nav-toggle','true');
   if(editorSection!=='info'&&!PAGE_TABS.some(([id])=>id===editorSection))editorSection='sweep';
   editorTabs.replaceChildren();
   if(p.kind==='dc'&&editorSection==='info')editorSection='sweep';
   editor?.setAttribute?.('data-dkts-editor-kind',p.kind);
   editor?.setAttribute?.('aria-label',p.name);
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
   renderParameterControls(editorTabs,p);
   parameters.replaceChildren();
   if(p.kind!=='time'||editorSection==='info')mountParameterIssue(parameters);
   if(p.previousPortMapping&&Object.keys(s.portMapping).some(key=>p.previousPortMapping[key]!==s.portMapping[key]))
    units.note.create(parameters,{variant:'warning',text:tr(
     '此测试已改用工程共享端口。运行前请核对原映射与当前接线。','This test now uses the shared mapping. Check the original mapping against the wiring before running.')+
     ' '+Object.entries(p.previousPortMapping).map(([key,value])=>key+' '+value).join(' · ')});
   if(p.kind==='dc')renderDc(parameters,p,s);
   else if(editorSection==='info')renderPageInfo(parameters,p,s);
   else if(p.kind==='time')renderTime(parameters,p);
   else if(p.timing)renderTiming(parameters,p);
   else if(editorSection==='sweep')renderSweep(parameters,p,s);
   else if(editorSection==='target')renderTargetPanel(parameters,p);
   else if(editorSection==='strategy')renderStrategyPanel(parameters,p);
   refreshParameterIssue(p);
  }
  ctx.ui.activities.add({id:ACTIVITY,label:'4200A',contextLabel:'DK Test Studio',icon:'▦',
   order:82,primary:true,openMode:'window',artifactHydration:'live',
   onActivate:()=>{ctx.workspace.openPage(PAGE);refreshData();}});
  function toggleLanguage(){
   language=language==='en'?'zh-CN':'en';
   preferences.set({language});
   defineConnectionSettings();
   const scroll=parameters.scrollTop;
   render();
   parameters.scrollTop=scroll;
   for(let index=0;index<frameKinds.length;index++)createFramePlot(index);
   updateGraphLanguage();
   if(measurementRuntime.status().connection.phase==='disconnected')showOfflineStatus();
  }
  async function configureWiring(connection){
   const protocol=ctx.modules.require('dkts-kxci'),ports=protocol.portCatalog(connection.inventory);
   const rpms=ports.filter(p=>p.hasRpm&&p.verified),smus=ports.filter(p=>p.family==='SMU'&&p.verified).map(p=>p.id);
   if(!rpms.length){await ctx.ui.dialogs.alert({title:tr('接线','Wiring'),message:tr('未检测到 RPM。','No RPM detected.')});return;}
   let prior=null;try{prior=JSON.parse(wiringPreferences.get('profile')||'null');}catch{}
   const valid=prior?.signature===protocol.topologySignature(connection.inventory,connection.identity.serial);
   const links=[];
   for(const port of rpms){
    const answer=await ctx.ui.dialogs.prompt({title:port.id+' · RPM',message:tr('请按实际接线或 KCon 确认与该 RPM 连接的 SMU。未连接 SMU 时填 None。可选：','Confirm the SMU connected to this RPM in KCon or at the instrument. Enter None when no SMU is connected. Options: ')+smus.join(', ')+', None',input:{label:tr('连接的 SMU','Connected SMU'),value:valid?prior.links.find(l=>l.pmu===port.id)?.smu||'':''},cancelLabel:t('取消'),confirmLabel:tr('下一步','Next')});
    if(answer==null)return;
    const smu=answer.trim().toUpperCase()==='NONE'?'None':answer.trim().toUpperCase();
    if(![...smus,'None'].includes(smu))throw Error(tr('请选择实际存在的 SMU 或 None。','Enter an installed SMU or None.'));
    links.push({pmu:port.id,smu});
   }
   const ok=await ctx.ui.dialogs.confirm({title:tr('确认实际接线','Confirm physical wiring'),message:links.map(l=>l.pmu+' ↔ '+l.smu).join('\n'),detail:tr('这里只保存接线记录，不改变硬件输出。','This saves wiring only; it does not change instrument outputs.'),confirmLabel:t('保存'),cancelLabel:t('取消')});
   if(!ok)return;
   const profile=measurementRuntime.confirmWiring(links);
   wiringPreferences.set({profile:JSON.stringify(profile)});
   ctx.status.set(tr('已保存 RPM 接线。','RPM wiring saved.'));
  }
  async function showInstrumentDetails(connection){
   const inv=connection.inventory,system=inv?.systemInfo;
   const records=[...(inv?.instrumentInfoRecords||[]),...(inv?.remoteModuleInfoRecords||[])];
   const detail=[system?('Clarius '+system.clariusVersion+' · '+system.softwareVersion):tr('系统版本未确认','System version unverified'),...records.map(r=>[r.name,r.model,r.serialNo,r.calibrationDate&&tr('校准 ','Calibrated ')+r.calibrationDate,r.calibrationDueDate&&tr('到期 ','Due ')+r.calibrationDueDate].filter(Boolean).join(' · '))].join('\n');
   await ctx.ui.dialogs.alert({title:tr('模块与校准信息','Modules and calibration'),message:detail||tr('尚未识别模块','Modules not detected')});
  }
  async function connectFromToolbar(){
   if(!instrumentIdle()||connectionDialogOpen)return;
   connectionDialogOpen=true;
   const advanced={id:'advanced',label:tr('高级设置','Advanced settings'),kind:'secondary'};
   const cancel={id:'cancel',label:t('取消'),kind:'secondary'};
   try{
    const {connection}=measurementRuntime.status();
    if(connection.phase==='connected'){
     const route=connection.route;
     const title=tr('4200A 已识别','4200A identified');
     const modules=connection.inventory?.slots?.filter(slot=>slot.family!=='empty')||[];
     const detail=connection.inventoryError||(!connection.inventory?.physicalModelsVerified?
      tr('实装模块仍待核验。','Installed modules still require verification.'):
      tr('已识别 ','Identified ')+modules.length+tr(' 个实装模块。',' installed modules.'));
     const result=await ctx.ui.dialogs.show({
      title,message:[connection.identity.serial,route?.remoteAddress&&route.remoteAddress+':'+route.remotePort].filter(Boolean).join(' · '),
      detail,detailOpen:true,defaultAction:'cancel',cancelAction:'cancel',
      actions:[{...cancel,label:tr('关闭','Close')},{id:'modules',label:tr('模块与校准','Modules & calibration'),kind:'secondary'},{id:'wiring',label:tr('接线','Wiring'),kind:'secondary'},advanced,{id:'disconnect',label:tr('断开','Disconnect'),kind:'secondary'}]
     });
     if(result==='disconnect')await disconnectInstrument();
     else if(result==='advanced')connectionSettings.open();
     else if(result==='modules')await showInstrumentDetails(connection);
     else if(result==='wiring')await configureWiring(connection);
     return;
    }
    const session=await measurementRuntime.currentTcp();
    if(!instrumentIdle())return;
    if(session){
     if(session.owner&&session.owner!==manifest.id)throw Error(tr(
      '当前 TCP 会话由另一工作区管理，请先断开。','Disconnect the session owned by the other workspace first.'));
     await updateInstrument({session});
     return;
    }
    const saved=connectionSettings.get();
    const result=await ctx.ui.dialogs.show({
     title:tr('连接 4200A','Connect to 4200A'),
     message:tr('输入仪器地址。连接后会自动读取序列号与实装模块。',
      'Enter the instrument address. The serial number and installed modules are read automatically.'),
     input:{type:'text',label:t('仪器 IP / 主机名'),value:saved.host||''},
     defaultAction:'connect',cancelAction:'cancel',
     actions:[advanced,cancel,{id:'connect',label:t('连接'),kind:'primary'}]
    });
    if(result?.action==='advanced'){connectionSettings.open();return;}
    if(result?.action==='connect'){
     const host=String(result.value||'').trim();
     if(!host){
      ctx.status.set(tr('请输入 4200A 的 IP 地址或主机名。','Enter the 4200A IP address or hostname.'));
      return;
     }
     const current=await measurementRuntime.currentTcp();
     if(current){
      if(!sameHost(current.settings.host,host))throw Error(tr(
       '通信已连接其他地址，请先断开。','Communication connected to another address. Disconnect it first.'));
      await updateInstrument({session:current});
     }else await updateInstrument({settings:{...connectionSettings.get(),host}});
    }
   }catch(error){ctx.status.set(String(error.message||error));}
   finally{connectionDialogOpen=false;}
  }
  const connectionLabel=()=>instrumentBusy?tr('处理中','Working'):
   measurementRuntime.status().connection.phase==='connected'?tr('已识别','Identified'):t('连接');
  const instrumentIdle=()=>!instrumentBusy&&!measurementRuntime.status().run.running;
  const languageTitle=()=>tr('Switch to English','切换为简体中文');
  function openSmuIntegration(anchor){
   if(!instrumentIdle())return;
   smuIntegrationPopover?.close?.();
   const title=tr('SMU 积分档','SMU integration'),s=state(),p=s.pages.find(row=>row.id===s.activeId);
   const pop=units.popover.create(null,{variant:'picker',className:'dkts-smu-integration-popover',title,role:'dialog',ariaLabel:title,anchor,placement:'bottom-start',
    dismissOnOutside:true,offset:4,onClose:()=>{if(smuIntegrationPopover===pop)smuIntegrationPopover=null;}});
   smuIntegrationPopover=pop;
   const form=units.layout.create(pop.body,{variant:'stack-compact'});
   const change=(apply,event,previous)=>{
    if(!instrumentIdle()){
     event.target.value=previous;
     return;
    }
    commitTransaction(()=>apply(event.target.value));
    pop.close();
   };
   const presets=smuIntegrationPresets();
   fsproField(form,{kind:'select',label:tr('工程默认','Project default'),value:s.smuIntegration,options:presets,
    onChange:event=>change(value=>model.editSmuIntegration(state(),value),event,s.smuIntegration)});
   if(p.kind==='time'&&['native-fixed','native-list'].includes(p.timing.mode)){
    const value=p.timing.integrationS?'legacy':p.timing.integrationPreset;
    const options=[{value:'instrument',label:tr('继承工程默认','Use project default')},...presets];
    if(value==='legacy')options.push({value:'legacy',label:p.timing.integrationS+' s · '+tr('旧方案','Legacy plan')});
    fsproField(form,{kind:'select',label:tr('当前时间扫描','Current time sweep'),value,options,onChange:event=>{
     if(event.target.value==='legacy')return;
     change(preset=>{
      const settings={integrationPreset:preset,integrationS:''};
      const next=model.editTiming(model.select(state(),p.id),settings);
      const draft=timeDrafts.get(p.id);
      if(draft)Object.assign(draft.settings,settings);
      return next;
     },event,value);
    }});
   }
   units.note.create(form,{variant:'meta',text:tr('较长的积分时间可降低噪声，也会增加采样耗时。',
    'Longer integration reduces noise and increases acquisition time.')});
  }
  const instrumentCommands=[
   {id:'dkts-workspace-connect',order:8,label:connectionLabel,
    enabled:instrumentIdle,
    onInvoke:()=>void connectFromToolbar()},
   {id:'dkts-workspace-scan',order:9,label:()=>tr('端口','Ports'),enabled:instrumentIdle,
    title:()=>tr('重新识别 4200A 实装 SMU 和 PMU','Refresh installed 4200A SMU and PMU modules'),
    onInvoke:()=>{
     if(measurementRuntime.status().connection.phase==='connected')void updateInstrument();
     else void connectFromToolbar();
    }},
   {id:'dkts-workspace-smu-integration',order:10,label:()=>tr('积分','Integration'),title:()=>tr('SMU 积分档','SMU integration'),enabled:instrumentIdle,
    onInvoke:({button}={})=>openSmuIntegration(button)},
   {id:'dkts-workspace-language',order:11,label:()=>tr('EN','中文'),title:languageTitle,onInvoke:toggleLanguage}
  ].map(action=>({...action,variant:'quiet'}));
  const desktopInstrumentButtons=instrumentCommands.map(action=>units.toolbar.contribute({
   id:action.id,order:action.order,label:action.label(),activity:ACTIVITY,section:'instrument',
   group:'analysis',priority:100,variant:action.variant,onClick:event=>action.onInvoke({button:event.currentTarget})
  }));
  // The native presenter reads the same activity-scoped actions from the SDK.
  // The detached Unit has no workspace geometry or duplicate visible controls.
  const nativeInstrumentCommands=units.toolbar.create(units.layout.create(null,{variant:'identity'}),{
   variant:'ordinary',activity:ACTIVITY,actions:instrumentCommands
  }).actionGroup;
  function syncInstrumentButtons(){
   for(const [index,button] of desktopInstrumentButtons.entries()){
    const action=instrumentCommands[index],label=action.label(),title=action.title?.()||label;
    if(!button)continue;
    button.textContent=label;
    button.title=title;
    button.setAttribute('aria-label',title);
    button.disabled=action.enabled?.()===false;
   }
   nativeInstrumentCommands?.update();
  }
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
  const projectControls=units.layout.create(projectToolbar,{variant:'identity',className:'dkts-project-controls'});
  const resizePanels=(container,target,id,axis,token,label,limits)=>{
   const handle=units.splitHandle.create(container,{
    axis:axis==='x'?'vertical':'horizontal',className:'dkts-'+id+'-handle'
   });
   handle.setAttribute('data-dkts-resize',id);
   handle.setAttribute('aria-label',label);
   return units.splitPane.adopt({container,target,handle,id,axis,trackToken:'--dkds-unit-'+token,
    layoutOwner:'host',...limits});
  };
  const main=units.layout.create(workspace,{variant:'identity',className:'dkts-main-grid'});
  const projectPanel=units.panel.create(main,{variant:'control-card',
   header:false,sizing:'fill',className:'dkts-project-panel'});
  projectPanel.body?.setAttribute?.('data-dkts-project-body','true');
  nav=units.layout.create(projectPanel.body,{variant:'identity',
   className:'dkts-project-navigation'});
  const navigation=units.layout.create(nav,{variant:'stack-compact',className:'dkts-navigation-scroll'});
  const librarySection=units.layout.create(nav,{variant:'stack-compact',className:'dkts-library-section'});
  const templateSplit=resizePanels(nav,librarySection,'template','y','template-height',
   tr('调整测试模板高度','Resize test templates'),{defaultSize:258,min:66,max:400,reverse:true});
  const navigationSplit=resizePanels(main,projectPanel.element,'navigation','x','project-width',
   tr('调整工程导航宽度','Resize project navigation'),{defaultSize:270,min:240,max:510,mobileStateScope:true});
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
    minWidth:'0',minHeight:'0',flex:'1 1 auto',overflow:'hidden',gap:'0px'}});
  // DKTS-owned markers let Electron validate real frames independently of
  // internal DKDS Unit attribute naming or temporary detached Page views.
  plotArea?.setAttribute?.('data-dkts-view','graph');
  workRegion=work;editorRegion=editor;plotRegion=plotArea;
  // Four independent DKDS PlotView subwindows, each with its own host controls.
  // Never synthesize measurement samples in an offline UI.
  plotsHeading=units.header.create(plotArea,{kind:'panel',
   variant:'content',title:t('绘图区'),meta:'',actionHost:true});
  plotsHeading.element?.setAttribute?.('data-dkts-workspace-heading','true');
  const frameTools=units.layout.create(plotsHeading.actions,{variant:'row-wrap',
   className:'dkts-plot-toolbar'});
  const navGraph=units.action.create(plotsHeading.actions,{id:'dkts-project-toggle-graph',
   label:()=>t('导航'),title:t('打开或收起工程导航'),variant:'quiet',
   onInvoke:()=>projectSurface?.toggle()});
  navGraph?.element?.setAttribute?.('data-dkts-nav-toggle','true');
  syncGraphSettings();
  layoutField=fsproField(frameTools,{kind:'select',label:t('图窗布局'),controlOnly:true,
    attributes:{'aria-label':'图窗布局','title':'图窗布局'},value:frameLayout,
   options:[{value:'1',label:t('单窗口')},{value:'2',label:t('双窗口')},
    {value:'4',label:t('四宫格')}],
   onChange:e=>saveGraphSetting(-1,'count',e.target.value)});
  const groupHost=units.layout.create(plotArea,{variant:'identity',
   className:'dkts-project-plot-group'});
  groupHost?.setAttribute?.('data-dkts-plot-group','four-independent-frames');
  frameGroup=units.plotGroup.create(groupHost,{columns:2,maxColumns:2,responsive:false,density:'compact'});
  historyHost=units.layout.create(plotArea,{variant:'identity',className:'dkts-history'});
  const historySplit=resizePanels(plotArea,historyHost,'history','y','history-height',
   tr('调整历史数据高度','Resize history'),{defaultSize:112,min:56,reserve:220,reverse:true});
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
   const narrowPlotHeader=(target,geometry)=>units.layout.apply(target,{
    variant:'identity',responsiveTarget:graphic.element,responsiveGeometry:[{maxWidth:310,geometry}]
   });
   narrowPlotHeader(graphicHeader.element,{
    display:'flex',flexDirection:'column',alignItems:'stretch',height:'auto',gap:'2px'
   });
   narrowPlotHeader(graphicHeader.actions,{
    flexWrap:'wrap',justifyContent:'flex-start',height:'auto',width:'100%',gap:'2px'
   });
   const frameActions=units.layout.create(graphicHeader.actions,{
    variant:'identity',className:'dkts-frame-actions'});
   const frameKind=units.action.create(frameActions,{
    id:'dkts-frame-kind-'+(index+1),label:()=>tr('显示','View'),
    title:'切换图窗 '+(index+1)+' 的图形类型',
    menu:true,variant:'quiet',items:()=>frameOptions(state()).map(kind=>({
     id:'kind-'+kind,
     label:(frameKinds[index]===kind?'✓ ':'')+plotLabel(kind),
     onInvoke:()=>saveGraphSetting(index,'kind',kind)
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
   const plotHost=units.layout.create(graphic.body,{variant:'identity'});
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
   navGraph?.actionGroup?.update?.();
   navigationSplit.handle.setAttribute('aria-label',tr('调整工程导航宽度','Resize project navigation'));
   templateSplit.handle.setAttribute('aria-label',tr('调整测试模板高度','Resize test templates'));
   historySplit.handle.setAttribute('aria-label',tr('调整历史数据高度','Resize history'));
   const s=state(),scope=scopeId(s);
   const owner=s.pages.find(page=>page.id===scope)||s.routines.find(routine=>routine.id===scope);
   if(plotsHeading.title)plotsHeading.title.textContent=owner?owner.name+' · '+t('绘图区'):t('绘图区');
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
  const offProjectRestore=store.subscribe?.((_,meta)=>{
   if(!['project-restore','project-reset','undo','redo'].includes(meta?.reason))return;
   for(const drafts of [dcDrafts,timeDrafts,timingDrafts,fieldIssues,segmentDrafts])drafts.clear();
   sweepIssue=null;
   editorPlan=null;
   render();
  });
  window.addEventListener?.('resize',updateEditorLayout);
  render();refreshData();
  function showOfflineStatus(){ctx.status.set(tr('DK Test Studio · 4200A 离线','DK Test Studio · 4200A offline'));}
  const isInstrumentSession=(session,saved)=>session&&!session.owner&&
   (Number(session.settings.port)===1225||
    (saved.host&&sameHost(session.settings.host,saved.host)&&Number(session.settings.port)===Number(saved.port)));
  const offTcp=ctx.events?.on?.('communication:interactive-tcp',({event,session})=>{
   if(event==='opened'&&isInstrumentSession(session,connectionSettings.get()))void updateInstrument({session});
   if(event==='disconnect-requested'&&session?.owner===manifest.id)void disconnectInstrument();
  });
  const stopConnectionCheck=ctx.ui.dom?.interval?.(()=>{
   if(instrumentIdle()&&!runConfirmationPending)void measurementRuntime.checkConnection();
  },15000);
  async function restoreInstrument(){
   try{
    const session=await measurementRuntime.currentTcp(),saved=connectionSettings.get();
    if(isInstrumentSession(session,saved))await updateInstrument({session});
    else if(!session&&saved.host&&saved.autoReconnect)await updateInstrument({settings:saved});
    else if(instrumentIdle()&&measurementRuntime.status().connection.phase==='disconnected')showOfflineStatus();
   }catch(error){ctx.status.set(String(error.message||error));}
  }
  void restoreInstrument();
  return {deactivate(){routineSettings?.close();closeTimeTimingTip();treeMenu?.dispose?.();projectSurface?.dispose();disposeTimePreview?.();window.removeEventListener?.('resize',updateEditorLayout);
   pad?.close?.();portPopover?.close?.();smuIntegrationPopover?.close?.();off?.();offProjectRestore?.();offTcp?.();stopConnectionCheck?.();
   void measurementRuntime.dispose().catch(()=>{});
   for(const item of plots)item?.dispose?.();
   for(const item of plotViews)item?.dispose?.();
   for(const item of frameTables)item?.dispose?.();frameGroup?.dispose?.();wb?.dispose?.();}};
 });
})();
