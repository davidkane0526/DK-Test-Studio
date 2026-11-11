/* KXCI *OPT? hardware-slot decoder (Rev E §4-4).
 * Never infer an addressable SMU channel from a physical slot index.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.DK4200OptionInventory=api;
})(typeof globalThis!=='undefined'?globalThis:undefined,function(){
 'use strict';
 const VERSION='0.1.0';
 const prefix=['HPSMUPA','HPSMU','SMUPA','SMU','CVU','PMURPM','PMU','VPU','VS','VM'];
 const classify=token=>{
  const clean=String(token??'').replace(/^[\s"']+|[\s"']+$/g,'').toUpperCase();
  if(!clean)return {kind:'empty',model:null,resource:null,raw:clean};
  const pmu=/^PMU([1-8])?RPM(1-2|1|2)?$/.exec(clean);
  if(pmu)return {kind:'PMU',model:clean,resource:pmu[1]?'PMU'+pmu[1]:null,raw:clean};
  for(const pre of prefix){
   if(!clean.startsWith(pre))continue;
   const tail=clean.slice(pre.length);
   if(tail&&!/^[1-9]$/.test(tail))break;
   const ch=tail?Number(tail):null;
   return {kind:pre.startsWith('HPSMU')||pre.startsWith('SMU')?'SMU':
     pre==='CVU'?'CVU':pre==='VPU'?'PGU':pre==='VS'?'VS':pre==='VM'?'VM':'PMU',
    model:pre,resource:ch?(pre.startsWith('HPSMU')||pre.startsWith('SMU')?'SMU':pre)+ch:null,raw:clean};
  }
  return {kind:'unknown',model:null,resource:null,raw:clean};
 };
 function parseOptReply(response){
  if(typeof response!=='string'||response.length>3000)throw new TypeError('Invalid *OPT? reply');
  const raw=response.trim().replace(/\0+$/,'');
  const tokens=raw.split(',').map(s=>s.trim()).filter((x,i,arr)=>x||i<arr.length-1);
  if(tokens.length<1||tokens.length>8)throw new RangeError('KXCI *OPT? lists up to eight slots');
  const slots=tokens.map((token,i)=>Object.freeze({slot:i+1,...classify(token)}));
  const channels=slots.filter(s=>s.kind==='SMU'&&s.resource);
  const unresolved=slots.filter(s=>s.kind!=='empty'&&(!s.resource||s.kind==='unknown'));
  return Object.freeze({
   schema:'dkts.4200a.opt-inventory.v1',slots:Object.freeze(slots),
   addressableSMUs:Object.freeze(channels),
   unresolvedSlots:Object.freeze(unresolved),
   complete:unresolved.length===0
  });
 }
 function parseInstrumentInfo(response){
  if(typeof response!=='string'||response.length>16384)throw new TypeError('Invalid SystemUtil instrumentinfo');
  const rows=[];
  for(const segment of response.split(/(?=slotno:)/i)){
   const slot=/^slotno:(\d{1,2})/i.exec(segment.trim());
   if(!slot)continue;
   const fields={slot:Number(slot[1])};
   // Dates contain commas; use "key:" boundaries, not blind CSV splitting.
   for(const key of ['name','model','serialno','hwver','fwver']){
    const match=new RegExp('(?:^|,)\\s*'+key+':([^,]+)','i').exec(segment);
    if(match)fields[key]=match[1].trim();
   }
   if(fields.slot<1||fields.slot>8||!fields.name||!fields.model||!fields.serialno)
    throw new Error('Incomplete physical card information at slot '+fields.slot);
   if(rows.some(v=>v.slot===fields.slot))throw new Error('Duplicate physical card slot '+fields.slot);
   rows.push(Object.freeze(fields));
  }
  return Object.freeze(rows);
 }
 function toModuleCapabilities(reply,{instrumentId,lineFrequencyHz,verifiedSlotMapping,instrumentInfoRaw,remoteModuleInfoRaw}={}){
  if(typeof instrumentId!=='string'||!/(KI4200A|4200A)/i.test(instrumentId))throw new Error('4200A IDN required');
  if(lineFrequencyHz!==50&&lineFrequencyHz!==60)throw new Error('Line frequency must be verified');
  const parsed=parseOptReply(reply);
  const mapping=verifiedSlotMapping&&typeof verifiedSlotMapping==='object'?verifiedSlotMapping:{};
  const smus=[],used=new Set(),unresolved=[];
  const physical=instrumentInfoRaw===undefined?[]:parseInstrumentInfo(instrumentInfoRaw);
  const physicalMap=new Map(physical.map(x=>[x.slot,x]));
  const remote=remoteModuleInfoRaw===undefined?[]:parseInstrumentInfo(remoteModuleInfoRaw);
  for(const slot of parsed.slots){
   if(slot.kind!=='SMU'){if(slot.kind==='unknown')unresolved.push({slot:slot.slot,reason:'UNKNOWN_SLOT'});continue;}
   const proposed=slot.resource||mapping[slot.slot];
   if(!/^SMU[1-9]$/.test(proposed||'')){unresolved.push({slot:slot.slot,reason:'KCON_CHANNEL_NOT_VERIFIED'});continue;}
   if(used.has(proposed))throw new Error('Duplicate KCon SMU channel mapping: '+proposed);
   used.add(proposed);
   const high=slot.model.startsWith('HPSMU'),pa=slot.model.endsWith('PA');
   const card=physicalMap.get(slot.slot);
   const exact=/^(?:KI)?(4200|4201|4210|4211)(?:-?SMU)?$/i.exec(card?.model||'');
   const model=exact?exact[1]+'-SMU':null;
   const physicalName=/^(?:SMU|HPSMU|SMUPA|HPSMUPA)([1-9])$/i.exec(card?.name||'');
   const sameMapping=Boolean(physicalName)&&Number(physicalName[1])===Number(proposed.slice(3));
   const paRecords=remote.filter(row=>row.slot===slot.slot&&/^PA[1-9]$/i.test(row.name));
   const paConfirmed=!pa||paRecords.some(row=>/^KI4200$/i.test(row.model)&&Boolean(row.serialno));
   const verified=model!==null&&Boolean(card?.serialno)&&sameMapping&&
       ((model.startsWith('421')===high))&&paConfirmed;
   if(card&&!sameMapping)unresolved.push({slot:slot.slot,reason:'PHYSICAL_CHANNEL_MISMATCH'});
   if(card&&model!==null&&((model.startsWith('421')!==high)))
    unresolved.push({slot:slot.slot,reason:'PHYSICAL_POWER_CLASS_MISMATCH'});
   if(card&&!model)unresolved.push({slot:slot.slot,reason:'PHYSICAL_MODEL_UNKNOWN'});
   if(pa&&!paConfirmed)unresolved.push({slot:slot.slot,reason:'PREAMPLIFIER_NOT_VERIFIED'});
   if(!card)unresolved.push({slot:slot.slot,reason:'PHYSICAL_MODEL_NOT_OBSERVED'});
   smus.push(Object.freeze({
    resource:proposed,modelVerified:verified,model:verified?model:null,
    preamplifier:pa,modelFamily:high?'4210/4211':'4200/4201',
    slot:slot.slot,cardSerial:verified?card.serialno:null,
    source:verified?'kxci-opt-and-systemutil-instrumentinfo':'kxci-opt-family-only'
   }));
  }
  return Object.freeze({
   schema:'dkts.4200a.module-capabilities.v1',instrumentId,lineFrequencyHz,
   smus:Object.freeze(smus),unresolved:Object.freeze(unresolved),
   executionAuthorized:false,
   readyForCompiler:smus.length>0&&unresolved.length===0&&smus.every(x=>x.modelVerified)
  });
 }
 return Object.freeze({VERSION,parseOptReply,parseInstrumentInfo,toModuleCapabilities});
});
