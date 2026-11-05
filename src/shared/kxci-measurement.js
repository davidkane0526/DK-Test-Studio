(() => {
  'use strict';
  // KXCI Rev. E, section 5: US / DV / TI / RG / RI. Commands are sent as
  // NUL-terminated ASCII. User mode executes each point on the instrument;
  // values returned by TI, not planned voltages, constitute measured data.
  const ROLES=Object.freeze(['source','drain','gate']);
  function integer(v,label,min,max){
    const n=Number(v);
    if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(label+' 无效');
    return n;
  }
  function number(v,label){
    const n=Number(v);
    if(!Number.isFinite(n))throw Error(label+' 不是有限数值');
    return n;
  }
  function numeric(v){
    const n=number(v,'KXCI 数值');
    return n===0?'0':n.toExponential(10).replace('e+','E+').replace('e-','E-');
  }
  function channelNumber(name){
    const m=/^SMU([1-9])$/.exec(String(name||''));
    return m?Number(m[1]):null;
  }
  function eachAxisPoint(axis,callback){
    let position=0;
    for(let s=0;s<axis.segments.length;s++){
      const seg=axis.segments[s];
      for(let i=0;i<seg.points;i++){
        const voltage=i===seg.points-1?seg.stopV:seg.startV+i*seg.stepV;
        callback(Object.freeze({voltageV:voltage,rangeA:seg.rangeA,
          delayMs:seg.delayMs??axis.delayMs,segmentIndex:s+1,position:position++}));
      }
    }
  }
  function axisPoints(axis){
    const points=[];
    eachAxisPoint(axis,point=>points.push(point));
    return points;
  }
  function* points(plan){
    const x=axisPoints(plan.xSweep),p=plan.pSweep?axisPoints(plan.pSweep):[null];
    for(let cycle=1;cycle<=plan.loops;cycle++){
      for(let pRepeat=1;pRepeat<=(plan.pSweep?.repeats||1);pRepeat++){
        for(let pi=0;pi<p.length;pi++){
          for(let xRepeat=1;xRepeat<=plan.xSweep.repeats;xRepeat++){
            for(let xi=0;xi<x.length;xi++){
              const xp=x[xi],pp=p[pi],voltages={...plan.fixedVoltages,
                [plan.xSweep.terminal]:xp.voltageV};
              if(pp)voltages[plan.pSweep.terminal]=pp.voltageV;
              yield {cycle,pRepeat,pPoint:pi+1,xRepeat,xPoint:xi+1,
                xSegment:xp.segmentIndex,pSegment:pp?.segmentIndex||null,
                xVoltageV:xp.voltageV,pVoltageV:pp?.voltageV??null,
                voltages,rangeX:xp.rangeA,rangeP:pp?.rangeA||'auto',
                delayMs:xp.delayMs,pDelayMs:pp?.delayMs??0,
                changedP:xi===0&&xRepeat===1};
            }
          }
        }
      }
    }
  }
  function compileSweep(input,hardware={}){
    const planner=typeof require==='function'
      ?require('./measurement-plan.js')
      :window.DKDSPluginModules.require('dkts-plan');
    const plan=planner.normalizeSweepProgram(input,hardware);
    const active=ROLES.filter(role=>channelNumber(plan.terminals[role])!==null);
    const channels=Object.fromEntries(active.map(role=>[role,channelNumber(plan.terminals[role])]));
    if(!channels.drain)throw Error('当前 KXCI 用户模式需要漏极 SMU');
    const unsupported=ROLES.filter(role=>{
      const name=plan.terminals[role];
      return name!=='None'&&name!=='GNDU'&&!channelNumber(name);
    });
    if(unsupported.length)throw Error('DC KXCI 用户模式暂不支持非 SMU 电压源：'+unsupported.join(', '));
    const limitRoles=active.every(role=>plan.limitsByRole?.[role]?.known);
    // Keep the hardware's documented ratings; only unresolved physical
    // interlocks and incomplete identity block output, never invent a derating.
    const physicalVerified=hardware.inventory?.physicalModelsVerified===true &&
      hardware.inventory?.hardwareLimitsVerified===true;
    let highestV=0;
    for(const role of active){
      const axis=plan.xSweep.terminal===role?plan.xSweep:
        plan.pSweep?.terminal===role?plan.pSweep:null;
      const volts=axis?axis.segments.flatMap(s=>[s.startV,s.stopV]):
        [plan.fixedVoltages[role]];
      highestV=Math.max(highestV,...volts.map(v=>Math.abs(v)));
    }
    const requiresInterlock=highestV>21||active.some(role=>
      plan.limitsByRole?.[role]?.segmentLimits?.some(s=>s.requiresInterlock));
    return Object.freeze({plan,channels,active,physicalVerified,
      capabilityVerified:limitRoles,requiresInterlock,
      canExecute:physicalVerified&&limitRoles&&!requiresInterlock,
      commandMode:'KXCI-US-DV-TI',measurementChannel:channels.drain,
      totalPoints:plan.totalPoints});
  }
  function parseTi(raw,expectedChannel){
    const text=String(raw??'').replace(/\0/g,'').trim();
    // 4200A user-mode: status letter, channel letter, I, signed scientific reading.
    const m=/^([A-Z])([A-Z])I\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+)[Ee][+-]?\d+)$/i.exec(text);
    if(!m)throw Error('KXCI TI 原始响应无法解析：'+text.slice(0,95));
    const currentA=Number(m[3]);
    if(!Number.isFinite(currentA))throw Error('KXCI TI 返回非有限电流');
    const status=m[1].toUpperCase();
    if(!['N','C'].includes(status))throw Error('KXCI TI 状态异常：'+status);
    return Object.freeze({currentA,status,channel:m[2].toUpperCase(),
      rawResponse:text,requestedSmU:expectedChannel});
  }
  function createRunner(options={}){
    const {controller,execution}=options;
    const wait=typeof options.wait==='function'?options.wait:null;
    if(!controller||typeof controller.measurementExchange!=='function')
      throw Error('缺少经过身份验证的 KXCI 会话');
    let job=null,sequence=0;
    function publicState(cursor=0){
      const j=job;
      if(!j)return {state:'idle',running:false,rows:[],nextCursor:0,totalRows:0};
      const from=integer(cursor,'数据游标',0,j.rows.length);
      const rows=j.rows.slice(from,Math.min(from+250,j.rows.length));
      return {runId:j.id,state:j.state,running:j.state==='running'||j.state==='stopping',
        totalPoints:j.compiled.totalPoints,totalRows:j.rows.length,
        nextCursor:from+rows.length,rows,error:j.error,
        shutdown:j.shutdown,startedAt:j.startedAt,finishedAt:j.finishedAt};
    }
    async function command(cmd,reply=false){
      const r=await controller.measurementExchange(cmd,reply);
      return String(r||'');
    }
    async function shutdown(j){
      // DVn with no arguments disables that SMU output (KXCI Rev E, ex. 2).
      let ok=true;
      const failed=[];
      for(const role of [...j.compiled.active].reverse()){
        try{await command('DV'+j.compiled.channels[role]);}
        catch(e){ok=false;failed.push(role+': '+String(e.message||e));}
      }
      j.shutdown=ok?'commands-sent':'unconfirmed';
      if(!ok)j.error=(j.error?j.error+'；':'')+
        '输出关闭未获确认，请在仪器现场检查：'+failed.join('; ');
      return ok;
    }
    async function execute(j,lease){
      const plan=j.compiled.plan;
      const lastCommands=Object.create(null);
      let previousP=null;
      const started=Date.now();
      try{
        await command('US');
        await command(':ERROR:LAST:CLEAR');
        for(const point of points(plan)){
          if(j.cancelled)break;
          for(const role of j.compiled.active){
            const ch=j.compiled.channels[role];
            const voltage=point.voltages[role];
            const setting=plan.portSettings[role];
            const isX=plan.xSweep.terminal===role;
            const isP=plan.pSweep?.terminal===role;
            const segmentRange=isX?point.rangeX:isP?point.rangeP:'auto';
            const selected=segmentRange!=='auto'?Number(segmentRange):
              setting.rangeMode==='fixed'?Number(setting.rangeA):null;
            const compliance=setting.complianceMode==='custom'?
              setting.complianceA:(selected??setting.complianceA);
            const code='DV'+ch+',0,'+numeric(voltage)+','+numeric(compliance);
            if(lastCommands[role]!==code){
              await command(code);
              lastCommands[role]=code;
            }
            if(selected!==null){
              const rangeCode='RI '+ch+','+numeric(selected)+','+numeric(compliance);
              if(lastCommands[role+'-range']!==rangeCode){
                await command(rangeCode);
                lastCommands[role+'-range']=rangeCode;
              }
            }else if(setting.rangeMode==='limited-auto'){
              const rangeCode='RG '+ch+','+numeric(Number(setting.rangeA));
              if(lastCommands[role+'-range']!==rangeCode){
                await command(rangeCode);
                lastCommands[role+'-range']=rangeCode;
              }
            }
            if(j.cancelled)break;
          }
          if(j.cancelled)break;
          const delay=point.delayMs+(point.changedP&&previousP!==null?
            point.pDelayMs:0);
          previousP=point.pPoint;
          if(delay>0){
            if(!wait)throw Error('当前插件宿主未提供测量时序调度器');
            await Promise.race([Promise.resolve().then(()=>wait(delay)),
              new Promise(resolve=>{j.wake=resolve;})]);
          }
          j.wake=null;
          if(j.cancelled)break;
          const raw=await command('TI'+j.compiled.measurementChannel,true);
          const sample=parseTi(raw,j.compiled.measurementChannel);
          const now=Date.now();
          j.rows.push(Object.freeze({
            timeS:(now-started)/1000,voltageV:point.voltages.drain,
            currentA:sample.currentA,sourceVoltageV:point.voltages.source,
            drainVoltageV:point.voltages.drain,gateVoltageV:point.voltages.gate,
            xVoltageV:point.xVoltageV,pVoltageV:point.pVoltageV,
            cycle:point.cycle,pPoint:point.pPoint,xRepeat:point.xRepeat,
            point:point.xPoint,measurementStatus:sample.status,
            rawKxciResponse:sample.rawResponse,source:'4200A-KXCI-TI'
          }));
          if(sample.status==='C')
            throw Error('SMU 触及电流保护（Compliance），测量已终止');
        }
        if(j.cancelled)j.state='stopping';
        // KXCI exposes its last error non-destructively. A failed query is
        // handled as a communication failure, not as an acceptable null read.
        if(!j.cancelled){
          const last=await command(':ERROR:LAST:GET',true);
          const match=last.match(/\((-?\d+)\)/);
          if(!match&& !/^\s*no\s+errors?\b/i.test(last))
            throw Error('KXCI 错误查询响应异常：'+last.slice(0,140));
          if(match&&Number(match[1])!==0)
            throw Error('4200A KXCI 仪器错误：'+last.slice(0,140));
        }
      }catch(error){j.state='failed';j.error=String(error.message||error);}
      finally{
        const safe=await shutdown(j);
        if(j.state!=='failed')j.state=safe?(j.cancelled?'stopped':'completed'):'failed';
        j.finishedAt=new Date().toISOString();
        lease.end();
      }
    }
    function start(input,hardware,authorization){
      if(job&&(job.state==='running'||job.state==='stopping'))
        throw Error('已有测试正在执行');
      if(authorization!=='CONFIRM_WIRING_AND_OUTPUT')
        throw Error('必须确认实际接线、电流保护及现场安全条件');
      if(controller.status().phase!=='connected')
        throw Error('4200A 未连接');
      const compiled=compileSweep(input,hardware);
      if(!compiled.capabilityVerified||!compiled.physicalVerified)
        throw Error('实际模块型号及其理论额定值尚未完整核验');
      if(compiled.requiresInterlock)
        throw Error('该方案需要硬件高压互锁，尚未实现互锁状态的可靠读取');
      // No implicit partial plan override and no software-derived measurement.
      const needsWait=compiled.plan.xSweep.delayMs>0||
        compiled.plan.xSweep.segments.some(s=>(s.delayMs||0)>0)||
        Boolean(compiled.plan.pSweep&&(compiled.plan.pSweep.delayMs>0||
          compiled.plan.pSweep.segments.some(s=>(s.delayMs||0)>0)));
      if(needsWait&&!wait)throw Error('当前 DKDS 插件宿主未提供受控测量时序调度器');
      const lease=execution.begin(compiled.plan.kind);
      job={id:'kxci-'+(++sequence),state:'running',cancelled:false,
        compiled,rows:[],error:'',shutdown:'pending',wake:null,task:null,
        startedAt:new Date().toISOString(),finishedAt:null};
      job.task=execute(job,lease);
      return publicState(0);
    }
    function stop(){
      if(!job)return publicState(0);
      if(job.state==='running'||job.state==='stopping'){
        job.cancelled=true;job.state='stopping';job.wake?.();
      }
      return publicState(job.rows.length);
    }
    async function dispose(){
      stop();
      // Wait for the owned execution task to finish before disconnecting.
      if(job?.task)await job.task;
    }
    return Object.freeze({start,stop,status:publicState,dispose});
  }
  const api=Object.freeze({compileSweep,points,parseTi,createRunner});
  if(typeof window!=='undefined'&&window.DKDSPluginModules)
    window.DKDSPluginModules.define('com.dkds.keithley-4200','dkts-kxci-measurement',api);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
