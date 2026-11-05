(() => {
  'use strict';
  // Hardware-independent, NON-EXECUTABLE SMU test planning.
  // Keithley 4200A SMU absolute source-voltage capability is ±210 V
  // (105% overrange of the nominal 200 V range). This is a planning ceiling,
  // not permission to use every voltage/current combination.
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
    const sourceModel=String(input.sourceModel||'unknown').trim().toUpperCase();
    if(!['UNKNOWN','4200-SMU','4201-SMU','4210-SMU','4211-SMU'].includes(sourceModel))
      throw Error('未识别的 SMU 型号，不能应用未经核实的额定参数');
    const maxAbsVoltage=Math.max(
      Math.abs(Number(input.gateBiasV??0)),Math.abs(Number(input.startV??-1)),
      Math.abs(Number(input.stopV??1)),Math.abs(Number(input.fixedV??0.1))
    );
    const highVoltage=maxAbsVoltage>21;
    const highPower=sourceModel==='4210-SMU'||sourceModel==='4211-SMU';
    const maxComplianceA=sourceModel==='UNKNOWN'?0.0105:
      highVoltage?(highPower?0.105:0.0105):(highPower?1.05:0.105);
    const complianceA=finite(input.complianceA??1e-4,'电流限值',1e-12,maxComplianceA);
    const direction=String(input.direction||'roundtrip');
    if(!['forward','reverse','roundtrip'].includes(direction))throw Error('不支持的扫描方向');
    const delayMs=finite(input.delayMs??20,'扫描点间延迟',0,60000);
    const intervalMs=finite(input.intervalMs??100,'I–t 规划采样间隔',0.000001,3600000);
    const gateBiasV=finite(input.gateBiasV??0,'栅极电压',-210,210);
    const startV=finite(input.startV??-1,'扫描起始电压',-210,210);
    const stopV=finite(input.stopV??1,'扫描结束电压',-210,210);
    const fixedV=finite(input.fixedV??0.1,'固定偏置',-210,210);
    const pointsPerCycle=kind==='iv'&&direction==='roundtrip'?points*2-1:points;
    const totalPoints=loops*pointsPerCycle;
    if(totalPoints>250000)throw Error('预计采样点超过 250000，请减少循环或点数');
    return Object.freeze({
      schema:'dk-test-studio.smu-plan.v1',kind,loops,points,direction,
      sourceSmU,measureSmU,gateSmU,sourceModel,maxAbsVoltageV:maxAbsVoltage,maxComplianceA,gateBiasV,complianceA,
      delayMs,intervalMs,startV,stopV,fixedV,pointsPerCycle,totalPoints,
      executable:false,hardwareVerified:false,
      provenance:'user-test-plan',safetyNote:'已按所选 SMU 型号和最大电压应用保守电流边界；仍需核验实际插槽、工作象限及模块额定值，禁止据此直接执行'
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
  // One measurement at a time in each host/process. Tabs may coexist, but
  // overlapping execution attempts fail before touching hardware.
  function createExecutionCoordinator(){
    let current=null;
    function status(){
      return Object.freeze({running:current!==null,kind:current?.kind||null});
    }
    function begin(kind){
      const name=String(kind||'').trim();
      if(!name)throw Error('测试类型不能为空');
      if(current)throw Error('测试 '+current.kind+' 正在运行，不允许同时执行两项测试');
      const token=Symbol(name);
      current={kind:name,token};
      let finished=false;
      return Object.freeze({
        kind:name,
        end(){
          if(finished)return false;
          finished=true;
          if(current?.token!==token)return false;
          current=null;
          return true;
        }
      });
    }
    async function run(kind,task){
      if(typeof task!=='function')throw Error('必须提供测试执行函数');
      const lease=begin(kind);
      try{return await task();}finally{lease.end();}
    }
    return Object.freeze({status,begin,run});
  }
  const api=Object.freeze({normalizePlan,previewPlan,createExecutionCoordinator});
    if(typeof window!=='undefined' && window.DKDSPluginModules)window.DKDSPluginModules.define('com.dkds.keithley-4200','dkts-plan',api);
    if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
