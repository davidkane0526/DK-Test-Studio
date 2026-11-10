(() => {
 'use strict';
 const KINDS=Object.freeze([
  {id:'iv',label:'I–V Sweep',testType:'DC'},
  {id:'transfer',label:'Transfer Sweep',testType:'DC'},
  {id:'time',label:'Time Sweep',testType:'IVT'},
  {id:'pulse',label:'Pulse Sweep',testType:'Pulse'},
  {id:'cv',label:'C–V Sweep',testType:'CV'}
 ]);
 const clone=x=>JSON.parse(JSON.stringify(x));
 // Offline scan structure mirrors the nested Xsweep/Psweep programming model.
 // No field in this project state authorizes or sends an instrument command.
 const segment=(mode='voltage',axis='X')=>({
  start:'0',stop:axis==='P'?'1':mode==='current'?'0.01':'2',
  step:mode==='current'?'0.001':'0.1',delayMs:'20',range:'auto'
 });
 const defaultSweep=()=>({
  loops:'1',xRepeats:'1',pRepeats:'1',pEnabled:false,
  xSegments:[segment()],pSegments:[segment('voltage','P')]
 });
 const sweepKeys=Object.freeze(['loops','xRepeats','pRepeats','pEnabled']);
 const segmentKeys=Object.freeze(['start','stop','step','delayMs','range']);
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
  if(a!==b&&Math.sign(b-a)!==Math.sign(step))throw Error('SWEEP_DIRECTION: step direction differs from endpoint');
  const count=a===b?1:Math.floor(Math.abs((b-a)/step)+1e-9)+1;
  if(!Number.isSafeInteger(count)||count<1)throw Error('SWEEP_POINTS: segment point count overflow');
  return count;
 }
 function validateSweep(p){
  const defaults=defaultSweep();
  p.sweep={...defaults,...(p.sweep||{})};
  const sw=p.sweep;
  for(const key of ['loops','xRepeats','pRepeats'])positiveInt(sw[key],10000,key);
  if(typeof sw.pEnabled!=='boolean')throw Error('Invalid Psweep enable state');
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
    if(Number(row.step)===0||Number(row.delayMs)<0)throw Error('Invalid sweep step/delay');
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
  const x=p.terminals.find(t=>t.resource!=='None'&&t.role==='X');
  const second=scan.pEnabled;
  const parallel=p.terminals.find(t=>t.resource!=='None'&&t.role==='P');
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
 const ports=()=>['D','G','S','B'].map((logical,i)=>({
  logical,resource:'None',sourceMode:'voltage',role:i===0?'X':'CONDITION',
  bias:'0',start:'0',stop:'2',step:'0.1',compliance:'0.01',rangeMode:'auto',rangeValue:'1e-6'
 }));
 const page=(kind='iv',id='page-1')=>{
  const type=KINDS.find(x=>x.id===kind);if(!type)throw Error('Unknown test type');
  return {id,kind,name:type.label,testType:type.testType,terminals:ports(),sweep:defaultSweep()};
 };
 const initial=()=>({schema:1,sequence:1,activeId:'page-1',pages:[page()]});
 function validate(state){
  if(state?.schema!==1||!Array.isArray(state.pages)||!state.pages.length||
     state.pages.length>128||!Number.isSafeInteger(state.sequence)||state.sequence<1)
   throw Error('Invalid DKTS project state');
  state=clone(state);
  const ids=new Set();
  for(const p of state.pages){
   if(!/^page-[1-9]\d*$/.test(p?.id||'')||ids.has(p.id)||!KINDS.some(k=>k.id===p.kind)||
      !Array.isArray(p.terminals)||p.terminals.length!==4)throw Error('Invalid Page');
   ids.add(p.id);
   const resources=new Set(),roles=new Set(),logicals=new Set();
   for(const t of p.terminals){
    if(logicals.has(t.logical))throw Error('Duplicate logical terminal: '+t.logical);
    logicals.add(t.logical);
    if(t.resource!=='None'){
     if(resources.has(t.resource))throw Error('Duplicate SMU assignment: '+t.resource);
     resources.add(t.resource);
     if(t.role!=='CONDITION'){
      if(roles.has(t.role))throw Error('Duplicate sweep role: '+t.role);
      roles.add(t.role);
     }
    }
    if(!['D','G','S','B'].includes(t.logical)||!/^None$|^SMU[1-8]$/.test(t.resource)||
       !['voltage','current'].includes(t.sourceMode)||!['CONDITION','X','P'].includes(t.role)||
       !['auto','minimum','fixed'].includes(t.rangeMode)||
       (t.rangeMode==='minimum'&&t.sourceMode!=='voltage'))throw Error('Invalid port mapping');
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
  if(!ids.has(state.activeId))throw Error('Active Page missing');
  return state;
 }
 function add(s,kind){
  s=validate(s);const id='page-'+(s.sequence+1);
  s.sequence++;s.pages.push(page(kind,id));s.activeId=id;return validate(s);
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
  s.activeId=id;return s;
 }
 function edit(s,logical,values){
  s=validate(s);
  const p=s.pages.find(x=>x.id===s.activeId),t=p.terminals.find(x=>x.logical===logical);
  if(!t||!values||Object.keys(values).some(key=>![
   'resource','sourceMode','role','bias','start','stop','step','compliance','rangeMode','rangeValue'
  ].includes(key)))throw Error('Invalid terminal change');
  Object.assign(t,values);
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
  if(values.resource==='None')t.role='CONDITION';
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
  return validate(s);
 }
 function editSegment(s,axis,index,changes){
  s=validate(s);
  if(!['X','P'].includes(axis)||!Number.isInteger(index)||!changes||
     Object.keys(changes).some(k=>!segmentKeys.includes(k)))throw Error('Invalid sweep segment change');
  const p=s.pages.find(x=>x.id===s.activeId),list=p.sweep[axis==='X'?'xSegments':'pSegments'];
  if(index<0||index>=list.length)throw Error('Sweep segment missing');
  Object.assign(list[index],changes);
  return validate(s);
 }
 function addSegment(s,axis){
  s=validate(s);
  if(!['X','P'].includes(axis))throw Error('Unknown sweep axis');
  const p=s.pages.find(x=>x.id===s.activeId),list=p.sweep[axis==='X'?'xSegments':'pSegments'];
  if(list.length>=64)throw Error('Maximum 64 segments per axis');
  const terminal=p.terminals.find(t=>t.role===axis&&t.resource!=='None');
  const next=segment(terminal?.sourceMode||'voltage',axis);
  const last=list[list.length-1];
  next.start=last.stop;
  next.stop=next.start;
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
  return validate(s);
 }
 // Core owns the canonical DataTable buffer and the drawing engine.
 // A curve reads bounded, immutable column slices instead of copying a whole
 // Artifact with artifacts.get(). Display decimation never changes raw data.
 function curvesFromArtifacts(refs,store,{maxRead=65536,maxDisplay=8192}={}){
  const out=[];
  if(!Array.isArray(refs)||!store?.columnMetadata||!store?.readColumnRange)return out;
  const budget=Math.max(1,Math.min(65536,Math.floor(Number(maxRead)||65536)));
  const display=Math.max(4,Math.min(16384,Math.floor(Number(maxDisplay)||8192)));
  for(const ref of refs){
   if(!ref||!ref.artifactId||ref.excluded===true)continue;
   const id=String(ref.artifactId),cols=store.columnMetadata(id);
   if(!Array.isArray(cols)||!cols.length)continue;
   const norm=c=>String(c.key||c.name||c.id||'').toLowerCase().replace(/[^a-z0-9]/g,'');
   const choose=(keys,role)=>cols.find(c=>keys.includes(norm(c)))||
    cols.find(c=>c.role===role);
   const x=choose(['vdset','vd','voltage','vds','vg','vgs','time','t','x'],'x');
   const y=choose(['id','current','ids','i','y'],'y');
   if(!x||!y||x===y)continue;
   const total=Math.min(Number(x.length)||0,Number(y.length)||0);
   if(total<=0)continue;
   const limit=Math.min(budget,total);
   const xc=store.readColumnRange(id,x.id||x.key,{start:0,limit});
   const yc=store.readColumnRange(id,y.id||y.key,{start:0,limit});
   if(!xc||!yc||!Array.isArray(xc.values)||!Array.isArray(yc.values))continue;
   const count=Math.min(limit,xc.values.length,yc.values.length),pts=[];
   if(!count)continue;
   const step=Math.max(1,Math.ceil(count/Math.max(1,Math.floor(display/2))));
   for(let start=0;start<count;start+=step){
    const end=Math.min(count,start+step);
    let lo=null,hi=null;
    for(let i=start;i<end;i++){
     const vx=Number(xc.values[i]),vy=Number(yc.values[i]);
     if(!Number.isFinite(vx)||!Number.isFinite(vy))continue;
     const point={x:vx,y:vy};
     if(!lo||point.y<lo.point.y)lo={index:i,point};
     if(!hi||point.y>hi.point.y)hi={index:i,point};
    }
    for(const entry of [lo,hi].filter(Boolean).sort((a,b)=>a.index-b.index)){
     if(!pts.length||pts[pts.length-1].index!==entry.index)pts.push(entry);
    }
   }
   if(!pts.length)continue;
   const points=pts.map(entry=>entry.point);
   const partial=total>limit;
   out.push({id,artifactId:id,label:String(ref.name||id)+(partial?' (preview '+limit+'/'+total+')':''),
    points,source:{artifactId:id,kind:'dkds-artifact-bounded-preview',
     totalRows:total,readRows:count,displayRows:points.length,truncated:partial}});
  }
  return out;
 }
 const api=Object.freeze({KINDS,initial,validate,add,remove,select,edit,editSweep,editSegment,addSegment,removeSegment,summary,visible:p=>p.terminals.filter(t=>t.resource!=='None'),curvesFromArtifacts});
 window.DKDSPluginModules.define('com.dkts.keithley-4200','model',api);
})();