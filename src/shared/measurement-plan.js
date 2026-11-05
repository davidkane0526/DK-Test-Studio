(() => {
  'use strict';
  const safety=typeof window!=='undefined'&&window.DKTS4200ASafetyPolicy
    ?window.DKTS4200ASafetyPolicy:typeof module!=='undefined'&&module.exports
      ?require('./4200a-safety-policy.js'):null;
  if(!safety)throw Error('缺少 4200A 安全策略模块');
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
  function detectedSmUClass(channel,inventory){
    const number=Number(channel??1);
    const slot=Array.isArray(inventory?.slots)
      ?inventory.slots.find(item=>item?.family==='SMU'&&Number(item.channel)===number):null;
    if(slot?.powerClass==='high')return 'high';
    if(slot?.powerClass==='medium')return 'medium';
    return 'UNKNOWN';
  }
  function normalizePlan(input={},hardware={}){
    const kind=String(input.kind||'iv');
    if(!['iv','it'].includes(kind))throw Error('该测试方式尚未进入安全执行计划');
    const loops=count(input.loops??1,'循环次数',1,10000);
    const points=count(input.points??101,'每循环点数',2,100000);
    const sourceSmU=count(input.sourceSmU??1,'源 SMU',1,9);
    const measureSmU=count(input.measureSmU??sourceSmU,'测量 SMU',1,9);
    const gateSmU=count(input.gateSmU??0,'栅极 SMU（0 为不使用）',0,9);
    if(gateSmU&&(gateSmU===sourceSmU||gateSmU===measureSmU))
      throw Error('栅极 SMU 不得与源/测量 SMU 使用相同编号');
    const sourceMode=String(input.sourceMode||'voltage').toLowerCase();
    const direction=String(input.direction||'roundtrip');
    if(!['forward','reverse','roundtrip'].includes(direction))throw Error('不支持的扫描方向');
    const delayMs=finite(input.delayMs??20,'源延迟 (ms)',0,60000);
    const integrationTimeMs=finite(input.integrationTimeMs??20,'测量积分时间 (ms)',0.001,60000);
    const intervalMs=finite(input.intervalMs??100,'I–t 规划采样间隔 (ms)',0.001,3600000);
    if(kind==='it'&&intervalMs+1e-9<integrationTimeMs)
      throw Error('I–t 采样间隔不能小于测量积分时间');
    const gateBiasV=finite(input.gateBiasV??0,'栅极电压 (V)',-210,210);
    const startV=finite(input.startV??-1,'扫描起始电压 (V)',-210,210);
    const stopV=finite(input.stopV??1,'扫描结束电压 (V)',-210,210);
    const fixedV=finite(input.fixedV??0.1,'固定偏置 (V)',-210,210);
    const startA=sourceMode==='current'?finite(input.startA,'扫描起始电流 (A)',-1.05,1.05):null;
    const stopA=sourceMode==='current'?finite(input.stopA,'扫描结束电流 (A)',-1.05,1.05):null;
    const fixedA=sourceMode==='current'?finite(input.fixedA,'固定电流 (A)',-1.05,1.05):null;
    const safetyPlan=safety.validateSmuPlan({
      ...input,kind,sourceMode,sourceSmU,measureSmU,gateSmU,
      gateBiasV,startV,stopV,fixedV,startA,stopA,fixedA
    },hardware);
    const pointsPerCycle=kind==='iv'&&direction==='roundtrip'?points*2-1:points;
    const totalPoints=loops*pointsPerCycle;
    if(totalPoints>250000)throw Error('预计采样点超过 250000，请减少循环或点数');
    return Object.freeze({
      schema:'dk-test-studio.smu-plan.v2',kind,sourceMode,loops,points,direction,
      sourceSmU,measureSmU,gateSmU,gateBiasV,startV,stopV,fixedV,startA,stopA,fixedA,
      voltageComplianceV:safetyPlan.voltageComplianceV??null,
      complianceA:safetyPlan.complianceA??null,
      sourceModel:safetyPlan.sourceModel,gateModel:safetyPlan.gateModel||null,
      sourcePowerClass:safetyPlan.sourcePowerClass,gatePowerClass:safetyPlan.gatePowerClass||null,
      sourcePreamplifier:safetyPlan.sourcePreamplifier,gatePreamplifier:safetyPlan.gatePreamplifier||false,
      sourceVoltageRangeV:safetyPlan.sourceVoltageRangeV??null,
      gateVoltageRangeV:safetyPlan.gateVoltageRangeV??null,
      sourceCurrentRangeA:safetyPlan.sourceCurrentRangeA??null,
      selectedCurrentRangeA:safetyPlan.selectedCurrentRangeA??null,
      maxAbsVoltageV:safetyPlan.maxAbsVoltageV??Math.max(Math.abs(startV),Math.abs(stopV),Math.abs(gateBiasV)),
      sourceMaxComplianceA:safetyPlan.sourceMaxComplianceA??null,
      gateMaxComplianceA:safetyPlan.gateMaxComplianceA??null,
      maxComplianceA:safetyPlan.maxComplianceA??null,minComplianceA:safetyPlan.minComplianceA??null,
      maxVoltageComplianceV:safetyPlan.maxVoltageComplianceV??null,
      maxPowerW:safetyPlan.maxPowerW??null,requiresInterlock:!!safetyPlan.requiresInterlock,
      warnings:safetyPlan.warnings||[],
      delayMs,integrationTimeMs,estimatedIvPointTimeMs:delayMs+integrationTimeMs,intervalMs,
      pointsPerCycle,totalPoints,
      executable:false,hardwareVerified:false,safetyDatabaseVersion:safety.getDatabase().databaseVersion,
      provenance:'user-test-plan',
      safetyNote:'按 canonical 4200A 能力数据库校验量程、功率、Compliance 与模块身份；物理联锁和 DUT 安全仍需单独确认'
    });
  }
  function previewPlan(plan,limit=300,hardware={}){
    const p=normalizePlan(plan,hardware);
    const max=Math.min(p.totalPoints,Math.max(2,Math.trunc(limit)));
    const rows=[];
    for(let index=0;index<max;index++){
      const cycle=Math.floor(index/p.pointsPerCycle)+1;
      const pos=index%p.pointsPerCycle;
      let setVoltageV=p.fixedV,setCurrentA=p.fixedA;
      if(p.kind==='iv'){
        const fraction=pos<p.points?pos/(p.points-1):
          (p.pointsPerCycle-pos-1)/(p.points-1);
        const progress=p.direction==='reverse'?1-fraction:fraction;
        if(p.sourceMode==='current')setCurrentA=p.startA+(p.stopA-p.startA)*progress;
        else setVoltageV=p.startV+(p.stopV-p.startV)*progress;
      }
      rows.push({cycle,point:pos+1,setVoltageV:p.sourceMode==='voltage'?setVoltageV:null,
        setCurrentA:p.sourceMode==='current'?setCurrentA:null,
        plannedElapsedS:p.kind==='it'?index*p.intervalMs/1000:null});
    }
    return {plan:p,firstPoints:rows,truncated:p.totalPoints>max};
  }
  function createExecutionCoordinator(){
    let current=null;
    function status(){return Object.freeze({running:current!==null,kind:current?.kind||null});}
    function begin(kind){
      const name=String(kind||'').trim();
      if(!name)throw Error('测试类型不能为空');
      if(current)throw Error('测试 '+current.kind+' 正在运行，不允许同时执行两项测试');
      const token=Symbol(name);current={kind:name,token};let finished=false;
      return Object.freeze({kind:name,end(){
        if(finished)return false;finished=true;
        if(current?.token!==token)return false;current=null;return true;
      }});
    }
    async function run(kind,task){
      if(typeof task!=='function')throw Error('必须提供测试执行函数');
      const lease=begin(kind);try{return await task();}finally{lease.end();}
    }
    return Object.freeze({status,begin,run});
  }
  const api=Object.freeze({normalizePlan,previewPlan,detectedSmUClass,createExecutionCoordinator});
  if(typeof window!=='undefined'&&window.DKDSPluginModules)
    window.DKDSPluginModules.define('com.dkds.keithley-4200','dkts-plan',api);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
