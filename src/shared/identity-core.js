(() => {
  'use strict';
  function isIPv4(input){
    const parts=String(input).split('.');
    return parts.length===4&&parts.every(p=>/^\d{1,3}$/.test(p)&&Number(p)<=255);
  }
  
  function integer(value,fallback,min,max,label){
    const n=value===undefined||value===''?fallback:Number(value);
    if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(label+' 必须是 '+min+' 至 '+max+' 的整数');
    return n;
  }
  function normalizeSettings(input={}){
    const host=String(input.host||'169.254.111.118').trim();
    if(!host||host.length>253||/[\s\/\\]/.test(host))throw Error('仪器地址无效');
    const port=integer(input.port,1225,1,65535,'TCP 端口');
    const timeoutMs=integer(input.timeoutMs,5000,250,30000,'超时时间');
    const networkMode=String(input.networkMode||'auto').trim().toLowerCase();
    if(!['auto','ethernet','wifi','interface'].includes(networkMode))throw Error('不支持的网络连接方式');
    const interfaceName=String(input.interfaceName||'').trim();
    if(networkMode==='interface'&&!interfaceName)throw Error('指定网卡模式必须填写网卡名称');
    const localAddress=String(input.localAddress||'').trim();
    if(localAddress&&!isIPv4(localAddress))throw Error('本地 IP 必须是 IPv4 地址');
    const expectedSerial=String(input.expectedSerial??'1498377').trim();
    if(expectedSerial.length>128)throw Error('序列号过长');
    return Object.freeze({host,port,timeoutMs,networkMode,interfaceName,localAddress,expectedSerial});
  }
  function summarizeError(error){
    const s=String(error?.message||error||'未知错误');
    if(/ECONNREFUSED|refused/i.test(s))return '仪器拒绝连接，请检查 KXCI 服务和端口';
    if(/timeout|ETIMEDOUT/i.test(s))return '连接超时，请检查网线、地址与路由';
    if(/ENETUNREACH|EHOSTUNREACH|route/i.test(s))return '网络不可达，请检查网卡与仪器地址';
    if(/序列号不匹配/.test(s))return '设备序列号与设置不符';
    if(/身份不匹配/.test(s))return '设备不是预期的 Keithley 4200A';
    return s.split('\n')[0].slice(0,110);
  }
  function createIdentityController(tcp,protocol){
    if(!tcp||typeof tcp.open!=='function'||typeof tcp.exchange!=='function'||typeof tcp.close!=='function')
      throw Error('必须提供宿主 TCP open/exchange/close 适配器');
    if(!protocol||typeof protocol.parseIdentity!=='function'||protocol.IDN_REQUEST!=='*IDN?\0')
      throw Error('缺少已验证的 KXCI 身份协议');
    let connection=null,phase='disconnected',identity=null,diagnostic='',settings=null,pending=null;
    let inventory=null,inventoryError='',inventoryPending=null;
    function status(){return {phase,identity,inventory,inventoryError,route:connection?{
      localAddress:connection.localAddress,remoteAddress:connection.remoteAddress,
      remotePort:connection.remotePort,interfaceName:connection.interfaceName,
      routeStrategy:connection.routeStrategy
    }:null,summary:phase==='connected'?'4200A 已识别':phase==='connecting'?'正在连接':phase==='error'?summarizeError(diagnostic):'未连接',diagnostic};}
    async function closeCurrent(){
      const id=connection?.sessionId;
      connection=null;identity=null;inventory=null;inventoryError='';
      if(id)await tcp.close({sessionId:id}).catch(()=>{});
    }
    async function connect(payload={}){
      // Duplicate page-open/auto-connect probes share the same promise.
      if(pending)return pending;
      const task=(async()=>{
        const next=normalizeSettings(payload);
        if(phase==='connected'&&settings&&JSON.stringify(settings)===JSON.stringify(next))return status();
        await closeCurrent();
        settings=next;phase='connecting';diagnostic='';
        let opened=null;
        try{
          opened=await tcp.open({
            host:next.host,port:next.port,networkMode:next.networkMode,
            interfaceName:next.interfaceName,localAddress:next.localAddress,
            connectTimeoutMs:next.timeoutMs,
            preferLinkLocalEthernet:next.networkMode==='auto'&&next.host.startsWith('169.254.')
          });
          // Hardware command allowlist: exactly one read-only identity query.
          const reply=await tcp.exchange({
            sessionId:opened.sessionId,
            base64:btoa(protocol.IDN_REQUEST),
            readTimeoutMs:next.timeoutMs,idleTimeoutMs:120,maxBytes:8192
          });
          const found=protocol.parseIdentity(atob(reply.base64),next.expectedSerial);
          connection=opened;identity=found;phase='connected';diagnostic='';
          return status();
        }catch(e){
          if(opened)await tcp.close({sessionId:opened.sessionId}).catch(()=>{});
          connection=null;identity=null;phase='error';diagnostic=String(e?.message||e);
          throw e;
        }
      })();
      pending=task;
      try{return await task;}finally{if(pending===task)pending=null;}
    }
    async function inspectModules(){
      if(pending)await pending;
      if(!connection||!identity||phase!=='connected')throw Error('必须先验证 4200A 仪器身份');
      if(inventory)return status();
      if(inventoryPending)return inventoryPending;
      if(protocol.OPTIONS_REQUEST!=='*OPT?\0'||typeof protocol.parseOptions!=='function')
        throw Error('不支持模块查询的 KXCI 版本');
      const targetId=connection.sessionId;
      const request=(async()=>{
        const exchangeText=async(command,maxBytes=8192)=>{
          if(connection?.sessionId!==targetId)throw Error('连接已切换，硬件查询已作废');
          const response=await tcp.exchange({
            sessionId:targetId,base64:btoa(command),
            readTimeoutMs:settings?.timeoutMs||5000,idleTimeoutMs:120,maxBytes
          });
          return atob(response.base64||'').replace(/\0+$/g,'').trim();
        };
        try{
          // Native KXCI *OPT? is the first, read-only inventory source.
          const response=await tcp.exchange({
            sessionId:targetId,base64:btoa(protocol.OPTIONS_REQUEST),
            readTimeoutMs:settings?.timeoutMs||5000,idleTimeoutMs:120,maxBytes:4096
          });
          if(connection?.sessionId!==targetId)throw Error('连接已切换，模块查询已作废');
          const base=protocol.parseOptions(atob(response.base64));
          let instrumentRaw='',remoteRaw='',systemRaw='',restoreError='';
          let enteredUserLibrary=false;
          try{
            // SystemUtil functions are read-only. UL/US are fixed KXCI mode
            // transitions; no user-supplied command or output command is sent.
            await exchangeText(protocol.USER_LIBRARY_REQUEST,2048);
            enteredUserLibrary=true;
            try{
              await exchangeText(protocol.INSTRUMENT_INFO_REQUEST,4096);
              instrumentRaw=await exchangeText(protocol.GET_RESULT_REQUEST,8192);
            }catch(error){inventoryError='instrumentinfo: '+String(error?.message||error).slice(0,180);}
            try{
              await exchangeText(protocol.REMOTE_MODULE_INFO_REQUEST,4096);
              remoteRaw=await exchangeText(protocol.GET_RESULT_REQUEST,8192);
            }catch(error){
              inventoryError=(inventoryError?inventoryError+'; ':'')+'remotemoduleinfo: '+String(error?.message||error).slice(0,180);
            }
            try{
              await exchangeText(protocol.SYSTEM_INFO_REQUEST,4096);
              systemRaw=await exchangeText(protocol.GET_RESULT_REQUEST,4096);
            }catch(error){
              inventoryError=(inventoryError?inventoryError+'; ':'')+'systeminfo: '+String(error?.message||error).slice(0,120);
            }
          }finally{
            if(enteredUserLibrary){
              try{await exchangeText(protocol.USER_MODE_REQUEST,2048);}
              catch(error){restoreError=String(error?.message||error).slice(0,180);}
            }
          }
          if(restoreError){
            const reason='无法将 KXCI 恢复到正常用户模式：'+restoreError;
            await closeCurrent();phase='error';diagnostic=reason;inventoryError=reason;
            return status();
          }
          let instrumentInfo=[],remoteModules=[],systemInfo=null;
          try{if(instrumentRaw)instrumentInfo=protocol.parseInfoRecords(instrumentRaw);}catch(e){
            inventoryError=(inventoryError?inventoryError+'; ':'')+'instrumentinfo parse: '+String(e.message||e).slice(0,120);
          }
          try{if(remoteRaw)remoteModules=protocol.parseRemoteModules(remoteRaw);}catch(e){
            inventoryError=(inventoryError?inventoryError+'; ':'')+'remotemoduleinfo parse: '+String(e.message||e).slice(0,120);
          }
          try{if(systemRaw)systemInfo=protocol.parseSystemInfo(systemRaw);}catch(e){
            inventoryError=(inventoryError?inventoryError+'; ':'')+'systeminfo parse: '+String(e.message||e).slice(0,120);
          }
          if(instrumentInfo.length||remoteModules.length){
            inventory=protocol.enrichInventory(base,instrumentInfo,remoteModules,systemInfo);
          }else{
            inventory={...base,detailedInventoryAvailable:false,
              detailedInventoryError:inventoryError||'SystemUtil 详细模块信息不可用'};
          }
          return status();
        }catch(error){
          inventoryError=String(error?.message||error).slice(0,300);
          if(/timeout|closed|econnreset|unavailable|not connected/i.test(inventoryError)){
            const reason=inventoryError;
            await closeCurrent();phase='error';diagnostic='模块查询失败，原连接可能已关闭：'+reason;
            inventoryError=reason;
          }
          return status();
        }
      })();
      inventoryPending=request;
      try{return await request;}finally{if(inventoryPending===request)inventoryPending=null;}
    }
    async function disconnect(){
      if(inventoryPending)await inventoryPending.catch(()=>{});
      if(pending)await pending.catch(()=>{});
      await closeCurrent();
      phase='disconnected';diagnostic='';settings=null;
      return status();
    }
    async function dispose(){await disconnect();tcp.closeAll?.();}
    return Object.freeze({connect,inspectModules,disconnect,status,dispose});
  }
  const api=Object.freeze({createIdentityController,normalizeSettings,summarizeError});
  if(typeof window!=='undefined'&&window.DKDSPluginModules)
    window.DKDSPluginModules.define('com.dkds.keithley-4200','dkts-identity-core',api);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
