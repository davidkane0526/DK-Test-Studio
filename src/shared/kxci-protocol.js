(() => {
  'use strict';
  const IDN_REQUEST='*IDN?\0',OPTIONS_REQUEST='*OPT?\0',UL_REQUEST='UL\0';
  const INSTRUMENT_INFO_REQUEST='EX SystemUtil instrumentinfo(,4096,)\0';
  const REMOTE_MODULE_INFO_REQUEST='EX SystemUtil remotemoduleinfo(,4096,)\0';
  const GN_RESULT_REQUEST='GN result\0',DE_REQUEST='DE\0';
  function parseIdentity(input,expectedSerial=''){
    const raw=String(input||'').replace(/\0+$/g,'').trim(),parts=raw.split(',').map(x=>x.trim());
    if(parts[0]!=='KEITHLEY INSTRUMENTS'||parts[1]!=='KI4200A')throw Error('仪器身份不匹配：'+(raw||'空响应'));
    if(expectedSerial&&parts[2]!==String(expectedSerial))throw Error('序列号不匹配：预期 '+expectedSerial+'，实际 '+(parts[2]||'未知'));
    return Object.freeze({manufacturer:parts[0],model:parts[1],serial:parts[2]||'',version:parts[3]||'',raw});
  }
  function parseSlot(token,index){
    const raw=String(token||'').trim().toUpperCase();
    if(!raw)return Object.freeze({slot:index+1,raw:'',logicalType:'EMPTY',type:'empty',physicalType:null,family:'empty',channel:null,physicalIdentityVerified:false,ratingsVerified:false,powerClass:'unknown',preamplifier:null,rpmCount:0,rpmChannels:[]});
    const m=/^(SMU|PMU|CVU|VPU|VS|VM|CVIV)([1-9])$/.exec(raw);
    if(!m)return Object.freeze({slot:index+1,raw,logicalType:null,type:null,physicalType:null,family:'unknown',channel:null,physicalIdentityVerified:false,ratingsVerified:false,powerClass:'unknown',preamplifier:null,rpmCount:null,rpmChannels:[]});
    const logicalType=m[1],channel=Number(m[2]),family=logicalType==='VPU'?'PGU':logicalType;
    return Object.freeze({slot:index+1,raw,logicalType,type:null,physicalType:null,family,channel,cardIndex:['PMU','VPU'].includes(logicalType)?channel:null,physicalIdentityVerified:false,ratingsVerified:false,powerClass:'unknown',preamplifier:['SMU','VS','VM'].includes(logicalType)?null:false,rpmCount:logicalType==='PMU'?null:0,rpmChannels:[],capabilityStatus:'physical-model-not-inspected'});
  }
  function parseOptions(value){
    const raw=String(value??'').replace(/\0+$/g,'').trim();
    if(!raw||raw.length>4096)throw Error('模块配置响应为空或过长');
    const parts=raw.split(',');
    if(parts.length>8)throw Error('模块配置超过八个插槽');
    const slots=Object.freeze(parts.map((part,index)=>parseSlot(part,index)));
    const logicalModules=slots.filter(x=>x.family!=='empty'&&x.family!=='unknown');
    const unknownModules=slots.filter(x=>x.family==='unknown');
    return Object.freeze({schema:'dkts.4200.modules.v3',raw,slots,logicalModules,knownModules:[],unknownModules,unverifiedModules:logicalModules.slice(),pmuCards:logicalModules.filter(x=>x.family==='PMU').length,pguCards:logicalModules.filter(x=>x.family==='PGU').length,rpmModules:null,hardwareLimitsVerified:false,instrumentInfoStatus:'not-read',remoteModuleInfoStatus:'not-read'});
  }
  function parseKultRecords(value,label,allowEmpty=false){
    const raw=String(value??'').replace(/\0/g,'').trim();
    if(!raw){if(allowEmpty)return Object.freeze([]);throw Error(label+' 响应为空');}
    const chunks=raw.split(/(?=slotno:\s*\d+\s*,)/i).map(x=>x.trim()).filter(Boolean);
    if(!chunks.length)throw Error(label+' 响应中没有 slotno 记录');
    return Object.freeze(chunks.map((record,index)=>{
      const slot=record.match(/(?:^|,)\s*slotno:\s*(\d+)/i),name=record.match(/(?:^|,)\s*name:\s*([^,]+)/i),model=record.match(/(?:^|,)\s*model:\s*([^,]+)/i),serial=record.match(/(?:^|,)\s*serialno:\s*([^,]+)/i),hw=record.match(/(?:^|,)\s*hwver:\s*([^,]+)/i),fw=record.match(/(?:^|,)\s*fwver:\s*([^,]+)/i),date=record.match(/(?:^|,)\s*caldate:\s*(.*?),\s*caldue:\s*(.*)$/i);
      if(!slot||!name||!model)throw Error(label+' 第 '+(index+1)+' 条记录缺少 slotno/name/model');
      return Object.freeze({slotNo:Number(slot[1]),name:name[1].trim(),model:model[1].trim(),serialNo:serial?.[1].trim()||'',hardwareVersion:hw?.[1].trim()||'',firmwareVersion:fw?.[1].trim()||'',calibrationDate:date?.[1].trim()||'',calibrationDueDate:date?.[2].replace(/,\s*$/,'').trim()||'',raw:record.replace(/,\s*$/,'')});
    }));
  }
  function parseInstrumentInfo(value){return parseKultRecords(value,'instrumentinfo',false);}
  function parseRemoteModuleInfo(value){return parseKultRecords(value,'remotemoduleinfo',true);}
  function expectedInstrumentName(family,name){
    const n=String(name||'').toUpperCase();
    if(['SMU','VS','VM'].includes(family))return /^SMU\d+$/.test(n);
    if(family==='PMU')return /^PMU\d+$/.test(n);
    if(family==='PGU')return /^(VPU|PGU)\d+$/.test(n);
    if(family==='CVU')return /^CVU\d+$/.test(n);
    if(family==='CVIV')return /^CVIV\d+$/.test(n);
    return false;
  }
  function identifyPhysicalType(slot,record,remoteRecords){
    const model=String(record.model||'').toUpperCase(),attached=remoteRecords.filter(x=>x.slotNo===slot.slot),unknownRemote=[];
    let type=null,basePhysicalType=null,variant=null,preamplifier=false,rpmChannels=[];
    if(['SMU','VS','VM'].includes(slot.family)){
      if(/4200|4201/.test(model))basePhysicalType='SMU';else if(/4210|4211/.test(model))basePhysicalType='HPSMU';
      const pa=attached.filter(x=>/^PA\d+$/i.test(x.name)),bad=pa.filter(x=>!/4200/.test(String(x.model||'')));
      if(bad.length)unknownRemote.push(...bad);
      preamplifier=pa.length>0&&bad.length===0;
      if(basePhysicalType)type=basePhysicalType+(preamplifier?'PA':'');
      for(const x of attached)if(!/^PA\d+$/i.test(x.name))unknownRemote.push(x);
    }else if(slot.family==='PMU'){
      if(/4225/.test(model)&&/PMU/i.test(record.name))type='PMU';
      const rpm=attached.filter(x=>/^RPM\d+-[12]$/i.test(x.name)),bad=rpm.filter(x=>!/4225/.test(String(x.model||'')));
      if(bad.length)unknownRemote.push(...bad);
      rpmChannels=[...new Set(rpm.filter(x=>/4225/.test(String(x.model||''))).map(x=>Number(x.name.split('-').pop())).filter(Number.isInteger))].sort((a,b)=>a-b);
      if(type&&rpmChannels.length)type='PMURPM';
      for(const x of attached)if(!/^RPM\d+-[12]$/i.test(x.name))unknownRemote.push(x);
    }else if(slot.family==='PGU'){
      if(/4220/.test(model)&&/(VPU|PGU)/i.test(record.name))type='VPU';
      for(const x of attached)unknownRemote.push(x);
    }else if(slot.family==='CVU'){
      if(/4210/.test(model)&&/CVU/i.test(record.name)){type='CVU';variant='4210-CVU';}
      else if(/4215/.test(model)&&/CVU/i.test(record.name)){type='CVU';variant='4215-CVU';}
      for(const x of attached)unknownRemote.push(x);
    }else if(slot.family==='CVIV'){
      if(/CVIV/i.test(model))type='CVIV';
      for(const x of attached)unknownRemote.push(x);
    }else for(const x of attached)unknownRemote.push(x);
    return {type,basePhysicalType,variant,preamplifier,rpmChannels,unknownRemote};
  }
  function parseHardwareInventory(optionsValue,instrumentInfoValue,remoteModuleInfoValue){
    const logical=parseOptions(optionsValue),instruments=parseInstrumentInfo(instrumentInfoValue),remote=parseRemoteModuleInfo(remoteModuleInfoValue),used=new Set();
    const unverifiedModules=logical.unverifiedModules.filter(x=>x.family==='unknown'),unknownModules=[...logical.unknownModules];
    const slots=logical.slots.map(slot=>{
      if(slot.family==='empty'||slot.family==='unknown')return slot;
      const record=instruments.find(x=>x.slotNo===slot.slot&&expectedInstrumentName(slot.family,x.name));
      if(!record){const unresolved=Object.freeze({...slot,physicalIdentityVerified:false,ratingsVerified:false,capabilityStatus:'physical-card-not-matched',reason:'instrumentinfo 未返回与 KXCI 插槽/逻辑通道对应的物理卡'});unverifiedModules.push(unresolved);unknownModules.push(unresolved);return unresolved;}
      used.add(record);
      const found=identifyPhysicalType(slot,record,remote),cap=found.type&&getCapabilities()?.getModuleCapability(found.type),variantKnown=slot.family!=='CVU'||Boolean(found.variant),verified=Boolean(cap&&variantKnown&&!found.unknownRemote.length);
      const rpmChannels=found.rpmChannels||[];
      const enriched=Object.freeze({...slot,type:found.type,physicalType:found.type,basePhysicalType:found.basePhysicalType,physicalModel:record.model,physicalName:record.name,physicalSerialNo:record.serialNo,hardwareVersion:record.hardwareVersion,firmwareVersion:record.firmwareVersion,calibrationDate:record.calibrationDate,calibrationDueDate:record.calibrationDueDate,variant:found.variant,physicalIdentityVerified:Boolean(found.type),powerClass:cap?.powerClass||'unknown',preamplifier:found.preamplifier,rpmCount:rpmChannels.length,rpmChannels,ratingsVerified:verified,capabilityStatus:verified?'documented':found.type?'variant-or-remote-module-unverified':'physical-model-unrecognized'});
      if(!verified)unverifiedModules.push(enriched);
      for(const x of found.unknownRemote)unknownModules.push(Object.freeze({family:'remote',slot:slot.slot,...x}));
      return enriched;
    });
    const attachedModules=instruments.filter(x=>!used.has(x)),rpmModules=remote.filter(x=>/^RPM\d+-[12]$/i.test(x.name)).length;
    const knownModules=slots.filter(x=>x.family!=='empty'&&x.family!=='unknown'&&x.physicalIdentityVerified);
    const hardwareLimitsVerified=knownModules.length>0&&unknownModules.length===0&&unverifiedModules.length===0;
    return Object.freeze({schema:'dkts.4200.modules.v3',raw:logical.raw,slots:Object.freeze(slots),logicalModules:Object.freeze(slots.filter(x=>x.family!=='empty'&&x.family!=='unknown')),knownModules:Object.freeze(knownModules),unknownModules:Object.freeze(unknownModules),unverifiedModules:Object.freeze(unverifiedModules),attachedModules,instrumentInfoRecords:instruments,remoteModuleInfoRecords:remote,pmuCards:slots.filter(x=>x.family==='PMU').length,pguCards:slots.filter(x=>x.family==='PGU').length,rpmModules,hardwareLimitsVerified,instrumentInfoStatus:'verified',remoteModuleInfoStatus:'verified'});
  }
  const api=Object.freeze({IDN_REQUEST,OPTIONS_REQUEST,UL_REQUEST,INSTRUMENT_INFO_REQUEST,REMOTE_MODULE_INFO_REQUEST,GN_RESULT_REQUEST,DE_REQUEST,parseIdentity,parseOptions,parseInstrumentInfo,parseRemoteModuleInfo,parseHardwareInventory});
  if(typeof window!=='undefined'&&window.DKDSPluginModules)window.DKDSPluginModules.define('com.dkds.keithley-4200','dkts-kxci',api);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();