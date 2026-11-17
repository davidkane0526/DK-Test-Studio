/* DKTS FS-Pro workbench preview - pure sweep planner, never sends hardware commands. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DKTSFSProPlan=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const roles=['source','drain','gate'];
  function finite(value,label,min=-210,max=210){
    const raw=typeof value==='number'?String(value):String(value??'').trim();
    if(!/^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw))
      throw Error(label+'不是有效数字');
    const n=Number(raw);
    if(!Number.isFinite(n))throw Error(label+'不是有效数字');
    if(n<min||n>max)throw Error(label+'必须在 '+min+' 至 '+max+' 之间');
    return n;
  }
  function integer(value,label,min,max){
    const n=finite(value,label,min,max);
    if(!Number.isSafeInteger(n))throw Error(label+'必须是 '+min+' 至 '+max+' 的整数');
    return n;
  }
  function expandAxis(axis,label){
    if(!axis||!Array.isArray(axis.segments)||axis.segments.length<1||axis.segments.length>64)
      throw Error(label+'需要 1–64 个扫描段');
    const values=[];
    for(const [i,segment] of axis.segments.entries()){
      const from=finite(segment.startV,label+'第'+(i+1)+'段起点');
      const to=finite(segment.stopV,label+'第'+(i+1)+'段终点');
      const step=finite(segment.stepV,label+'第'+(i+1)+'段步长',-420,420);
      // Match the native DKDS/KXCI planning contract. A segment cannot stop
      // short of its requested end point; a single-point segment uses step=0.
      let count;
      if(from===to){
        if(step!==0)throw Error(label+'单点段必须使用 0 步长');
        count=1;
      }else{
        if(step===0||Math.sign(to-from)!==Math.sign(step))
          throw Error(label+'起止方向与步长不一致');
        const steps=(to-from)/step,nearest=Math.round(steps);
        if(!Number.isSafeInteger(nearest)||nearest<1||
           Math.abs(steps-nearest)>1e-8*Math.max(1,Math.abs(steps)))
          throw Error(label+'步长不能精确到达扫描终点');
        count=nearest+1;
      }
      if(count>4096)throw Error(label+'单段扫描点数不得超过 4096');
      for(let k=0;k<count;k++){
        const voltage=k===count-1?to:from+k*step;
        values.push(Number(voltage.toPrecision(13)));
      }
    }
    const repeats=integer(axis.repeats,label+'重复次数',1,10000);
    return {values,repeats,points:values.length*repeats};
  }
  function calculate(input){
    // Preview contracts must not silently reinterpret unsupported UI modes as
    // a linear single sweep, or let a cleared number input become zero.
    if(input.scanMode!==undefined&&input.scanMode!=='linear')
      throw Error('当前只支持线性扫描规划；双向和回滞扫描尚未实现');
    if(input.speed!==undefined&&!['Fast','Normal','Quiet'].includes(input.speed))
      throw Error('不支持的全局扫描速度');
    if(input.pointDelay!==undefined)finite(input.pointDelay,'点间延迟 (ms)',0,6553);
    const terminals=input.terminals||{};
    const active=roles.map(role=>String(terminals[role]||'None')).filter(x=>x!=='None'&&x!=='GNDU');
    if(new Set(active).size!==active.length)throw Error('不同端口不能重复分配同一仪器通道');
    const xRole=input.xSweep?.terminal;
    if(!roles.includes(xRole)||!terminals[xRole]||terminals[xRole]==='None'||terminals[xRole]==='GNDU')
      throw Error('Xsweep 的扫描端口未分配可用源模块');
    for(const [role,channel] of Object.entries(terminals)){
      if(channel==='None'||channel==='GNDU')continue;
      const cfg=input.portSettings?.[role];
      if(!cfg)continue; // Historical lightweight preview fixtures may omit limits.
      if(!['Auto','Fixed','Limited Auto'].includes(cfg.rangeMode))
        throw Error(role+' 的量程模式无效');
      if(!['Follow range','Custom'].includes(cfg.complianceMode))
        throw Error(role+' 的限流方式无效');
      finite(cfg.complianceA,role+' 电流限制 (A)',1e-12,1.05);
      if(cfg.rangeA!=='Auto')finite(cfg.rangeA,role+' 电流档位 (A)',1e-12,1.05);
    }
    for(const [axis,label] of [['xSweep','Xsweep'],['pSweep','Psweep']]){
      if(axis==='pSweep'&&input.pSweep?.enabled!==true)continue;
      for(const [i,seg] of (input[axis]?.segments||[]).entries()){
        if(seg.rangeA!==undefined&&seg.rangeA!=='Auto')
          finite(seg.rangeA,label+'第'+(i+1)+'段电流档位 (A)',1e-12,1.05);
        if(seg.speed!==undefined&&!['Fast','Normal','Quiet'].includes(seg.speed))
          throw Error(label+'第'+(i+1)+'段速度无效');
      }
    }
    const x=expandAxis(input.xSweep,'Xsweep');
    const pOn=input.pSweep?.enabled===true;
    if(pOn&&(input.pSweep.terminal===xRole||terminals[input.pSweep.terminal]==='None'||
       terminals[input.pSweep.terminal]==='GNDU'||!roles.includes(input.pSweep.terminal)))
      throw Error('Psweep 必须使用另一条已分配的源通道');
    const p=pOn?expandAxis(input.pSweep,'Psweep'):null;
    // Every assigned non-sweep source is a fixed-bias output in the plan.
    const swept=new Set([xRole,...(pOn?[input.pSweep.terminal]:[])]);
    for(const role of roles){
      if(swept.has(role)||!terminals[role]||['None','GNDU'].includes(terminals[role]))continue;
      finite(input.fixed?.[role]??0,role+' 固定偏置 (V)');
    }
    const fixedP=!pOn&&input.pSweep?.terminal&&terminals[input.pSweep.terminal]&&
      !['None','GNDU'].includes(terminals[input.pSweep.terminal])&&
      input.pSweep.terminal!==xRole
       ?finite(input.fixed?.[input.pSweep.terminal]??0,'Psweep 未启用时的固定偏置 (V)'):0;
    const loops=integer(input.loops,'循环次数',1,10000);
    const totalPoints=x.points*(p?p.points:1)*loops;
    if(!Number.isSafeInteger(totalPoints)||totalPoints>1000000)throw Error('规划点数超过网页预览上限 1000000');
    const sampleCount=Math.min(280,totalPoints);
    const sample=[];
    for(let k=0;k<sampleCount;k++){
      const index=sampleCount===1?0:Math.floor(k*(totalPoints-1)/(sampleCount-1));
      const inner=index%x.points;
      const outer=Math.floor(index/x.points)%(p?p.points:1);
      const xV=x.values[inner%x.values.length],pV=p?p.values[outer%p.values.length]:fixedP;
      sample.push({index,xV,pV});
    }
    return {xPoints:x.points,pPoints:p?p.points:0,pEnabled:pOn,loops,totalPoints,sample,
      executable:false,hardwareVerified:false,provenance:'planned-only'};
  }
  return Object.freeze({calculate,expandAxis,roles:Object.freeze([...roles])});
});