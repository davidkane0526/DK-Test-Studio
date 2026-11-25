(() => {
 'use strict';
 // Converts only real, completed/stopped KXCI TI responses into a canonical
 // DKDS DataTable. No planned/simulated values can cross this write boundary.
 const OWNER='com.dkts.keithley-4200';
 const FIELDS=[
  ['sequence','序号','','index'],['timeS','测量时间','s','x'],
  ['plannedTimeS','计划采样时间','s','raw'],['sampleStartS','主机采样起点','s','raw'],['sampleWindowOverrun','采样窗口超时','','raw'],
  ['plannedXCurrentA','Xsweep 设定电流','A','raw'],['plannedPCurrentA','Psweep 设定电流','A','raw'],['xCurrentA','Xsweep 实测电流','A','raw'],['pCurrentA','Psweep 实测电流','A','raw'],
  ['plannedXVoltageV','Xsweep 设定电压','V','raw'],['plannedPVoltageV','Psweep 设定电压','V','raw'],
  ['pulseChannelSequence','通道原始点序','','index'],['pulseRunSequence','任务接收顺序','','index'],
  ['pulseVoltageV','脉冲实测电压','V','x'],['pulseCurrentA','脉冲实测电流','A','y'],
  ['drainVoltageV','漏极电压','V','x'],['drainCurrentA','漏极电流','A','y'],
  ['gateVoltageV','栅极电压','V','group'],['gateCurrentA','栅极电流','A','y'],
  ['sourceVoltageV','源极电压','V','group'],['sourceCurrentA','源极电流','A','y'],
  ['xVoltageV','Xsweep 电压','V','x'],['pVoltageV','Psweep 电压','V','group'],
  ['cycle','整体循环','','index'],['xRepeat','Xsweep 重复','','index'],
  ['xSegment','Xsweep 扫描段','','index'],['point','Xsweep 点序','','index'],
  ['pRepeat','Psweep 重复','','index'],['pSegment','Psweep 扫描段','','index'],
  ['pPoint','Psweep 点序','','index']
 ];
 const STRINGS=[
  ['pulseResource','脉冲通道'],['pulseMode','脉冲采集方式'],['pulseStatusRaw','脉冲原始状态'],
  ['source','采集协议来源'],['measurementStatus','测量状态'],['measurementCompleteness','采样完整性'],
  ['complianceRole','触及限流端口'],['rawKxciResponse','KXCI 原始响应'],
  ['rawKxciResponses','各端口原始响应 JSON'],
  ['measurementStatusByRole','端口状态 JSON'],
  ['measurementOrder','采样端口顺序 JSON']
 ];
 const safeId=value=>String(value||'').trim();
 function publishRaw(ctx,{runId,rows,serial,startedAt,finishedAt,runState,source,scope}={}){
  if(!ctx?.data?.model?.createTable||!ctx?.data?.artifacts?.publish)
   throw Error('DKDS Data Center model/Artifact publication is unavailable');
  if(!['completed','stopped','failed'].includes(runState))
   throw Error('Only finalized instrument runs can be published');
  const id=safeId(runId),instrument=safeId(serial);
  if(!/^[A-Za-z0-9._:-]{1,90}$/.test(id)||!instrument)
   throw Error('Verified KXCI run ID and instrument serial are required');
  if(!Array.isArray(rows)||rows.length<1)
   throw Error('No actual KXCI samples to publish');
  for(let i=0;i<rows.length;i++){
   const row=rows[i];
   const pulse=row?.source==='4200A-KXCI-PMU';
   if(!['4200A-KXCI-TI','4200A-KXCI-DO','4200A-KXCI-RD','4200A-KXCI-PMU'].includes(row?.source)||row.sequence!==i+1||
      !Number.isFinite(row.timeS)||!(pulse?Number.isFinite(row.pulseVoltageV)&&Number.isFinite(row.pulseCurrentA):Number.isFinite(row.drainVoltageV)&&Number.isFinite(row.drainCurrentA))||!row.rawKxciResponse||
      !['complete','partial'].includes(row.measurementCompleteness))
    throw Error('Malformed/mixed/synthetic KXCI original record at '+(i+1));
  }
  const pulseRun=rows[0].source==='4200A-KXCI-PMU';
  if(rows.some(row=>(row.source==='4200A-KXCI-PMU')!==pulseRun))throw Error('Mixed SMU and PMU records require separate tables');
  if(pulseRun&&rows.some(row=>row.pulseResource!==rows[0].pulseResource||row.pulseMode!==rows[0].pulseMode))throw Error('Mixed pulse channels or acquisition modes require separate tables');
  // Numeric acquisition channels stay in original units. Missing measurements
  // are NaN in the numeric DataTable; their null/status/response information
  // remains preserved verbatim in the raw metadata/text columns.
  const columns=FIELDS.filter(([key])=>pulseRun?rows.some(row=>row[key]!=null):!key.startsWith('pulse')).map(([key,name,unit,role])=>({
   key,name,unit,role,dtype:'float64',
   values:rows.map(row=>row[key]==null?NaN:Number(row[key]))
  }));
  for(const [key,name] of STRINGS.filter(([key])=>pulseRun||!key.startsWith('pulse'))){
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
    rawInstrumentResponse:true,...(pulseRun?{pulseResource:rows[0].pulseResource,pulseMode:rows[0].pulseMode}:{}),...(scope?.pageId&&scope?.routineId?{dktsScope:{...scope}}:{}),
    acquisition:{runId:id,timestamp:String(startedAt||''),
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
function publishRun(ctx,opts){
 const rows=opts.rows;
 if(!rows?.length||rows[0].source!=='4200A-KXCI-PMU')return publishRaw(ctx,opts);
 const groups=new Map();let sequence=0;for(const row of rows){
  if(row.sequence!==++sequence)throw Error('PMU run sequence is not contiguous');
  if(row.source!=='4200A-KXCI-PMU')throw Error('Mixed measurement sources');
  if(!groups.has(row.pulseResource))groups.set(row.pulseResource,[]);
  const group=groups.get(row.pulseResource);
  if(row.pulseChannelSequence!==undefined&&row.pulseChannelSequence!==group.length+1)throw Error('PMU channel sequence is not contiguous');
  group.push({...row,pulseRunSequence:row.sequence,sequence:group.length+1});
 }
 const artifacts=[];for(const [resource,group] of groups)artifacts.push(publishRaw(ctx,{...opts,runId:groups.size>1?opts.runId+'-'+resource:opts.runId,rows:group}));
 return {...artifacts[0],rows:rows.length,artifacts,canonical:true,unprocessed:true};
}
 const api=Object.freeze({publishRaw,publishRun,owner:OWNER,fields:FIELDS.map(x=>x[0])});
 window.DKDSPluginModules.define(OWNER,'measurementData',api,{replace:true});
})();
