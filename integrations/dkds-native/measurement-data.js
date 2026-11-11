(() => {
 'use strict';
 // Converts only real, completed/stopped KXCI TI responses into a canonical
 // DKDS DataTable. No planned/simulated values can cross this write boundary.
 const OWNER='com.dkts.keithley-4200';
 const FIELDS=[
  ['sequence','序号','','index'],['timeS','测量时间','s','x'],
  ['drainVoltageV','漏极电压','V','x'],['drainCurrentA','漏极电流','A','y'],
  ['gateVoltageV','栅极电压','V','group'],['gateCurrentA','栅极电流','A','y'],
  ['sourceVoltageV','源极电压','V','group'],['sourceCurrentA','源极电流','A','y'],
  ['cycle','循环次数','','index'],['xRepeat','Xsweep 重复','','index'],
  ['xSegment','Xsweep 扫描段','','index'],['pRepeat','Psweep 重复','','index'],
  ['pSegment','Psweep 扫描段','','index']
 ];
 const STRINGS=[
  ['measurementStatus','测量状态'],['measurementCompleteness','采样完整性'],
  ['complianceRole','触及限流端口'],['rawKxciResponse','KXCI 原始 TI 响应'],
  ['rawKxciResponses','各端口原始响应 JSON'],
  ['measurementStatusByRole','端口状态 JSON'],
  ['measurementOrder','采样端口顺序 JSON']
 ];
 const safeId=value=>String(value||'').trim();
 function publishRaw(ctx,{runId,rows,serial,startedAt,finishedAt,runState,source}={}){
  if(!ctx?.data?.model?.createTable||!ctx?.data?.artifacts?.publish)
   throw Error('DKDS Data Center model/Artifact publication is unavailable');
  if(!['completed','stopped','failed'].includes(runState))
   throw Error('Only finalized instrument runs can be published');
  const id=safeId(runId),instrument=safeId(serial);
  if(!/^[A-Za-z0-9._:-]{1,90}$/.test(id)||!instrument)
   throw Error('Verified KXCI run ID and instrument serial are required');
  if(!Array.isArray(rows)||rows.length<1)
   throw Error('No actual KXCI TI samples to publish');
  for(let i=0;i<rows.length;i++){
   const row=rows[i];
   if(row?.source!=='4200A-KXCI-TI'||row.sequence!==i+1||
      !Number.isFinite(row.timeS)||!Number.isFinite(row.drainVoltageV)||
      !Number.isFinite(row.drainCurrentA)||!row.rawKxciResponse||
      !['complete','partial'].includes(row.measurementCompleteness))
    throw Error('Malformed/mixed/synthetic KXCI original record at '+(i+1));
  }
  // Numeric acquisition channels stay in original units. Missing measurements
  // are NaN in the numeric DataTable; their null/status/response information
  // remains preserved verbatim in the raw metadata/text columns.
  const columns=FIELDS.map(([key,name,unit,role])=>({
   key,name,unit,role,dtype:'float64',
   values:rows.map(row=>row[key]==null?NaN:row[key])
  }));
  for(const [key,name] of STRINGS){
   columns.push({key,name,unit:'',role:'raw',dtype:'string',
    values:rows.map(row=>
     key==='rawKxciResponses'||key==='measurementStatusByRole'||key==='measurementOrder'
      ?JSON.stringify(row[key]??null):String(row[key]??''))});
  }
  const table=ctx.data.model.createTable({
   id:'dkts:kxci:'+id,
   name:'4200A '+id,
   semanticType:'science.transport.iv',
   transient:false,
   source:source||{name:'KI4200A '+instrument},
   metadata:{instrument:'KI4200A',instrumentSerial:instrument,
    rawInstrumentResponse:true,acquisition:{runId:id,timestamp:String(startedAt||''),
     finishedAt:String(finishedAt||''),runState,sequenceIndex:0,
     provenance:'kxci-native-acquisition'},
    dataAssignments:[OWNER]},
   columns
  });
  if(table.kind!=='data.table'||table.rowCount!==rows.length)
   throw Error('DKDS DataTable conversion did not preserve original row count');
  const result=ctx.data.artifacts.publish(table);
  ctx.project?.capture?.();
  return Object.freeze({artifactId:table.id,rows:rows.length,published:result?.changed!==false,
   canonical:true,unprocessed:true});
 }
 const api=Object.freeze({publishRaw,owner:OWNER,fields:FIELDS.map(x=>x[0])});
 window.DKDSPluginModules.define(OWNER,'measurementData',api,{replace:true});
})();
