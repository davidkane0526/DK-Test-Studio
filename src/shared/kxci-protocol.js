(() => {
  'use strict';
  // Only fixed, read-only KXCI and SystemUtil inventory queries are exposed.
  // No user-supplied command string can reach the TCP transport.
  const IDN_REQUEST='*IDN?\0';
  const OPTIONS_REQUEST='*OPT?\0';
  const USER_LIBRARY_REQUEST='UL\0';
  const USER_MODE_REQUEST='US\0';
  const INSTRUMENT_INFO_REQUEST='EX SystemUtil instrumentinfo(,4096,)\0';
  const REMOTE_MODULE_INFO_REQUEST='EX SystemUtil remotemoduleinfo(,4096,)\0';
  const SYSTEM_INFO_REQUEST='EX SystemUtil systeminfo(,2048,)\0';
  const GET_RESULT_REQUEST='GN result\0';
  function parseIdentity(input,expectedSerial=''){
    const raw=String(input||'').replace(/\0+$/g,'').trim();
    const parts=raw.split(',').map(part=>part.trim());
    if(parts[0]!=='KEITHLEY INSTRUMENTS'||parts[1]!=='KI4200A')
      throw Error('仪器身份不匹配：'+(raw||'空响应'));
    if(expectedSerial&&parts[2]!==String(expectedSerial))
      throw Error('序列号不匹配：预期 '+expectedSerial+'，实际 '+(parts[2]||'未知'));
    return Object.freeze({manufacturer:parts[0],model:parts[1],serial:parts[2]||'',version:parts[3]||'',raw});
  }
  function parseOptionToken(part,index){
    const token=String(part||'').trim().toUpperCase();
    if(!token)return {slot:index+1,raw:token,type:'empty',family:'empty',channel:null,powerClass:'unknown',preamplifier:false,rpm:false,ratingsVerified:false};
    let m;
    if((m=/^(HPSMUPA|HPSMU|SMUPA|SMU|CVU|VPU|VS|VM)([1-9])$/.exec(token))){
      const type=m[1],channel=Number(m[2]);
      const family=type.includes('SMU')?'SMU':type==='CVU'?'CVU':type==='VPU'?'PGU':type;
      return {slot:index+1,raw:token,type,family,channel,
        powerClass:type.startsWith('HPSMU')?'high':type==='SMU'||type==='SMUPA'?'medium':'unknown',
        preamplifier:type==='SMUPA'||type==='HPSMUPA',rpm:false,rpmChannels:[],modelKey:null,exactModelVerified:false,ratingsVerified:false};
    }
    if((m=/^PMU([1-9])(?:RPM(1-2|1|2))?$/.exec(token))){
      const channel=Number(m[1]),rpmChannels=m[2]?m[2]==='1-2'?[1,2]:[Number(m[2])]:[];
      return {slot:index+1,raw:token,type:'PMU',family:'PMU',channel,powerClass:'unknown',
        preamplifier:false,rpm:rpmChannels.length>0,rpmChannels,modelKey:'4225-PMU',exactModelVerified:false,ratingsVerified:false};
    }
    if((m=/^PMURPM([1-9])?$/.exec(token))){
      return {slot:index+1,raw:token,type:'PMURPM',family:'PMU',channel:m[1]?Number(m[1]):null,
        powerClass:'unknown',preamplifier:false,rpm:true,rpmChannels:'unknown',modelKey:'4225-PMU',
        exactModelVerified:false,ratingsVerified:false};
    }
    if((m=/^PMU([1-9])$/.exec(token))){
      return {slot:index+1,raw:token,type:'PMU',family:'PMU',channel:Number(m[1]),powerClass:'unknown',
        preamplifier:false,rpm:false,rpmChannels:[],modelKey:'4225-PMU',exactModelVerified:false,ratingsVerified:false};
    }
    return {slot:index+1,raw:token,type:'unknown',family:'unknown',channel:null,powerClass:'unknown',
      preamplifier:false,rpm:false,rpmChannels:[],modelKey:null,exactModelVerified:false,ratingsVerified:false};
  }
  function parseOptions(value){
    const raw=String(value??'').replace(/\0+$/g,'').trim();
    if(!raw||raw.length>4096)throw Error('模块配置响应为空或过长');
    const parts=raw.split(',');
    if(parts.length>8)throw Error('模块配置超过八个插槽');
    const slots=parts.map(parseOptionToken);
    return {schema:'dkts.4200.modules.v2',raw,slots,
      knownModules:slots.filter(x=>x.family!=='empty'&&x.family!=='unknown'),
      unknownModules:slots.filter(x=>x.family==='unknown'),hardwareLimitsVerified:false,
      detailedInventoryAvailable:false};
  }
  const INFO_FIELDS=['slotno','name','model','serialno','hwver','fwver','caldate','caldue'];
  function parseInfoRecords(value){
    const raw=String(value??'').replace(/\0+$/g,'').trim();
    if(!raw)return [];
    const fields=INFO_FIELDS.join('|');
    const re=new RegExp('(?:^|,)\\s*slotno\\s*:\\s*(\\d+)\\s*,\\s*name\\s*:\\s*([^,]*?)\\s*,\\s*model\\s*:\\s*([^,]*?)\\s*,\\s*serialno\\s*:\\s*([^,]*?)\\s*,\\s*hwver\\s*:\\s*([^,]*?)\\s*,\\s*fwver\\s*:\\s*([^,]*?)\\s*,\\s*caldate\\s*:\\s*([\\s\\S]*?)\\s*,\\s*caldue\\s*:\\s*([\\s\\S]*?)(?=,\\s*slotno\\s*:|$)','gi');
    const rows=[];let match;
    while((match=re.exec(raw))){
      const record={slotno:Number(match[1]),name:match[2].trim(),model:match[3].trim(),
        serialno:match[4].trim(),hwver:match[5].trim(),fwver:match[6].trim(),
        caldate:match[7].trim(),caldue:match[8].trim().replace(/,$/,'')};
      const due=Date.parse(record.caldue);
      record.calibrationStatus=Number.isFinite(due)?(due<Date.now()?'overdue':'in-date'):'unknown';
      rows.push(record);
    }
    if(!rows.length)throw Error('SystemUtil 信息响应无法解析');
    return rows;
  }
  function modelKeyFor(model){
    const m=String(model||'').toUpperCase();
    if(/4211/.test(m)&&/SMU|HPSMU/.test(m))return '4211-SMU';
    if(/4210/.test(m)&&/SMU|HPSMU/.test(m))return '4210-SMU';
    if(/4201/.test(m)&&/SMU/.test(m))return '4201-SMU';
    if(/4200/.test(m)&&/SMU/.test(m))return '4200-SMU';
    if(/4215/.test(m)&&/CVU/.test(m))return '4215-CVU';
    if(/4210/.test(m)&&/CVU/.test(m))return '4210-CVU';
    if(/4225/.test(m)&&/PMU/.test(m))return '4225-PMU';
    if(/4220/.test(m)&&/(VPU|PGU)/.test(m))return '4220-PGU';
    if(/CVIV/.test(m))return '4200A-CVIV';
    if(/CVU.?PWR|PWR.?CVU/.test(m))return '4200-CVU-PWR';
    return null;
  }
  function parseSystemInfo(value){
    const raw=String(value??'').replace(/\0+$/g,'').trim();
    if(!raw)return {raw,fields:{}};
    const fields={};
    for(const match of raw.matchAll(/(?:^|,)\s*([A-Za-z][A-Za-z0-9_-]*)\s*:\s*([^,]*)/g))
      fields[match[1]]=match[2].trim();
    return {raw,fields};
  }
  function parseRemoteModules(value){
    const records=parseInfoRecords(value);
    return records.map(record=>{
      const name=record.name.toUpperCase();
      const pa=/^PA([1-9])$/.exec(name);
      const rpm=/^RPM([1-9])-([12])$/.exec(name);
      if(pa)return {...record,category:'SMU-PREAMPLIFIER',type:'4200-PA',channel:Number(pa[1])};
      if(rpm)return {...record,category:'PMU-REMOTE-PREAMPLIFIER-SWITCH',type:'4225-RPM',
        pmuChannel:Number(rpm[1]),rpmChannel:Number(rpm[2])};
      return {...record,category:'unknown',type:'unknown'};
    });
  }
  function enrichInventory(base,instrumentInfo,remoteModules,systemInfo){
    const slots=base.slots.map(slot=>{
      if(slot.family==='empty'||slot.family==='unknown')return {...slot};
      const prefix=slot.family==='SMU'?'SMU':slot.family==='PMU'?'PMU':slot.family==='PGU'?'VPU':slot.family==='CVU'?'CVU':null;
      const record=instrumentInfo.find(x=>prefix&&x.name.toUpperCase()===prefix+slot.channel)||
        instrumentInfo.find(x=>prefix&&x.name.toUpperCase().startsWith(prefix)&&x.slotno===slot.slot);
      const modelKey=modelKeyFor(record?.model);
      const pa=remoteModules.some(x=>x.category==='SMU-PREAMPLIFIER'&&x.channel===slot.channel);
      const rpmChannels=remoteModules.filter(x=>x.category==='PMU-REMOTE-PREAMPLIFIER-SWITCH'&&x.pmuChannel===slot.channel).map(x=>x.rpmChannel);
      const powerClass=modelKey==='4210-SMU'||modelKey==='4211-SMU'?'high':
        modelKey==='4200-SMU'||modelKey==='4201-SMU'?'medium':slot.powerClass;
      return {...slot,modelKey,exactModelVerified:!!modelKey,powerClass,
        preamplifier:slot.preamplifier||pa,
        rpm:slot.rpm||rpmChannels.length>0,
        rpmChannels:slot.rpmChannels==='unknown'?'unknown':Array.from(new Set([...(slot.rpmChannels||[]),...rpmChannels])),
        instrumentInfo:record||null};
    });
    const cviv=instrumentInfo.some(x=>modelKeyFor(x.model)==='4200A-CVIV');
    const cvuPower=instrumentInfo.some(x=>modelKeyFor(x.model)==='4200-CVU-PWR');
    const unknownModules=slots.filter(x=>x.family==='unknown');
    return {
      ...base,slots,knownModules:slots.filter(x=>x.family!=='empty'&&x.family!=='unknown'),
      unknownModules,systemInfo,remoteModules,instrumentInfo,
      externalAccessories:{cviv,cvuPower},
      detailedInventoryAvailable:true,hardwareLimitsVerified:false,
      calibration:{records:instrumentInfo.map(x=>({name:x.name,model:x.model,serial:x.serialno,
        caldate:x.caldate,caldue:x.caldue,status:x.calibrationStatus}))}
    };
  }
  const api=Object.freeze({
    IDN_REQUEST,OPTIONS_REQUEST,USER_LIBRARY_REQUEST,USER_MODE_REQUEST,
    INSTRUMENT_INFO_REQUEST,REMOTE_MODULE_INFO_REQUEST,SYSTEM_INFO_REQUEST,GET_RESULT_REQUEST,
    parseIdentity,parseOptions,parseInfoRecords,parseRemoteModules,parseSystemInfo,enrichInventory
  });
  if(typeof window!=='undefined'&&window.DKDSPluginModules)
    window.DKDSPluginModules.define('com.dkds.keithley-4200','dkts-kxci',api);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
