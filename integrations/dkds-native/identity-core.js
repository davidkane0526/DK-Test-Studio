(() => {
  'use strict';
  function isIPv4(input){const parts=String(input).split('.');return parts.length===4&&parts.every(p=>/^\d{1,3}$/.test(p)&&Number(p)<=255);}
  function integer(value,fallback,min,max,label){const n=value===undefined||value===''?fallback:Number(value);if(!Number.isSafeInteger(n)||n<min||n>max)throw Error(label+' 必须是 '+min+' 至 '+max+' 的整数');return n;}
  function normalizeSettings(input={}){
    const host=String(input.host??'').trim();
    if(!host||host.length>253||/[\s\/\\]/.test(host))throw Error('仪器地址无效');
    const port=integer(input.port,1225,1,65535,'TCP 端口'),timeoutMs=integer(input.timeoutMs,5000,250,30000,'超时时间');
    const networkMode=String(input.networkMode||'auto').trim().toLowerCase();
    if(!['auto','ethernet','wifi','interface'].includes(networkMode))throw Error('不支持的网络连接方式');
    const interfaceName=String(input.interfaceName||'').trim();if(networkMode==='interface'&&!interfaceName)throw Error('指定网卡模式必须填写网卡名称');
    const localAddress=String(input.localAddress||'').trim();if(localAddress&&!isIPv4(localAddress))throw Error('本地 IP 必须是 IPv4 地址');
    const expectedSerial=String(input.expectedSerial??'').trim();if(expectedSerial.length>128)throw Error('序列号过长');
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
  function decodeKxciFrame(base64){
    const frame=atob(base64||'');
    if(!frame.endsWith('\0')||frame.slice(0,-1).includes('\0'))throw Error('KXCI 响应不是单个完整 NUL 帧');
    return frame.slice(0,-1).trim();
  }
  function createIdentityController(tcp,protocol){
    if(!tcp||typeof tcp.open!=='function'||typeof tcp.exchange!=='function'||typeof tcp.close!=='function')throw Error('必须提供宿主 TCP open/exchange/close 适配器');
    if(!protocol||typeof protocol.parseIdentity!=='function'||protocol.IDN_REQUEST!=='*IDN?\0')throw Error('缺少已验证的 KXCI 身份协议');
    let connection=null,phase='disconnected',identity=null,diagnostic='',settings=null,pending=null,inventory=null,inventoryError='',inventoryPending=null,verificationPending=null;
    function status(){return {phase,sessionId:connection?.sessionId||'',identity,inventory,inventoryError,inventoryPending:Boolean(inventoryPending),verificationPending:Boolean(verificationPending),route:connection?{localAddress:connection.localAddress,remoteAddress:connection.remoteAddress,remotePort:connection.remotePort,interfaceName:connection.interfaceName,routeStrategy:connection.routeStrategy}:null,summary:phase==='connected'?'4200A 已识别':phase==='connecting'?'正在连接':phase==='error'?summarizeError(diagnostic):'未连接',diagnostic};}
    async function closeCurrent(){const id=connection?.sessionId;connection=null;identity=null;inventory=null;inventoryError='';if(id)await tcp.close({sessionId:id}).catch(()=>{});}
    async function connect(payload={},reuseSessionId=''){
      if(pending)return pending;
      const task=(async()=>{
        const next=normalizeSettings(payload);
        if(phase==='connected'&&(!reuseSessionId||reuseSessionId===connection?.sessionId)&&
            settings&&JSON.stringify(settings)===JSON.stringify(next))return status();
        if(inventoryPending)await inventoryPending;
        if(verificationPending)await verificationPending;
        await closeCurrent();settings=next;phase='connecting';diagnostic='';
        let opened=null,receivedIdentity=false;
        try{
          opened=await tcp.open({host:next.host,port:next.port,networkMode:next.networkMode,interfaceName:next.interfaceName,localAddress:next.localAddress,connectTimeoutMs:next.timeoutMs,preferLinkLocalEthernet:next.networkMode==='auto'&&next.host.startsWith('169.254.')},reuseSessionId);
          const reply=await tcp.exchange({sessionId:opened.sessionId,base64:btoa(protocol.IDN_REQUEST),responseTerminator:'nul',readTimeoutMs:next.timeoutMs,idleTimeoutMs:120,maxBytes:8192});
          receivedIdentity=true;
          const found=protocol.parseIdentity(decodeKxciFrame(reply.base64),next.expectedSerial);
          connection=opened;identity=found;phase='connected';diagnostic='';return status();
        }catch(e){
          if(opened){
            if(receivedIdentity&&reuseSessionId&&tcp.release)
              await tcp.release({sessionId:opened.sessionId}).catch(()=>{});
            else await tcp.close({sessionId:opened.sessionId}).catch(()=>{});
          }
          connection=null;identity=null;phase='error';diagnostic=String(e?.message||e);throw e;
        }
      })();pending=task;try{return await task;}finally{if(pending===task)pending=null;}
    }
    async function inspectModules({refresh=false}={}){
      if(pending)await pending;
      if(verificationPending)await verificationPending;
      if(!connection||!identity||phase!=='connected')throw Error('必须先验证 4200A 仪器身份');
      if(inventoryPending)return inventoryPending;
      if(!refresh&&inventory&&!inventoryError)return status();
      const required=['OPTIONS_REQUEST','UL_REQUEST','INSTRUMENT_INFO_REQUEST','REMOTE_MODULE_INFO_REQUEST','GN_RESULT_REQUEST','DE_REQUEST'];
      if(required.some(name=>!protocol[name])||typeof protocol.parseOptions!=='function'||typeof protocol.parseHardwareInventory!=='function')throw Error('当前 KXCI 协议不支持物理模块信息查询');
      const targetId=connection.sessionId;
      const request=(async()=>{
        const send=async(command,maxBytes=8192,expectData=true)=>{
          // KXCI Ethernet always replies. Commands which have no textual result
          // return ACK\0; draining it here prevents stale ACK bytes from being
          // mistaken for the next GN result or TI measurement.
          const response=await tcp.exchange({sessionId:targetId,base64:btoa(command),responseTerminator:'nul',
            readTimeoutMs:settings?.timeoutMs||5000,idleTimeoutMs:expectData?120:30,maxBytes,noReply:false});
          if(connection?.sessionId!==targetId)throw Error('连接已切换，模块查询已作废');
          const raw=decodeKxciFrame(response?.base64);
          if(!expectData&&raw.toUpperCase()!=='ACK')
            throw Error('KXCI 写入命令未收到 ACK：'+command+' / '+(raw||'空响应'));
          return raw;
        };
        let optionsRaw='',logicalInventory=null,enteredUserLibrary=false;
        try{
          optionsRaw=await send(protocol.OPTIONS_REQUEST,4096);logicalInventory=protocol.parseOptions(optionsRaw);
          if(logicalInventory.logicalModules.length===0&&logicalInventory.unknownModules.length>0){
            inventory=logicalInventory;
            inventoryError='配置响应中没有可识别的模块类型，已停止后续模块查询';
            return status();
          }
          enteredUserLibrary=true;await send(protocol.UL_REQUEST,1024,false);
          await send(protocol.INSTRUMENT_INFO_REQUEST,1024);
          const instrumentInfo=await send(protocol.GN_RESULT_REQUEST,8192);
          await send(protocol.REMOTE_MODULE_INFO_REQUEST,1024);
          const remoteModuleInfo=await send(protocol.GN_RESULT_REQUEST,8192);
          const systemResult=await send(protocol.SYSTEM_INFO_REQUEST,1024);
          const systemRaw=/^OK\b|^ACK$/i.test(systemResult)?await send(protocol.GN_RESULT_REQUEST,8192):systemResult;
          await send(protocol.DE_REQUEST,1024,false);enteredUserLibrary=false;
          const parsed=protocol.parseHardwareInventory(optionsRaw,instrumentInfo,remoteModuleInfo);
          let systemInfo=null,systemInfoError='';
          try{systemInfo=protocol.parseSystemInfo(systemRaw,identity.serial);}catch(e){systemInfoError=String(e.message||e);if(/序列号不匹配/.test(systemInfoError))throw e;}
          inventory=Object.freeze({...parsed,systemInfo,systemInfoError,ports:Object.freeze(protocol.portCatalog(parsed))});inventoryError='';return status();
        }catch(error){
          let reason=String(error?.message||error).slice(0,300);
          if(enteredUserLibrary&&connection?.sessionId===targetId){try{await send(protocol.DE_REQUEST,1024,false);enteredUserLibrary=false;}catch(restoreError){reason+='；恢复 KXCI 系统模式失败：'+String(restoreError?.message||restoreError).slice(0,120);}}
          inventory=logicalInventory;inventoryError='物理模块型号/PA/RPM 信息读取失败：'+reason;
          if(/timeout|closed|econnreset|unavailable|not connected/i.test(reason)){await closeCurrent();phase='error';diagnostic='模块查询失败，原连接可能已关闭：'+reason;}
          return status();
        }
      })();inventoryPending=request;try{return await request;}finally{if(inventoryPending===request)inventoryPending=null;}
    }
    async function verifyLiveConnection(){
      if(verificationPending)return verificationPending;
      if(pending||inventoryPending||phase!=='connected'||!connection)return status();
      const id=connection.sessionId;
      const request=(async()=>{
        try{
          const answer=await tcp.exchange({sessionId:id,base64:btoa(protocol.IDN_REQUEST),responseTerminator:'nul',
            readTimeoutMs:settings.timeoutMs,idleTimeoutMs:120,maxBytes:8192});
          protocol.parseIdentity(decodeKxciFrame(answer.base64),identity.serial);
        }catch(error){
          await closeCurrent();
          phase='error';diagnostic='连接已失效：'+String(error?.message||error);
        }
      })();
      verificationPending=request;
      try{await request;}finally{if(verificationPending===request)verificationPending=null;}
      return status();
    }
    // Internal measurement-only path. UI receives no raw-command endpoint.
    const trace=[];
    let systemProgram=null;
    function beginSystemProgram(program){
      if(systemProgram)throw Error('已有 System Mode 任务');
      const reads=new Set(program.reads);
      if(program.rpmRoutes?.length)reads.add(':PMU:TEST:STATUS?');
      const pulseChannels=program.pulseChannel?(program.channels||[program]):[];
      systemProgram={
        commands:new Set([...program.setup,...reads,...program.cleanup,'ME1','SP',':ERROR:LAST:CLEAR',':ERROR:LAST:GET']),
        reads,rdNames:new Set(program.rdNames),count:program.count,
        pulseFields:new Map(pulseChannels.map(channel=>[channel.pulseChannel,channel.fields]))
      };
      if(program.pulseChannel)systemProgram.commands.add(':PMU:EXECUTE');
    }
    function endSystemProgram(){systemProgram=null;}
    // Query-only commissioning probe. Fixed command list from the protocol
    // module; never a UI-supplied string and never a source/measure command.
    let selfTestPending=null;
    async function selfTest(){
      if(selfTestPending)return selfTestPending;
      if(phase!=='connected'||!connection||!identity||pending||inventoryPending||verificationPending)throw Error('必须先验证 4200A 仪器身份');
      if(systemProgram)throw Error('测量进行中，不能执行自检');
      if(!Array.isArray(protocol.SELF_TEST_PLAN)||typeof protocol.assessSelfTest!=='function')throw Error('当前 KXCI 协议不支持自检');
      const id=connection.sessionId;
      const task=(async()=>{
        const entries=[];
        for(const step of protocol.SELF_TEST_PLAN){
          const item={id:step.id,command:step.command,response:'',frameHex:'',error:'',durationMs:0},started=Date.now();
          try{
            const answer=await tcp.exchange({sessionId:id,base64:btoa(step.command+'\0'),responseTerminator:'nul',noReply:false,
              readTimeoutMs:settings?.timeoutMs||5000,idleTimeoutMs:step.reply?120:30,maxBytes:8192});
            if(connection?.sessionId!==id)throw Error('自检期间连接发生变化');
            const frame=atob(answer.base64||'');
            item.frameHex=Array.from(frame,ch=>ch.charCodeAt(0).toString(16).padStart(2,'0')).join(' ');
            item.response=decodeKxciFrame(answer.base64);
          }catch(error){item.error=String(error?.message||error);}
          finally{item.durationMs=Date.now()-started;entries.push(Object.freeze(item));trace.push({command:step.command,sentAt:new Date().toISOString(),response:item.response,error:item.error,durationMs:item.durationMs});if(trace.length>256)trace.shift();}
          if(connection?.sessionId!==id)break;
        }
        const assessment=protocol.assessSelfTest(entries,identity?.serial||'');
        return Object.freeze({...assessment,serial:identity?.serial||'',route:status().route,ranAt:new Date().toISOString(),transport:'raw-tcp-nul',entries:Object.freeze(entries)});
      })();
      selfTestPending=task;try{return await task;}finally{if(selfTestPending===task)selfTestPending=null;}
    }
    function measurementTrace(){return trace.map(x=>({...x}));}
    function clearMeasurementTrace(){trace.length=0;}
    async function measurementExchange(text,expectReply=false){
      if(phase!=='connected'||!connection||!identity||inventoryPending||verificationPending||selfTestPending||
         inventory?.physicalModelsVerified!==true||
         inventory?.hardwareLimitsVerified!==true)
        throw Error('仪器及物理模块尚未完成身份核验');
      const cmd=String(text||'');
      const rd=/^RD '([A-Z0-9]+)',([1-9][0-9]*)$/.exec(cmd);
      const block=/^:PMU:DATA:GET ([1-8]),(0|[1-9][0-9]*),([1-9][0-9]*),([A-Z,]+)$/.exec(cmd);
      const blockAllowed=Boolean(systemProgram&&block&&systemProgram.pulseFields.get(Number(block[1]))===block[4]&&Number(block[3])<=2048&&Number(block[2])+Number(block[3])<=systemProgram.count);
      const systemAllowed=Boolean(systemProgram&&(systemProgram.commands.has(cmd)||blockAllowed||(rd&&systemProgram.rdNames.has(rd[1])&&Number(rd[2])<=systemProgram.count)));
      const systemRead=Boolean(systemAllowed&&(systemProgram.reads.has(cmd)||rd||blockAllowed));
      const n='(?:0|[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[Ee][+-]?\\d+)?)';
      const dv=new RegExp('^DV([1-9]),0,('+n+'),('+n+')$').exec(cmd);
      const ri=new RegExp('^RI ([1-9]),('+n+'),('+n+')$').exec(cmd);
      const rg=new RegExp('^RG ([1-9]),('+n+')$').exec(cmd);
      if(dv&&!(Math.abs(Number(dv[2]))<=210&&Number(dv[3])>0&&Number(dv[3])<=1.05))
        throw Error('KXCI DV 指令值越过绝对硬件边界');
      if(ri&&!(Number(ri[2])>0&&Number(ri[2])<=0.1&&Number(ri[3])>0&&Number(ri[3])<=1.05))
        throw Error('KXCI RI 参数越界');
      if(rg&&!(Number(rg[2])>0&&Number(rg[2])<=1))
        throw Error('KXCI RG 参数越界');
      if(!systemAllowed&&!['US','DE','EM 1,0','BC','SP',':ERROR:LAST:CLEAR',':ERROR:LAST:GET'].includes(cmd)&&
         !/^DV[1-9]$/.test(cmd)&&!/^TI[1-9]$/.test(cmd)&&!/^TV(?:[1-4]|[7-9]|10)$/.test(cmd)&&!/^IT[123]$/.test(cmd)&&!dv&&!ri&&!rg)
        throw Error('禁止非测量白名单 KXCI 指令');
      if(expectReply&&!(systemRead||/^TI[1-9]$/.test(cmd)||/^TV(?:[1-4]|[7-9]|10)$/.test(cmd)||['SP',':ERROR:LAST:GET'].includes(cmd)))
        throw Error('此 KXCI 指令没有测量响应');
      if(!expectReply&&(systemRead||/^TI[1-9]$/.test(cmd)||/^TV(?:[1-4]|[7-9]|10)$/.test(cmd)||['SP',':ERROR:LAST:GET'].includes(cmd)))
        throw Error('数据查询不能丢弃响应');
      const id=connection.sessionId;
      // Ethernet KXCI returns one NUL-terminated response for every command.
      // Always consume it; otherwise ACK from DV/US/RI/RG can poison the next TI.
      const item={command:cmd,sentAt:new Date().toISOString(),response:'',error:'',durationMs:0},started=Date.now();
      try{
       const answer=await tcp.exchange({sessionId:id,base64:btoa(cmd+'\0'),responseTerminator:'nul',
         noReply:false,readTimeoutMs:settings?.timeoutMs||5000,idleTimeoutMs:expectReply?120:30,maxBytes:systemRead?262144:8192});
       const frame=atob(answer.base64||'');item.response=frame;
       if(connection?.sessionId!==id)throw Error('测量期间仪器连接发生变化');
       const raw=decodeKxciFrame(answer.base64);
       if(expectReply){
        if(cmd!==':ERROR:LAST:GET'&&(raw.toUpperCase()==='ACK'||!raw&&!blockAllowed))throw Error('查询未返回数据');
        return raw;
       }
       if(raw.toUpperCase()!=='ACK')throw Error('未收到 ACK：'+raw);
       return '';
      }catch(error){item.error=String(error?.message||error);throw Error(cmd+'：'+item.error);}
      finally{item.durationMs=Date.now()-started;trace.push(item);if(trace.length>256)trace.shift();}
    }
    async function disconnect(){if(inventoryPending)await inventoryPending.catch(()=>{});if(pending)await pending.catch(()=>{});if(verificationPending)await verificationPending.catch(()=>{});await closeCurrent();phase='disconnected';diagnostic='';settings=null;return status();}
    async function dispose(){await disconnect();tcp.closeAll?.();}
    return Object.freeze({connect,inspectModules,verifyLiveConnection,disconnect,status,dispose,measurementExchange,measurementTrace,clearMeasurementTrace,beginSystemProgram,endSystemProgram,selfTest});
  }
  const api=Object.freeze({createIdentityController,normalizeSettings,summarizeError});
  if(typeof window!=='undefined'&&window.DKDSPluginModules)window.DKDSPluginModules.define('com.dkts.keithley-4200','dkts-identity-core',api);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
