(() => {
  'use strict';
  // Hardware-independent, NON-EXECUTABLE SMU test planning.
  // Deliberately contains no KXCI write or instrument output command.
  function finite(input,label,min,max){
    if(input===undefined||input===null||String(input).trim()==='')throw Error(label+' 不能为空');
    const n=Number(input);
    if(!Number.isFinite(n)||n<min||n>max)throw Error(label+' 必须在 '+min+' 到 '+max+' 的规划范围内');
    return n;
  }
  function count(input,label,min,max){
    const n=finite(input,label,min,max);
    if(!Number.isSafeInteger(n))throw Error(label+' 必须是整数');
    return n;
  }
  function normalizePlan(input={}){
    const kind=String(input.kind||'iv');
    if(!['iv','it'].includes(kind))throw Error('该测试方式尚未进入安全执行计划');
    const loops=count(input.loops??1,'循环次数',1,10000);
    const points=count(input.points??101,'每循环点数',2,100000);
    const sourceSmU=count(input.sourceSmU??1,'源 SMU',1,9);
    const measureSmU=count(input.measureSmU??1,'测量 SMU',1,9);
    const gateSmU=count(input.gateSmU??0,'栅极 SMU（0 为不使用）',0,9);
    if(gateSmU&&(gateSmU===sourceSmU||gateSmU===measureSmU))
      throw Error('栅极 SMU 不得与源/测量 SMU 使用相同编号');
    const complianceA=finite(input.complianceA??1e-4,'电流限值',1e-12,1);
    const direction=String(input.direction||'roundtrip');
    if(!['forward','reverse','roundtrip'].includes(direction))throw Error('不支持的扫描方向');
    const delayMs=finite(input.delayMs??20,'扫描点间延迟',0,60000);
    const intervalMs=finite(input.intervalMs??100,'I–t 规划采样间隔',0.000001,3600000);
    const gateBiasV=finite(input.gateBiasV??0,'栅极电压',-200,200);
    const startV=finite(input.startV??-1,'扫描起始电压',-200,200);
    const stopV=finite(input.stopV??1,'扫描结束电压',-200,200);
    const fixedV=finite(input.fixedV??0.1,'固定偏置',-200,200);
    const pointsPerCycle=kind==='iv'&&direction==='roundtrip'?points*2-1:points;
    const totalPoints=loops*pointsPerCycle;
    if(totalPoints>250000)throw Error('预计采样点超过 250000，请减少循环或点数');
    return Object.freeze({
      schema:'dk-test-studio.smu-plan.v1',kind,loops,points,direction,
      sourceSmU,measureSmU,gateSmU,gateBiasV,complianceA,
      delayMs,intervalMs,startV,stopV,fixedV,pointsPerCycle,totalPoints,
      executable:false,hardwareVerified:false,
      provenance:'user-test-plan',safetyNote:'仅校验测试参数，未核验实际插槽、限值和可执行指令'
    });
  }
  function previewPlan(plan,limit=300){
    const p=normalizePlan(plan);
    const max=Math.min(p.totalPoints,Math.max(2,Math.trunc(limit)));
    const rows=[];
    for(let index=0;index<max;index++){
      const cycle=Math.floor(index/p.pointsPerCycle)+1;
      const pos=index%p.pointsPerCycle;
      let voltageV=p.fixedV;
      if(p.kind==='iv'){
        const fraction=pos<p.points?pos/(p.points-1):
          (p.pointsPerCycle-pos-1)/(p.points-1);
        const progress=p.direction==='reverse'?1-fraction:fraction;
        voltageV=p.startV+(p.stopV-p.startV)*progress;
      }
      rows.push({cycle,point:pos+1,setVoltageV:voltageV,
        plannedElapsedS:p.kind==='it'?index*p.intervalMs/1000:null});
    }
    return {plan:p,firstPoints:rows,truncated:p.totalPoints>max};
  }
  const api=Object.freeze({normalizePlan,previewPlan});
    if(typeof window!=='undefined' && window.DKDSPluginModules)window.DKDSPluginModules.define('com.dkds.keithley-4200','dkts-plan',api);
    if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
