/* DKTS FS-Pro workbench preview - pure sweep planner, never sends hardware commands. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.DKTSFSProPlan=api;
})(typeof window==='undefined'?null:window,function(){
  'use strict';
  const roles=['source','drain','gate'];
  function finite(value,label,min=-210,max=210){
    if(value===null||value===''||!Number.isFinite(Number(value)))throw Error(label+'不是有效数字');
    const n=Number(value);
    if(n<min||n>max)throw Error(label+'必须在 '+min+' 至 '+max+' 之间');
    return n;
  }
  function integer(value,label,min,max){
    const n=Number(value);
    if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(label+'必须是 '+min+' 至 '+max+' 的整数');
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
      if(step===0)throw Error(label+'步长不能为 0');
      if(from!==to&&Math.sign(to-from)!==Math.sign(step))throw Error(label+'起止方向与步长不一致');
      const count=Math.floor(Math.abs((to-from)/step)+1e-8)+1;
      if(count>10001)throw Error(label+'单段点数不得超过 10001');
      for(let k=0;k<count;k++)values.push(Number((from+k*step).toPrecision(13)));
    }
    const repeats=integer(axis.repeats,label+'重复次数',1,10000);
    return {values,repeats,points:values.length*repeats};
  }
  function calculate(input){
    const terminals=input.terminals||{};
    const active=roles.map(role=>String(terminals[role]||'None')).filter(x=>x!=='None'&&x!=='GNDU');
    if(new Set(active).size!==active.length)throw Error('不同端口不能重复分配同一仪器通道');
    const xRole=input.xSweep?.terminal;
    if(!roles.includes(xRole)||terminals[xRole]==='None'||terminals[xRole]==='GNDU')
      throw Error('Xsweep 的扫描端口未分配可用源模块');
    const x=expandAxis(input.xSweep,'Xsweep');
    const pOn=input.pSweep?.enabled===true;
    if(pOn&&(input.pSweep.terminal===xRole||terminals[input.pSweep.terminal]==='None'||
       terminals[input.pSweep.terminal]==='GNDU'||!roles.includes(input.pSweep.terminal)))
      throw Error('Psweep 必须使用另一条已分配的源通道');
    const p=pOn?expandAxis(input.pSweep,'Psweep'):null;
    const loops=integer(input.loops,'循环次数',1,10000);
    const totalPoints=x.points*(p?p.points:1)*loops;
    if(!Number.isSafeInteger(totalPoints)||totalPoints>1000000)throw Error('规划点数超过网页预览上限 1000000');
    const sampleCount=Math.min(280,totalPoints);
    const sample=[];
    for(let k=0;k<sampleCount;k++){
      const index=sampleCount===1?0:Math.floor(k*(totalPoints-1)/(sampleCount-1));
      const inner=index%x.points;
      const outer=Math.floor(index/x.points)%(p?p.points:1);
      const xV=x.values[inner%x.values.length],pV=p?p.values[outer%p.values.length]:0;
      sample.push({index,xV,pV});
    }
    return {xPoints:x.points,pPoints:p?p.points:0,pEnabled:pOn,loops,totalPoints,sample,
      executable:false,hardwareVerified:false,provenance:'planned-only'};
  }
  return Object.freeze({calculate,expandAxis,roles:Object.freeze([...roles])});
});