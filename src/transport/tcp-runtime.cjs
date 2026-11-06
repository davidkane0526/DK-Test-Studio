'use strict';
// Migrated from DK Data Studio branch 4200. Standalone OS TCP adapter, no DKDS imports.

const net=require('net');
const crypto=require('crypto');
const os=require('os');

function boundedInt(value,fallback,min,max){
  const n=Number(value);
  if(!Number.isFinite(n))return fallback;
  return Math.max(min,Math.min(max,Math.trunc(n)));
}

function resolveLocalAddress(payload={},networkInterfaces=os.networkInterfaces()){
  const explicitAddress=String(payload.localAddress||'').trim();
  if(explicitAddress){
    if(net.isIP(explicitAddress)!==4)throw new Error('Explicit TCP localAddress must be an IPv4 address.');
    return {address:explicitAddress,interfaceName:'',networkMode:'address',routeStrategy:'explicit-local-address'};
  }
  const mode=String(payload.networkMode||'auto').trim().toLowerCase();
  if(!['auto','wifi','ethernet','interface'].includes(mode))throw new Error('Unsupported TCP network mode: '+mode);
  const host=String(payload.host||'').trim();
  const targetLinkLocal=net.isIP(host)===4&&host.startsWith('169.254.');
  const name=String(payload.interfaceName||'').trim();
  if(mode==='interface'&&!name)throw new Error('TCP interfaceName is required in interface mode.');
  const match=(iface)=>{
    if(mode==='interface')return iface.toLowerCase()===name.toLowerCase();
    if(mode==='wifi')return /(wi-?fi|wireless|wlan|wlp[0-9]|无线|無線|airport|802[.]11|^en0$)/i.test(iface);
    return /(ethernet|ether|以太网|乙太網|有线|本地连接|^eth[0-9]|^enp[0-9]|^enx|usb|^en[1-9]$)/i.test(iface);
  };
  const rows=[];
  for(const [iface,addresses] of Object.entries(networkInterfaces)){
    if(mode!=='auto'&&!match(iface))continue;
    for(const row of addresses||[]){
      if((row.family!=='IPv4'&&row.family!==4)||row.internal||net.isIP(row.address)!==4)continue;
      rows.push({address:row.address,interfaceName:iface,networkMode:mode});
    }
  }
  if(mode==='auto'&&!payload.preferLinkLocalEthernet)return {
    address:'',interfaceName:'',networkMode:'auto',routeStrategy:'system-routing'
  };
  const candidates=(mode==='auto'?rows.filter(row=>/(ethernet|ether|以太网|乙太網|有线|本地连接|^eth[0-9]|^enp[0-9]|^enx|usb|^en[1-9]$)/i.test(row.interfaceName)):rows);
  const choices=targetLinkLocal?candidates.filter(row=>row.address.startsWith('169.254.')):candidates.filter(row=>!row.address.startsWith('169.254.'));
  const wifiRoute=targetLinkLocal&&choices.length===0&&
    (mode==='wifi'||mode==='interface'&&/(wi-?fi|wireless|wlan|wlp[0-9]|无线|無線|802[.]11|^en0$)/i.test(name));
  if(targetLinkLocal&&choices.length===0&&!wifiRoute){
    throw new Error('No Ethernet adapter has a 169.254.x.x IPv4 for '+host+
      '. Configure a link-local IPv4 (/16) on the intended adapter without a default gateway, then retry.');
  }
  if(!targetLinkLocal&&candidates.length===0){
    if(mode==='auto')return {address:'',interfaceName:'',networkMode:mode,routeStrategy:'system-routing'};
    throw new Error('No IPv4 address found for TCP '+mode+(name?' interface '+name:'')+'.');
  }
  const selected=choices.length?choices:candidates;
  const adapters=new Set(selected.map(row=>row.interfaceName.toLowerCase()));
  if(adapters.size>1){
    throw new Error('Several '+mode+' adapters match '+host+': '+
      [...adapters].join(', ')+'. Select Specific interface to avoid routing via the wrong cable.');
  }
  return {...selected[0],routeStrategy:wifiRoute?'wifi-route-required':'local-address-bound'};
}


function resolveLocalCandidates(payload={},networkInterfaces=os.networkInterfaces()){
  const explicitAddress=String(payload.localAddress||'').trim();
  if(explicitAddress){
    if(net.isIP(explicitAddress)!==4)throw new Error('Explicit TCP localAddress must be an IPv4 address.');
    return [{address:explicitAddress,interfaceName:'',networkMode:'address',routeStrategy:'explicit-local-address'}];
  }
  const mode=String(payload.networkMode||'auto').trim().toLowerCase();
  if(!['auto','wifi','ethernet','interface'].includes(mode))throw new Error('Unsupported TCP network mode: '+mode);
  const host=String(payload.host||'').trim();
  const targetLinkLocal=net.isIP(host)===4&&host.startsWith('169.254.');
  const name=String(payload.interfaceName||'').trim();
  if(mode==='interface'&&!name)throw new Error('TCP interfaceName is required in interface mode.');
  const ethernetName=iface=>/(ethernet|ether|以太网|乙太網|有线|本地连接|^eth[0-9]|^enp[0-9]|^enx|usb|^en[1-9]$)/i.test(iface);
  const wifiName=iface=>/(wi-?fi|wireless|wlan|wlp[0-9]|无线|無線|airport|802[.]11|^en0$)/i.test(iface);
  const rows=[];
  for(const [iface,addresses] of Object.entries(networkInterfaces)){
    const lower=iface.toLowerCase();
    const matches=mode==='auto'||mode==='interface'&&lower===name.toLowerCase()||
      mode==='ethernet'&&ethernetName(iface)||mode==='wifi'&&wifiName(iface);
    if(!matches)continue;
    for(const row of addresses||[]){
      if((row.family!=='IPv4'&&row.family!==4)||row.internal||net.isIP(row.address)!==4)continue;
      const linkLocal=row.address.startsWith('169.254.');
      rows.push({address:row.address,interfaceName:iface,networkMode:mode,
        routeStrategy:targetLinkLocal&&!linkLocal&&wifiName(iface)?'wifi-route-required':'local-address-bound',
        linkLocal,ethernet:ethernetName(iface),wifi:wifiName(iface)});
    }
  }
  const byPriority=(a,b)=>(Number(b.linkLocal)-Number(a.linkLocal))||
    (Number(b.ethernet)-Number(a.ethernet))||
    (Number(b.wifi)-Number(a.wifi));
  rows.sort(byPriority);
  let selected=rows;
  const system={address:'',interfaceName:'',networkMode:'auto',routeStrategy:'system-routing'};
  const systemFirst=mode==='auto'&&!targetLinkLocal&&!payload.preferLinkLocalEthernet;
  if(systemFirst){
    // Try the OS-selected route first for ordinary routed targets, then
    // explicitly bind each visible adapter if the OS route does not connect.
    selected=rows;
  }else if(mode==='auto'&&targetLinkLocal&&payload.preferLinkLocalEthernet){
    // All Ethernet link-local addresses first, then Wi-Fi/other source addresses
    // for networks with an explicit host route, then the OS route as last resort.
    selected=rows;
  }
  const candidates=selected.slice(0,16).map(({linkLocal,ethernet,wifi,...row})=>row);
  if(mode==='auto'&&systemFirst)candidates.unshift(system);
  else if(mode==='auto')candidates.push(system);
  if(!candidates.length&&mode==='auto')candidates.push(system);
  return candidates;
}

function createTcpRuntime(options={}){
  const sessions=new Map();
  const readInterfaces=()=>typeof options.networkInterfaces==='function'?options.networkInterfaces():options.networkInterfaces||os.networkInterfaces();

  function getSession(id){
    const key=String(id||'').trim();
    const row=sessions.get(key);
    if(!row||row.socket.destroyed)throw new Error('TCP session is unavailable or closed.');
    return row;
  }

  function closeSession(id){
    const key=String(id||'').trim();
    const row=sessions.get(key);
    if(!row)return false;
    sessions.delete(key);
    try{row.socket.destroy();}catch{}
    return true;
  }

  async function open(payload={}){
    const host=String(payload.host||'').trim();
    const port=boundedInt(payload.port,0,1,65535);
    const connectTimeoutMs=boundedInt(payload.connectTimeoutMs,5000,250,120000);
    if(!host)throw new Error('TCP host is required.');
    if(!port)throw new Error('TCP port must be between 1 and 65535.');
    const candidates=resolveLocalCandidates(payload,readInterfaces());
    const failures=[];
    const attemptTimeoutMs=Math.min(1200,Math.max(300,Math.ceil(connectTimeoutMs/Math.max(1,candidates.length))));
    for(const binding of candidates){
      try{
        return await new Promise((resolve,reject)=>{
          const id=crypto.randomUUID();
          const socket=new net.Socket();
          const row={id,socket,busy:false,lastError:''};
          let settled=false;
          const finishError=error=>{
            if(settled)return;
            settled=true;
            clearTimeout(timer);
            try{socket.destroy();}catch{}
            const message=String(error?.message||error||'TCP connect failed.');
            const note=(binding.address&&host.startsWith('169.254.'))
              ? ' Bound source '+binding.address+' on '+(binding.interfaceName||'selected interface')+
                '; verify the OS host route and cable/link state for '+host+'.' : '';
            reject(new Error(message+note));
          };
          const timer=setTimeout(()=>finishError(new Error('TCP connect timeout after '+attemptTimeoutMs+' ms.')),attemptTimeoutMs);
          socket.setNoDelay(true);
          socket.once('error',finishError);
          socket.once('connect',()=>{
            if(settled)return;
            settled=true;
            clearTimeout(timer);
            socket.removeListener('error',finishError);
            sessions.set(id,row);
            socket.on('error',error=>{row.lastError=String(error?.message||error||'TCP socket error');});
            socket.on('close',()=>sessions.delete(id));
            resolve({
              sessionId:id,
              localAddress:socket.localAddress||'',
              localPort:Number(socket.localPort)||0,
              remoteAddress:socket.remoteAddress||host,
              remotePort:Number(socket.remotePort)||port,
              interfaceName:binding.interfaceName,
              networkMode:binding.networkMode,
              routeStrategy:binding.routeStrategy
            });
          });
          socket.connect({host,port,...(binding.address?{localAddress:binding.address}:{})});
        });
      }catch(error){
        failures.push((binding.interfaceName||binding.routeStrategy)+
          (binding.address?' ['+binding.address+']':'')+': '+String(error?.message||error));
      }
    }
    throw new Error('TCP connection failed after trying '+candidates.length+
      ' available network paths ('+failures.join(' | ')+').');
  }

  async function exchange(payload={}){
    const row=getSession(payload.sessionId);
    if(row.busy)throw new Error('TCP session already has an active exchange.');
    const write=Buffer.from(String(payload.base64||''),'base64');
    const readTimeoutMs=boundedInt(payload.readTimeoutMs,5000,250,120000);
    const idleTimeoutMs=boundedInt(payload.idleTimeoutMs,120,20,10000);
    const maxBytes=boundedInt(payload.maxBytes,65536,1,8*1024*1024);
    const noReply=payload.noReply===true;
    if(noReply){
      const raw=write.toString('ascii');
      if(!raw.endsWith('\0')||raw.slice(0,-1).includes('\0')||
         !/^(?:UL|DE|US|:ERROR:LAST:CLEAR|DV[1-9](?:,0,[^,]+,[^,]+)?|RI [1-9],[^,]+,[^,]+|RG [1-9],[^,]+)$/.test(raw.slice(0,-1)))
        throw new Error('Write-only TCP is restricted to allowlisted KXCI commands.');
    }
    if(write.length>1024*1024)throw new Error('TCP write exceeds the 1 MiB safety limit.');

    row.busy=true;
    return await new Promise((resolve,reject)=>{
      const socket=row.socket;
      const chunks=[];
      let total=0,done=false,idleTimer=null,readTimer=null;
      const cleanup=()=>{
        if(readTimer)clearTimeout(readTimer);
        if(idleTimer)clearTimeout(idleTimer);
        socket.removeListener('data',onData);
        socket.removeListener('error',onError);
        socket.removeListener('close',onClose);
        row.busy=false;
      };
      const finishOk=()=>{
        if(done)return;
        done=true;cleanup();
        const bytes=Buffer.concat(chunks,total);
        resolve({base64:bytes.toString('base64'),bytesRead:bytes.length});
      };
      const finishError=error=>{
        if(done)return;
        done=true;cleanup();
        closeSession(row.id);
        reject(error instanceof Error?error:new Error(String(error||'TCP exchange failed.')));
      };
      const armIdle=()=>{
        if(idleTimer)clearTimeout(idleTimer);
        idleTimer=setTimeout(finishOk,idleTimeoutMs);
      };
      const onData=chunk=>{
        if(done)return;
        const data=Buffer.from(chunk);
        if(total+data.length>maxBytes){
          closeSession(row.id);
          finishError(new Error('TCP response exceeded '+maxBytes+' bytes; session closed.'));
          return;
        }
        chunks.push(data);total+=data.length;armIdle();
      };
      const onError=error=>finishError(error);
      const onClose=()=>{if(total>0)finishOk();else finishError(new Error('TCP session closed before a response was received.'));};

      if(!noReply){
        readTimer=setTimeout(()=>{
          if(total>0)return finishOk();
          closeSession(row.id);
          finishError(new Error('TCP read timeout after '+readTimeoutMs+' ms; session closed to prevent late-response contamination.'));
        },readTimeoutMs);
        socket.on('data',onData);
      }
      socket.once('error',onError);
      socket.once('close',onClose);
      socket.write(write,error=>{if(error)finishError(error);else if(noReply)finishOk();});
    });
  }

  async function close(payload={}){return closeSession(payload.sessionId);}
  function closeAll(){for(const id of [...sessions.keys()])closeSession(id);}

  return Object.freeze({open,exchange,close,closeAll});
}

module.exports={createTcpRuntime,resolveLocalAddress,resolveLocalCandidates};
