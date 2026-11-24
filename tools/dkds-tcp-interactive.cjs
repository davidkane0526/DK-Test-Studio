'use strict';

// Staged into the derived DKTS host's generic communication console.
function createInteractiveTcp(tcp, changed) {
  let session=null,opening=null,closing=null,exchangeBusy=false;
  const current=()=>session?{...session,settings:{...session.settings}}:null;
  const notify=(event,detail=current())=>changed(event,detail);

  async function open(settings,owner=''){
    if(session||opening||closing)throw Error('已有 TCP 会话或连接正在切换，请先断开。');
    const request={...settings};
    let opened;
    opening=Promise.resolve().then(()=>tcp.open(request));
    notify('opening');
    try{
      opened=await opening;
      if(!opened?.sessionId)throw Error('Host 未返回 TCP 会话标识');
      session={...opened,settings:request,owner};
    }catch(error){
      notify('open-failed');
      throw error;
    }finally{opening=null;}
    notify('opened');
    return current();
  }

  function claim({sessionId,owner}){
    if(!owner||session?.sessionId!==sessionId||closing||exchangeBusy)
      throw Error('该 TCP 会话不存在或正在传输。');
    if(session.owner&&session.owner!==owner)throw Error('该 TCP 会话已由其他工作区控制。');
    session.owner=owner;
    notify('claimed');
    return current();
  }

  function release({sessionId,owner}){
    if(!session||session.sessionId!==sessionId||!owner||session.owner!==owner||closing)return false;
    session.owner='';
    notify('released');
    return true;
  }

  async function close({sessionId,owner='',force=false}={}){
    if(closing)return closing;
    if(!session||(sessionId&&sessionId!==session.sessionId))return false;
    if(!force&&session.owner!==owner)throw Error('该 TCP 会话由设备工作区管理。');
    const previous=current();
    closing=Promise.resolve().then(()=>tcp.close({sessionId:previous.sessionId}));
    try{return await closing;}
    finally{
      session=null;
      closing=null;
      notify('closed',previous);
    }
  }

  async function exchange({sessionId,owner='',...payload}){
    if(!session||session.sessionId!==sessionId||session.owner!==owner||exchangeBusy||closing)
      throw Error('当前 TCP 会话无法传输，或正在处理其他请求。');
    exchangeBusy=true;
    try{return await tcp.exchange({...payload,sessionId});}
    finally{exchangeBusy=false;}
  }

  async function dispose(){
    if(opening){try{await opening;}catch{}}
    return close({force:true});
  }

  return {open,current,claim,release,close,exchange,dispose};
}

function patchInteractiveTcp(source){
  const begin="    let tcpSession='',tcpBusy=false;";
  const end='    // ---- SMB file manager';
  const start=source.indexOf(begin),stop=source.indexOf(end,start);
  if(start<0||stop<0||source.indexOf(begin,start+begin.length)!==-1)
    throw Error('Pinned DKDS compatibility mismatch: interactive TCP console');
  const consoleAdapter=`
    let tcpBusy=false,transportOpening=false;
    const tcpState=msg=>{const label=te('dktcpState');if(label)label.textContent=String(msg||'').slice(0,160)};
    const refreshTcpPanel=()=>{
      if(!te('dktcpToggle'))return;
      const session=interactive.current(),managed=Boolean(session?.owner);
      te('dktcpToggle').textContent=session?'断开':'连接';
      te('dktcpToggle').disabled=tcpBusy||transportOpening;
      te('dktcpSend').disabled=tcpBusy||!session||managed;
      for(const name of ['dktcpHost','dktcpPort','dktcpMode','dktcpInterface'])
        te(name).disabled=Boolean(session)||transportOpening;
      if(session){
        const prefs=session.settings;
        te('dktcpHost').value=prefs.host;
        te('dktcpPort').value=String(prefs.port);
        te('dktcpMode').value=prefs.networkMode||'auto';
        te('dktcpInterface').value=prefs.interfaceName||'';
      }
    };
    const interactive=createInteractiveTcp(tcp,(event,session)=>{
      transportOpening=event==='opening';
      refreshTcpPanel();
      if(event==='opening')tcpState('正在连接…');
      else if(event==='open-failed')tcpState('连接失败');
      else if(event==='closed')tcpState('未连接');
      else if(session?.owner)tcpState('TCP 已连接 · 由设备工作区管理');
      else if(session)tcpState('TCP 已连接 · '+String(session.localAddress||session.interfaceName||session.remoteAddress||''));
      ctx.events.emit('communication:interactive-tcp',{event,session});
    });
    ctx.capabilities.register('network.tcp.interactive',{kind:'network.transport',title:'Interactive TCP session',remote:false,
      methods:{
        current:()=>interactive.current(),
        open:({settings,owner})=>interactive.open(settings,owner),
        claim:value=>interactive.claim(value),
        release:value=>interactive.release(value),
        exchange:value=>interactive.exchange(value),
        close:({sessionId,owner})=>interactive.close({sessionId,owner})
      }});
    const openTcp=()=>{refreshTcpPanel();tcpOverlay.classList.remove('hidden');};
    const hideTcp=()=>tcpOverlay.classList.add('hidden');
    dom.on(te('dktcpClose'),'click',hideTcp);
    dom.on(tcpOverlay,'click',event=>{if(event.target===tcpOverlay)hideTcp();});
    dom.on(te('dktcpToggle'),'click',async()=>{
      if(tcpBusy||transportOpening)return;
      tcpBusy=true;
      refreshTcpPanel();
      try{
        const session=interactive.current();
        if(session?.owner){
          ctx.events.emit('communication:interactive-tcp',{event:'disconnect-requested',session});
          return;
        }
        if(session){await interactive.close();return;}
        const host=te('dktcpHost').value.trim(),port=Number(te('dktcpPort').value);
        const networkMode=te('dktcpMode').value,interfaceName=te('dktcpInterface').value.trim();
        if(!host||host.length>253||/[\\s/\\\\]/.test(host))throw Error('目标主机地址不合法');
        if(!Number.isInteger(port)||port<1||port>65535)throw Error('端口必须是 1–65535 的整数');
        if(networkMode==='interface'&&!interfaceName)throw Error('指定接口模式需要填写接口名称');
        await interactive.open({host,port,networkMode,interfaceName,connectTimeoutMs:5000});
      }catch(error){
        transportOpening=false;
        tcpState('连接失败：'+String(error?.message||error));
      }finally{tcpBusy=false;refreshTcpPanel();}
    });
    dom.on(te('dktcpSend'),'click',async()=>{
      if(tcpBusy||!interactive.current()||interactive.current()?.owner)return;
      tcpBusy=true;
      refreshTcpPanel();
      try{
        const base64=te('dktcpPayload').value.trim();
        if(!base64||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))
          throw Error('请提供有效 Base64 原始字节');
        tcpState('正在传输…');
        const result=await interactive.exchange({sessionId:interactive.current().sessionId,
          base64,readTimeoutMs:5000,idleTimeoutMs:120,maxBytes:65536});
        te('dktcpResponse').value=String(result?.base64||'');
        tcpState('收到 '+(Number(result?.bytesRead)||0)+' 字节');
      }catch(error){
        await interactive.close().catch(()=>{});
        tcpState('传输失败：'+String(error?.message||error));
      }finally{tcpBusy=false;refreshTcpPanel();}
    });

`;
  return (source.slice(0,start)+'    '+createInteractiveTcp.toString()+'\n'+consoleAdapter+source.slice(stop))
    .replace("'ui.status-bar','ui.workspace'];", "'ui.status-bar','ui.workspace','events'];")
    .replace('"ui.status-bar","ui.workspace"],"entry"', '"ui.status-bar","ui.workspace","events"],"entry"')
    .replace('"network.interface.generic"]','"network.interface.generic","network.tcp.interactive"]')
    .replace('void closeTcp();tcpOverlay.remove()', 'void interactive.dispose().catch(()=>{});tcpOverlay.remove()');
}

module.exports={createInteractiveTcp,patchInteractiveTcp};
