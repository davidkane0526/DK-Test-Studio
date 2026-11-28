(() => {
 'use strict';
 const OWNER='com.dkts.keithley-4200';
 const SMU_INTEGRATION=Object.freeze({short:'IT1',medium:'IT2',long:'IT3'});
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
function pageToBasicProgram(page, model, globalIntegration='medium'){
 const check=(x,m)=>{if(!x)throw Error(m);};
 const n=(x,label)=>{check(x!==null&&x!==undefined&&String(x).trim()!==''&&Number.isFinite(Number(x)),label+' 数值无效');return Number(x);};
 const roles={D:'drain',G:'gate',S:'source',B:'body'},ports=Object.fromEntries(page.terminals.map(t=>[t.logical,t]));
 if(page.kind==='dc')ports.B={...ports.B,resource:page.dc.bodyResource};
 const terminals=Object.fromEntries(Object.entries(roles).map(([k,r])=>[r,ports[k]?.resource||'None']));
 const active=Object.keys(roles).filter(k=>/^SMU[1-8]$/.test(ports[k]?.resource||''));
 check(Object.keys(roles).every(k=>['None','GNDU'].includes(ports[k]?.resource)||active.includes(k)),'基础执行仅支持 SMU1–8、GNDU 或 None');
 check(active.includes('D'),'请将漏极映射到 SMU');
 check(new Set(active.map(k=>ports[k].resource)).size===active.length,'端口重复');
 const fixedVoltages={},fixedCurrents={},sourceModes={},portSettings={},disabled={enabled:false,terminal:'gate'};
 const segment=(startV,stopV,stepV,rangeA='auto',delayMs=0)=>({startV,stopV,stepV,rangeA,delayMs});
 const axis=(terminal,segments,repeats=1)=>({terminal,segments,repeats,delayMs:0});
 if(page.kind==='dc'){
  const dc=page.dc,info=model.dcSummary(page,dc);
  check(['optimized','point-by-point'].includes(dc.preset),'未知 DC 执行模式');
  check(dc.bodyResource==='None'||dc.preset==='optimized','B 端当前使用原生 Optimized 执行');
  check(dc.preset==='optimized'||(info.outputs.length===1&&info.outputs[0]==='Id'),'逐点 DC 仅支持 Outputs=Id');
  const plot=model.dcTargetColumns(page,dc),plotSignals=plot.rawSignals.filter(s=>s!=='Time');
  check(dc.strategy.onLimit==='stop','当前执行器仅支持 Stop on limit');
  const hold=dc.strategy.hold.trim()?n(dc.strategy.hold,'Hold'):0;
  check(hold>=0&&hold<=655.3,'HT 允许 0–655.3 s');
  check(dc.preset==='optimized'||hold===0,'逐点模式 Hold 尚未接入');
  const speed=dc.strategy.integrationPreset??(text(dc.strategy.integration)?'legacy':'normal');
  const integration=dc.strategy.mode==='global'?SMU_INTEGRATION[globalIntegration]:{fast:'IT1',normal:'IT2',quiet:'IT3'}[speed];
  check(integration,'旧积分秒数未确认电源频率，请重新选择测量速度');
  const delay=dc.strategy.mode==='local'&&dc.strategy.delay.trim()?n(dc.strategy.delay,'Delay')*1000:0;
  check(dc.reference==='GND'||ports[dc.reference]?.resource==='GNDU','仅支持接地参考');
  const vars=Object.fromEntries(page.variables.map(v=>[v.name,Number(v.value)])),v=x=>model.dcExpression(x,vars,dc.polarity);
  const axes={},generators={},generatorFormulas={};
  for(const k of active){
   const row=dc.terminals[k],r=roles[k];
   const current=row.mode==='current';
   check(!current||dc.preset==='optimized','电流源请使用 Optimized 扫描');
   sourceModes[r]=row.mode;
   check(row.ref==='GND'||ports[row.ref]?.resource==='GNDU','仅支持接地参考：'+k);
   check(new Set(row.segments.map(s=>s.range)).size===1,'扫描段间量程切换尚未接入');
   const range=row.segments[0].range;
   portSettings[r]={rangeMode:range==='auto'?'auto':'fixed',rangeA:range==='auto'?'1e-6':range,complianceMode:'custom',...(current?{complianceV:n(row.limitV,k+' 限压')}:{complianceA:n(row.limitI,k+' 限流')})};
   if(row.role==='CONDITION'){const s=row.segments[0];if(s.method==='generator'){check(dc.preset==='optimized','Generator 使用 Optimized 原生扫描');generatorFormulas[r]=s.formula;}else{check(s.method==='constant','未知 Condition 模式');(current?fixedCurrents:fixedVoltages)[r]=v(s.value);}continue;}
   const segs=[];
   const make=(a,b,c)=>current?{startA:a,stopA:b,stepA:c,rangeA:range,delayMs:delay}:segment(a,b,c,range,delay);
   for(const s of row.segments){
    if(s.method==='step')segs.push(make(v(s.start),v(s.stop),v(s.step)));
    else if(s.method==='points')segs.push(make(v(s.start),v(s.stop),(v(s.stop)-v(s.start))/(v(s.points)-1)));
    else if(s.method==='log'){
     check(dc.preset==='optimized'&&row.role==='X','对数扫描请使用 Optimized 的 Xsweep');
     const a=v(s.start),b=v(s.stop),count=v(s.points);check(Number.isInteger(count)&&count>=2&&count<=4096&&a*b>0,'对数扫描参数无效');
     for(let i=0;i<count;i++){const level=i===0?a:i===count-1?b:Math.sign(a)*Math.exp(Math.log(Math.abs(a))+(Math.log(Math.abs(b))-Math.log(Math.abs(a)))*i/(count-1));segs.push(make(level,level,0));}
    }
    else if(s.method==='list')for(const x of s.list.split(/[,\n]/).map(v))segs.push(make(x,x,0));
    else throw Error('扫描方式尚未接入：'+s.method);
   }
   check(segs.length<=4096,'单轴最多 4096 个编译段');
   // DC strategy Delay is shared, not an independent VAR2 step delay.
   axes[row.role]=axis(r,dc.preset==='optimized'&&row.role==='P'?segs.map(s=>({...s,delayMs:0})):segs);
  }
  check(axes.X,'缺少 Xsweep');
  if(dc.strategy.direction==='forward-reverse'){
   check(!axes.P||dc.preset==='point-by-point'||Object.keys(generatorFormulas).length,'Optimized 双向扫描与 Psweep 需要原生列表模式');
   const x=axes.X,r=x.terminal,current=sourceModes[r]==='current',levels=[];
   for(const seg of x.segments){const a=current?seg.startA:seg.startV,b=current?seg.stopA:seg.stopV,d=current?seg.stepA:seg.stepV;const count=a===b?1:Math.round((b-a)/d)+1;check(Number.isSafeInteger(count)&&count>=1&&count<=4096&&(count===1||Math.abs(a+(count-1)*d-b)<=Math.max(1e-15,Math.abs(d)*1e-8)),'双向扫描起止值与步长不匹配');for(let i=0;i<count;i++)levels.push({...seg,value:i===count-1?b:a+i*d});check(levels.length<=4096,'扫描点数超出单轴容量');}
   // Turning point is measured once. Other repeated points are preserved.
   const ordered=[...levels,...levels.slice(0,-1).reverse()];check(ordered.length<=4096,'往返扫描最多 4096 点');
   axes.X={...x,segments:ordered.map(({value,rangeA,delayMs})=>current?{startA:value,stopA:value,stepA:0,rangeA,delayMs}:segment(value,value,0,rangeA,delayMs))};
  }
  const followers={};let dcList=null;
  if(Object.keys(generatorFormulas).length){
   const x=axes.X,p=axes.P,mode=sourceModes[x.terminal],seg=x.segments[0],current=mode==='current';
   const linear=x.segments.length===1&&((current?seg.stopA:seg.stopV)!==(current?seg.startA:seg.startV))&&Math.abs((current?seg.stopA-seg.startA:seg.stopV-seg.startV)/(current?seg.stepA:seg.stepV))+1<=1024&&(!current&&[seg.startV,seg.stopV,seg.stepV].every(z=>z===0||Math.abs(z)>=.001));
   let affine=linear;for(const [role,formula] of Object.entries(generatorFormulas)){try{if(sourceModes[role]!=='voltage')throw Error('current generator');generators[role]=model.dcAffine(formula,vars,dc.polarity);}catch{affine=false;}}
   if(!affine){for(const role of Object.keys(generators))delete generators[role];
    const expand=a=>{const cur=sourceModes[a.terminal]==='current',values=[];for(const s of a.segments){const [lo,hi,step]=cur?[s.startA,s.stopA,s.stepA]:[s.startV,s.stopV,s.stepV];const count=lo===hi?1:Math.round((hi-lo)/step)+1;check(Number.isSafeInteger(count)&&count>=1&&count<=4096&&(count===1||Math.abs(lo+(count-1)*step-hi)<=Math.max(1e-15,Math.abs(step)*1e-8)),'Generator 列表轴参数无效');check(values.length+count<=4096,'Generator 列表超过 4096 点');for(let i=0;i<count;i++)values.push(i===count-1?hi:lo+i*step);}return values;};
    const xs=expand(x),ps=p?expand(p):[null];check(xs.length*ps.length<=4096,'Generator 单次列表最多 4096 点');
    const master=[],pLevels=[],evals=Object.fromEntries(Object.entries(generatorFormulas).map(([role,expr])=>[role,model.generatorEvaluator(expr,vars,dc.polarity,!!p)]));for(const role of Object.keys(evals))followers[role]=[];if(p)followers[p.terminal]=[];
    for(const pv of ps)for(const xv of xs){master.push(xv);if(p){followers[p.terminal].push(pv);pLevels.push(pv);}for(const [role,evalFn] of Object.entries(evals))followers[role].push(evalFn(xv,pv));}
    dcList={xCount:xs.length,pRole:p?.terminal||null,pMode:p?sourceModes[p.terminal]:null,pValues:pLevels};
    const range=x.segments[0].rangeA;axes.X={...x,segments:master.map(z=>current?{startA:z,stopA:z,stepA:0,rangeA:range,delayMs:delay}:segment(z,z,0,range,delay))};delete axes.P;
   }
  }
  return {kind:'iv',pageKind:'dc',executionMode:dc.preset==='optimized'?'system':'user',systemHoldS:hold,systemIntegration:integration,requestedOutputs:info.outputs,plotSignals,dcList,sweepProgram:{terminals,fixedVoltages,fixedCurrents,sourceModes,portSettings,generators,listFollowers:followers,loops:n(page.sweep.loops,'循环'),xSweep:axes.X,pSweep:axes.P?{...axes.P,enabled:true}:disabled}};
 }
 if(page.kind==='time'){
  const t=page.timing,summary=model.timedSummary('time',t);
  check(['native-fixed','native-list'].includes(t.mode),'请选择仪器固定偏置或偏置列表；旧线性时间计划不自动改变时钟语义');
  check(model.timeGroundNodes(page).includes(model.timeReference(page,t)),'参考节点必须是 GND 或已接到 GNDU 的端子');
  check(ports.B?.resource==='None','B 端尚未接入');
  const list=t.mode==='native-list';check(list||t.segments.length===1,'固定偏置要求单段');
  check(t.events.every(e=>active.includes(e.terminal)),'测量事件必须对应实装 SMU');
  const requestedOutputs=t.events.map(e=>(e.quantity==='Current'?'I':'V')+e.terminal.toLowerCase());
  check(!t.integrationS,'旧积分秒数尚未映射 PLC');
  const integration=SMU_INTEGRATION[t.integrationPreset==='instrument'?globalIntegration:t.integrationPreset];
  check(integration!==undefined,'积分预设无效');
  for(const k of Object.keys(roles)){
   const v=n(t.segments[0].bias[k],k+' 偏置');
   if(!active.includes(k)){check(t.segments.every(s=>n(s.bias[k],k+' 偏置')===0&&n(s.currentBias[k],k+' 电流偏置')===0),'接地或未映射端不得施加偏置');continue;}
   const r=roles[k],p=ports[k],current=t.sourceModes[k]==='current';sourceModes[r]=t.sourceModes[k];
   if(current){
    fixedCurrents[r]=n(t.segments[0].currentBias[k],k+' 电流偏置');
    portSettings[r]={rangeMode:'auto',complianceMode:'custom',complianceV:n(t.voltageLimitsV?.[k],k+' 限压')};
   }else{
    fixedVoltages[r]=v;
    portSettings[r]={rangeMode:p.rangeMode==='minimum'?'limited-auto':p.rangeMode,rangeA:p.rangeValue,complianceMode:p.complianceMode||'follow-range',complianceA:n(p.compliance,k+' 限流')};
   }
  }
  if(list){
   const levels=Object.fromEntries(active.map(key=>[roles[key],t.segments.flatMap(s=>Array.from({length:n(s.listPoints,'段点数')},()=>n((t.sourceModes[key]==='current'?s.currentBias:s.bias)[key],key+' 偏置')))]));
   const variable=Object.keys(levels).filter(r=>levels[r].some(v=>v!==levels[r][0])),master=variable[0]||'drain',followers={};
   for(const r of [master,...variable.filter(r=>r!==master)]){delete fixedVoltages[r];delete fixedCurrents[r];if(r!==master)followers[r]=levels[r];}
   const cur=sourceModes[master]==='current',delay=summary.settlingDelayS*1000;
   const segments=levels[master].map(v=>cur?{startA:v,stopA:v,stepA:0,rangeA:'auto',delayMs:delay}:segment(v,v,0,'auto',delay));
   const segmentIndices=t.segments.flatMap((s,i)=>Array.from({length:n(s.listPoints,'段点数')},()=>i+1));
   return {kind:'iv',pageKind:'time',executionMode:'system',requestedOutputs,systemIntegration:integration,timeList:{segmentIndices},sweepProgram:{terminals,fixedVoltages,fixedCurrents,sourceModes,portSettings,listFollowers:followers,loops:summary.cycles,xSweep:axis(master,segments),pSweep:disabled}};
  }
  const e=t.events[0],count=n(e.points,'点数'),current=sourceModes.drain==='current',v=current?fixedCurrents.drain:fixedVoltages.drain;
  const xSegment=current?{startA:v,stopA:v,stepA:0,rangeA:'auto',delayMs:0}:segment(v,v,0);
  return {kind:'iv',pageKind:'time',executionMode:'system',requestedOutputs,timeProgram:{durationS:summary.durationS,cycles:summary.cycles,startS:n(e.startS,'起点'),intervalS:n(e.intervalS,'间隔'),windowS:n(e.averageS,'窗口'),count,integration},sweepProgram:{terminals,fixedVoltages,fixedCurrents,sourceModes,portSettings,loops:summary.cycles,xSweep:axis('drain',[xSegment],count),pSweep:disabled}};
 }
 throw Error('测试类型尚未接入');
}
 function pageToSweepProgram(page,model,globalIntegration='medium'){
  if(page?.kind==='dc'||page?.kind==='time')return pageToBasicProgram(page,model,globalIntegration);
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
  return {kind:page.kind,systemIntegration:SMU_INTEGRATION[globalIntegration],sweepProgram:{
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
  let topologyProfile=null;
  function setTopologyProfile(profile){if(runner.status(0).running)throw Error('测量期间不能更改接线');topologyProfile=profile||null;}
  function resolvePulsePort(resource,legacyChannel){const c=controller.status();return protocol.resolvePulseResource(c.inventory,c.identity?.serial,topologyProfile,resource,legacyChannel);}
  function confirmWiring(links){const c=controller.status();if(runner.status(0).running||c.phase!=='connected')throw Error('请在仪器空闲时确认接线');const profile=protocol.confirmTopology(c.inventory,c.identity.serial,links);setTopologyProfile(profile);return profile;}
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
    systemModeProtocolVerified:hardwareCapabilities.DATABASE?.safetyPolicies?.kxci?.smuSystemModeManualVerified===true&&hardwareCapabilities.DATABASE?.safetyPolicies?.kxci?.allowSystemModeOutput===true,
    protocolRevision:String(hardwareCapabilities.DATABASE?.safetyPolicies?.kxci?.latestOfficialRevision||''),
    executionAdapterAvailable,
    transportAvailable:ctx.capabilities.get?.('network.tcp')!==null&&
      ctx.capabilities.get?.('network.tcp')!==undefined});
  }
  function prepare(page){
   const connection=controller.status(),lastRun=runner.status(0);
   if(lastRun.shutdown==='unconfirmed')return {ready:false,canExecute:false,
    reason:'上一次测量的输出关闭未获确认；必须先在仪器现场确认输出状态，禁止继续启动测量'};
   if(connection.phase!=='connected')return {ready:false,canExecute:false,reason:'尚未连接并验证 Keithley 4200A'};
   if(connection.verificationPending)return {ready:false,canExecute:false,reason:'正在重新核验 4200A 连接，请稍候'};
   if(connection.inventoryPending)return {ready:false,canExecute:false,reason:'正在重新读取模块，请等待端口扫描完成'};
   if(!connection.inventory||connection.inventoryError)
    return {ready:false,canExecute:false,reason:connection.inventoryError||'尚未完成实际模块识别'};
   try{
    let input;
    const pmuTime=page.kind==='time'&&page.timing.mode===model.TIME_PMU_MODE;
    if(page.kind==='pulse'||pmuTime){
     const v=pmuTime?{...page.timing.pmu,rangeV:'auto'}:page.timing,resource=resolvePulsePort(page.terminals.find(t=>t.logical===v.terminal)?.resource,v.channel);
     protocol.planSmURoutes(connection.inventory,connection.identity.serial,topologyProfile,[]);
     input={executionMode:'pulse',settings:v,summary:pmuTime?null:model.timedSummary('pulse',v),resource,wiringConfirmed:true};
     if(v.testMode==='sequence'&&v.arbPartner){const settings={...v,...v.arbPartner,rateHz:v.rateHz,arbPartner:null,secondary:null};input.arbPartner={settings,resource:resolvePulsePort(page.terminals.find(t=>t.logical===settings.terminal)?.resource,settings.channel),wiringConfirmed:true};}
     if(v.secondary&&v.testMode==='sweep'){const settings=model.pulseSecondarySettings(v);input.secondary={settings,summary:model.timedSummary('pulse',settings),resource:resolvePulsePort(page.terminals.find(t=>t.logical===settings.terminal)?.resource,settings.channel),wiringConfirmed:true};}
    }else{
     input=pageToSweepProgram(page,model,options.getSmuIntegration?.());
     const routes=protocol.planSmURoutes(connection.inventory,connection.identity.serial,topologyProfile,Object.values(input.sweepProgram.terminals));
     if(routes.length&&input.executionMode!=='system')throw Error('RPM 自动切换目前仅支持仪器原生 DC 和固定偏置时间测试');
     input.rpmRoutes=routes;
    }
    const compiled=measurement.compileSweep(input,{
     inventory:connection.inventory,capabilities:hardwareCapabilities
    });
    const protocolPolicy=hardwareCapabilities.DATABASE?.safetyPolicies?.kxci||{};
    const protocolVerified=compiled.pulse?protocolPolicy.pmuModeManualVerified===true&&protocolPolicy.allowPulseModeOutput===true&&(!compiled.pulse.arb||protocolPolicy.segmentArbManualVerified===true&&protocolPolicy.allowSegmentArbOutput===true):compiled.system?protocolPolicy.smuSystemModeManualVerified===true&&protocolPolicy.allowSystemModeOutput===true&&(!(compiled.system.timeList?.multiChannel||compiled.system.dcList?.multiChannel)||protocolPolicy.allowMultiChannelListOutput===true):protocolPolicy.latestOfficialContentVerified===true&&protocolPolicy.allowInstrumentOutput===true;
    let reason='';
    if(!protocolVerified)reason=compiled.pulse?'当前策略未开放此 PMU 模式的实机输出':'Rev F 已取得；当前执行模式尚未取得输出许可';
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
  function prepareRoutine(pages,repeat){
   if(!Array.isArray(pages)||!pages.length||runner.status(0).running)return {ready:false,canExecute:false,reason:'流程为空或仪器正在执行'};
   try{const stages=pages.map(page=>{const p=prepare(page);if(!p.canExecute)throw Error(page.name+'：'+(p.reason||'执行前检查失败'));if(!p.compiled.system&&!p.compiled.pulse)throw Error(page.name+'：流程当前仅支持仪器原生执行');return {input:p.input,scope:{pageId:page.id,routineId:page.routineId,pageName:page.name}};});
    const input={executionMode:'routine',repeat,stages},c=controller.status(),compiled=measurement.compileSweep(input,{inventory:c.inventory,capabilities:hardwareCapabilities});return {ready:true,canExecute:compiled.canExecute,pointCount:compiled.totalPoints,input,compiled};
   }catch(e){return {ready:false,canExecute:false,reason:String(e.message||e)};}
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
      published=(scope?.routineSequence?measurementData.publishSequence:measurementData.publishRun)(ctx,{
       runId,rows,serial,stageResults:current.stageResults,startedAt:current.startedAt,
       finishedAt:current.finishedAt,runState:current.state,scope,
       source:{name:'KI4200A '+serial,model:'KI4200A',serial,
        firmware:connection.identity?.version||'',transport:'KXCI TCP',route}
      });
      if(published?.errors?.length)publishError=published.errors.join('；');
     }catch(error){publishError=String(error?.message||error);}
    }
    const smuRows=rows.filter(row=>row.source!=='4200A-KXCI-PMU');
    const pointStatus=smuRows.length&&typeof measurementData.statusSummary==='function'?measurementData.statusSummary(smuRows):null;
    notify('measurement-finished',{rows:rows.length,published,publishError,pointStatus,commandTrace:controller.measurementTrace()});
    return Object.freeze({run:current,rows:rows.length,published,publishError,pointStatus});
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
  function startRoutine(pages,repeat,confirmed){
   if(disposed||confirmed!==true)throw Error('必须确认流程接线及实际输出');
   const p=prepareRoutine(pages,repeat);if(!p.canExecute)throw Error(p.reason||'流程校验失败');
   const c=controller.status(),runId='dkts-routine-'+Date.now()+'-'+(++runSequence);controller.clearMeasurementTrace();
   const initial=runner.start(p.input,{inventory:c.inventory,capabilities:hardwareCapabilities},'CONFIRM_WIRING_AND_OUTPUT');
   monitorTask=monitor(runId,c.identity.serial,c.route,{routineSequence:true,routineId:pages[0].routineId});notify('measurement-started');return {...initial,runId};
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
    throw Error('仪器输出关闭未获确认。为避免失去仪器控制连接，软件拒绝断开；请立即在仪器现场检查并手动关闭输出。');
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
   prepare,prepareRoutine,start,startRoutine,stop,status,waitForCompletion,dispose,setTopologyProfile,confirmWiring,resolvePulsePort,
   currentRanges:(resource,voltagePeaks)=>hardwareCapabilities.verifiedCurrentRanges(
    controller.status(),resource,voltagePeaks)});
 }
 const api=Object.freeze({createRuntime,pageToSweepProgram,pageToBasicProgram});
 window.DKDSPluginModules.define(OWNER,'measurementRuntime',api,{replace:true});
})();
