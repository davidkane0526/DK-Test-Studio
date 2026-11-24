(() => {
 'use strict';
 const OWNER='com.dkts.keithley-4200';
 const ROLE_BY_LOGICAL=Object.freeze({S:'source',D:'drain',G:'gate'});
 const text=value=>String(value??'').trim();
 const finite=(value,label)=>{
  if(value===undefined||value===null||text(value)==='')throw Error(label+' 不能为空');
  const number=Number(value);
  if(!Number.isFinite(number))throw Error(label+' 必须是有限数值');
  return number;
 };
 function axisSegments(rows,label){
  if(!Array.isArray(rows)||!rows.length)throw Error(label+' 至少需要一个扫描段');
  return rows.map((row,index)=>({
   startV:finite(row.start,label+' 第 '+(index+1)+' 段起点'),
   stopV:finite(row.stop,label+' 第 '+(index+1)+' 段终点'),
   stepV:finite(row.step,label+' 第 '+(index+1)+' 段步长'),
   rangeA:text(row.range||'auto')||'auto',
   delayMs:finite(row.delayMs,label+' 第 '+(index+1)+' 段点间延迟')
  }));
 }
function pageToBasicProgram(page, model){
 const check=(x,m)=>{if(!x)throw Error(m);};
 const n=(x,label)=>{check(x!==null&&x!==undefined&&String(x).trim()!==''&&Number.isFinite(Number(x)),label+' 数值无效');return Number(x);};
 const roles={D:'drain',G:'gate',S:'source'},ports=Object.fromEntries(page.terminals.map(t=>[t.logical,t]));
 const terminals=Object.fromEntries(Object.entries(roles).map(([k,r])=>[r,ports[k]?.resource||'None']));
 const active=Object.keys(roles).filter(k=>/^SMU[1-8]$/.test(ports[k]?.resource||''));
 check(Object.keys(roles).every(k=>['None','GNDU'].includes(ports[k]?.resource)||active.includes(k)),'基础执行仅支持 SMU1–8、GNDU 或 None');
 check(active.includes('D'),'请将漏极映射到 SMU');
 check(new Set(active.map(k=>ports[k].resource)).size===active.length,'端口重复');
 const fixedVoltages={},portSettings={},disabled={enabled:false,terminal:'gate'};
 const segment=(startV,stopV,stepV,rangeA='auto',delayMs=0)=>({startV,stopV,stepV,rangeA,delayMs});
 const axis=(terminal,segments,repeats=1)=>({terminal,segments,repeats,delayMs:0});
 if(page.kind==='dc'){
  const dc=page.dc,info=model.dcSummary(page,dc);
  check(['optimized','point-by-point'].includes(dc.preset),'未知 DC 执行模式');
  check(dc.bodyResource==='None','B 端尚未接入');
  check(info.outputs.length===1&&info.outputs[0]==='Id','基础 DC 仅支持 Outputs=Id');
  check(!dc.target.formula.trim(),'Target 公式尚未接入');
  check(dc.strategy.direction==='forward'&&dc.strategy.onLimit==='stop','仅支持 Forward 和 Stop on limit');
  const hold=dc.strategy.hold.trim()?n(dc.strategy.hold,'Hold'):0;
  check(hold>=0&&hold<=655.3,'HT 允许 0–655.3 s');
  check(dc.preset==='optimized'||hold===0,'逐点模式 Hold 尚未接入');
  check(dc.strategy.mode!=='local'||!dc.strategy.integration.trim(),'自定义积分尚未映射 PLC');
  const delay=dc.strategy.mode==='local'&&dc.strategy.delay.trim()?n(dc.strategy.delay,'Delay')*1000:0;
  check(dc.reference==='GND'||ports[dc.reference]?.resource==='GNDU','仅支持接地参考');
  const vars=Object.fromEntries(page.variables.map(v=>[v.name,Number(v.value)])),v=x=>model.dcExpression(x,vars,dc.polarity);
  const axes={};
  for(const k of active){
   const row=dc.terminals[k],r=roles[k];
   check(row.mode==='voltage','仅支持电压源：'+k);
   check(row.ref==='GND'||ports[row.ref]?.resource==='GNDU','仅支持接地参考：'+k);
   check(new Set(row.segments.map(s=>s.range)).size===1,'扫描段间量程切换尚未接入');
   const range=row.segments[0].range;
   portSettings[r]={rangeMode:range==='auto'?'auto':'fixed',rangeA:range==='auto'?'1e-6':range,complianceMode:'custom',complianceA:n(row.limitI,k+' 限流')};
   if(row.role==='CONDITION'){check(row.segments[0].method==='constant','Generator 尚未接入');fixedVoltages[r]=v(row.segments[0].value);continue;}
   const segs=[];
   for(const s of row.segments){
    if(s.method==='step')segs.push(segment(v(s.start),v(s.stop),v(s.step),range,delay));
    else if(s.method==='points')segs.push(segment(v(s.start),v(s.stop),(v(s.stop)-v(s.start))/(v(s.points)-1),range,delay));
    else if(s.method==='list')for(const x of s.list.split(/[,\n]/).map(v))segs.push(segment(x,x,0,range,delay));
    else throw Error('扫描方式尚未接入：'+s.method);
   }
   check(segs.length<=4096,'单轴最多 4096 个编译段');
   axes[row.role]=axis(r,segs);
  }
  check(axes.X,'缺少 Xsweep');
  return {kind:'iv',pageKind:'dc',executionMode:dc.preset==='optimized'?'system':'user',systemHoldS:hold,sweepProgram:{terminals,fixedVoltages,portSettings,loops:n(page.sweep.loops,'循环'),xSweep:axes.X,pSweep:axes.P?{...axes.P,enabled:true}:disabled}};
 }
 if(page.kind==='time'){
  const t=page.timing,summary=model.timedSummary('time',t);
  check(ports.B?.resource==='None','B 端尚未接入');
  check(t.segments.length===1,'仅支持单段固定偏置；多段切换待接入');
  check(t.events.length===1&&t.events[0].terminal==='D'&&t.events[0].quantity==='Current','仅支持一个漏极电流采样事件');
  check(!t.integrationS,'旧积分秒数尚未映射 PLC');
  const integration={instrument:'IT2',short:'IT1',medium:'IT2',long:'IT3'}[t.integrationPreset];
  check(integration!==undefined,'积分预设无效');
  for(const k of Object.keys(roles)){
   const v=n(t.segments[0].bias[k],k+' 偏置');
   if(!active.includes(k)){check(v===0&&n(t.segments[0].currentBias[k],k+' 电流偏置')===0,'接地或未映射端不得施加偏置');continue;}
   check(t.sourceModes[k]==='voltage','仅支持电压源：'+k);
   const r=roles[k],p=ports[k];fixedVoltages[r]=v;
   portSettings[r]={rangeMode:p.rangeMode==='minimum'?'limited-auto':p.rangeMode,rangeA:p.rangeValue,complianceMode:p.complianceMode||'follow-range',complianceA:n(p.compliance,k+' 限流')};
  }
  const e=t.events[0],count=n(e.points,'点数'),v=fixedVoltages.drain;
  return {kind:'iv',pageKind:'time',executionMode:'system',timeProgram:{durationS:summary.durationS,cycles:summary.cycles,startS:n(e.startS,'起点'),intervalS:n(e.intervalS,'间隔'),windowS:n(e.averageS,'窗口'),count,integration},sweepProgram:{terminals,fixedVoltages,portSettings,loops:summary.cycles,xSweep:axis('drain',[segment(v,v,0)],count),pSweep:disabled}};
 }
 throw Error('测试类型尚未接入');
}
 function pageToSweepProgram(page,model){
  if(page?.kind==='dc'||page?.kind==='time')return pageToBasicProgram(page,model);
  if(!page||!['iv','transfer','output'].includes(page.kind))
   throw Error('当前原生 KXCI 执行器仅支持 I–V、转移特性和输出特性');
  if(Array.isArray(page.targets)&&page.targets.length!==1)
   throw Error('当前 KXCI TI 用户模式只支持一个测量目标；请先保留单一 Target。');
  if(page.sweep?.mode&&page.sweep.mode!=='linear')
   throw Error('当前 KXCI 执行器尚未实现 Forward / Reverse 或 Hysteresis，请选择 Linear。');
  const allSegments=[...(page.sweep?.xSegments||[]),...(page.sweep?.pSegments||[])];
  if(allSegments.some(segment=>segment.speed&&segment.speed!=='Normal')||
     (page.sweep?.speed&&page.sweep.speed!=='Normal'))
   throw Error('Fast / Quiet 速度尚未映射到经核验的 KXCI 指令，请先选择 Normal。');
  if(page.target?.logical!=='D'||page.target?.quantity!=='Current')
   throw Error('当前 KXCI TI 用户模式只读取漏极 SMU 电流，请将测量目标设为漏极电流');
  if(page.target.range&&page.target.range!=='auto')
   throw Error('当前 KXCI 执行器使用端子和扫描段量程，请将测量目标量程恢复为 Auto。');
  if(!Array.isArray(page.terminals)||page.terminals.length!==4)
   throw Error('当前页面缺少完整的 S/D/G/B 端口配置');
  const terminals=Object.fromEntries(page.terminals.map(row=>[row.logical,row]));
  const body=terminals.B;
  if(body?.resource&&body.resource!=='None')
   throw Error('当前 DC KXCI 用户模式尚未实现衬底 B 端输出，请先将 B 端口设为 None');
  if(body&&Math.abs(Number(body.bias)||0)>0)
   throw Error('当前 DC KXCI 用户模式未实现衬底 B 端偏置，请将 B 端偏置设为 0');
  for(const logical of ['S','D','G']){
   const terminal=terminals[logical];
   if(!terminal)throw Error('缺少 '+logical+' 端口配置');
   if(/^PMU/.test(terminal.resource))throw Error(logical+' 已映射到 PMU；当前 DC 扫描需要 SMU');
   if(terminal.resource!=='None'&&terminal.sourceMode!=='voltage')
    throw Error(logical+' 端口当前为电流源模式；此 KXCI 用户模式只支持电压源输出');
  }
  const sweep=page.sweep||{};
  const xTerminal=page.terminals.find(row=>row.role==='X'&&row.resource!=='None');
  const pTerminal=page.terminals.find(row=>row.role==='P'&&row.resource!=='None');
  if(!xTerminal)throw Error('必须为 Xsweep 分配一个 SMU');
  if(sweep.pEnabled&&!pTerminal)throw Error('Psweep 已启用，但没有分配独立的 Psweep SMU');
  const xRole=ROLE_BY_LOGICAL[xTerminal.logical];
  const pRole=pTerminal?ROLE_BY_LOGICAL[pTerminal.logical]:null;
  if(!xRole)throw Error('Xsweep 仅支持源极、漏极或栅极');
  if(sweep.pEnabled&&!pRole)throw Error('Psweep 仅支持源极、漏极或栅极');
  if(sweep.pEnabled&&pRole===xRole)throw Error('Xsweep 与 Psweep 不能使用同一电极');
  const terminalNames={};
  const fixedVoltages={};
  const portSettings={};
  for(const [logical,role] of Object.entries(ROLE_BY_LOGICAL)){
   const terminal=terminals[logical];
   terminalNames[role]=terminal.resource;
   if(!['None','GNDU'].includes(terminal.resource)&&
      (terminal.role==='CONDITION'||(!sweep.pEnabled&&terminal.role==='P')))
    fixedVoltages[role]=finite(terminal.bias,logical+' 固定偏置');
   const rangeMode=terminal.rangeMode==='minimum'?'limited-auto':terminal.rangeMode;
   portSettings[role]={rangeMode,rangeA:text(terminal.rangeValue),
    complianceMode:terminal.complianceMode||'follow-range',complianceA:finite(terminal.compliance,logical+' 限流')};
  }
  const xSegments=axisSegments(sweep.xSegments,'Xsweep');
  const pSegments=axisSegments(sweep.pSegments,'Psweep');
  const loops=finite(sweep.loops,'整体循环次数');
  const xRepeats=finite(sweep.xRepeats,'Xsweep 重复次数');
  const pRepeats=finite(sweep.pRepeats,'Psweep 重复次数');
  return {kind:page.kind,sweepProgram:{
   terminals:terminalNames,fixedVoltages,portSettings,loops,
   xSweep:{terminal:xRole,repeats:xRepeats,delayMs:finite(sweep.pointDelay??20,'点间延迟'),segments:xSegments},
   pSweep:{enabled:sweep.pEnabled===true,
    terminal:pRole||(xRole==='gate'?'drain':'gate'),repeats:pRepeats,
    delayMs:finite(sweep.pointDelay??20,'点间延迟'),segments:pSegments}
  }};
 }
 function createHostWait(dom){
  if(typeof dom?.timeout!=='function')return null;
  return delayMs=>{
   let cancel=()=>{},timerFired=false,settled=false;
   let resolve;
   const pending=new Promise(done=>{resolve=done;});
   const onTimer=()=>{timerFired=true;if(!settled){settled=true;resolve();}};
   const finish=()=>{if(settled)return;settled=true;if(!timerFired)cancel?.();resolve();};
   const scheduled=dom.timeout(onTimer,Math.max(0,Number(delayMs)||0));
   if(typeof scheduled==='function')cancel=scheduled;
   Object.defineProperty(pending,'cancel',{value:finish,enumerable:false});
   return pending;
  };
 }
 function createRuntime(ctx,options={}){
  const protocol=ctx.modules.require('dkts-kxci');
  const identity=ctx.modules.require('dkts-identity-core');
  const hardwareCapabilities=ctx.modules.require('dkts-capabilities');
  const plan=ctx.modules.require('dkts-plan');
  const measurement=ctx.modules.require('dkts-kxci-measurement');
  const measurementData=ctx.modules.require('measurementData');
  const model=ctx.modules.require('model');
  if(typeof ctx.capabilities?.invoke!=='function')
   throw Error('DKDS Generic TCP capability facade is unavailable');
  const sharedCapability='network.tcp.interactive',sharedSessions=new Set();
  const hasShared=()=>Boolean(ctx.capabilities.get?.(sharedCapability));
  const shared=(method,payload)=>ctx.capabilities.invoke(sharedCapability,method,{...payload,owner:OWNER});
  const tcp=Object.freeze({
   async open(settings,sessionId){
    if(!hasShared()){
     if(sessionId)throw Error('此宿主不支持共享 TCP 会话');
     return ctx.capabilities.invoke('network.tcp','open',settings);
    }
    const opened=await (sessionId?shared('claim',{sessionId}):shared('open',{settings}));
    sharedSessions.add(opened.sessionId);
    return opened;
   },
   exchange:payload=>sharedSessions.has(payload.sessionId)?shared('exchange',payload):
    ctx.capabilities.invoke('network.tcp','exchange',payload),
   close:async payload=>sharedSessions.delete(payload.sessionId)?shared('close',payload):
    ctx.capabilities.invoke('network.tcp','close',payload),
   release:async payload=>{sharedSessions.delete(payload.sessionId);return shared('release',payload);}
  });
  const controller=identity.createIdentityController(tcp,protocol);
  const execution=plan.createExecutionCoordinator();
  // DKDS owns DOM timers and cancels them with the plugin lifecycle. Never
  // create raw setTimeout/setInterval resources inside a plugin.
  const wait=typeof options.wait==='function'?options.wait:createHostWait(ctx.ui?.dom);
  const executionAdapterAvailable=typeof wait==='function';
  const runner=measurement.createRunner({controller,execution,wait,
   onProgress:()=>notify('measurement-progress')});
  const onChange=typeof options.onChange==='function'?options.onChange:()=>{};
  let monitorTask=null,disposed=false,runSequence=0;
  const notify=(event,details)=>{try{onChange(Object.freeze({event,...status(),...details}));}catch{}};
  function status(){
   const connection=controller.status(),run=runner.status(0);
   return Object.freeze({connection,run,execution:execution.status(),
    protocolVerified:hardwareCapabilities.DATABASE?.safetyPolicies?.kxci?.latestOfficialContentVerified===true&&hardwareCapabilities.DATABASE?.safetyPolicies?.kxci?.allowInstrumentOutput===true,
    protocolRevision:String(hardwareCapabilities.DATABASE?.safetyPolicies?.kxci?.latestOfficialRevision||''),
    executionAdapterAvailable,
    transportAvailable:ctx.capabilities.get?.('network.tcp')!==null&&
      ctx.capabilities.get?.('network.tcp')!==undefined});
  }
  function prepare(page){
   const connection=controller.status(),lastRun=runner.status(0);
   if(lastRun.shutdown==='unconfirmed')return {ready:false,canExecute:false,
    reason:'上一次测量的 SMU 输出关闭未获确认；必须先在仪器现场确认输出状态，禁止继续启动测量'};
   if(connection.phase!=='connected')return {ready:false,canExecute:false,reason:'尚未连接并验证 Keithley 4200A'};
   if(connection.verificationPending)return {ready:false,canExecute:false,reason:'正在重新核验 4200A 连接，请稍候'};
   if(connection.inventoryPending)return {ready:false,canExecute:false,reason:'正在重新读取模块，请等待端口扫描完成'};
   if(!connection.inventory||connection.inventoryError)
    return {ready:false,canExecute:false,reason:connection.inventoryError||'尚未完成实际模块识别'};
   try{
    const input=pageToSweepProgram(page,model);
    const compiled=measurement.compileSweep(input,{
     inventory:connection.inventory,capabilities:hardwareCapabilities
    });
    const protocolPolicy=hardwareCapabilities.DATABASE?.safetyPolicies?.kxci||{};
    const protocolVerified=protocolPolicy.latestOfficialContentVerified===true&&protocolPolicy.allowInstrumentOutput===true;
    let reason='';
    if(!protocolVerified)reason='Rev F 已取得；基础 SMU System Mode 待完整集成和受控实机验收，当前版本尚未授权真实输出';
    else if(!executionAdapterAvailable)reason='当前 DKDS 宿主缺少生命周期管理的查询/停止调度器';
    else if(!compiled.physicalVerified)reason='实际模块型号、序列号或附件身份尚未完整核验';
    else if(!compiled.capabilityVerified)reason='一个或多个活动 SMU 的额定值尚未核验';
    else if(compiled.requiresInterlock)reason='当前方案需要硬件高压互锁；软件尚不能可靠读取互锁状态';
    return Object.freeze({ready:true,canExecute:compiled.canExecute&&protocolVerified&&executionAdapterAvailable,
     protocolVerified,executionAdapterAvailable,reason,compiled,input,pointCount:compiled.totalPoints,
     channels:compiled.channels,active:compiled.active,
     inventory:connection.inventory});
   }catch(error){return Object.freeze({ready:false,canExecute:false,
    reason:String(error?.message||error)});}
  }
  function collectRows(){
   const rows=[];let cursor=0;
   for(let page=0;page<100000;page++){
    const batch=runner.status(cursor);
    if(!Array.isArray(batch.rows)||!batch.rows.length)break;
    rows.push(...batch.rows);
    if(batch.nextCursor<=cursor||batch.nextCursor>=batch.totalRows)break;
    cursor=batch.nextCursor;
   }
   return rows;
  }
  async function monitor(runId,serial,route,scope){
   try{
    const current=await runner.waitForCompletion();
    const rows=collectRows();
    let published=null,publishError='';
    if(rows.length){
     try{
      const connection=controller.status();
      published=measurementData.publishRaw(ctx,{
       runId,rows,serial,startedAt:current.startedAt,
       finishedAt:current.finishedAt,runState:current.state,scope,
       source:{name:'KI4200A '+serial,model:'KI4200A',serial,
        firmware:connection.identity?.version||'',transport:'KXCI TCP',route}
      });
     }catch(error){publishError=String(error?.message||error);}
    }
    notify('measurement-finished',{rows:rows.length,published,publishError,commandTrace:controller.measurementTrace()});
    return Object.freeze({run:current,rows:rows.length,published,publishError});
   }catch(error){
    const failure=String(error?.message||error);
    try{ctx.status.set('测量结果处理失败：'+failure);}catch{}
    return Object.freeze({run:runner.status(0),rows:0,published:null,publishError:failure});
   }
  }
  async function connect(settings,sessionId){
   if(disposed)throw Error('测量运行时已释放');
   const run=runner.status(0);
   if(run.running)throw Error('测量执行期间不能重新连接仪器');
   if(run.shutdown==='unconfirmed')throw Error('上次测量的 SMU 关闭未获确认，请先到仪器现场核查。');
   const result=await controller.connect(settings||{},sessionId);
   notify('connected');
   return result;
  }
  async function inspectModules(options){
   if(disposed)throw Error('测量运行时已释放');
   if(runner.status(0).running)throw Error('测量执行期间不能重新枚举模块');
   const result=await controller.inspectModules(options);
   notify('modules-inspected');
   if(result.phase!=='connected')throw Error(result.diagnostic||'端口扫描过程中连接已断开');
   return result;
  }
  async function connectAndInspect(settings,sessionId){
   await connect(settings,sessionId);
   return inspectModules();
  }
  async function checkConnection(){
   const {connection,run}=status();
   if(disposed||run.running||run.shutdown==='unconfirmed'||connection.phase!=='connected'||
      connection.inventoryPending||connection.verificationPending)
    return;
   const next=await controller.verifyLiveConnection();
   if(next.phase==='error')notify('connection-lost');
  }
  function start(page,confirmed){
   if(disposed)throw Error('测量运行时已释放');
   if(confirmed!==true)throw Error('必须经过用户确认接线、电流保护和实际仪器输出');
   const prepared=prepare(page);
   if(!prepared.ready||!prepared.canExecute)
    throw Error(prepared.reason||'测量方案未通过硬件安全校验');
   const connection=controller.status(),serial=connection.identity.serial;
   const runId='dkts-kxci-'+Date.now()+'-'+(++runSequence);
   controller.clearMeasurementTrace();
   const initial=runner.start(prepared.input,{
    inventory:connection.inventory,capabilities:hardwareCapabilities
   },'CONFIRM_WIRING_AND_OUTPUT');
   monitorTask=monitor(runId,serial,connection.route,{pageId:page.id,routineId:page.routineId,pageName:page.name});
   notify('measurement-started');
   return Object.freeze({...initial,runId,prepared:{pointCount:prepared.pointCount,
    channels:prepared.channels,active:prepared.active}});
  }
  function stop(){
   const result=runner.stop();notify('measurement-stopping');return result;
  }
  async function disconnect(){
   if(runner.status(0).running){
    runner.stop();
    if(monitorTask)await monitorTask;
   }
   const finalRun=runner.status(0);
   if(finalRun.shutdown==='unconfirmed')
    throw Error('SMU 输出关闭未获确认。为避免失去仪器控制连接，软件拒绝断开；请立即在仪器现场检查并手动关闭输出。');
   const result=await controller.disconnect();notify('disconnected');return result;
  }
  function waitForCompletion(){return monitorTask||Promise.resolve(null);}
  async function dispose(){
   if(disposed)return;
   if(runner.status(0).running)runner.stop();
   if(monitorTask)await monitorTask;
   await runner.dispose();
   await controller.dispose();
   disposed=true;
  }
  return Object.freeze({connect,inspectModules,connectAndInspect,checkConnection,disconnect,
   currentTcp:()=>hasShared()?shared('current'):null,
   prepare,start,stop,status,waitForCompletion,dispose,
   currentRanges:(resource,voltagePeaks)=>hardwareCapabilities.verifiedCurrentRanges(
    controller.status(),resource,voltagePeaks)});
 }
 const api=Object.freeze({createRuntime,pageToSweepProgram,pageToBasicProgram});
 window.DKDSPluginModules.define(OWNER,'measurementRuntime',api,{replace:true});
})();
