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
 const ports=()=>['D','G','S','B'].map((logical,i)=>({
  logical,resource:'None',sourceMode:'voltage',role:i===1?'X':'CONDITION',
  bias:'0',start:'0',stop:'2',step:'0.1',compliance:'0.01',rangeMode:'auto',rangeValue:'1e-6'
 }));
 const page=(kind='iv',id='page-1')=>{
  const type=KINDS.find(x=>x.id===kind);if(!type)throw Error('Unknown test type');
  return {id,kind,name:type.label,testType:type.testType,terminals:ports()};
 };
 const initial=()=>({schema:1,sequence:1,activeId:'page-1',pages:[page()]});
 function validate(state){
  if(state?.schema!==1||!Array.isArray(state.pages)||!state.pages.length||
     state.pages.length>128||!Number.isSafeInteger(state.sequence)||state.sequence<1)
   throw Error('Invalid DKTS project state');
  const ids=new Set();
  for(const p of state.pages){
   if(!/^page-[1-9]\d*$/.test(p?.id||'')||ids.has(p.id)||!KINDS.some(k=>k.id===p.kind)||
      !Array.isArray(p.terminals)||p.terminals.length!==4)throw Error('Invalid Page');
   ids.add(p.id);
   for(const t of p.terminals){
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
  }
  if(!ids.has(state.activeId))throw Error('Active Page missing');
  return clone(state);
 }
 function add(s,kind){
  s=validate(s);const id='page-'+(s.sequence+1);
  s.sequence++;s.pages.push(page(kind,id));s.activeId=id;return validate(s);
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
  if(values.sourceMode){t.rangeMode='auto';t.rangeValue=values.sourceMode==='current'?'2':'1e-6';}
  if(values.resource==='None')t.role='CONDITION';
  if(values.role&&values.role!=='CONDITION')for(const other of p.terminals)
   if(other!==t&&other.role===values.role)other.role='CONDITION';
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
 const api=Object.freeze({KINDS,initial,validate,add,select,edit,visible:p=>p.terminals.filter(t=>t.resource!=='None'),curvesFromArtifacts});
 window.DKDSPluginModules.define('com.dkts.keithley-4200','model',api);
})();