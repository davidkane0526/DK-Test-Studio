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
    if(route==='/api/workspaces')return saveWorkspace(payload.workspace);
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
        const value=planner.previewPlan(payload,300,{inventory:controller.status().inventory});
        return {ok:true,plan:value.plan,firstPoints:value.firstPoints,truncated:value.truncated};
      }catch(e){return {ok:false,error:String(e.message||e)};}
    }
    if(route==='/api/waveform/validate'){
      try{
        const value=waveform.parseWaveformText(payload.text,{sourceType:payload.sourceType||'smu',loadOhms:payload.loadOhms});
        return {ok:true,count:value.points.length,durationS:value.durationS,
          minimumStepS:value.minimumStepS,maximumStepS:value.maximumStepS,
          sourceType:value.sourceType,rangeV:value.rangeV,loadOhms:value.loadOhms,maxCurrentA:value.maxCurrentA,maxVoltageV:value.maxVoltageV,
          executable:false,hardwareVerified:false,
          preview:value.points.length<=300?value.points:
            value.points.filter((_,i)=>i%Math.ceil(value.points.length/300)===0)};
      }catch(e){return {ok:false,error:String(e.message||e)};}
    }
    throw Error('未授权的本机接口：'+route);
  }

  // Private app files retain data across UI hot reload and signed APK upgrades.
  // Bounded chunks avoid passing a multi-megabyte JSON object through one WebView bridge call.
  const WORKSPACE_CHUNK_BYTES=32768;
  function toBase64(bytes){
    let binary='';
    for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);
    return btoa(binary);
  }
  async function saveWorkspace(snapshot){
    if(!snapshot||!['dkts.workspace.v1','dkts.workspace.v2'].includes(snapshot.schema)||
       !Array.isArray(snapshot.tabs)||
       (snapshot.schema==='dkts.workspace.v2'&&!Array.isArray(snapshot.archivedTabs)))
      throw Error('工作区数据格式无效');
    const bytes=new TextEncoder().encode(JSON.stringify(snapshot));
    if(bytes.length<1||bytes.length>64*1024*1024)
      throw Error('工作区快照超过 64 MiB 限制');
    const started=await native('workspace-begin',{bytes:bytes.length});
    try{
      for(let offset=0;offset<bytes.length;offset+=WORKSPACE_CHUNK_BYTES){
        const part=bytes.subarray(offset,offset+WORKSPACE_CHUNK_BYTES);
        await native('workspace-append',{
          token:started.token,offset,base64:toBase64(part)
        });
      }
      await native('workspace-commit',{token:started.token});
      return {ok:true,bytes:bytes.length};
    }catch(error){
      try{await native('workspace-abort');}catch{}
      throw error;
    }
  }
  async function loadWorkspace(){
    const info=await native('workspace-info');
    if(!info.exists)return {ok:true,workspace:null};
    if(!Number.isSafeInteger(info.bytes)||info.bytes<1||info.bytes>64*1024*1024)
      throw Error('应用保存的工作区数据大小无效');
    const bytes=new Uint8Array(info.bytes);
    for(let offset=0;offset<bytes.length;offset+=WORKSPACE_CHUNK_BYTES){
      const part=await native('workspace-read',{
        offset,length:Math.min(WORKSPACE_CHUNK_BYTES,bytes.length-offset)
      });
      const binary=atob(part.base64);
      if(binary.length!==part.bytes||part.bytes<=0)
        throw Error('工作区快照读取不完整');
      for(let i=0;i<binary.length;i++)bytes[offset+i]=binary.charCodeAt(i);
    }
    const workspace=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    return {ok:true,workspace};
  }

  window.DKTSClient=Object.freeze({
    post,loadWorkspace,status:()=>Promise.resolve(controller.status()),
    nativeVersion:async()=>String((await native('version')).version||''),
    checkUiUpdate:async()=>native('ui-check'),
    uiUpdateStatus:async()=>native('ui-status'),
    checkAppUpdate:async()=>native('app-update-check'),
    appUpdateStatus:async()=>native('app-update-status'),
    installAppUpdate:async()=>native('app-update-install')
  });
})();
