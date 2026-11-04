(() => {
  'use strict';
  const registry=window.DKDSPluginModules;
  const protocol=registry.require('dkts-kxci');
  const domain=registry.require('dkts-identity-core');
  const planner=registry.require('dkts-plan');
  const waveform=registry.require('dkts-waveform');
  const requests=new Map();
  let sequence=0;
  window.DKTSNativeBridgeResolve=serialized=>{
    let reply;
    try{reply=JSON.parse(serialized);}catch{return;}
    const pending=requests.get(reply.id);
    if(!pending)return;
    requests.delete(reply.id);
    if(reply.ok)pending.resolve(reply.value);
    else pending.reject(Error(String(reply.error||'原生连接请求失败')));
  };
  function native(op,payload={}){
    return new Promise((resolve,reject)=>{
      if(!window.DKTSNative||typeof window.DKTSNative.request!=='function')
        return reject(Error('Android 原生 TCP 组件不可用'));
      const id=++sequence;
      requests.set(id,{resolve,reject});
      try{window.DKTSNative.request(JSON.stringify({id,op,payload}));}
      catch(e){requests.delete(id);reject(e);}
    });
  }
  const tcp=Object.freeze({
    open:data=>native('open',data),
    exchange:data=>native('exchange',data),
    close:async data=>{const reply=await native('close',data);return reply.closed===true;}
  });
  const controller=domain.createIdentityController(tcp,protocol);
  async function post(route,payload={}){
    if(route==='/api/connect'){
      try{return {ok:true,...await controller.connect(payload)};}
      catch(error){return {ok:false,...controller.status(),summary:domain.summarizeError(error)};}
    }
    if(route==='/api/disconnect')return {ok:true,...await controller.disconnect()};
    if(route==='/api/modules/inspect'){
      try{return {ok:true,...await controller.inspectModules()};}
      catch(error){return {ok:false,error:domain.summarizeError(error),...controller.status()};}
    }
    if(route==='/api/plan/validate'){
      try{
        const value=planner.previewPlan(payload,300);
        return {ok:true,plan:value.plan,firstPoints:value.firstPoints,truncated:value.truncated};
      }catch(e){return {ok:false,error:String(e.message||e)};}
    }
    if(route==='/api/waveform/validate'){
      try{
        const value=waveform.parseWaveformText(payload.text);
        return {ok:true,count:value.points.length,durationS:value.durationS,
          minimumStepS:value.minimumStepS,maximumStepS:value.maximumStepS,
          executable:false,hardwareVerified:false,
          preview:value.points.length<=300?value.points:
            value.points.filter((_,i)=>i%Math.ceil(value.points.length/300)===0)};
      }catch(e){return {ok:false,error:String(e.message||e)};}
    }
    throw Error('未授权的本机接口：'+route);
  }
  window.DKTSClient=Object.freeze({
    post,status:()=>Promise.resolve(controller.status()),
    nativeVersion:async()=>String((await native('version')).version||''),
    checkUiUpdate:async()=>native('ui-check'),
    uiUpdateStatus:async()=>native('ui-status')
  });
})();
