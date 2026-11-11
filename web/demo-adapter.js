/* DKTS Web UI Demo adapter. Never connects to a real instrument. */
(() => {
  'use strict';
  if (window.DKTSClient) throw Error('Web demo cannot replace an existing native instrument bridge');
  const packageVersion = '__DKTS_PACKAGE_VERSION__';
  const status = Object.freeze({ok:false,phase:'disconnected',summary:'网页 UI Demo · 无仪器连接',identity:null,inventory:null,route:null});
  let memoryWorkspace = null;
  const STORAGE_KEY = 'dkts.ui-demo.session.v1';
  const failure = message => ({ok:false,error:String(message)});
  const integer = (value, min, max, label) => {
    const n=Number(value);
    if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(label+'必须为 '+min+'–'+max+' 之间的整数');
    return n;
  };
  function estimate(axis, label) {
    const list=axis?.segments;
    if(!Array.isArray(list)||!list.length||list.length>64)throw Error(label+'需要 1–64 个扫描段');
    let points=0;
    for(const segment of list) {
      const start=Number(segment.startV),stop=Number(segment.stopV),step=Number(segment.stepV);
      if(![start,stop,step].every(Number.isFinite)||Math.max(Math.abs(start),Math.abs(stop))>210)
        throw Error(label+'包含无效电压参数');
      if(!step||Math.sign(stop-start)!==Math.sign(step)) {
        if(start!==stop)throw Error(label+'扫描方向与步长符号不匹配');
        if(step===0)throw Error(label+'步长不能为零');
      }
      const n=Math.floor(Math.abs((stop-start)/step)+1e-8)+1;
      if(!Number.isSafeInteger(n)||n>100000)throw Error(label+'扫描点数超过网页预览上限');
      points+=n;
    }
    return {points,repeats:integer(axis.repeats||1,1,10000,label+'重复次数')};
  }
  function previewPlan(input) {
    try {
      if(['iv','transfer','output'].includes(input?.kind)) {
        const plan=input.sweepProgram||{};
        const x=estimate(plan.xSweep,'Xsweep');
        const p=plan.pSweep?.enabled?estimate(plan.pSweep,'Psweep'):null;
        const loops=integer(plan.loops||1,1,10000,'循环次数');
        const totalPoints=x.points*x.repeats*(p?p.points*p.repeats:1)*loops;
        if(!Number.isSafeInteger(totalPoints)||totalPoints>1000000)
          throw Error('网页演示最多预览 100 万个规划点');
        return {ok:true,plan:{kind:input.kind,loops,xSweep:x,
          pSweep:p?{points:p.points*p.repeats,repeats:p.repeats}:null,
          totalPoints,hardwareCapabilityStatus:'unverified'},
          demoOnly:true,hardwareVerified:false};
      }
      return failure('网页预览仅提供 Xsweep/Psweep 点数估算');
    }catch(error){return failure(error.message);}
  }
  function previewWave(input) {
    try {
      const lines=String(input.text||'').split(/\r?\n/).map(line=>line.trim()).filter(line=>line&&!line.startsWith('#'));
      if(lines.length<2||lines.length>2000)throw Error('波形预览要求 2–2000 行');
      const preview=lines.map(line=>{
        const [time,voltage]=line.split(/[,;\s]+/).map(Number);
        if(!Number.isFinite(time)||!Number.isFinite(voltage)||time<0||Math.abs(voltage)>210)
          throw Error('波形时间或电压格式无效');
        return {timeS:time,voltageV:voltage};
      });
      for(let i=1;i<preview.length;i++)if(preview[i].timeS<=preview[i-1].timeS)
        throw Error('时间必须严格递增');
      const intervals=preview.slice(1).map((point,i)=>point.timeS-preview[i].timeS);
      const values=preview.map(point=>Math.abs(point.voltageV));
      const maxVoltageV=Math.max(...values);
      return {ok:true,count:preview.length,durationS:preview.at(-1).timeS-preview[0].timeS,
        minimumStepS:Math.min(...intervals),maximumStepS:Math.max(...intervals),
        sourceType:input.sourceType||'smu',rangeV:Number(input.rangeV)||0,
        loadOhms:Number(input.loadOhms)||0,maxCurrentA:0,maxVoltageV,
        preview,executable:false,hardwareVerified:false,demoOnly:true};
    }catch(error){return failure(error.message);}
  }
  function loadStoredWorkspace() {
    try{
      const saved=sessionStorage.getItem(STORAGE_KEY);
      if(saved)return JSON.parse(saved);
    }catch{}
    return memoryWorkspace;
  }
  function saveWorkspace(snapshot) {
    const value=JSON.stringify(snapshot);
    if(value.length>1000000)return failure('演示工作区数据过大');
    memoryWorkspace=snapshot;
    try{sessionStorage.setItem(STORAGE_KEY,value);}catch{}
    return {ok:true,saved:true};
  }
  const client=Object.freeze({
    isDemo:true,
    nativeVersion:async()=>packageVersion,
    status:async()=>({...status}),
    loadWorkspace:async()=>({ok:true,workspace:loadStoredWorkspace()}),
    checkUiUpdate:async()=>({ok:true}),
    uiUpdateStatus:async()=>({status:'current'}),
    post:async(route,body={})=>{
      switch(route) {
        case '/api/status':return {...status};
        case '/api/connect':return {...status};
        case '/api/modules/inspect':return {...status};
        case '/api/disconnect':return {...status};
        case '/api/workspaces':return saveWorkspace(body.workspace);
        case '/api/plan/validate':return previewPlan(body);
        case '/api/waveform/validate':return previewWave(body);
        case '/api/measurement/start':return failure('网页 UI Demo 禁止仪器输出');
        case '/api/measurement/stop':return failure('网页 UI Demo 不存在测量会话');
        case '/api/measurement/status':return {ok:true,state:'unsupported',running:false,rows:[],totalRows:0};
        case '/api/ui/check':return {ok:true,updated:false,status:'disabled'};
        default:return failure('网页 UI Demo 不支持该接口');
      }
    }
  });
  window.DKTSClient=client;
  window.DKTSWebDemo=Object.freeze({enabled:true,hardwareOutput:false,rawSamples:false});
  document.documentElement.dataset.dktsWebDemo='true';
  function relabelStatus() {
    const node=document.getElementById('plan-status');
    if(node&&node.textContent.includes('方案校验通过'))
      node.textContent=node.textContent.replace('方案校验通过','网页演示估算，未进行硬件安全校验');
    const footer=document.getElementById('status-message-text');
    if(footer&&footer.textContent.includes('方案校验通过'))
      footer.textContent=footer.textContent.replace('方案校验通过','网页演示估算（非硬件校验）');
  }
  window.addEventListener('DOMContentLoaded',()=>{
    const node=document.getElementById('plan-status');
    const footer=document.getElementById('status-message-text');
    if(typeof MutationObserver==='function'){
      const observer=new MutationObserver(relabelStatus);
      for(const el of [node,footer])if(el)observer.observe(el,{childList:true,characterData:true,subtree:true});
    }
    relabelStatus();
  });
})();