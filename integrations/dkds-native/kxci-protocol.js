(() => {
  'use strict';
  const IDN_REQUEST='*IDN?\0',OPTIONS_REQUEST='*OPT?\0',UL_REQUEST='UL\0';
  const INSTRUMENT_INFO_REQUEST='EX SystemUtil instrumentinfo(,4096,)\0';
  const REMOTE_MODULE_INFO_REQUEST='EX SystemUtil remotemoduleinfo(,4096,)\0';
  const SYSTEM_INFO_REQUEST='EX SystemUtil systeminfo(,2048,)\0';
  const GN_RESULT_REQUEST='GN result\0',DE_REQUEST='DE\0';
  function getCapabilities(){
    if(typeof window!=='undefined'&&window.DKTSHardwareCapabilities)return window.DKTSHardwareCapabilities;
    if(typeof module!=='undefined'&&typeof require==='function')return require('./hardware-capabilities.js');
    return null;
  }
  function parseIdentity(input,expectedSerial=''){
    const raw=String(input||'').replace(/\0+$/g,'').trim(),parts=raw.split(',').map(x=>x.trim());
    // 4200A firmware/bridge variants expose either the full IEEE-488.2
    // manufacturer prefix or the compact KI4200A,serial,version form.
    // Both identify the same exact model token; arbitrary vendor/model
    // strings remain rejected.
    let manufacturer='',model='',serial='',version='',format='';
    if(parts[0]==='KEITHLEY INSTRUMENTS'&&parts[1]==='KI4200A'&&parts.length>=3){
      manufacturer=parts[0];model=parts[1];serial=parts[2]||'';version=parts[3]||'';format='manufacturer-prefixed';
    }else if(parts[0]==='KEITHLEY INSTRUMENTS'&&/^MODEL\s+4200A(?:-SCS)?$/.test(parts[1]||'')&&parts.length>=3){
      // Rev F 4-4: KEITHLEY INSTRUMENTS,MODEL nnnn,serial,firmware.
      manufacturer=parts[0];model='KI4200A';serial=parts[2]||'';version=parts[3]||'';format='manual-model-prefixed';
    }else if(parts[0]==='KI4200A'&&parts.length>=2){
      manufacturer='KEITHLEY INSTRUMENTS';model=parts[0];serial=parts[1]||'';version=parts[2]||'';format='compact';
    }else throw Error('仪器身份不匹配：'+(raw||'空响应'));
    if(!serial)throw Error('仪器身份响应缺少序列号：'+raw);
    if(expectedSerial&&serial!==String(expectedSerial))throw Error('序列号不匹配：预期 '+expectedSerial+'，实际 '+(serial||'未知'));
    return Object.freeze({manufacturer,model,serial,version,format,raw});
  }
  function parseSlot(token,index){
    const raw=String(token||'').trim().toUpperCase();
    const empty={slot:index+1,raw:'',logicalType:'EMPTY',type:'empty',physicalType:null,family:'empty',channel:null,physicalIdentityVerified:false,ratingsVerified:false,powerClass:'unknown',preamplifier:null,rpmCount:0,rpmChannels:[]};
    if(!raw)return Object.freeze(empty);
    let type=null,logicalType=null,family=null,channel=null,rpmCount=0,rpmChannels=[],preamplifier=false;
    let m;
    if((m=/^(HPSMUPA|SMUPA|HPSMU|SMU)([1-9])$/.exec(raw))){
      type=m[1];logicalType=type;family='SMU';channel=Number(m[2]);preamplifier=type.endsWith('PA');
    }else if((m=/^PMU([1-9])(?:RPM(1-2|1|2))?$/.exec(raw))){
      logicalType='PMU';type=m[2]?'PMURPM':'PMU';family='PMU';channel=Number(m[1]);rpmCount=m[2]?(m[2]==='1-2'?2:1):0;rpmChannels=m[2]==='1-2'?[1,2]:m[2]?[Number(m[2])]:[];
    }else if((m=/^PMURPM([1-9])?$/.exec(raw))){
      logicalType='PMURPM';type='PMURPM';family='PMU';channel=m[1]?Number(m[1]):null;rpmCount=1;
    }else if((m=/^(CVU|VPU|VS|VM|CVIV)([1-9])$/.exec(raw))){
      logicalType=m[1];type=m[1];family=type==='VPU'?'PGU':type;channel=Number(m[2]);
    }else{
      return Object.freeze({slot:index+1,raw,logicalType:null,type:null,physicalType:null,family:'unknown',channel:null,physicalIdentityVerified:false,ratingsVerified:false,powerClass:'unknown',preamplifier:null,rpmCount:null,rpmChannels:[],capabilityStatus:'unrecognized-kxci-option'});
    }
    const cap=getCapabilities()?.getModuleCapability(type);
    const powerClass=cap?.powerClass||'unknown';
    const ratingsVerified=['SMU','SMUPA','HPSMU','HPSMUPA','PMU','PMURPM','VPU'].includes(type);
    return Object.freeze({
      slot:index+1,raw,logicalType,type,physicalType:null,family,channel,
      cardIndex:['PMU','VPU'].includes(logicalType)||family==='PMU'||family==='PGU'?channel:null,
      physicalIdentityVerified:false,ratingsVerified,powerClass,preamplifier,
      rpmCount,rpmChannels,capabilityStatus:ratingsVerified?'kxci-rating-class-identified':'physical-variant-required'
    });
  }
  function parseOptions(value){
    const raw=String(value??'').replace(/\0+$/g,'').trim();
    if(!raw||raw.length>4096)throw Error('模块配置响应为空或过长');
    const parts=raw.split(',');
    if(parts.length>8)throw Error('模块配置超过八个插槽');
    const slots=Object.freeze(parts.map((part,index)=>parseSlot(part,index)));
    const logicalModules=slots.filter(x=>x.family!=='empty'&&x.family!=='unknown');
    const unknownModules=slots.filter(x=>x.family==='unknown');
    const unverifiedModules=logicalModules.filter(x=>!x.ratingsVerified);
    const knownModules=logicalModules.filter(x=>x.ratingsVerified);
    const hardwareLimitsVerified=logicalModules.length>0&&unknownModules.length===0&&unverifiedModules.length===0;
    return Object.freeze({
      schema:'dkts.4200.modules.v3',raw,slots,logicalModules,knownModules,unknownModules,unverifiedModules,
      pmuCards:logicalModules.filter(x=>x.family==='PMU').length,pguCards:logicalModules.filter(x=>x.family==='PGU').length,
      rpmModules:logicalModules.filter(x=>x.family==='PMU').reduce((sum,x)=>sum+(x.rpmCount||0),0),
      hardwareLimitsVerified,physicalModelsVerified:false,instrumentInfoStatus:'not-read',remoteModuleInfoStatus:'not-read'
    });
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
  function expectedInstrumentName(family,name,channel=null){
    const n=String(name||'').toUpperCase();
    let m=null;
    if(['SMU','VS','VM'].includes(family))m=/^(SMU|HPSMU|SMUPA|HPSMUPA)(\d+)$/.exec(n);
    else if(family==='PMU')m=/^PMU(\d+)$/.exec(n);
    else if(family==='PGU')m=/^(VPU|PGU)(\d+)$/.exec(n);
    else if(family==='CVU')m=/^CVU(\d+)$/.exec(n);
    else if(family==='CVIV')m=/^CVIV(\d+)$/.exec(n);
    if(!m)return false;
    const number=Number(m[m.length-1]);
    return channel==null||number===Number(channel);
  }
  function modelSmUClass(model){
    const m=String(model||'').toUpperCase();
    if(/4200|4201/.test(m))return 'SMU';
    if(/4210|4211/.test(m))return 'HPSMU';
    return null;
  }
  function parseHardwareInventory(optionsValue,instrumentInfoValue,remoteModuleInfoValue){
    const logical=parseOptions(optionsValue),instruments=parseInstrumentInfo(instrumentInfoValue),remote=parseRemoteModuleInfo(remoteModuleInfoValue);
    const used=new Set(),unknownModules=[...logical.unknownModules],unverifiedModules=[];
    const slots=logical.slots.map(slot=>{
      if(slot.family==='empty'||slot.family==='unknown')return slot;
      const exactRecord=instruments.find(x=>x.slotNo===slot.slot&&expectedInstrumentName(slot.family,x.name,slot.channel));
      const candidates=instruments.filter(x=>expectedInstrumentName(slot.family,x.name,slot.channel));
      const record=exactRecord||(candidates.length===1?candidates[0]:null);
      const physicalSlotNo=record?.slotNo??slot.slot;
      const attached=remote.filter(x=>x.slotNo===physicalSlotNo);
      const paRecords=attached.filter(x=>/^PA\d+$/i.test(x.name));
      const rpmRecords=attached.filter(x=>/^RPM\d+-[12]$/i.test(x.name));
      let type=slot.type,physicalType=null,basePhysicalType=null,variant=null,preamplifier=slot.preamplifier,rpmChannels=slot.rpmChannels||[],rpmCount=slot.rpmCount||0;
      let mismatch=false,reason='';
      if(record){
        used.add(record);
        const model=String(record.model||'').toUpperCase();
        if(['SMU','VS','VM'].includes(slot.family)){
          basePhysicalType=modelSmUClass(model);
          if(slot.family==='SMU'&&basePhysicalType){
            const expected=basePhysicalType+(slot.preamplifier?'PA':'');
            if(expected!==slot.type){mismatch=true;reason='*OPT? SMU 功率/PA 类别与 instrumentinfo 型号不一致';}
            else physicalType=expected;
          }else if(['VS','VM'].includes(slot.family)&&basePhysicalType){
            const remotePa=paRecords.some(x=>/4200/.test(x.model));
            const badPa=paRecords.some(x=>!/4200/.test(x.model));
            if(badPa||remotePa!==(paRecords.length>0)){mismatch=true;reason='VS/VM 的 PA 物理信息不一致';}
            else{preamplifier=remotePa;physicalType=basePhysicalType+(remotePa?'PA':'');}
          }else{mismatch=true;reason='instrumentinfo 中的 SMU 物理型号无法识别';}
        }else if(slot.family==='PMU'){
          if(!/4225/.test(model)){mismatch=true;reason='*OPT? PMU 类别与 instrumentinfo 型号不一致';}
          else physicalType=slot.type;
        }else if(slot.family==='PGU'){
          if(!/4220/.test(model)){mismatch=true;reason='*OPT? VPU/PGU 类别与 instrumentinfo 型号不一致';}
          else physicalType='VPU';
        }else if(slot.family==='CVU'){
          if(/4210/.test(model)){variant='4210-CVU';physicalType='CVU';}
          else if(/4215/.test(model)){variant='4215-CVU';physicalType='CVU';}
          else{mismatch=true;reason='CVU 物理型号无法区分 4210-CVU 与 4215-CVU';}
        }else if(slot.family==='CVIV'){
          if(/CVIV/i.test(model))physicalType='CVIV';else{mismatch=true;reason='CVIV 物理型号无法识别';}
        }
      }else{
        // *OPT? already supplies the electrical SMU/PMU/PGU class; exact
        // physical model and calibration identity remain unavailable.
        if(['SMU','PMU','PGU'].includes(slot.family))physicalType=slot.type;
        else if(slot.family==='CVU'||slot.family==='VS'||slot.family==='VM'){mismatch=true;reason='缺少物理型号，不能确认 CVU 变体或 VS/VM 底层 SMU';}
      }
      if(slot.family==='SMU'){
        const remotePa=paRecords.length>0,badPa=paRecords.some(x=>!/4200/.test(x.model));
        if(badPa||remotePa!==Boolean(slot.preamplifier)){mismatch=true;reason='*OPT? 的 PA 类别与 remotemoduleinfo 不一致';}
        preamplifier=remotePa;
      }
      if(slot.family==='PMU'){
        const remoteChannels=rpmRecords.filter(x=>/4225/.test(x.model)).map(x=>Number(x.name.split('-').pop())).filter(Number.isInteger).sort((a,b)=>a-b);
        const badRpm=rpmRecords.some(x=>!/4225/.test(x.model));
        const genericRpm=slot.logicalType==='PMURPM';
        const uniqueChannels=new Set(remoteChannels);
        if(badRpm||uniqueChannels.size!==remoteChannels.length||(genericRpm?remoteChannels.length<1||remoteChannels.length>2:remoteChannels.length!==rpmCount||(rpmChannels.length&&remoteChannels.join(',')!==rpmChannels.join(',')))){mismatch=true;reason='*OPT? 的 RPM 通道类别与 remotemoduleinfo 不一致';}
        rpmChannels=remoteChannels.length?remoteChannels:rpmChannels;
        rpmCount=remoteChannels.length||rpmCount;
        if(rpmCount)type='PMURPM';
      }
      for(const item of attached){
        const known=['SMU','VS','VM'].includes(slot.family)?/^PA\d+$/i.test(item.name):slot.family==='PMU'?/^RPM\d+-[12]$/i.test(item.name):false;
        if(!known){unknownModules.push(Object.freeze({family:'remote',slot:slot.slot,...item}));mismatch=true;reason='发现未识别的远程模块';}
      }
      if(mismatch){type=null;physicalType=null;}
      const capabilityType=['VS','VM'].includes(slot.family)?physicalType:type;
      const cap=capabilityType?getCapabilities()?.getModuleCapability(capabilityType):null;
      const ratingsVerified=!mismatch&&Boolean(cap)&&(
        ['SMU','SMUPA','HPSMU','HPSMUPA','PMU','PMURPM','VPU'].includes(type)||
        (slot.family==='CVU'&&Boolean(variant))||
        (['VS','VM'].includes(slot.family)&&Boolean(physicalType))
      );
      const channel=slot.family==='PMU'&&slot.channel==null?Number(record?.name?.match(/^PMU([1-9])$/i)?.[1]||0)||null:slot.channel;
      const enriched=Object.freeze({
        ...slot,channel,cardIndex:['PMU','PGU'].includes(slot.family)?channel:slot.cardIndex,type,physicalType,basePhysicalType,physicalModel:record?.model||null,
        physicalName:record?.name||null,physicalSerialNo:record?.serialNo||null,
        hardwareVersion:record?.hardwareVersion||'',firmwareVersion:record?.firmwareVersion||'',
        calibrationDate:record?.calibrationDate||'',calibrationDueDate:record?.calibrationDueDate||'',
        physicalIdentityVerified:Boolean(record&&!mismatch),modelIdentityVerified:Boolean(record&&!mismatch),
        variant,preamplifier,rpmCount,rpmChannels,ratingsVerified,
        powerClass:cap?.powerClass||slot.powerClass||'unknown',
        capabilityStatus:mismatch?'kxci-and-physical-inventory-mismatch':ratingsVerified?'documented':'physical-variant-required',
        inventoryReason:reason
      });
      if(!ratingsVerified)unverifiedModules.push(enriched);
      return enriched;
    });
    const attachedModules=[];
    for(const record of instruments.filter(x=>!used.has(x))){
      if(/^CVIV\d+$/i.test(record.name)&&/CVIV/i.test(record.model)){
        const cap=getCapabilities()?.getModuleCapability('CVIV');
        attachedModules.push(Object.freeze({...record,type:'CVIV',family:'CVIV',physicalIdentityVerified:true,ratingsVerified:Boolean(cap),capabilityStatus:cap?'documented':'unverified'}));
      }else{
        const item=Object.freeze({...record,type:null,family:'unknown',physicalIdentityVerified:false,ratingsVerified:false,capabilityStatus:'unrecognized-attached-instrument'});
        attachedModules.push(item);unknownModules.push(item);
      }
    }
    const rpmModules=remote.filter(x=>/^RPM\d+-[12]$/i.test(x.name)).length;
    const knownModules=slots.filter(x=>x.ratingsVerified).concat(attachedModules.filter(x=>x.ratingsVerified));
    const logicalModules=slots.filter(x=>x.family!=='empty'&&x.family!=='unknown');
    const hardwareLimitsVerified=logicalModules.length>0&&unknownModules.length===0&&unverifiedModules.length===0;
    const physicalModelsVerified=logicalModules.every(x=>x.physicalIdentityVerified)&&attachedModules.every(x=>x.physicalIdentityVerified);
    return Object.freeze({
      schema:'dkts.4200.modules.v3',raw:logical.raw,slots:Object.freeze(slots),
      logicalModules:Object.freeze(logicalModules),knownModules:Object.freeze(knownModules),
      unknownModules:Object.freeze(unknownModules),unverifiedModules:Object.freeze(unverifiedModules),
      attachedModules:Object.freeze(attachedModules),instrumentInfoRecords:instruments,remoteModuleInfoRecords:remote,
      pmuCards:slots.filter(x=>x.family==='PMU').length,pguCards:slots.filter(x=>x.family==='PGU').length,
      rpmModules,hardwareLimitsVerified,physicalModelsVerified,
      instrumentInfoStatus:'verified',remoteModuleInfoStatus:'verified'
    });
  }
function portCatalog(inventory){
 return (inventory?.slots||[]).flatMap(s=>{
  if(!Number.isInteger(s.channel)||s.channel<1||s.channel>9)return [];
  const base={verified:s.physicalIdentityVerified===true&&s.ratingsVerified===true,serial:s.physicalSerialNo||'',slot:s.slot,model:s.physicalModel||s.type||''};
  if(s.family==='SMU')return [{...base,id:'SMU'+s.channel,family:'SMU',channel:s.channel}];
  if(s.family==='PMU'||s.family==='PGU')return [1,2].map(ch=>({...base,id:(s.family==='PGU'?'VPU':'PMU')+s.channel+'-'+ch,family:s.family,card:s.channel,subchannel:ch,hasRpm:s.family==='PMU'&&(s.rpmChannels||[]).includes(ch)}));
  if(['CVU','VS','VM'].includes(s.family))return [{...base,id:s.family+s.channel,family:s.family,channel:s.channel}];
  return [];
 });
}
function topologySignature(inventory,serial){
 const cards=portCatalog(inventory).map(p=>[p.id,p.slot,p.serial,p.hasRpm===true,p.verified]).sort((a,b)=>a[0].localeCompare(b[0]));
 const rpm=(inventory?.remoteModuleInfoRecords||[]).filter(r=>/^RPM\d+-[12]$/i.test(r.name)).map(r=>[r.name.toUpperCase(),r.slotNo,r.serialNo]).sort((a,b)=>a[0].localeCompare(b[0]));
 return JSON.stringify([String(serial||''),cards,rpm]);
}
function confirmTopology(inventory,serial,links){
 const ports=portCatalog(inventory),rpms=ports.filter(p=>p.hasRpm),smus=ports.filter(p=>p.family==='SMU'&&p.verified);
 if(!serial||!inventory?.physicalModelsVerified||!inventory?.hardwareLimitsVerified)throw Error('请先识别全部实装模块');
 if(rpms.length&&(!rpms.every(p=>p.serial)||!smus.every(p=>p.serial)||rpms.some(p=>!(inventory.remoteModuleInfoRecords||[]).some(r=>r.name.toUpperCase()==='RPM'+p.card+'-'+p.subchannel&&r.serialNo))))throw Error('请先确认模块和 RPM 的序列号');
 if(!Array.isArray(links)||links.length!==rpms.length)throw Error('请逐一确认 RPM 对应的 SMU 接线');
 const seen=new Set(),used=new Set();
 for(const link of links){
  if(!rpms.some(p=>p.id===link.pmu&&p.verified)||seen.has(link.pmu))throw Error('RPM 通道无效或重复');
  seen.add(link.pmu);
  if(link.smu!=='None'){
   if(!smus.some(p=>p.id===link.smu)||used.has(link.smu))throw Error('SMU 接线无效或重复');
   used.add(link.smu);
  }
 }
 return Object.freeze({serial,signature:topologySignature(inventory,serial),links:links.map(x=>Object.freeze({pmu:x.pmu,smu:x.smu})),source:'user-confirmed-kcon-wiring',confirmedAt:new Date().toISOString()});
}
function planSmURoutes(inventory,serial,profile,resources){
 const ports=portCatalog(inventory),rpms=ports.filter(p=>p.hasRpm);
 if(!rpms.length)return [];
 if(!profile||profile.serial!==serial||profile.signature!==topologySignature(inventory,serial))throw Error('请在仪器连接菜单确认 RPM 接线（一次性设置）');
 const verified=confirmTopology(inventory,serial,profile.links);
 const pulseCards=(inventory.slots||[]).filter(s=>['PMU','PGU'].includes(s.family)).map(s=>s.channel).sort((a,b)=>a-b);
 if(pulseCards.some((v,i)=>v!==i+1)||pulseCards.length>4)throw Error('脉冲卡编号未能对应实际通道，请核对 KCon');
 return verified.links.filter(x=>x.smu!=='None'&&resources.includes(x.smu)).map(x=>{
  const port=rpms.find(p=>p.id===x.pmu);
  return Object.freeze({pmu:x.pmu,smu:x.smu,pulseChannel:2*(port.card-1)+port.subchannel});
 });
}
function resolvePulseResource(inventory,serial,profile,resource,legacyChannel){
 const ports=portCatalog(inventory);
 // A saved explicit PMU channel remains an explicit choice.
 if(/^PMU[1-9]-[12]$/.test(resource))return resource;
 // Only migrate an old card-level choice when the old plan specified CH1/2.
 if(/^PMU[1-9]$/.test(resource)&&/^[12]$/.test(String(legacyChannel))){
  const candidate=resource+'-'+legacyChannel;
  return ports.some(p=>p.id===candidate)?candidate:resource;
 }
 if(!/^SMU[1-9]$/.test(resource)||!profile||profile.serial!==serial||profile.signature!==topologySignature(inventory,serial))return resource;
 const confirmed=confirmTopology(inventory,serial,profile.links);
 return confirmed.links.find(l=>l.smu===resource)?.pmu||resource;
}
function parseSystemInfo(value,serial){
 const raw=String(value||'').trim().replace(/,\s*$/,'');
 const fields=Object.fromEntries(raw.split(',').map(s=>s.trim().split(/:(.*)/s).slice(0,2).map(x=>x.trim())));
 if(!fields.serialno||!fields.swver||!fields.platformver||!fields.clariusver)throw Error('系统版本信息缺失');
 if(serial&&fields.serialno!==serial)throw Error('系统信息序列号不匹配');
 return Object.freeze({serial:fields.serialno,softwareVersion:fields.swver,platformVersion:fields.platformver,clariusVersion:fields.clariusver,raw});
}
  // Query-only commissioning probe (no source/measure command is sent).
  // It answers the reply formats Rev F leaves open: SP text, *IDN?/ID form,
  // :ERROR:LAST:GET with and without an error, and whether an unsupported
  // command raises the SP syntax-error bit (Rev F 3-14, 4-3..4-6).
  const SELF_TEST_UNSUPPORTED='ZZDKTSPROBE';
  const SELF_TEST_PLAN=Object.freeze([
    {id:'sp-idle',command:'SP',reply:true},
    {id:'idn',command:'*IDN?',reply:true},
    {id:'id',command:'ID',reply:true},
    {id:'opt',command:'*OPT?',reply:true},
    {id:'clear',command:':ERROR:LAST:CLEAR',reply:false},
    {id:'error-none',command:':ERROR:LAST:GET',reply:true},
    {id:'sp-clean',command:'SP',reply:true},
    {id:'probe',command:SELF_TEST_UNSUPPORTED,reply:false},
    {id:'sp-after-probe',command:'SP',reply:true},
    {id:'error-after-probe',command:':ERROR:LAST:GET',reply:true},
    {id:'sp-cleared',command:'SP',reply:true},
    {id:'clear-final',command:':ERROR:LAST:CLEAR',reply:false}
  ].map(Object.freeze));
  function assessSelfTest(entries,expectedSerial=''){
    const by=Object.fromEntries((entries||[]).map(e=>[e.id,e]));
    const text=id=>String(by[id]?.response??'').replace(/\0+$/,'').trim().replace(/,\s*$/,'');
    const ok=id=>Boolean(by[id])&&!by[id].error;
    const spByte=id=>{const t=text(id);return ok(id)&&/^\d{1,3}$/.test(t)&&Number(t)<=255?Number(t):null;};
    const findings=[];
    const add=(id,status,summary,raw)=>findings.push(Object.freeze({id,status,summary,raw:raw??''}));
    const idle=spByte('sp-idle'),clean=spByte('sp-clean'),after=spByte('sp-after-probe'),cleared=spByte('sp-cleared');
    add('sp-format',[idle,clean,after,cleared].every(v=>v!==null)?'pass':'fail',
      [idle,clean,after,cleared].every(v=>v!==null)?'SP 返回十进制状态字节（0–255），与解析器一致':'SP 返回格式与十进制状态字节假设不符',
      ['sp-idle','sp-clean','sp-after-probe','sp-cleared'].map(text).join(' | '));
    add('sp-idle-busy',idle!==null&&!(idle&16)?'pass':'warn',idle!==null&&(idle&16)?'仪器 Busy：可能有其他测试在运行':'空闲时 Busy 位为 0',text('sp-idle'));
    add('syntax-bit',after!==null&&(after&2)&&cleared!==null&&!(cleared&2)?'pass':'fail',
      after!==null&&(after&2)?(cleared!==null&&!(cleared&2)?'不支持的指令置位 SP 语法错误位 B1，读取后清零':'B1 读取后未清零'):'不支持的指令没有置位 SP 语法错误位 B1；逐条错误检测不可依赖',
      text('sp-after-probe')+' → '+text('sp-cleared'));
    let identity=null;try{identity=protocol().parseIdentity(text('idn'),expectedSerial);}catch(e){}
    add('idn-format',identity?'pass':'fail',identity?'*IDN? 可解析（'+identity.format+'）':'*IDN? 无法被当前解析器接受',text('idn'));
    add('id-format',ok('id')&&/^KI4200A\b/.test(text('id'))?'pass':'warn',ok('id')&&/^KI4200A\b/.test(text('id'))?'ID 返回 KI4200A 版本串（Rev F 4-4）':'ID 返回与 Rev F 4-4 写法不同',text('id'));
    let options=null;try{options=protocol().parseOptions(text('opt'));}catch(e){}
    add('opt-format',options&&!options.unknownModules.length?'pass':'warn',options?(options.unknownModules.length?'*OPT? 含未识别插槽':'*OPT? 全部插槽可识别'):'*OPT? 无法解析',text('opt'));
    const none=text('error-none'),code=none.match(/\((-?\d+)\)/);
    add('error-none',ok('error-none')&&(code?Number(code[1])===0:/^ACK$|^no errors?\b/i.test(none)||none==='')?'pass':'warn',
      '清除后 :ERROR:LAST:GET 返回：'+(none||'空响应')+'（运行器按此判断“无错误”）',none);
    const err=text('error-after-probe'),errCode=err.match(/\((-?\d+)\)/);
    add('error-format',errCode&&Number(errCode[1])<0?'pass':'warn',errCode?'错误响应带负数错误码 '+errCode[1]+'（Rev F 3-16）':'错误响应没有 (代码) 格式',err);
    add('ack',ok('clear')&&ok('clear-final')&&String(by.clear?.response).toUpperCase()==='ACK'?'pass':'fail','写入类指令返回 ACK\\0（Rev F 2-2）',String(by.clear?.response??''));
    const status=findings.some(f=>f.status==='fail')?'fail':findings.some(f=>f.status==='warn')?'warn':'pass';
    return Object.freeze({schema:'dkts.kxci.selftest.v1',status,findings:Object.freeze(findings),identity,options});
  }
  function protocol(){return api;}
  const api=Object.freeze({SELF_TEST_PLAN,SELF_TEST_UNSUPPORTED,assessSelfTest,SYSTEM_INFO_REQUEST,portCatalog,topologySignature,confirmTopology,planSmURoutes,resolvePulseResource,parseSystemInfo,IDN_REQUEST,OPTIONS_REQUEST,UL_REQUEST,INSTRUMENT_INFO_REQUEST,REMOTE_MODULE_INFO_REQUEST,GN_RESULT_REQUEST,DE_REQUEST,parseIdentity,parseOptions,parseInstrumentInfo,parseRemoteModuleInfo,parseHardwareInventory});
  if(typeof window!=='undefined'&&window.DKDSPluginModules)window.DKDSPluginModules.define('com.dkts.keithley-4200','dkts-kxci',api);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();