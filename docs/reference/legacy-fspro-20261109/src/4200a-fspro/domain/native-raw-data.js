/* Native acquisition data contract for DK Test Studio / 4200A.
 * This file NEVER creates fake measurements and never sends an instrument command.
 * The authorizing transport MUST prove origin; this consumer only checks structure.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.DK4200RawData=api;
})(typeof globalThis!=='undefined'?globalThis:undefined,function(){
 'use strict';
 const VERSION='1.0.0';
 const SOURCE='keithley-4200a-kxci';
 const DEFAULT_LIMIT=200000;
 const NUMBER=/^[+-]?(?:(?:\d+\.?\d*)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;
 const identifier=x=>typeof x==='string'&&/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(x);
 const text=x=>typeof x==='string'&&x.trim().length>0;
 const decimal=x=>typeof x==='string'&&NUMBER.test(x.trim())&&Number.isFinite(Number(x));
 function validate(raw,{limit=DEFAULT_LIMIT}={}){
  const errors=[];
  const fail=(code,path)=>errors.push(Object.freeze({code,path}));
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return Object.freeze({valid:false,errors:[{code:'INVALID_CAPTURE',path:'$'}]});
  if(raw.schema!=='dkts.4200a.native.raw.v1')fail('SCHEMA','schema');
  if(raw.source!==SOURCE)fail('SOURCE','source');
  if(!text(raw.captureId)||raw.captureId.length>128)fail('CAPTURE_ID','captureId');
  if(!text(raw.instrumentId)||raw.instrumentId.length>256)fail('INSTRUMENT_ID','instrumentId');
  if(!text(raw.planHash)||!/^[a-f\d]{64}$/i.test(raw.planHash))fail('PLAN_HASH','planHash');
  if(!text(raw.startedAt)||!Number.isFinite(Date.parse(raw.startedAt)))fail('START_TIME','startedAt');
  const columns=Array.isArray(raw.columns)?raw.columns:[];
  const samples=Array.isArray(raw.samples)?raw.samples:[];
  if(columns.length<2||columns.length>32)fail('COLUMNS','columns');
  const ids=new Set();
  for(let i=0;i<columns.length;i++){
   const c=columns[i];
   if(!c||!identifier(c.id)||!text(c.label)||typeof c.unit!=='string'||c.unit.length>24){fail('COLUMN',`columns[${i}]`);continue;}
   if(ids.has(c.id))fail('DUPLICATE_COLUMN',`columns[${i}].id`);
   ids.add(c.id);
  }
  if(samples.length>limit)fail('ROW_LIMIT','samples');
  let lastIndex=-1;
  for(let i=0;i<Math.min(samples.length,limit);i++){
   const row=samples[i];
   if(!row||typeof row!=='object'||Array.isArray(row)){fail('SAMPLE',`samples[${i}]`);continue;}
   if(!Number.isSafeInteger(row.index)||row.index<=lastIndex)fail('SAMPLE_ORDER',`samples[${i}].index`);
   lastIndex=row.index;
   if(!text(row.sweepId)||row.sweepId.length>80)fail('SWEEP_ID',`samples[${i}].sweepId`);
   if(row.status!==undefined&&(!Number.isInteger(row.status)||row.status<0||row.status>0xFFFFFFFF))fail('STATUS',`samples[${i}].status`);
   if(row.channelStatuses!==undefined){
    if(!row.channelStatuses||typeof row.channelStatuses!=='object'||Array.isArray(row.channelStatuses))
     fail('CHANNEL_STATUSES',`samples[${i}].channelStatuses`);
    else for(const [key,state] of Object.entries(row.channelStatuses))
     if(!ids.has(key)||!['N','C'].includes(state))fail('CHANNEL_STATUS',`samples[${i}].channelStatuses.${key}`);
    if(Object.values(row.channelStatuses||{}).includes('C')&&row.status===0)
     fail('COMPLIANCE_STATUS_MISMATCH',`samples[${i}].status`);
   }
   if(row.instrumentStatuses!==undefined){
    if(!row.instrumentStatuses||typeof row.instrumentStatuses!=='object'||Array.isArray(row.instrumentStatuses))
      fail('INSTRUMENT_STATUSES',`samples[${i}].instrumentStatuses`);
    else for(const [key,state] of Object.entries(row.instrumentStatuses))
      if(!ids.has(key)||typeof state!=='string'||state.length>32||
        !/^[A-Za-z0-9_.+\\-]{1,32}$/.test(state))
        fail('INSTRUMENT_STATUS',`samples[${i}].instrumentStatuses.${key}`);
   }
   for(const id of ids){
    const val=row[id];
    if(val===null)continue; // instrumentation range overflow / invalid reading; preserve as blank in plot
    if(!decimal(val))fail('INVALID_DATUM',`samples[${i}].${id}`);
   }
  }
  if(!Array.isArray(raw.rawFrames)||raw.rawFrames.length===0)fail('MISSING_RAW_FRAMES','rawFrames');
  else for(let i=0;i<raw.rawFrames.length;i++){
    const frame=raw.rawFrames[i];
    if(!frame||!text(frame.command)||!text(frame.payloadBase64)||!Number.isSafeInteger(frame.readOrder)||frame.readOrder<0||
       !/^[A-Za-z0-9+/]+={0,2}$/.test(frame.payloadBase64))fail('RAW_FRAME',`rawFrames[${i}]`);
  }
  if(raw.status!==undefined&&!['complete','aborted','fault'].includes(raw.status))fail('RUN_STATUS','status');
  return Object.freeze({valid:!errors.length,errors:Object.freeze(errors)});
 }
 function toTable(raw,{limit=DEFAULT_LIMIT}={}){
  const result=validate(raw,{limit});if(!result.valid)throw new TypeError('Invalid 4200A raw capture: '+result.errors.map(x=>x.code).join(', '));
  const fields=raw.columns.map(c=>({id:c.id,label:c.label,unit:c.unit}));
  return Object.freeze({
   captureId:raw.captureId,source:raw.source,rows:raw.samples.map(row=>({index:row.index,sweepId:row.sweepId,status:row.status??null,channelStatuses:row.channelStatuses?{...row.channelStatuses}:null,
    instrumentStatuses:row.instrumentStatuses?{...row.instrumentStatuses}:null,
    values:Object.fromEntries(fields.map(c=>[c.id,row[c.id]]))})),columns:fields
  });
 }
 const csvField=v=>{const s=String(v??'');return /[,"\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;};
 function toCSV(raw,opts={}){
  const table=toTable(raw,opts),ids=table.columns.map(c=>c.id),header=['index','sweepId','status',...table.columns.map(c=>`${c.label}${c.unit?` (${c.unit})`:''}`)].map(csvField).join(',');
  const stateKeys=[...new Set(table.rows.flatMap(row=>Object.keys(row.channelStatuses||{})))].sort();
  const nativeKeys=[...new Set(table.rows.flatMap(row=>Object.keys(row.instrumentStatuses||{})))].sort();
  const rows=table.rows.map(row=>[row.index,row.sweepId,row.status??'',...ids.map(k=>row.values[k]??''),
    ...stateKeys.map(k=>row.channelStatuses?.[k]??''),...nativeKeys.map(k=>row.instrumentStatuses?.[k]??'')].map(csvField).join(','));
  return [[header,...stateKeys.map(k=>csvField(k+' status')),...nativeKeys.map(k=>csvField(k+' native status raw'))].join(','),...rows].join('\r\n')+'\r\n';
 }
 function traces(raw,{x='voltage',y='current'}={}){
  const table=toTable(raw);
  if(!table.columns.some(c=>c.id===x)||!table.columns.some(c=>c.id===y))throw new RangeError('Plot columns not found');
  const groups=new Map();
  for(const row of table.rows){
   const vx=row.values[x],vy=row.values[y];
   if(vx===null||vy===null)continue;
   const id=row.sweepId;
   if(!groups.has(id))groups.set(id,{id,x:[],y:[],indices:[]});
   const g=groups.get(id);g.x.push(Number(vx));g.y.push(Number(vy));g.indices.push(row.index);
  }
  return [...groups.values()].map(g=>Object.freeze({
   type:'scatter',mode:'lines+markers',name:g.id,
   x:Object.freeze(g.x),y:Object.freeze(g.y),
   customdata:Object.freeze(g.indices),
   meta:Object.freeze({captureId:table.captureId,sweepId:g.id,source:SOURCE})
  }));
 }
 return Object.freeze({VERSION,SOURCE,validate,toTable,toCSV,traces});
});
