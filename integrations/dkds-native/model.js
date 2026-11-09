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
    for(const key of ['bias','start','stop','step','compliance','rangeValue'])
     if(!Number.isFinite(Number(t[key])))throw Error('Invalid numeric input');
    if(Number(t.compliance)<=0||Number(t.step)===0)throw Error('Invalid limit/step');
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
 const api=Object.freeze({KINDS,initial,validate,add,select,edit,visible:p=>p.terminals.filter(t=>t.resource!=='None')});
 window.DKDSPluginModules.define('com.dkts.keithley-4200','model',api);
})();