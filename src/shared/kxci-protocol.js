(() => {
  'use strict';
  const IDN_REQUEST='*IDN?\0',OPTIONS_REQUEST='*OPT?\0',UL_REQUEST='UL\0';
  const INSTRUMENT_INFO_REQUEST='EX SystemUtil instrumentinfo(,4096,)\0';
  const REMOTE_MODULE_INFO_REQUEST='EX SystemUtil remotemoduleinfo(,4096,)\0';
  const GN_RESULT_REQUEST='GN result\0',DE_REQUEST='DE\0';
  function getCapabilities(){
    if(typeof window!=='undefined'&&window.DKTSHardwareCapabilities)return window.DKTSHardwareCapabilities;
    if(typeof module!=='undefined'&&typeof require==='function')return require('./hardware-capabilities.js');
    return null;
  }
  function parseIdentity(input,expectedSerial=''){
    const raw=String(input||'').replace(/\0+$/g,'').trim(),parts=raw.split(',').map(x=>x.trim());
    if(parts[0]!=='KEITHLEY INSTRUMENTS'||parts[1]!=='KI4200A')throw Error('仪器身份不匹配：'+(raw||'空响应'));
    if(expectedSerial&&parts[2]!==String(expectedSerial))throw Error('序列号不匹配：预期 '+expectedSerial+'，实际 '+(parts[2]||'未知'));
    return Object.freeze({manufacturer:parts[0],model:parts[1],serial:parts[2]||'',version:parts[3]||'',raw});
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
  function expectedInstrumentName(family,name){
    const n=String(name||'').toUpperCase();
    if(['SMU','VS','VM'].includes(family))return /^(SMU|HPSMU|SMUPA|HPSMUPA)\d+$/.test(n);
    if(family==='PMU')return /^PMU\d+$/.test(n);
    if(family==='PGU')return /^(VPU|PGU)\d+$/.test(n);
    if(family==='CVU')return /^CVU\d+$/.test(n);
    if(family==='CVIV')return /^CVIV\d+$/.test(n);
    return false;
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
      const record=instruments.find(x=>x.slotNo===slot.slot&&expectedInstrumentName(slot.family,x.name));
      const attached=remote.filter(x=>x.slotNo===slot.slot);
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
            if(badPa||remotePa!==paRecords.length>0){mismatch=true;reason='VS/VM 的 PA 物理信息不一致';}
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
        if(badRpm||remoteChannels.length!==rpmCount||(rpmChannels.length&&remoteChannels.join(',')!==rpmChannels.join(','))){mismatch=true;reason='*OPT? 的 RPM 通道类别与 remotemoduleinfo 不一致';}
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
  const api=Object.freeze({IDN_REQUEST,OPTIONS_REQUEST,UL_REQUEST,INSTRUMENT_INFO_REQUEST,REMOTE_MODULE_INFO_REQUEST,GN_RESULT_REQUEST,DE_REQUEST,parseIdentity,parseOptions,parseInstrumentInfo,parseRemoteModuleInfo,parseHardwareInventory});
  if(typeof window!=='undefined'&&window.DKDSPluginModules)window.DKDSPluginModules.define('com.dkds.keithley-4200','dkts-kxci',api);
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();