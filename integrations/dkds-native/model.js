(() => {
 'use strict';
 const KINDS=Object.freeze([
  {id:'iv',label:'I–V 扫描',testType:'DC'},
  {id:'transfer',label:'转移特性',testType:'DC'},
  {id:'output',label:'输出特性',testType:'DC'},
  {id:'pund',label:'PUND',testType:'Pulse'},
  {id:'endurance',label:'耐久性',testType:'Cycle'},
  {id:'retention',label:'保持特性',testType:'Time'},
  {id:'arb',label:'任意波形',testType:'Pulse'},
  {id:'time',label:'时间扫描',testType:'IVT'},
  {id:'pulse',label:'脉冲扫描',testType:'Pulse'},
  {id:'cv',label:'C–V 扫描',testType:'CV'}
 ]);
 const clone=x=>JSON.parse(JSON.stringify(x));
 // Offline scan structure mirrors the nested Xsweep/Psweep programming model.
 // No field in this project state authorizes or sends an instrument command.
 const segment=(mode='voltage',axis='X')=>({
  start:'0',stop:axis==='P'?'1':mode==='current'?'0.01':'2',
  step:mode==='current'?'0.001':'0.1',delayMs:'20',range:'auto',speed:'Normal'
 });
 const defaultSweep=()=>({
  contractVersion:2,loops:'1',xRepeats:'1',pRepeats:'1',pEnabled:false,
  mode:'linear',speed:'Normal',pointDelay:'20',
  xSegments:[segment()],pSegments:[segment('voltage','P')]
 });
 const sweepKeys=Object.freeze(['loops','xRepeats','pRepeats','pEnabled','mode','speed','pointDelay']);
 const segmentKeys=Object.freeze(['start','stop','step','delayMs','range','speed']);
 const positiveInt=(raw,max,label)=>{
  const text=String(raw??'');
  if(!/^[1-9][0-9]*$/.test(text))throw Error(label+' must be a positive integer');
  const n=Number(text);
  if(!Number.isSafeInteger(n)||n>max)throw Error(label+' exceeds planning bound');
  return n;
 };
 const numeric=(raw,label)=>{
  const text=String(raw??'').trim();
  if(!/^[+-]?(?:[0-9]+[.]?[0-9]*|[.][0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(text)||
      !Number.isFinite(Number(text)))throw Error('Invalid numeric input: '+label);
  return Number(text);
 };
 function segmentPoints(seg){
  const a=Number(seg.start),b=Number(seg.stop),step=Number(seg.step);
  if(a===b){
   if(step!==0)throw Error('SWEEP_STEP: identical endpoints require zero step');
   return 1;
  }
  if(step===0||Math.sign(b-a)!==Math.sign(step))
   throw Error('SWEEP_DIRECTION: step direction differs from endpoint');
  // Mirror the standalone KXCI planner: no silently shortened final step.
  const interval=(b-a)/step,nearest=Math.round(interval);
  if(!Number.isSafeInteger(nearest)||nearest<1||
      Math.abs(interval-nearest)>1e-8*Math.max(1,Math.abs(interval)))
   throw Error('SWEEP_ENDPOINT: step cannot exactly reach requested stop');
  if(nearest+1>4096)throw Error('SWEEP_POINTS: KXCI segment exceeds 4096 points');
  return nearest+1;
 }
 function validateSweep(p){
  const defaults=defaultSweep();
  const legacy=!p.sweep||p.sweep.contractVersion===undefined;
  p.sweep={...defaults,...(p.sweep||{})};
  const sw=p.sweep;
  if(sw.contractVersion!==2)throw Error('Unsupported sweep contract version');
  if(legacy){
   // v0.8.0 created a one-point append with a nonzero default step.
   // Normalize only snapshots without an explicit contract version.
   for(const key of ['xSegments','pSegments'])
    if(Array.isArray(sw[key]))for(const row of sw[key]){
     if(row&&Number.isFinite(Number(row.start))&&
         Number(row.start)===Number(row.stop))row.step='0';
    }
  }
  for(const key of ['loops','xRepeats','pRepeats'])positiveInt(sw[key],10000,key);
  if(typeof sw.pEnabled!=='boolean')throw Error('Invalid Psweep enable state');
  if(!['linear','bidirectional','hysteresis'].includes(sw.mode))throw Error('Invalid scan mode');
  if(!['Fast','Normal','Quiet'].includes(sw.speed))throw Error('Invalid measurement speed');
  const pointDelay=numeric(sw.pointDelay,'point delay');
  if(pointDelay<0||pointDelay>6553)throw Error('Invalid sweep delay (0..6553 ms)');
  for(const axis of ['X','P']){
   const key=axis==='X'?'xSegments':'pSegments',list=sw[key];
   if(!Array.isArray(list)||!list.length||list.length>64)throw Error('Invalid '+axis+' segment count');
   const terminal=p.terminals.find(t=>t.role===axis&&t.resource!=='None');
   const voltageSource=terminal?.sourceMode!=='current';
   const sourceMax=voltageSource?210:1.05;
   const rangeMax=voltageSource?1.05:210;
   for(const [i,row] of list.entries()){
    if(!row||typeof row!=='object'||Array.isArray(row))throw Error('Invalid '+axis+' segment');
    for(const key of ['start','stop','step','delayMs'])numeric(row[key],axis+'['+i+'].'+key);
    if(Number(row.delayMs)<0||Number(row.delayMs)>6553)
     throw Error('Invalid sweep delay (0..6553 ms)');
    if(!['Fast','Normal','Quiet'].includes(row.speed||'Normal'))
     throw Error('Invalid segment speed');
    if(Math.max(Math.abs(Number(row.start)),Math.abs(Number(row.stop)))>sourceMax)
     throw Error('HARDWARE_ENVELOPE: scan source exceeds theoretical SMU envelope');
    if(terminal&&Math.max(Math.abs(Number(row.start)),Math.abs(Number(row.stop)))>
        (voltageSource?21:0.105)&&Number(terminal.compliance)>(voltageSource?0.105:21))
     throw Error('HARDWARE_POWER_ENVELOPE: scan source and compliance conflict');
    if(row.range!=='auto'){
     const range=numeric(row.range,axis+'['+i+'].range');
     if(range<=0||range>rangeMax)throw Error('HARDWARE_RANGE_ENVELOPE: scan measurement range');
    }
    segmentPoints(row);
   }
  }
 }
 function summary(p){
  const scan=p.sweep||defaultSweep();
  const x=p.terminals.find(t=>!['None','GNDU'].includes(t.resource)&&t.role==='X');
  const second=scan.pEnabled;
  const parallel=p.terminals.find(t=>!['None','GNDU'].includes(t.resource)&&t.role==='P');
  if(!x)return {ready:false,reason:'请先分配 Xsweep 的 SMU 端口'};
  if(second&&!parallel)return {ready:false,reason:'Psweep 已启用，请分配独立的 SMU 端口'};
  const xPoints=scan.xSegments.reduce((n,row)=>n+segmentPoints(row),0);
  const pPoints=second?scan.pSegments.reduce((n,row)=>n+segmentPoints(row),0):1;
  const total=xPoints*positiveInt(scan.xRepeats,10000,'Xsweep repeats')*
    pPoints*(second?positiveInt(scan.pRepeats,10000,'Psweep repeats'):1)*
    positiveInt(scan.loops,10000,'cycles');
  if(!Number.isSafeInteger(total))return {ready:false,reason:'总扫描点数超过可精确表示范围'};
  return {ready:true,mode:'offline-only',xTerminal:x.logical,pTerminal:second?parallel.logical:null,
   xPoints,pPoints,total,loops:Number(scan.loops),xRepeats:Number(scan.xRepeats),
   pRepeats:second?Number(scan.pRepeats):0};
 }
 // Deterministic, zero-allocation-at-scale *offline* planning cursor.
 // X steps form the innermost loop, followed by X repeats, P steps,
 // P repeats, and finally whole-page loops. Not an instrument runner.
 function segmentAt(segments,index){
  let cursor=index;
  for(let i=0;i<segments.length;i++){
   const seg=segments[i],length=segmentPoints(seg);
   if(cursor<length){
    const value=cursor===length-1?Number(seg.stop):
     Number((Number(seg.start)+cursor*Number(seg.step)).toPrecision(13));
    return Object.freeze({segment:i+1,step:cursor+1,value,
     delayMs:Number(seg.delayMs),range:seg.range,speed:seg.speed||'Normal'});
   }
   cursor-=length;
  }
  throw new RangeError('Sweep cursor outside segment list');
 }
 function pointAt(page,index){
  // Validate a copy: cursor reads must not mutate persisted project state.
  if(!page||!['iv','transfer','output'].includes(page.kind))
   throw Error('Only DC sweep pages have an offline X/P scan cursor');
  const p={...page,sweep:clone(page.sweep||defaultSweep())};
  validateSweep(p);
  const info=summary(p);
  if(!info.ready)throw Error(info.reason);
  if(!Number.isSafeInteger(index)||index<0||index>=info.total)
   throw new RangeError('Sweep cursor index out of bounds');
  const sw=p.sweep;
  const xBlock=info.xPoints*info.xRepeats;
  const pBlock=info.pPoints*(sw.pEnabled?info.pRepeats:1);
  const cyclePoints=xBlock*pBlock;
  const inner=index%cyclePoints;
  const pBlockOffset=Math.floor(inner/xBlock);
  const xOffset=inner%xBlock;
  const xTerminal=p.terminals.find(t=>t.logical===info.xTerminal);
  const pTerminal=sw.pEnabled?p.terminals.find(t=>t.logical===info.pTerminal):null;
  const x=Object.freeze({...segmentAt(sw.xSegments,xOffset%info.xPoints),
   logical:xTerminal.logical,resource:xTerminal.resource,mode:xTerminal.sourceMode,
   repeat:Math.floor(xOffset/info.xPoints)+1});
  const outer=sw.pEnabled?Object.freeze({
   ...segmentAt(sw.pSegments,pBlockOffset%info.pPoints),
   logical:pTerminal.logical,resource:pTerminal.resource,mode:pTerminal.sourceMode,
   repeat:Math.floor(pBlockOffset/info.pPoints)+1}):null;
  const fixed=Object.freeze(p.terminals.filter(t=>!['None','GNDU'].includes(t.resource)&&
   (t.role==='CONDITION'||(!sw.pEnabled&&t.role==='P')))
   .map(t=>Object.freeze({logical:t.logical,resource:t.resource,
    mode:t.sourceMode,value:Number(t.bias)})));
  return Object.freeze({index,loop:Math.floor(index/cyclePoints)+1,
   x,p:outer,fixed,provenance:'planned-only',executable:false,hardwareVerified:false});
 }
 const ports=()=>[
  {logical:'D',resource:'SMU1',sourceMode:'voltage',role:'X'},
  {logical:'G',resource:'SMU2',sourceMode:'voltage',role:'CONDITION'},
  {logical:'S',resource:'GNDU',sourceMode:'voltage',role:'CONDITION'},
  {logical:'B',resource:'None',sourceMode:'voltage',role:'CONDITION'}
 ].map(row=>({...row,bias:'0',start:'0',stop:'2',step:'0.1',compliance:'0.01',complianceMode:'follow-range',rangeMode:'auto',rangeValue:'1e-6'}));
 const logicalsList=['S','D','G','B'];
 const validResource=value=>/^(?:None|GNDU|SMU[1-9]|PMU[1-9](?:-[12])?)$/.test(value);
 const mappingOf=terminals=>Object.fromEntries(terminals.map(({logical,resource})=>[logical,resource]));
 const page=(kind='iv',id='page-1',routineId='routine-1')=>{
  const type=KINDS.find(x=>x.id===kind);if(!type)throw Error('Unknown test type');
  return {id,routineId,kind,name:type.label,testType:type.testType,note:'',
   terminals:ports(),sweep:defaultSweep(),
   target:{name:'Id',logical:'D',quantity:'Current',range:'auto'},
   targets:[{id:'target-1',name:'Id',logical:'D',quantity:'Current',range:'auto'}],variables:[]};
 };
 const initial=()=>({schema:1,sequence:1,activeId:'page-1',
  activeDeviceId:'device-1',devices:[{id:'device-1',name:'MOSFET'}],
  activeRoutineId:'routine-1',
  routines:[{id:'routine-1',deviceId:'device-1',name:'测试流程 1'}],
  specs:[],pages:[page()],ui:{graphs:{count:4,
   kinds:['iv','transfer','it','raw'],sources:['','','','']}}});
 function validate(state){
  if(state?.schema!==1||!Array.isArray(state.pages)||!state.pages.length||
     state.pages.length>128||!Number.isSafeInteger(state.sequence)||state.sequence<1)
   throw Error('Invalid DKTS project state');
  state=clone(state);
  // Schema-1 snapshots predate Device ownership. Migrate in a cloned state
  // only; never change an already persisted project while merely validating.
  if(!Array.isArray(state.devices))
   state.devices=[{id:'device-1',name:'MOSFET'}];
  if(!state.devices.length||state.devices.length>100)
   throw Error('Invalid Device count');
  const deviceIds=new Set();
  for(const device of state.devices){
   if(!/^device-[A-Za-z0-9-]+$/.test(device?.id||'')||
      deviceIds.has(device.id)||typeof device.name!=='string'||
      !device.name.trim()||device.name.length>64)
    throw Error('Invalid Device');
   deviceIds.add(device.id);
  }
  if(!Array.isArray(state.routines)||!state.routines.length)
   state.routines=[{id:'routine-1',deviceId:state.devices[0].id,name:'测试流程 1'}];
  if(state.routines.length>100)throw Error('Too many Routines');
  const routineIds=new Set(),routineOwners=new Map();
  for(const routine of state.routines){
   if(!routine.deviceId)routine.deviceId=state.devices[0].id;
   if(!/^routine-[A-Za-z0-9-]+$/.test(routine?.id||'')||
      routineIds.has(routine.id)||typeof routine.name!=='string'||
      !routine.name.trim()||routine.name.length>64||
      !deviceIds.has(routine.deviceId))throw Error('Invalid Routine or Device ownership');
   routine.loops=String(positiveInt(routine.loops??'1',10000,'Routine loops'));
   routineIds.add(routine.id);
   routineOwners.set(routine.id,routine.deviceId);
  }
  if(!Array.isArray(state.specs))state.specs=[];
  if(state.specs.length>100)throw Error('Too many Specs');
  const specIds=new Set(),specOwners=new Map();
  for(const spec of state.specs){
   if(!spec.deviceId)spec.deviceId=state.devices[0].id;
   if(!/^spec-[A-Za-z0-9-]+$/.test(spec?.id||'')||
      specIds.has(spec.id)||typeof spec.name!=='string'||
      !spec.name.trim()||spec.name.length>64||
      !deviceIds.has(spec.deviceId))throw Error('Invalid Spec or Device ownership');
   specIds.add(spec.id);
   specOwners.set(spec.id,spec.deviceId);
  }
  const ids=new Set();
  const legacyMapping=state.portMapping===undefined;
  if(!legacyMapping&&(!state.portMapping||Object.keys(state.portMapping).length!==4||
     logicalsList.some(logical=>!validResource(state.portMapping[logical]))))
   throw Error('Invalid project port mapping');
  for(const p of state.pages){
   if(!p.routineId)p.routineId=state.routines[0].id;
   if(!routineIds.has(p.routineId))throw Error('Page references an unknown Routine');
   if(p.associateSpecId===undefined)p.associateSpecId=null;
   if(p.associateSpecId!==null&&
      (!specIds.has(p.associateSpecId)||
       specOwners.get(p.associateSpecId)!==routineOwners.get(p.routineId)))
    throw Error('Page Spec must belong to the same Device');
   if(!/^page-[1-9]\d*$/.test(p?.id||'')||ids.has(p.id)||!KINDS.some(k=>k.id===p.kind)||
      !Array.isArray(p.terminals)||p.terminals.length!==4)throw Error('Invalid Page');
   ids.add(p.id);
   if(typeof p.name!=='string'||!p.name.trim()||p.name.length>64)
    throw Error('Invalid Page name');
   if(p.note===undefined)p.note='';
   if(typeof p.note!=='string'||p.note.length>512)throw Error('Invalid Page note');
   // UI planning metadata is never a hardware execution permission.
   if(!p.target)p.target={name:'Id',logical:'D',quantity:'Current',range:'auto'};
   if(typeof p.target.name!=='string'||!p.target.name.trim()||p.target.name.length>32)
    p.target.name='Id';
   if(!['D','G','S','B'].includes(p.target.logical)||
      !['Current','Voltage'].includes(p.target.quantity))throw Error('Invalid Target plan');
   if(!Array.isArray(p.targets)||!p.targets.length){
    p.targets=[{id:'target-1',name:p.target.name||'Id',logical:p.target.logical,
     quantity:p.target.quantity,range:p.target.range||'auto'}];
   }
   if(p.targets.length>16)throw Error('Too many measurement targets');
   const targetIds=new Set(),targetNames=new Set();
   for(const [index,target] of p.targets.entries()){
    if(!target||!/^target-[1-9][0-9]*$/.test(target.id||'')||targetIds.has(target.id)||
       typeof target.name!=='string'||! /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(target.name)||
       targetNames.has(target.name)||!['D','G','S','B'].includes(target.logical)||
       !['Current','Voltage'].includes(target.quantity)||
       !(target.range==='auto'||/^(?:1e-[0-9]+|1e[0-9]+|[0-9]+(?:\.[0-9]+)?)$/.test(String(target.range))))
     throw Error('Invalid measurement target '+(index+1));
    targetIds.add(target.id);targetNames.add(target.name);
   }
   p.target={...p.targets[0]};
   if(!Array.isArray(p.variables))p.variables=[];
   if(p.variables.length>32)throw Error('Too many Page variables');
   const variableNames=new Set();
   for(const variable of p.variables){
    if(!/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(variable?.name||'')||
       variableNames.has(variable.name))throw Error('Invalid or duplicate Page variable name');
    variableNames.add(variable.name);
    numeric(variable.value,'Page variable');
    if(typeof variable.unit!=='string'||variable.unit.length>12)
     throw Error('Invalid Page variable unit');
   }
   const resources=new Set(),roles=new Set(),logicals=new Set();
   for(const t of p.terminals){
    if(logicals.has(t.logical))throw Error('Duplicate logical terminal: '+t.logical);
    logicals.add(t.logical);
    if(!legacyMapping)t.resource=state.portMapping[t.logical];
    if(t.resource!=='None'){
     if(resources.has(t.resource))throw Error('Duplicate SMU assignment: '+t.resource);
     resources.add(t.resource);
     if(t.role!=='CONDITION'){
      if(roles.has(t.role))throw Error('Duplicate sweep role: '+t.role);
      roles.add(t.role);
     }
    }
    if(t.complianceMode===undefined)t.complianceMode='follow-range';
    if(!logicalsList.includes(t.logical)||!validResource(t.resource)||
       !['voltage','current'].includes(t.sourceMode)||!['CONDITION','X','P'].includes(t.role)||
       !['auto','minimum','limited-auto','fixed'].includes(t.rangeMode)||
       !['follow-range','custom'].includes(t.complianceMode)||
       (['minimum','limited-auto'].includes(t.rangeMode)&&t.sourceMode!=='voltage'))
     throw Error('Invalid port mapping');
    const numeric=/^[+-]?(?:[0-9]+[.]?[0-9]*|[.][0-9]+)(?:[eE][+-]?[0-9]+)?$/;
    for(const key of ['bias','start','stop','step','compliance','rangeValue']){
     const raw=String(t[key]??'').trim();
     if(!numeric.test(raw)||!Number.isFinite(Number(raw)))
      throw Error('Invalid numeric input: '+t.logical+'.'+key);
    }
    const magnitude=Math.max(Math.abs(Number(t.bias)),Math.abs(Number(t.start)),Math.abs(Number(t.stop)));
    const compliance=Number(t.compliance),range=Number(t.rangeValue);
    if(compliance<=0||Number(t.step)===0||range<=0)throw Error('Invalid limit/step/range');
    // Overall theoretical envelope across SMUs: this is NOT per-model
    // authorization. Exact attached module/preamp check remains mandatory.
    const sourceMax=t.sourceMode==='voltage'?210:1.05;
    const complianceMax=t.sourceMode==='voltage'?1.05:210;
    if(magnitude>sourceMax||compliance>complianceMax)
     throw Error('HARDWARE_ENVELOPE: source/compliance exceeds 4200A SMU maximum');
    if((t.sourceMode==='voltage'&&magnitude>21&&compliance>0.105)||
       (t.sourceMode==='current'&&magnitude>0.105&&compliance>21))
     throw Error('HARDWARE_POWER_ENVELOPE: high voltage and high current cannot coexist');
    if(t.rangeMode!=='auto'&&range>complianceMax)
     throw Error('HARDWARE_RANGE_ENVELOPE: measurement range exceeds theoretical limit');
   }
   validateSweep(p);
  }
  // UI plot layout is canonical project state and survives Core workspace reopening.
  if(!state.ui||typeof state.ui!=='object')state.ui={};
  if(!state.ui.graphs)state.ui.graphs=initial().ui.graphs;
  const graphs=state.ui.graphs;
  if(![1,2,4].includes(Number(graphs.count))||!Array.isArray(graphs.kinds)||
     graphs.kinds.length!==4||!Array.isArray(graphs.sources)||graphs.sources.length!==4)
   throw Error('Invalid persisted plot window state');
  if(graphs.kinds.some(kind=>!['iv','transfer','it','raw'].includes(kind))||
     graphs.sources.some(id=>typeof id!=='string'||id.length>160))
   throw Error('Invalid plot selection');
  if(!ids.has(state.activeId))throw Error('Active Page missing');
  if(legacyMapping){
   state.portMapping=mappingOf(state.pages.find(p=>p.id===state.activeId).terminals);
   for(const p of state.pages){
    const original=mappingOf(p.terminals);
    if(logicalsList.some(logical=>original[logical]!==state.portMapping[logical]))
     p.previousPortMapping=original;
   }
   return validate(state);
  }
  const scoped=state.ui.scopedGraphs||{};
  state.ui.scopedGraphs=Object.fromEntries(Object.entries(scoped).filter(([id,graph])=>
   (ids.has(id)||routineIds.has(id))&&graph&&[1,2,4].includes(Number(graph.count))&&
   Array.isArray(graph.kinds)&&graph.kinds.length===4&&graph.kinds.every(kind=>['iv','transfer','it','raw'].includes(kind))&&
   Array.isArray(graph.sources)&&graph.sources.length===4&&graph.sources.every(id=>typeof id==='string'&&id.length<=160)));
  state.activeRoutineId=state.pages.find(p=>p.id===state.activeId).routineId;
  state.activeDeviceId=routineOwners.get(state.activeRoutineId);
  return state;
 }
 function add(s,kind,routineId){
  s=validate(s);const id='page-'+(s.sequence+1);
  const target=routineId||s.activeRoutineId;
  if(!s.routines.some(r=>r.id===target))throw Error('Unknown Routine');
  s.sequence++;s.pages.push(page(kind,id,target));
  s.activeId=id;s.activeRoutineId=target;return validate(s);
 }
 function addRoutine(s,deviceId){
  s=validate(s);
  if(s.routines.length>=100||s.pages.length>=128)
   throw Error('Maximum Routines or Pages reached');
  const owner=deviceId||s.activeDeviceId;
  if(!s.devices.some(d=>d.id===owner))throw Error('Unknown Device');
  const routineId='routine-'+(s.routines.length+1);
  if(s.routines.some(r=>r.id===routineId))throw Error('Duplicate Routine ID');
  s.routines.push({id:routineId,deviceId:owner,name:'测试流程 '+(s.routines.length+1)});
  return add(s,'iv',routineId);
 }
 function addDevice(s){
  s=validate(s);
  if(s.devices.length>=100)throw Error('Maximum 100 Devices');
  const deviceId='device-'+(s.devices.length+1);
  if(s.devices.some(d=>d.id===deviceId))throw Error('Duplicate Device ID');
  s.devices.push({id:deviceId,name:'器件 '+(s.devices.length+1)});
  return addRoutine(s,deviceId);
 }
 function selectDevice(s,deviceId){
  s=validate(s);
  if(!s.devices.some(d=>d.id===deviceId))throw Error('Unknown Device');
  const routine=s.routines.find(r=>r.deviceId===deviceId);
  if(!routine)return addRoutine(s,deviceId);
  return selectRoutine(s,routine.id);
 }
 function selectRoutine(s,routineId){
  s=validate(s);
  if(!s.routines.some(r=>r.id===routineId))throw Error('Unknown Routine');
  const first=s.pages.find(p=>p.routineId===routineId);
  if(!first)return add(s,'iv',routineId);
  s.activeId=first.id;s.activeRoutineId=routineId;
  return validate(s);
 }
 function setRoutineLoops(s,routineId,loops){
  s=validate(s);
  const routine=s.routines.find(row=>row.id===routineId);
  if(!routine)throw Error('Unknown Routine');
  routine.loops=String(positiveInt(loops,10000,'Routine loops'));
  return s;
 }
 function addSpec(s){
  s=validate(s);
  if(s.specs.length>=100)throw Error('Maximum 100 Specs');
  const id='spec-'+(s.specs.length+1);
  if(s.specs.some(spec=>spec.id===id))throw Error('Duplicate Spec ID');
  s.specs.push({id,deviceId:s.activeDeviceId,name:'Spec '+(s.specs.length+1)});
  return associateSpec(s,id);
 }
 function associateSpec(s,specId){
  s=validate(s);
  if(specId!==null&&!s.specs.some(spec=>spec.id===specId&&
      spec.deviceId===s.activeDeviceId))
   throw Error('Spec belongs to another Device or is unknown');
  const active=s.pages.find(p=>p.id===s.activeId);
  active.associateSpecId=specId;
  return validate(s);
 }
 function remove(s,id){
  s=validate(s);
  if(s.pages.length===1)throw Error('Cannot remove the last test');
  const index=s.pages.findIndex(x=>x.id===id);
  if(index<0)throw Error('Page missing');
  s.pages.splice(index,1);
  if(s.activeId===id)s.activeId=s.pages[Math.min(index,s.pages.length-1)].id;
  return validate(s);
 }
 function select(s,id){
  s=validate(s);if(!s.pages.some(x=>x.id===id))throw Error('Page missing');
  s.activeId=id;s.activeRoutineId=s.pages.find(p=>p.id===id).routineId;return s;
 }
 function editPage(s,changes){
  s=validate(s);
  if(!changes||typeof changes!=='object'||
     Object.keys(changes).some(k=>!['name','note','kind'].includes(k)))
   throw Error('Invalid Page metadata change');
  const page=s.pages.find(p=>p.id===s.activeId),patch={...changes};
  if(patch.kind!==undefined){
   const kind=KINDS.find(row=>row.id===patch.kind);if(!kind)throw Error('Unknown test type');
   page.kind=kind.id;page.testType=kind.testType;
   if(patch.name===undefined)page.name=kind.label;
   delete patch.kind;
  }
  Object.assign(page,patch);
  return validate(s);
 }
 function editDevice(s,changes){
  s=validate(s);
  if(!changes||typeof changes!=='object'||Object.keys(changes).some(k=>k!=='name'))
   throw Error('Invalid Device metadata change');
  const device=s.devices.find(row=>row.id===s.activeDeviceId);
  if(!device)throw Error('Active Device missing');
  Object.assign(device,changes);return validate(s);
 }
 function editTarget(s,indexOrChanges,maybeChanges){
  s=validate(s);
  const index=typeof indexOrChanges==='number'?indexOrChanges:0;
  const changes=typeof indexOrChanges==='number'?maybeChanges:indexOrChanges;
  if(!Number.isInteger(index)||!changes||typeof changes!=='object'||
     Object.keys(changes).some(k=>!['name','logical','quantity','range'].includes(k)))
   throw Error('Invalid Target change');
  const page=s.pages.find(p=>p.id===s.activeId),target=page.targets[index];
  if(!target)throw Error('Target missing');
  Object.assign(target,changes);page.target={...page.targets[0]};
  return validate(s);
 }
 function addTarget(s){
  s=validate(s);const page=s.pages.find(p=>p.id===s.activeId);
  if(page.targets.length>=16)throw Error('Maximum 16 measurement targets');
  let index=page.targets.length+1,name='I'+index;
  while(page.targets.some(row=>row.name===name)){index++;name='I'+index;}
  const available=page.terminals.find(t=>!['None','GNDU'].includes(t.resource));
  if(!available)throw Error('No assigned SMU is available for a measurement target');
  let targetIndex=1;while(page.targets.some(row=>row.id==='target-'+targetIndex))targetIndex++;
  const id='target-'+targetIndex;
  page.targets.push({id,name,logical:available.logical,quantity:'Current',range:'auto'});
  page.target={...page.targets[0]};return validate(s);
 }
 function removeTarget(s,index){
  s=validate(s);const page=s.pages.find(p=>p.id===s.activeId);
  if(!Number.isInteger(index)||index<0||index>=page.targets.length)throw Error('Target missing');
  if(page.targets.length<=1)throw Error('At least one measurement target must remain');
  page.targets.splice(index,1);page.target={...page.targets[0]};return validate(s);
 }
 function addVariable(s){
  s=validate(s);
  const vars=s.pages.find(p=>p.id===s.activeId).variables;
  if(vars.length>=32)throw Error('Maximum 32 Page variables');
  let index=vars.length+1;
  while(vars.some(row=>row.name==='var'+index))index++;
  vars.push({name:'var'+index,value:'0',unit:'V'});
  return validate(s);
 }
 function editVariable(s,index,changes){
  s=validate(s);
  if(!Number.isInteger(index)||!changes||typeof changes!=='object'||
     Object.keys(changes).some(k=>!['name','value','unit'].includes(k)))
   throw Error('Invalid Page variable change');
  const vars=s.pages.find(p=>p.id===s.activeId).variables;
  if(index<0||index>=vars.length)throw Error('Page variable missing');
  Object.assign(vars[index],changes);
  return validate(s);
 }
 function removeVariable(s,index){
  s=validate(s);
  const vars=s.pages.find(p=>p.id===s.activeId).variables;
  if(!Number.isInteger(index)||index<0||index>=vars.length)
   throw Error('Page variable missing');
  vars.splice(index,1);
  return validate(s);
 }
 function edit(s,logical,values){
  s=validate(s);
  const p=s.pages.find(x=>x.id===s.activeId),t=p.terminals.find(x=>x.logical===logical);
  if(!t||!values||Object.keys(values).some(key=>![
   'resource','sourceMode','role','bias','start','stop','step','compliance','complianceMode','rangeMode','rangeValue'
  ].includes(key)))throw Error('Invalid terminal change');
  Object.assign(t,values);
  if(Object.hasOwn(values,'resource'))s.portMapping[logical]=values.resource;
  if(values.sourceMode&&t.role!=='CONDITION'){
   // Changing source quantity must reset all associated sweep segment units.
   const key=t.role==='X'?'xSegments':'pSegments';
   p.sweep[key]=[segment(values.sourceMode,t.role)];
  }
  if(values.sourceMode){
   // Source units have changed (volts versus amperes), so retaining a
   // voltage sweep 0..2 as a 0..2 A sweep would violate the hardware
   // envelope. Reset ALL incompatible numeric quantities atomically.
   if(values.sourceMode==='current')Object.assign(t,{
    bias:'0',start:'0',stop:'0.01',step:'0.001',compliance:'2',
    rangeMode:'auto',rangeValue:'2'
   });else Object.assign(t,{
    bias:'0',start:'0',stop:'2',step:'0.1',compliance:'0.01',
    rangeMode:'auto',rangeValue:'1e-6'
   });
  }
  if(values.resource==='None')for(const page of s.pages)
   page.terminals.find(term=>term.logical===logical).role='CONDITION';
  if(values.role&&values.role!=='CONDITION')for(const other of p.terminals)
   if(other!==t&&other.role===values.role)other.role='CONDITION';
  return validate(s);
 }
 function editSweep(s,changes){
  s=validate(s);
  if(!changes||typeof changes!=='object'||Object.keys(changes).some(k=>!sweepKeys.includes(k)))
   throw Error('Invalid sweep setting');
  const p=s.pages.find(x=>x.id===s.activeId);
  Object.assign(p.sweep,changes);
  if(Object.prototype.hasOwnProperty.call(changes,'pointDelay')){
   for(const row of [...p.sweep.xSegments,...p.sweep.pSegments])row.delayMs=String(changes.pointDelay);
  }
  return validate(s);
 }
 function orientSegmentStep(row){
  const direction=Math.sign(numeric(row.stop,'stop')-numeric(row.start,'start'));
  const step=numeric(row.step,'step');
  if(direction&&step&&Math.sign(step)!==direction)row.step=String(-step);
 }
 function connectFollowingSegments(list,index){
  for(let i=index+1;i<list.length;i++){
   const row=list[i];
   const singlePoint=Number(row.start)===Number(row.stop)&&Number(row.step)===0;
   row.start=list[i-1].stop;
   if(singlePoint)row.stop=row.start;
   if(Number(row.start)===Number(row.stop))row.step='0';
   orientSegmentStep(row);
  }
 }
 function editSegment(s,axis,index,changes){
  s=validate(s);
  if(!['X','P'].includes(axis)||!Number.isInteger(index)||!changes||
     Object.keys(changes).some(k=>!segmentKeys.includes(k)))throw Error('Invalid sweep segment change');
  const p=s.pages.find(x=>x.id===s.activeId),list=p.sweep[axis==='X'?'xSegments':'pSegments'];
  if(index<0||index>=list.length)throw Error('Sweep segment missing');
  const row=list[index];
  Object.assign(row,changes);
  if(['start','stop','step'].some(key=>Object.hasOwn(changes,key))){
   if(!Object.hasOwn(changes,'step')&&numeric(row.start,'start')===numeric(row.stop,'stop'))
    row.step='0';
   orientSegmentStep(row);
   if(Object.hasOwn(changes,'stop'))connectFollowingSegments(list,index);
  }
  return validate(s);
 }
 function addSegment(s,axis){
  s=validate(s);
  if(!['X','P'].includes(axis))throw Error('Unknown sweep axis');
  const p=s.pages.find(x=>x.id===s.activeId),list=p.sweep[axis==='X'?'xSegments':'pSegments'];
  if(list.length>=64)throw Error('Maximum 64 segments per axis');
  const terminal=p.terminals.find(t=>t.role===axis&&t.resource!=='None');
  const next=segment(terminal?.sourceMode||'voltage',axis);
  next.delayMs=String(p.sweep.pointDelay??'20');
  const last=list[list.length-1];
  next.start=last.stop;
  next.stop=next.start;
  next.step='0'; // A one-point segment must use step=0, per the KXCI planner.
  list.push(next);
  return validate(s);
 }
 function removeSegment(s,axis,index){
  s=validate(s);
  if(!['X','P'].includes(axis)||!Number.isInteger(index))throw Error('Invalid sweep axis/index');
  const p=s.pages.find(x=>x.id===s.activeId),list=p.sweep[axis==='X'?'xSegments':'pSegments'];
  if(index<0||index>=list.length)throw Error('Sweep segment missing');
  if(list.length<=1)throw Error('At least one segment must remain');
  list.splice(index,1);
  if(index>0)connectFollowingSegments(list,index-1);
  return validate(s);
 }
 // Core owns the canonical DataTable buffer and the drawing engine.
 // A curve reads bounded, immutable column slices instead of copying a whole
 // Artifact with artifacts.get(). Display decimation never changes raw data.
 function curvesFromArtifacts(refs,store,{maxRead=65536,maxDisplay=8192,axis='iv'}={}){
  const out=[];
  if(!Array.isArray(refs)||!store?.columnMetadata||!store?.readColumnRange)return out;
  const budget=Math.max(1,Math.min(65536,Math.floor(Number(maxRead)||65536)));
  const display=Math.max(4,Math.min(16384,Math.floor(Number(maxDisplay)||8192)));
  for(const ref of refs){
   if(!ref||!ref.artifactId||ref.excluded===true)continue;
   const id=String(ref.artifactId),cols=store.columnMetadata(id);
   if(!Array.isArray(cols)||!cols.length)continue;
   const norm=c=>String(c.key||c.name||c.id||'').toLowerCase().replace(/[^a-z0-9]/g,'');
   const choose=(keys,role,allowRole=true)=>cols.find(c=>keys.includes(norm(c)))||
    (allowRole?cols.find(c=>c.role===role):null);
   const xkeys={
    iv:['drainvoltagev','vdset','vd','voltage','vds','drainvoltage','x'],
    transfer:['gatevoltagev','vg','vgs','gatevoltage'],
    it:['times','time','elapsedseconds','seconds','t']
   };
   if(!Object.prototype.hasOwnProperty.call(xkeys,axis))throw Error('Unknown graph axis');
   const x=choose(xkeys[axis],'x',axis==='iv');
   const y=choose(['draincurrenta','id','current','ids','i','draincurrent','y'],'y');
      if(!x||!y||x===y)continue;
   const total=Math.min(Number(x.length)||0,Number(y.length)||0);
   if(!Number.isSafeInteger(total)||total<=0)continue;
   // Span the entire raw table, not just the first 65536 rows. All accesses
   // use the DKDS Data Center bounded column-read interface; no artifacts.get().
   const limit=Math.min(budget,total);
   const windows=total<=limit?1:Math.min(32,Math.max(2,Math.ceil(total/limit)));
   const baseSize=Math.floor(limit/windows),extra=limit%windows;
   const spans=[];
   let cursor=0;
   for(let i=0;i<windows;i++){
    const size=baseSize+(i<extra?1:0);
    if(!size)continue;
    const ideal=windows===1?0:Math.round(i*(total-size)/(windows-1));
    const start=Math.max(cursor,Math.min(total-size,ideal));
    spans.push({start,limit:size});
    cursor=start+size;
   }
   const sampled=[];
   let readRows=0;
   for(const span of spans){
    const xc=store.readColumnRange(id,x.id||x.key,span);
    const yc=store.readColumnRange(id,y.id||y.key,span);
    const isColumn=v=>Array.isArray(v)||ArrayBuffer.isView(v);
    if(!isColumn(xc?.values)||!isColumn(yc?.values))continue;
    const count=Math.min(span.limit,xc.values.length,yc.values.length);
    readRows+=count;
    for(let j=0;j<count;j++){
     const vx=Number(xc.values[j]),vy=Number(yc.values[j]);
     if(Number.isFinite(vx)&&Number.isFinite(vy))
      sampled.push({index:span.start+j,point:{x:vx,y:vy}});
    }
   }
   if(!sampled.length)continue;
   const chosen=[],seen=new Set();
   function keep(entry){
    if(entry&&!seen.has(entry.index)){seen.add(entry.index);chosen.push(entry);}
   }
   // Chronological min/max decimation retains local extrema of the rows
   // actually inspected. Unsampled gaps are NEVER represented as full coverage.
   keep(sampled[0]);
   const groups=Math.max(1,Math.floor((display-2)/2));
   const groupStep=Math.max(1,Math.ceil(sampled.length/groups));
   for(let start=0;start<sampled.length;start+=groupStep){
    const block=sampled.slice(start,start+groupStep);
    let lo=block[0],hi=block[0];
    for(const point of block){
     if(point.point.y<lo.point.y)lo=point;
     if(point.point.y>hi.point.y)hi=point;
    }
    for(const entry of [lo,hi].sort((a,b)=>a.index-b.index))keep(entry);
   }
   keep(sampled[sampled.length-1]);
   chosen.sort((a,b)=>a.index-b.index);
   const partial=readRows<total;
   out.push({id,artifactId:id,label:String(ref.name||id)+
     (partial?' (preview '+readRows+'/'+total+')':''),
    points:chosen.map(x=>x.point),
    source:{artifactId:id,kind:'dkds-artifact-bounded-preview',
     totalRows:total,readRows,displayRows:chosen.length,truncated:partial,
     coverage:partial?'stratified-intervals':'all-rows',
     windows:spans.map(x=>({start:x.start,rows:x.limit}))}});
  }
  return out;
 }
 const api=Object.freeze({KINDS,initial,validate,add,addDevice,selectDevice,addRoutine,selectRoutine,setRoutineLoops,addSpec,associateSpec,remove,select,editPage,editDevice,editTarget,addTarget,removeTarget,addVariable,editVariable,removeVariable,edit,editSweep,editSegment,addSegment,removeSegment,summary,pointAt,visible:p=>p.terminals.filter(t=>!['None','GNDU'].includes(t.resource)),curvesFromArtifacts});
 window.DKDSPluginModules.define('com.dkts.keithley-4200','model',api,{replace:true});
})();
